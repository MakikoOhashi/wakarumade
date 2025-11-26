import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { TEACHER_PROMPT } from '../../../prompts';
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

    const { message, problem, chatHistory } = await request.json();

    // Load existing chat history from database
    let existingHistory = [];
    const { data: existingLog } = await supabase
      .from('guest_chat_logs')
      .select('log')
      .eq('guest_id', guestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      existingHistory = existingLog.log;
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
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: `${TEACHER_PROMPT}\n\n# Problem Text:\n${problem}` },
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

    // Save to database
    const { error } = await supabase
      .from('guest_chat_logs')
      .upsert({
        guest_id: guestId,
        log: updatedHistory,
        summary: `Chat session for problem: ${problem.substring(0, 100)}...`
      }, {
        onConflict: 'guest_id'
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