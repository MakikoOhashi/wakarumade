import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `あなたは、日本の小学生が話した言葉を、算数の文脈で正しく書き起こす専門家です。数字は半角に、単位は小学生に最も分かりやすい形に直してください。余計な言葉はつけず、整形したテキストだけを返してください。`
      },
    });

    const response = await chat.sendMessage({ message: text });
    if (!response.text) {
      return NextResponse.json({ error: 'No response text' }, { status: 500 });
    }
    return NextResponse.json({ correctedText: response.text.trim() });
  } catch (error) {
    console.error('Correction API error:', error);
    return NextResponse.json({ error: 'Failed to correct text' }, { status: 500 });
  }
}