import type { ChangeEvent } from 'react';

import type { Language, LocalizedTextSet } from '@/types/app';

type UploadScreenProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  texts: LocalizedTextSet;
};

export function UploadScreen({
  language,
  onLanguageChange,
  onImageChange,
  texts,
}: UploadScreenProps) {
  return (
    <div className="text-center">
      <div className="mb-4 flex justify-center">
        <button
          onClick={() => onLanguageChange('ja')}
          className={`rounded px-4 py-2 ${language === 'ja' ? 'bg-orange-500 text-white' : 'bg-stone-200'}`}
        >
          日本語
        </button>
        <button
          onClick={() => onLanguageChange('en')}
          className={`ml-2 rounded px-4 py-2 ${language === 'en' ? 'bg-orange-500 text-white' : 'bg-stone-200'}`}
        >
          English
        </button>
      </div>
      <h1 className="mb-4 text-4xl font-bold text-500 md:text-5xl">
        {language === 'en' ? (
          <>
            Until You Understand
            <br />
            WAKARUMADE
          </>
        ) : (
          texts.title
        )}
      </h1>
      <p className="mb-16 text-xl text-stone-500 md:text-2xl">{texts.subtitle}</p>
      <div className="flex flex-col items-center gap-4">
        <input
          type="file"
          id="camera-upload"
          accept="image/*,.heic"
          capture="environment"
          onChange={onImageChange}
          className="hidden"
        />
        <label
          htmlFor="camera-upload"
          className="inline-block cursor-pointer rounded-full bg-orange-500 px-8 py-4 text-xl font-bold text-white shadow-md transition-transform hover:scale-105 hover:bg-orange-600"
        >
          {texts.takePhoto}
        </label>
        <input
          type="file"
          id="file-upload"
          accept="image/*,.heic"
          onChange={onImageChange}
          className="hidden"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer text-sm text-stone-600 underline hover:text-stone-800"
        >
          {texts.selectPhoto}
        </label>
      </div>
    </div>
  );
}
