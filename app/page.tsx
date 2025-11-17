'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TEACHER_PROMPT } from '../prompts';

// --- Type Definitions ---
type Problem = {
  number: string | null;
  question: string;
};
type AppState = 'upload' | 'solving';
type ChatMessage = {
    role: 'user' | 'model';
    text: string;
    hint?: string;
    isLoading?: boolean;
};

// --- Helper Functions ---

/**
 * Extracts a JSON string from a markdown code block.
 */
const extractJsonFromMarkdown = (text: string): string => {
  const match = text.match(/```(json)?\s*([\s\S]*?)\s*```/);
  if (match && match[2]) {
    return match[2];
  }
  return text;
};

/**
 * Converts a File object to a Base64 encoded string.
 */
const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

// --- UI Components ---

const LoadingSpinner: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center text-stone-600">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-orange-400"></div>
        <p className="mt-4 text-2xl font-semibold">{message}</p>
    </div>
);

const MicIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
);

const RecordingIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);

const CorrectionSpinner: React.FC = () => (
    <div className="w-6 h-6 border-2 border-dashed rounded-full animate-spin border-stone-600"></div>
);

const HighlightedText: React.FC<{ text: string; keywords: string[] }> = ({ text, keywords }) => {
    if (!keywords || keywords.length === 0) {
        return <>{text}</>;
    }

    try {
        const regex = new RegExp(`(${keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
        const parts = text.split(regex);

        return (
            <>{parts.map((part, i) =>
                keywords.some(kw => part.toLowerCase() === kw.toLowerCase()) ? (
                    <mark key={i} className="bg-yellow-200 rounded px-1">
                        {part}
                    </mark>
                ) : ( part )
            )}</>
        );
    } catch (e) {
        console.error("Error creating regex for highlighting:", e);
        return <>{text}</>;
    }
};

// --- Main Application Component ---

const App: React.FC = () => {
  // --- State Management ---
  const [appState, setAppState] = useState<AppState>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [ocrResults, setOcrResults] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userMessage, setUserMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showSimilarProblemButton, setShowSimilarProblemButton] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isCorrecting, setIsCorrecting] = useState<boolean>(false);
  const [highlightKeywords, setHighlightKeywords] = useState<string[]>([]);

  // --- Refs ---
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null); // For SpeechRecognition instance

  // --- Effects ---
  useEffect(() => {
    // Scroll to the bottom of the chat history when new messages are added
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  useEffect(() => {
    // Cleanup SpeechRecognition instance on component unmount
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // --- Core API Functions ---

  const handleImageChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setError('ファイルが選択されていません。');
      return;
    }

    setIsLoading(true);
    setError('');
    setSelectedProblem(null);
    setOcrResults([]);

    let processedFile = file;

    const isHeic = file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic');
    if (isHeic && (window as any).heic2any) {
        setLoadingMessage('HEIC画像を変換中…');
        try {
            const conversionResult = await (window as any).heic2any({
                blob: file, toType: "image/jpeg", quality: 0.8,
            });
            const convertedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
            processedFile = new File([convertedBlob], file.name.replace(/\.[^/.]+$/, ".jpeg"), { type: convertedBlob.type });
        } catch (conversionError) {
            console.error("HEIC Conversion Error:", conversionError);
            setError('ごめんね、しゃしんの変換に失敗しました。別の形式で試してみてね。');
            setIsLoading(false);
            return;
        }
    }

    console.log('📋 Starting image processing...');
    setLoadingMessage('プリント読み込み中…');
    setImageFile(processedFile);
    setImageUrl(URL.createObjectURL(processedFile));
    console.log('✅ Image URL created:', URL.createObjectURL(processedFile));

    try {
      console.log('🔄 Converting file to generative part...');
      const imagePart = await fileToGenerativePart(processedFile);
      console.log('✅ Image part created:', {
        hasData: !!imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType,
        dataLength: imagePart.inlineData.data?.length
      });

      const textPart = { text: `この画像から、小学生向けの算数の問題文を抽出してください。問題番号もあれば一緒に抽出してください。結果をJSON形式で返してください。各 문제는 'number' (問題番号、なければnull) と 'question' (問題文) のキーを持つオブジェクトにしてください。例: { "problems": [ { "number": "1", "question": "3 + 5 =" } ] }` };

      // Call API route for OCR
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }),
      });

      if (!response.ok) {
        throw new Error('OCR API failed');
      }

      const result = await response.json();
      console.log('✅ Parsed result:', result);
      setOcrResults(result.problems || []);
      setAppState('solving');
    } catch (err) {
      console.error("❌ OCR Error:", err);
      console.error("Error details:", err);
      setError(`ごめんね、プリントから問題を見つけられなかったみたい。別のしゃしんで試してみてね。
      ${err}`);
      setAppState('upload');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSendMessage = useCallback(async (messageOverride?: string) => {
    const message = messageOverride || userMessage;
    if (!message.trim()) return;

    setUserMessage('');
    setChatHistory(prev => [...prev, { role: 'user', text: message }]);
    setChatHistory(prev => [...prev, { role: 'model', text: '先生が考え中…', isLoading: true }]);
    setShowSimilarProblemButton(false);
    setHighlightKeywords([]);

    try {
        // Call API route for chat
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, problem: selectedProblem?.question, chatHistory }),
        });

        if (!response.ok) {
          throw new Error('Chat API failed');
        }

        const result = await response.json();
        setChatHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = { role: 'model', text: result.teacher, hint: result.hint };
          return newHistory;
        });
        setHighlightKeywords(result.highlight || []);

        if (result.teacher.includes('正解') || result.teacher.includes('せいかい')) {
          setShowSimilarProblemButton(true);
        }
    } catch(err) {
        console.error("Chat Error:", err);
        setChatHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = { role: 'model', text: 'ごめんなさい、通信がうまくいかなかったようです。' };
          return newHistory;
        });
        setHighlightKeywords([]);
    }

  }, [userMessage, selectedProblem, chatHistory]);

  const generateSimilarProblem = useCallback(async () => {
    if (!selectedProblem) return;

    setIsLoading(true);
    setLoadingMessage('類題を作成中…');
    setShowSimilarProblemButton(false);
    setChatHistory([]);
    setHighlightKeywords([]);

    try {
        // Call API route for similar problem
        const response = await fetch('/api/similar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: selectedProblem.question }),
        });

        if (!response.ok) {
          throw new Error('Similar problem API failed');
        }

        const result = await response.json();
        const newProblem: Problem = { number: '類題', question: result.question };

        await startChat(newProblem);

    } catch (err) {
      console.error("Similar Problem Generation Error:", err);
      setError('ごめんなさい、類題をうまく作れませんでした。');
    } finally {
        setIsLoading(false);
    }
}, [selectedProblem]);

  const handleToggleListening = useCallback(async () => {
    if (isListening) {
        recognitionRef.current?.stop();
        return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        setError('ごめんなさい、お使いのブラウザは音声入力に対応していません。');
        return;
    }

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => { setIsListening(true); setUserMessage(''); setError(''); };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') setError('音声の聞き取りに失敗しました。');
        setIsListening(false);
    };

    recognition.onresult = async (event: any) => {
        const rawText = event.results[0][0].transcript;
        if (!rawText) return;
        setIsCorrecting(true);
        try {
            // Call API route for speech correction
            const response = await fetch('/api/correct', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: rawText }),
            });

            if (!response.ok) {
              throw new Error('Correction API failed');
            }

            const result = await response.json();
            setUserMessage(result.correctedText);
        } catch(err) {
            console.error("Speech correction error:", err);
            setUserMessage(rawText);
        } finally {
            setIsCorrecting(false);
        }
    };
    recognition.start();
  }, [isListening]);

  const startChat = useCallback(async (problem: Problem) => {
    setSelectedProblem(problem);
    setChatHistory([]);
    setHighlightKeywords([]);
    setShowSimilarProblemButton(false);

    setChatHistory([{ role: 'model', text: '先生が考え中…', isLoading: true }]);

    try {
        // Call API route for initial chat
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'この問題について教えてください。', problem: problem.question, chatHistory: [] }),
        });

        if (!response.ok) {
          throw new Error('Initial chat API failed');
        }

        const result = await response.json();
        setChatHistory([{ role: 'model', text: result.teacher, hint: result.hint }]);
        setHighlightKeywords(result.highlight || []);
    } catch(err) {
        console.error("Chat Start Error:", err);
        setChatHistory([{ role: 'model', text: 'ごめんなさい、通信がうまくいかなかったようです。' }]);
        setHighlightKeywords([]);
    }
  }, []);

  const resetState = () => {
    setAppState('upload');
    setImageFile(null);
    setImageUrl('');
    setOcrResults([]);
    setSelectedProblem(null);
    setChatHistory([]);
    setUserMessage('');
    setIsLoading(false);
    setError('');
    setShowSimilarProblemButton(false);
  };

  return (
    <div className="h-screen bg-[#fffefc] text-stone-800 flex flex-col items-center p-4 sm:p-6 overflow-hidden">
      {appState === 'upload' && (
        <header className="w-full max-w-6xl mb-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-500">わかるまで</h1>
        </header>
      )}

      <main className={`w-full max-w-6xl h-full flex flex-col items-center ${(isLoading || appState === 'upload') ? 'justify-center' : ''}`}>
        {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 w-full" role="alert">
                <p>{error}</p>
            </div>
        )}

        {appState === 'upload' && !isLoading && (
            <div>
                <input type="file" id="file-upload" accept="image/*,.heic" capture="environment" onChange={handleImageChange} className="hidden" />
                <label htmlFor="file-upload" className="cursor-pointer inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-full text-xl shadow-md transition-transform transform hover:scale-105">
                    写真をとる
                </label>
            </div>
        )}

        {isLoading && <LoadingSpinner message={loadingMessage} />}

        {appState === 'solving' && !isLoading && (
            <div className="w-full h-full flex flex-col md:flex-row gap-6">

              <div className="md:w-3/5 flex items-center justify-center">
                  {selectedProblem?.number === '類題' ? (
                      <div className="text-4xl font-bold text-center text-stone-800 p-4">
                          {selectedProblem.question}
                      </div>
                  ) : (
                      imageUrl && <img src={imageUrl} alt="Uploaded worksheet" className="w-full h-auto object-contain rounded-lg max-h-[80vh]" />
                  )}
              </div>

              <div className="md:w-2/5 flex flex-col h-full pb-8">
                  {!selectedProblem && ocrResults.length > 0 && (
                      <div className="flex flex-col h-full">
                          <h2 className="text-2xl font-bold mb-4 text-stone-800">もんだいを選びましょう</h2>
                          <div className="overflow-y-auto flex-grow">
                              <ul className="space-y-3">
                                  {ocrResults.map((problem, index) => (
                                      <li key={index} onClick={() => startChat(problem)} className="p-4 bg-stone-50 hover:bg-orange-100 rounded-lg cursor-pointer transition-colors border border-stone-200">
                                          <span className="font-bold text-orange-500 mr-3">{problem.number || '？'}</span>
                                          <span className="text-lg">{problem.question}</span>
                                      </li>
                                  ))}
                              </ul>
                          </div>
                          <button onClick={resetState} className="mt-4 bg-stone-500 hover:bg-stone-600 text-white font-bold py-2 px-4 rounded-full transition-colors self-start">はじめからやり直す</button>
                      </div>
                  )}

                  {selectedProblem && (
                    <div className="flex flex-col h-full max-h-[90vh]">
                        <div className="flex-grow overflow-y-auto mb-4 pr-2 space-y-4">
                            {chatHistory.map((msg, index) => (
                                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-md lg:max-w-xl ${msg.role === 'user' ? 'text-right' : ''}`}>
                                        {msg.isLoading ? (
                                            <LoadingSpinner message="" />
                                        ) : (
                                            <p className={`whitespace-pre-wrap text-lg font-semibold ${msg.role === 'user' ? 'text-blue-900' : 'text-red-900'}`}>{msg.text}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatBottomRef} />
                        </div>
                        <div className="mt-auto pt-4 border-t">
                            {showSimilarProblemButton && (
                                <button onClick={generateSimilarProblem} className="w-full mb-3 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full transition-colors">似た問題にチャレンジ！</button>
                            )}
                            <div className="flex items-center gap-2">
                                <textarea value={userMessage} onChange={(e) => setUserMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="先生へのメッセージ" className="flex-grow p-3 border-2 border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400" rows={2} disabled={isLoading} />
                                <button onClick={handleToggleListening} disabled={isLoading || isCorrecting} className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-200' : 'bg-stone-200 hover:bg-stone-300'}`}>
                                    {isCorrecting ? <CorrectionSpinner /> : (isListening ? <RecordingIcon /> : <MicIcon />)}
                                </button>
                                <button onClick={() => handleSendMessage()} disabled={isLoading || !userMessage.trim()} className="bg-orange-500 hover:bg-orange-600 text-white font-bold p-3 rounded-full disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                             <div className="flex justify-between mt-3">
                                 <button onClick={() => setSelectedProblem(null)} className="bg-stone-500 hover:bg-stone-600 text-white font-bold py-2 px-4 rounded-full transition-colors">← 別の問題を選ぶ</button>
                                 <button onClick={resetState} className="bg-stone-500 hover:bg-stone-600 text-white font-bold py-2 px-4 rounded-full transition-colors">はじめからやり直す →</button>
                             </div>
                        </div>
                    </div>
                  )}
              </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;