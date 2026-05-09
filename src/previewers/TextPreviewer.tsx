import { getLanguageFromFileName } from "@/utils/fileTypes";

interface Props {
  content: string;
  fileName: string;
}

export default function TextPreviewer({ content, fileName }: Props) {
  const lang = getLanguageFromFileName(fileName);

  return (
    <div className="w-full h-full overflow-auto">
      <pre className="p-6 font-mono text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
        <code>{content}</code>
      </pre>
    </div>
  );
}
