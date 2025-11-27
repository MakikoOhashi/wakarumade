import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { TEACHER_PROMPT, TEACHER_PROMPT_EN, SUMMARY_PROMPT, SUMMARY_PROMPT_EN } from '../../../prompts';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const guestId = request.headers.get("x-guest-id");
    if (!guestId) {
      return NextResponse.json({ error: "missing guest id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { "x-guest-id": guestId } }
      }
    );

    const { message, problem, problemId, chatHistory, language } = await request.json();
    const effectiveProblemId = problemId ?? problem ?? 'unknown-problem';

    // Load existing chat history from database
    let existingHistory = [];
    const { data: existingLog } = await supabase
      .from('guest_chat_logs')
      .select('log, summary, problem_id')
      .eq('guest_id', guestId)
      .eq('problem_id', effectiveProblemId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let historySource: any | null = existingLog ?? null;

    // Fallback for legacy rows without problem_id (or mismatched IDs)
    if (!historySource && problem) {
      const snippet = problem.substring(0, Math.min(50, problem.length));
      if (snippet) {
        const { data: legacyLogs } = await supabase
          .from('guest_chat_logs')
          .select('log, summary, problem_id')
          .eq('guest_id', guestId)
          .order('created_at', { ascending: false })
          .limit(5);

        historySource = legacyLogs?.find((entry: any) =>
          entry.summary?.includes(snippet)
        );
      }
    }

    if (historySource?.log) {
      existingHistory = historySource.log;
    } else if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      // Fallback to client-provided history to avoid losing context
      existingHistory = chatHistory
        .filter((entry: any) => entry.role === 'user' || entry.role === 'model' || entry.role === 'assistant')
        .map((entry: any) => ({
          role: entry.role === 'user' ? 'user' : 'assistant',
          content: entry.text ?? entry.content ?? '',
          timestamp: entry.timestamp ?? new Date().toISOString(),
        }));
    }

    // Combine existing history with new message
    const fullHistory = [...existingHistory, { role: 'user', content: message, timestamp: new Date().toISOString() }];

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Prepare conversation history for AI (excluding timestamps and filtering valid roles)
    const conversationHistory = existingHistory
      .filter((entry: any) => entry.role === 'user' || entry.role === 'assistant')
      .map((entry: any) => ({
        role: entry.role === 'user' ? 'user' : 'model',
        parts: [{ text: entry.content }]
      }));

    // Create chat session with history
    const prompt = language === 'en' ? TEACHER_PROMPT_EN : TEACHER_PROMPT;
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: `${prompt}\n\n# Problem Text:\n${problem}` },
      history: conversationHistory,
    });

    // Send message
    const response = await chat.sendMessage({ message });

    // Extract JSON from response
    if (!response.text) {
      return NextResponse.json({ error: 'No response text' }, { status: 500 });
    }
    
    let result;
    // Try to extract JSON from markdown code block first
    const jsonMatch = response.text.match(/```(json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        result = JSON.parse(jsonMatch[2]);
      } catch (e) {
        console.error('Failed to parse JSON from code block:', e);
        result = { teacher: response.text, hint: '', highlight: [] };
      }
    } else {
      // Try to parse as JSON directly (in case AI returns JSON without code block)
      try {
        const trimmedText = response.text.trim();
        // Check if it looks like JSON (starts with { and ends with })
        if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
          result = JSON.parse(trimmedText);
        } else {
          result = { teacher: response.text, hint: '', highlight: [] };
        }
      } catch (e) {
        // Not valid JSON, treat as plain text
        result = { teacher: response.text, hint: '', highlight: [] };
      }
    }

    // Update chat history
    const updatedHistory = [...fullHistory, { role: 'assistant', content: result.teacher, timestamp: new Date().toISOString() }];

    // Generate summary using AI
    let summaryText = '';
    try {
      const summarySystemPrompt = language === 'en' ? SUMMARY_PROMPT_EN : SUMMARY_PROMPT;
      const summaryChat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction: summarySystemPrompt },
      });

      const conversationText = updatedHistory
        .filter((entry: any) => entry.role === 'user' || entry.role === 'assistant')
        .map((entry: any) => `${entry.role === 'user' ? (language === 'en' ? 'Student' : '生徒') : (language === 'en' ? 'Teacher' : '先生')}: ${entry.content}`)
        .join('\n');

      const summaryPrompt = language === 'en'
        ? `Problem text: ${problem}\n\nConversation history:\n${conversationText}`
        : `問題文: ${problem}\n\n会話履歴:\n${conversationText}`;

      const summaryResponse = await summaryChat.sendMessage({ message: summaryPrompt });
      if (summaryResponse.text) {
        const summaryJsonMatch = summaryResponse.text.match(/```(json)?\s*([\s\S]*?)\s*```/);
        if (summaryJsonMatch) {
           const summaryData = JSON.parse(summaryJsonMatch[2]);
           summaryText = language === 'en'
             ? `Mistake reason: ${summaryData.mistake_reason}\nArea to strengthen: ${summaryData.strengthen_point}`
             : `間違いの原因: ${summaryData.mistake_reason}\n強化すべきポイント: ${summaryData.strengthen_point}`;
         } else {
           summaryText = language === 'en'
             ? `Chat session for problem: ${problem?.substring(0, 100) ?? 'N/A'}...`
             : `問題のチャットセッション: ${problem?.substring(0, 100) ?? 'N/A'}...`;
         }
      } else {
        summaryText = `Chat session for problem: ${problem?.substring(0, 100) ?? 'N/A'}...`;
      }
    } catch (e) {
      console.error('Summary generation error:', e);
      summaryText = `Chat session for problem: ${problem?.substring(0, 100) ?? 'N/A'}...`;
    }

    // Save to database
    const { error } = await supabase
      .from('guest_chat_logs')
      .upsert({
        guest_id: guestId,
        problem_id: effectiveProblemId,
        log: updatedHistory,
        summary: summaryText
      }, {
        onConflict: 'guest_id,problem_id'
      });

    if (error) {
      console.error('Supabase error:', error);
    }

    return NextResponse.json({ ...result, chatHistory: updatedHistory, guestId });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 });
  }
}