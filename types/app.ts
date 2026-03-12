export type Problem = {
  number: string | null;
  question: string;
};

export type AppState = 'upload' | 'solving';

export type ChatMessage = {
  role: 'user' | 'model';
  text: string;
  hint?: string;
  isLoading?: boolean;
};

export type Language = 'ja' | 'en';

export type LocalizedTextSet = {
  title: string;
  subtitle: string;
  takePhoto: string;
  loadingConverting: string;
  loadingProcessing: string;
  errorNoFile: string;
  errorConversion: string;
  errorOcr: string;
  selectProblem: string;
  selectPhoto: string;
  reset: string;
  messagePlaceholder: string;
  selectDifferentProblem: string;
  resetRight: string;
  thinking: string;
  communicationError: string;
  restoringSession: string;
  generatingSimilar: string;
  similarError: string;
  speechNotSupported: string;
  speechError: string;
  initialMessage: string;
  similarProblemButton: string;
  savedProblem: string;
  personalizedMessage: string;
};
