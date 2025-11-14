import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const textPrompt = `「${question}」という日本の小学生向けの算数の問題に似た問題を1つだけ作成してください。数字や内容は変えてください。結果はJSON形式で、'question'というキーに問題文のみを入れてください。`;

    const textResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: textPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "生成された類似問題文" }
          },
          required: ["question"]
        }
      }
    });
    if (!textResponse.text) {
      return NextResponse.json({ error: 'No response text' }, { status: 500 });
    }
    const result = JSON.parse(textResponse.text);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Similar problem API error:', error);
    return NextResponse.json({ error: 'Failed to generate similar problem' }, { status: 500 });
  }
}