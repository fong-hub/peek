import VirtualizedLineView from "@/components/VirtualizedLineView";

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
  return (
    <VirtualizedLineView
      lines={content.split("\n")}
      wrapLines={false}
      getRowClassName={(index) =>
        index % 2 === 0 ? "bg-bg-primary" : "bg-bg-secondary/20"
      }
      getLineClassName={(line) => getLogLevelColor(line)}
    />
  );
}
