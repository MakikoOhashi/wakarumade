import type { Ref } from 'react';

import { CorrectionSpinner, MicIcon, RecordingIcon } from '@/components/app/chat-controls';
import { LoadingSpinner } from '@/components/app/loading-spinner';
import type { ChatMessage, LocalizedTextSet } from '@/types/app';

type ChatPanelProps = {
  chatBottomRef: Ref<HTMLDivElement>;
  chatHistory: ChatMessage[];
  isCorrecting: boolean;
  isListening: boolean;
  isLoading: boolean;
  isSendingMessage: boolean;
  onGenerateSimilarProblem: () => void;
  onReset: () => void;
  onSelectDifferentProblem: () => void;
  onSendMessage: () => void;
  onToggleListening: () => void;
  personalizedMessage: string | null;
  showSimilarProblemButton: boolean;
  texts: LocalizedTextSet;
  userMessage: string;
  setUserMessage: (value: string) => void;
};

export function ChatPanel({
  chatBottomRef,
  chatHistory,
  isCorrecting,
  isListening,
  isLoading,
  isSendingMessage,
  onGenerateSimilarProblem,
  onReset,
  onSelectDifferentProblem,
  onSendMessage,
  onToggleListening,
  personalizedMessage,
  showSimilarProblemButton,
  texts,
  userMessage,
  setUserMessage,
}: ChatPanelProps) {
  return (
    <div className="flex h-full max-h-[90vh] flex-col">
      <div className="mb-4 flex-grow space-y-4 overflow-y-auto pr-2">
        {chatHistory.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md lg:max-w-xl ${message.role === 'user' ? 'text-right' : ''}`}>
              {message.isLoading ? (
                <LoadingSpinner message="" />
              ) : (
                <p
                  className={`whitespace-pre-wrap text-lg font-semibold ${
                    message.role === 'user' ? 'text-blue-900' : 'text-red-900'
                  }`}
                >
                  {message.text}
                </p>
              )}
            </div>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      <div className="mt-auto border-t pt-4">
        {showSimilarProblemButton && personalizedMessage && (
          <div className="mb-3 w-full rounded-lg border-l-4 border-yellow-500 bg-yellow-100 p-4 text-yellow-700">
            <p className="whitespace-pre-wrap">{personalizedMessage}</p>
          </div>
        )}
        {showSimilarProblemButton && (
          <button
            onClick={onGenerateSimilarProblem}
            className="mb-3 w-full rounded-full bg-green-500 px-4 py-2 font-bold text-white transition-colors hover:bg-green-600"
          >
            {texts.similarProblemButton}
          </button>
        )}

        <div className="flex items-center gap-2">
          <textarea
            value={userMessage}
            onChange={(event) => setUserMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSendMessage();
              }
            }}
            placeholder={texts.messagePlaceholder}
            className="flex-grow rounded-xl border-2 border-stone-300 p-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
            rows={2}
            disabled={isLoading || isSendingMessage}
          />
          <button
            onClick={onToggleListening}
            disabled={isLoading || isCorrecting || isSendingMessage}
            className={`rounded-full p-3 transition-colors ${
              isListening ? 'bg-red-200' : 'bg-stone-200 hover:bg-stone-300'
            }`}
          >
            {isCorrecting ? <CorrectionSpinner /> : isListening ? <RecordingIcon /> : <MicIcon />}
          </button>
          <button
            onClick={onSendMessage}
            disabled={isLoading || isSendingMessage || !userMessage.trim()}
            className="rounded-full bg-orange-500 p-3 font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex justify-between">
          <button
            onClick={onSelectDifferentProblem}
            className="rounded-full bg-stone-200 px-4 py-2 font-bold text-stone-800 transition-colors hover:bg-stone-300"
          >
            {texts.selectDifferentProblem}
          </button>
          <button
            onClick={onReset}
            className="rounded-full bg-stone-200 px-4 py-2 font-bold text-stone-800 transition-colors hover:bg-stone-300"
          >
            {texts.resetRight}
          </button>
        </div>
      </div>
    </div>
  );
}
