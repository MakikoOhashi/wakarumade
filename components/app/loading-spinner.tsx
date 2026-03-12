type LoadingSpinnerProps = {
  message: string;
};

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center text-stone-600">
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-dashed border-orange-400" />
      <p className="mt-4 text-2xl font-semibold">{message}</p>
    </div>
  );
}
