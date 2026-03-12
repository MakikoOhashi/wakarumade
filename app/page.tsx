'use client';

import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { ChatPanel } from '@/components/app/chat-panel';
import { HighlightedText } from '@/components/app/highlighted-text';
import { LoadingSpinner } from '@/components/app/loading-spinner';
import { ProblemList } from '@/components/app/problem-list';
import { UploadScreen } from '@/components/app/upload-screen';
import { browserSupabase, fileToGenerativePart, getProblemId, isSolvedMessage } from '@/lib/app-helpers';
import { texts } from '@/lib/texts';
import type { AppState, ChatMessage, Language, Problem } from '@/types/app';

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type BrowserWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  heic2any?: (options: {
    blob: File;
    toType: string;
    quality: number;
  }) => Promise<Blob | Blob[]>;
};

export default function App() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [ocrResults, setOcrResults] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userMessage, setUserMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [showSimilarProblemButton, setShowSimilarProblemButton] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [highlightKeywords, setHighlightKeywords] = useState<string[]>([]);
  const [language, setLanguage] = useState<Language>('ja');
  const [guestId, setGuestId] = useState('');
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [personalizedMessage, setPersonalizedMessage] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const hasRestoredSessionRef = useRef(false);

  const uiText = texts[language];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    let storedGuestId = sessionStorage.getItem('wakarumade_guest_id');
    if (!storedGuestId) {
      storedGuestId = crypto.randomUUID();
      sessionStorage.setItem('wakarumade_guest_id', storedGuestId);
    }
    setGuestId(storedGuestId);
  }, []);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('lang');
    if (savedLanguage === 'ja' || savedLanguage === 'en') {
      setLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  useEffect(() => {
    if (!guestId || !browserSupabase || selectedProblem || hasRestoredSessionRef.current) {
      return;
    }

    const supabase = browserSupabase;
    let isMounted = true;

    const restoreSession = async () => {
      setIsRestoringSession(true);
      hasRestoredSessionRef.current = true;

      try {
        const { data, error: restoreError } = await supabase
          .from('guest_chat_logs')
          .select('log, summary, problem_id')
          .eq('guest_id', guestId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (restoreError) {
          console.error('Failed to restore session from Supabase:', restoreError);
          return;
        }

        if (data?.log?.length) {
          const restoredHistory = data.log.map((entry: { role: string; content: string }) => ({
            role: entry.role === 'user' ? 'user' : 'model',
            text: entry.content,
            isLoading: false,
          }));

          setChatHistory(restoredHistory);
          setAppState('solving');
          setImageFile(null);
          setImageUrl('');

          const problemIdParts = data.problem_id?.split('::') || [];
          const number = problemIdParts[0] || 'saved';
          const question = problemIdParts[1] || data.summary || uiText.savedProblem;

          setSelectedProblem({
            number,
            question,
          });
        }
      } catch (restoreError) {
        if (isMounted) {
          console.error('Unexpected error restoring session:', restoreError);
        }
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [guestId, selectedProblem, uiText.savedProblem]);

  const setLanguageAndClearError = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    setError('');
  };

  const handleImageChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        setError(uiText.errorNoFile);
        return;
      }

      setIsLoading(true);
      setError('');
      setSelectedProblem(null);
      setOcrResults([]);
      setPersonalizedMessage(null);

      let processedFile = file;
      const runtimeWindow = window as BrowserWindow;
      const isHeic = file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic');

      if (isHeic && runtimeWindow.heic2any) {
        setLoadingMessage(uiText.loadingConverting);
        try {
          const conversionResult = await runtimeWindow.heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.8,
          });
          const convertedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
          processedFile = new File(
            [convertedBlob],
            file.name.replace(/\.[^/.]+$/, '.jpeg'),
            { type: convertedBlob.type },
          );
        } catch (conversionError) {
          console.error('HEIC Conversion Error:', conversionError);
          setError(uiText.errorConversion);
          setIsLoading(false);
          return;
        }
      }

      setLoadingMessage(uiText.loadingProcessing);
      setImageFile(processedFile);

      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      setImageUrl(URL.createObjectURL(processedFile));

      try {
        const imagePart = await fileToGenerativePart(processedFile);
        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType,
          }),
        });

        if (!response.ok) {
          throw new Error('OCR API failed');
        }

        const result = await response.json();
        setOcrResults(result.problems || []);
        setAppState('solving');
      } catch (ocrError) {
        console.error('OCR Error:', ocrError);
        setError(`${uiText.errorOcr}${ocrError}`);
        setAppState('upload');
      } finally {
        setIsLoading(false);
      }
    },
    [imageUrl, uiText.errorConversion, uiText.errorNoFile, uiText.errorOcr, uiText.loadingConverting, uiText.loadingProcessing],
  );

  const handleSendMessage = useCallback(
    async (messageOverride?: string) => {
      const message = messageOverride || userMessage;
      if (!message.trim() || isSendingMessage) {
        return;
      }

      setUserMessage('');
      setIsSendingMessage(true);
      setShowSimilarProblemButton(false);
      setHighlightKeywords([]);
      setChatHistory((previous) => [
        ...previous,
        { role: 'user', text: message },
        { role: 'model', text: uiText.thinking, isLoading: true },
      ]);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guest-id': guestId },
          body: JSON.stringify({
            message,
            problem: selectedProblem?.question,
            problemId: selectedProblem ? getProblemId(selectedProblem) : undefined,
            chatHistory,
            language,
          }),
        });

        if (!response.ok) {
          throw new Error('Chat API failed');
        }

        const result = await response.json();
        setChatHistory(
          result.chatHistory.map((entry: { role: string; content: string }) => ({
            role: entry.role === 'user' ? 'user' : 'model',
            text: entry.content,
            hint: entry.role === 'assistant' ? result.hint : undefined,
          })),
        );
        setHighlightKeywords(result.highlight || []);

        if (result.guestId && result.guestId !== guestId) {
          sessionStorage.setItem('wakarumade_guest_id', result.guestId);
          setGuestId(result.guestId);
        }

        if (isSolvedMessage(result.teacher) && selectedProblem && guestId && browserSupabase) {
          const problemId = getProblemId(selectedProblem);
          const { data: logData, error: summaryError } = await browserSupabase
            .from('guest_chat_logs')
            .select('summary')
            .eq('guest_id', guestId)
            .eq('problem_id', problemId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!summaryError && logData?.summary) {
            setPersonalizedMessage(uiText.personalizedMessage);
          }
          setShowSimilarProblemButton(true);
        }
      } catch (chatError) {
        console.error('Chat Error:', chatError);
        setChatHistory((previous) => {
          const nextHistory = [...previous];
          nextHistory[nextHistory.length - 1] = {
            role: 'model',
            text: uiText.communicationError,
          };
          return nextHistory;
        });
        setHighlightKeywords([]);
      } finally {
        setUserMessage('');
        setIsSendingMessage(false);
      }
    },
    [
      chatHistory,
      guestId,
      isSendingMessage,
      language,
      selectedProblem,
      uiText.communicationError,
      uiText.personalizedMessage,
      uiText.thinking,
      userMessage,
    ],
  );

  const startChat = useCallback(
    async (problem: Problem) => {
      if (!guestId || !browserSupabase) {
        return;
      }

      setSelectedProblem(problem);
      setChatHistory([]);
      setHighlightKeywords([]);
      setShowSimilarProblemButton(false);
      setPersonalizedMessage(null);

      try {
        const { data: existingLog, error: fetchError } = await browserSupabase
          .from('guest_chat_logs')
          .select('log')
          .eq('guest_id', guestId)
          .eq('problem_id', getProblemId(problem))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error('Failed to fetch existing chat history:', fetchError);
        }

        if (existingLog?.log?.length) {
          const restoredHistory = existingLog.log.map((entry: { role: string; content: string }) => ({
            role: entry.role === 'user' ? 'user' : 'model',
            text: entry.content,
            isLoading: false,
          }));
          setChatHistory(restoredHistory);
          return;
        }

        setChatHistory([{ role: 'model', text: uiText.thinking, isLoading: true }]);

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guest-id': guestId },
          body: JSON.stringify({
            message: uiText.initialMessage,
            problem: problem.question,
            problemId: getProblemId(problem),
            chatHistory: [],
            language,
          }),
        });

        if (!response.ok) {
          throw new Error('Initial chat API failed');
        }

        const result = await response.json();
        setChatHistory(
          result.chatHistory.map((entry: { role: string; content: string }) => ({
            role: entry.role === 'user' ? 'user' : 'model',
            text: entry.content,
            hint: entry.role === 'assistant' ? result.hint : undefined,
          })),
        );
        setHighlightKeywords(result.highlight || []);

        if (result.guestId && result.guestId !== guestId) {
          sessionStorage.setItem('wakarumade_guest_id', result.guestId);
          setGuestId(result.guestId);
        }
      } catch (chatError) {
        console.error('Chat Start Error:', chatError);
        setChatHistory([{ role: 'model', text: uiText.communicationError }]);
        setHighlightKeywords([]);
      }
    },
    [guestId, language, uiText.communicationError, uiText.initialMessage, uiText.thinking],
  );

  const generateSimilarProblem = useCallback(async () => {
    if (!selectedProblem || !guestId || !browserSupabase) {
      return;
    }

    setIsLoading(true);
    setLoadingMessage(uiText.generatingSimilar);
    setShowSimilarProblemButton(false);
    setChatHistory([]);
    setHighlightKeywords([]);

    try {
      const problemId = getProblemId(selectedProblem);
      const { data: logData, error: fetchError } = await browserSupabase
        .from('guest_chat_logs')
        .select('summary')
        .eq('guest_id', guestId)
        .eq('problem_id', problemId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Failed to fetch summary:', fetchError);
      }

      const response = await fetch('/api/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: selectedProblem.question,
          summary: logData?.summary,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error('Similar problem API failed');
      }

      const result = await response.json();
      const newProblem: Problem = {
        number: language === 'en' ? 'Similar' : '類題',
        question: result.question,
      };

      setOcrResults((previous) => {
        const exists = previous.some(
          (problem) => problem.number === newProblem.number && problem.question === newProblem.question,
        );
        return exists ? previous : [...previous, newProblem];
      });

      await startChat(newProblem);
    } catch (similarError) {
      console.error('Similar Problem Generation Error:', similarError);
      setError(uiText.similarError);
    } finally {
      setIsLoading(false);
    }
  }, [guestId, language, selectedProblem, startChat, uiText.generatingSimilar, uiText.similarError]);

  const handleToggleListening = useCallback(async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const runtimeWindow = window as BrowserWindow;
    const RecognitionCtor = runtimeWindow.SpeechRecognition || runtimeWindow.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      setError(uiText.speechNotSupported);
      return;
    }

    recognitionRef.current = new RecognitionCtor();
    const recognition = recognitionRef.current;

    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      setIsListening(true);
      setUserMessage('');
      setError('');
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        setError(uiText.speechError);
      }
      setIsListening(false);
    };
    recognition.onresult = async (event) => {
      const rawText = event.results[0]?.[0]?.transcript;
      if (!rawText) {
        return;
      }

      setIsCorrecting(true);
      try {
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
      } catch (correctionError) {
        console.error('Speech correction error:', correctionError);
        setUserMessage(rawText);
      } finally {
        setIsCorrecting(false);
      }
    };

    recognition.start();
  }, [isListening, uiText.speechError, uiText.speechNotSupported]);

  const selectDifferentProblem = () => {
    hasRestoredSessionRef.current = true;
    setSelectedProblem(null);
    setChatHistory([]);
    setUserMessage('');
    setHighlightKeywords([]);
    setShowSimilarProblemButton(false);
    setPersonalizedMessage(null);

    if (ocrResults.length === 0) {
      setAppState('upload');
      setImageFile(null);
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      setImageUrl('');
    }
  };

  const resetState = () => {
    const newGuestId = crypto.randomUUID();
    sessionStorage.setItem('wakarumade_guest_id', newGuestId);
    setGuestId(newGuestId);
    hasRestoredSessionRef.current = false;

    setAppState('upload');
    setImageFile(null);
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl('');
    setOcrResults([]);
    setSelectedProblem(null);
    setChatHistory([]);
    setUserMessage('');
    setIsLoading(false);
    setLoadingMessage('');
    setError('');
    setShowSimilarProblemButton(false);
    setHighlightKeywords([]);
    setPersonalizedMessage(null);
  };

  return (
    <div className="flex h-screen flex-col items-center overflow-hidden bg-[#fffefc] p-4 text-stone-800 sm:p-6">
      <main
        className={`flex h-full w-full max-w-6xl flex-col items-center ${
          isLoading || appState === 'upload' ? 'justify-center' : ''
        }`}
      >
        {error && (
          <div className="mb-4 w-full border-l-4 border-red-500 bg-red-100 p-4 text-red-700" role="alert">
            <p>{error}</p>
          </div>
        )}

        {appState === 'upload' && !isLoading && !isRestoringSession && (
          <UploadScreen
            language={language}
            onLanguageChange={setLanguageAndClearError}
            onImageChange={handleImageChange}
            texts={uiText}
          />
        )}

        {(isLoading || isRestoringSession) && (
          <LoadingSpinner message={isRestoringSession ? uiText.restoringSession : loadingMessage} />
        )}

        {appState === 'solving' && !isLoading && (
          <div className="flex h-full w-full flex-col md:flex-row md:gap-2">
            <div className="flex flex-1 items-center justify-center md:h-auto md:w-3/5">
              {selectedProblem ? (
                selectedProblem.number === (language === 'en' ? 'Similar' : '類題') || !imageUrl ? (
                  <div className="rounded-2xl bg-stone-50 p-6 text-stone-800 shadow-sm">
                    <p className="text-xl font-bold leading-relaxed">
                      <HighlightedText text={selectedProblem.question} keywords={highlightKeywords} />
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-stone-50 p-4 shadow-sm">
                    <Image
                      src={imageUrl}
                      alt="Uploaded worksheet"
                      width={1200}
                      height={900}
                      unoptimized
                      className="h-auto max-h-[33vh] w-auto max-w-full rounded-lg object-contain md:max-h-[80vh]"
                    />
                  </div>
                )
              ) : imageFile && imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Uploaded worksheet"
                  width={1200}
                  height={900}
                  unoptimized
                  className="h-auto max-h-[33vh] w-auto max-w-full rounded-lg object-contain"
                />
              ) : null}
            </div>

            <div className="flex h-[67vh] flex-1 flex-col pb-8 md:h-full md:max-h-[90vh] md:w-2/5">
              {!selectedProblem && ocrResults.length > 0 && (
                <ProblemList problems={ocrResults} texts={uiText} onStartChat={startChat} onReset={resetState} />
              )}

              {selectedProblem && (
                <ChatPanel
                  chatBottomRef={chatBottomRef}
                  chatHistory={chatHistory}
                  isCorrecting={isCorrecting}
                  isListening={isListening}
                  isLoading={isLoading}
                  isSendingMessage={isSendingMessage}
                  onGenerateSimilarProblem={generateSimilarProblem}
                  onReset={resetState}
                  onSelectDifferentProblem={selectDifferentProblem}
                  onSendMessage={() => void handleSendMessage()}
                  onToggleListening={() => void handleToggleListening()}
                  personalizedMessage={personalizedMessage}
                  showSimilarProblemButton={showSimilarProblemButton}
                  texts={uiText}
                  userMessage={userMessage}
                  setUserMessage={setUserMessage}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
