import VirtualizedLineView from "@/components/VirtualizedLineView";

interface Props {
  content: string;
}

export default function JsonPreviewer({ content }: Props) {
  let formatted = content;
  let hasError = false;

  try {
    const parsed = JSON.parse(content);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    hasError = true;
  }

  return (
    <div className="w-full h-full flex flex-col">
      {hasError && (
        <div className="border-b border-error/20 bg-error/10 px-3 py-2 text-sm text-error">
          无效的 JSON，已按原始文本展示
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <VirtualizedLineView lines={formatted.split("\n")} />
      </div>
    </div>
  );
}
