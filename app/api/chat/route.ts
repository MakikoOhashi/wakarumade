import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { TEACHER_PROMPT } from '../../../prompts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { message, problem, chatHistory, sessionId } = await request.json();

    // Load existing chat history from database
    let existingHistory = [];
    if (sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: parseInt(sessionId) },
      });
      if (session) {
        existingHistory = JSON.parse(session.data);
      }
    }

    // Combine existing history with new message
    const fullHistory = [...existingHistory, { role: 'user', content: message }];

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
    const updatedHistory = [...fullHistory, { role: 'assistant', content: result.teacher }];

    // Save to database
    if (sessionId) {
      await prisma.session.upsert({
        where: { id: parseInt(sessionId) },
        update: { data: JSON.stringify(updatedHistory), updatedAt: new Date() },
        create: { id: parseInt(sessionId), userId: 1, data: JSON.stringify(updatedHistory) }, // Assuming userId 1 for now
      });
    }

    return NextResponse.json({ ...result, chatHistory: updatedHistory });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 });
  }
}