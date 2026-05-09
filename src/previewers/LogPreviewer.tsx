interface Props {
  content: string;
}

function getLogLevelColor(line: string): string {
  const upper = line.toUpperCase();
  if (upper.includes("ERROR") || upper.includes("FATAL")) return "text-error";
  if (upper.includes("WARN")) return "text-warning";
  if (upper.includes("INFO")) return "text-accent";
  if (upper.includes("DEBUG")) return "text-text-muted";
  if (upper.includes("SUCCESS") || upper.includes("DONE")) return "text-success";
  return "text-text-primary";
}

export default function LogPreviewer({ content }: Props) {
  const lines = content.split("\n");

  return (
    <div className="w-full h-full overflow-auto">
      <div className="font-mono text-sm leading-relaxed">
        {lines.map((line, index) => (
          <div
            key={index}
            className={`flex px-4 py-0.5 hover:bg-bg-secondary/50 transition-colors ${
              index % 2 === 0 ? "bg-bg-primary" : "bg-bg-secondary/20"
            }`}
          >
            <span className="text-text-muted select-none w-12 text-right mr-4 flex-shrink-0">
              {index + 1}
            </span>
            <span className={`${getLogLevelColor(line)} whitespace-pre-wrap break-all`}>
              {line || " "}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
