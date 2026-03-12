type HighlightedTextProps = {
  text: string;
  keywords: string[];
};

export function HighlightedText({ text, keywords }: HighlightedTextProps) {
  if (keywords.length === 0) {
    return <>{text}</>;
  }

  try {
    const regex = new RegExp(
      `(${keywords.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'gi',
    );
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) =>
          keywords.some((keyword) => part.toLowerCase() === keyword.toLowerCase()) ? (
            <mark key={`${part}-${index}`} className="rounded bg-yellow-200 px-1">
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </>
    );
  } catch (error) {
    console.error('Error creating regex for highlighting:', error);
    return <>{text}</>;
  }
}
