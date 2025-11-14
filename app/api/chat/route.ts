import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { TEACHER_PROMPT } from '../../../prompts';

export async function POST(request: NextRequest) {
  try {
    const { message, problem, chatHistory } = await request.json();

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

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 });
  }
}