import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { TEACHER_PROMPT } from '../../../prompts';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { message, problem, chatHistory, guestId } = await request.json();

    // Generate guestId if not provided
    const currentGuestId = guestId || crypto.randomUUID();

    // Load existing chat history from database
    let existingHistory = [];
    if (currentGuestId) {
      const { data: existingLog } = await supabase
        .from('guest_chat_logs')
        .select('log')
        .eq('guest_id', currentGuestId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingLog) {
        existingHistory = existingLog.log;
      }
    }

    // Combine existing history with new message
    const fullHistory = [...existingHistory, { role: 'user', content: message, timestamp: new Date().toISOString() }];

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Create chat session
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: `${TEACHER_PROMPT}\n\n# Problem Text:\n${problem}` },
    });

    // Send message
    const response = await chat.sendMessage({ message });

    // Extract JSON from response
    if (!response.text) {
      return NextResponse.json({ error: 'No response text' }, { status: 500 });
    }
    const jsonMatch = response.text.match(/```(json)?\s*([\s\S]*?)\s*```/);
    let result;
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[2]);
    } else {
      result = { teacher: response.text, hint: '', highlight: [] };
    }

    // Update chat history
    const updatedHistory = [...fullHistory, { role: 'assistant', content: result.teacher, timestamp: new Date().toISOString() }];

    // Save to database
    if (currentGuestId) {
      const { error } = await supabase
        .from('guest_chat_logs')
        .upsert({
          guest_id: currentGuestId,
          log: updatedHistory,
          summary: `Chat session for problem: ${problem.substring(0, 100)}...`
        }, {
          onConflict: 'guest_id'
        });

      if (error) {
        console.error('Supabase error:', error);
      }
    }

    return NextResponse.json({ ...result, chatHistory: updatedHistory, guestId: currentGuestId });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 });
  }
}