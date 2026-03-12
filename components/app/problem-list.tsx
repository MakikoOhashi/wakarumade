import type { LocalizedTextSet, Problem } from '@/types/app';

type ProblemListProps = {
  problems: Problem[];
  texts: LocalizedTextSet;
  onStartChat: (problem: Problem) => void;
  onReset: () => void;
};

export function ProblemList({ problems, texts, onStartChat, onReset }: ProblemListProps) {
  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-4 text-2xl font-bold text-stone-800">{texts.selectProblem}</h2>
      <div className="max-h-[67vh] overflow-y-auto md:max-h-none md:flex-grow">
        <ul className="space-y-3">
          {problems.map((problem, index) => (
            <li
              key={`${problem.number ?? 'unknown'}-${index}`}
              onClick={() => onStartChat(problem)}
              className="cursor-pointer rounded-lg border border-stone-200 bg-stone-50 p-4 transition-colors hover:bg-orange-100"
            >
              <span className="mr-3 font-bold text-orange-500">{problem.number || '？'}</span>
              <span className="text-lg">{problem.question}</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={onReset}
        className="mt-4 self-start rounded-full bg-stone-500 px-4 py-2 font-bold text-white transition-colors hover:bg-stone-600"
      >
        {texts.reset}
      </button>
    </div>
  );
}
