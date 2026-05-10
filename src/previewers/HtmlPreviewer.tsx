import { useState, useRef, useEffect } from "react";
import { Eye, Code } from "lucide-react";

interface Props {
  content: string;
}

export default function HtmlPreviewer({ content }: Props) {
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (mode === "preview" && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(content);
        doc.close();
      }
    }
  }, [content, mode]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary">
        <button
          onClick={() => setMode("preview")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
            mode === "preview"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
        >
          <Eye size={14} />
          预览
        </button>
        <button
          onClick={() => setMode("source")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
            mode === "source"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
        >
          <Code size={14} />
          源码
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {mode === "preview" ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
          />
        ) : (
          <pre className="p-6 font-mono text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
