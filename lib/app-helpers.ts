import { createClient } from '@supabase/supabase-js';

import type { Problem } from '@/types/app';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const browserSupabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

export const getProblemId = (problem: Problem): string => {
  const numberPart = problem.number ?? 'unknown';
  return `${numberPart}::${problem.question}`;
};

export const isSolvedMessage = (message: string): boolean =>
  ['正解', 'せいかい', 'Correct!', 'correct!', 'right!'].some((phrase) =>
    message.includes(phrase),
  );
