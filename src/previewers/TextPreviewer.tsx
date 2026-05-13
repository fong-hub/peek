import { getLanguageFromFileName } from "@/utils/fileTypes";

interface Props {
  content: string;
  fileName: string;
}

export default function TextPreviewer({ content, fileName }: Props) {
  const lang = getLanguageFromFileName(fileName);
  const lines = content.split("\n");

  return (
    <div className="w-full h-full overflow-auto">
      <div className="font-mono text-sm leading-relaxed">
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
