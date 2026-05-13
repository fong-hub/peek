interface Props {
  content: string;
}

export default function JsonPreviewer({ content }: Props) {
  let formatted: string;
  let hasError = false;

  try {
    const parsed = JSON.parse(content);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    formatted = content;
    hasError = true;
  }

  const lines = formatted.split("\n");

  return (
    <div className="w-full h-full overflow-auto">
      <div className="font-mono text-sm leading-relaxed">
        {hasError && (
          <div className="px-2 py-2 text-error text-sm">无效的 JSON</div>
        )}
        {lines.map((line, index) => (
          <div
            key={index}
            className="flex px-2 py-0.5 hover:bg-bg-secondary/30 transition-colors"
          >
            <span className="text-text-muted select-none w-12 text-right mr-3 flex-shrink-0 text-xs pt-0.5">
              {index + 1}
            </span>
            <span className="text-text-primary whitespace-pre-wrap break-all">
              {line || " "}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
