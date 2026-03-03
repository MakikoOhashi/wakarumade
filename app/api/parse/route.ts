import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
以下のOCR抽出テキストから、小学生向け算数の「各問題文」を抽出してください。
- 問題番号があれば number に入れる（なければ null または空文字）
- 問題文は question に入れる
- 余計なヘッダー/フッター（名前欄、日付、"しき/こたえ" など）があれば可能な範囲で除外
- 結果は必ず指定のJSONスキーマに従う
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: `${prompt}\n\n---\nOCR_TEXT:\n${text}` }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            problems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  number: { type: Type.STRING, description: '問題番号。なければnull/空' },
                  question: { type: Type.STRING, description: '問題文' },
                },
                required: ['question'],
              },
            },
          },
          required: ['problems'],
        },
      },
    });

    if (!response.text) {
      return NextResponse.json({ error: 'No response text' }, { status: 500 });
    }

    const result = JSON.parse(response.text);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse text' }, { status: 500 });
  }
}
