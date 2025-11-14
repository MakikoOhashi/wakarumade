import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { problem, message } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `以下の算数の問題について、学生のメッセージに対するヒントを提供してください。

問題: ${problem}
学生のメッセージ: ${message}

ヒントは短く、役立つものにしてください。`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });

    return NextResponse.json({ hint: response.text });
  } catch (error) {
    console.error('Hint API error:', error);
    return NextResponse.json({ error: 'Failed to generate hint' }, { status: 500 });
  }
}