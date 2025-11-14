import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { imageData, mimeType } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const imagePart = {
      inlineData: { data: imageData, mimeType },
    };

    const textPart = { text: `この画像から、小学生向けの算数の問題文を抽出してください。問題番号もあれば一緒に抽出してください。結果をJSON形式で返してください。各問題は 'number' (問題番号、なければnull) と 'question' (問題文) のキーを持つオブジェクトにしてください。例: { "problems": [ { "number": "1", "question": "3 + 5 =" } ] }` };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [imagePart, textPart] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT, properties: {
            problems: {
              type: Type.ARRAY, items: {
                type: Type.OBJECT, properties: {
                  number: { type: Type.STRING, description: "問題番号。なければnull" },
                  question: { type: Type.STRING, description: "問題文" }
                }, required: ["question"]
              }
            }
          }, required: ["problems"]
        }
      }
    });
    if (!response.text) {
      return NextResponse.json({ error: 'No response text' }, { status: 500 });
    }
    const result = JSON.parse(response.text);
    return NextResponse.json(result);
  } catch (error) {
    console.error('OCR API error:', error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}