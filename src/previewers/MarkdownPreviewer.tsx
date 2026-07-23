import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Code, Eye } from "lucide-react";
import VirtualizedLineView from "@/components/VirtualizedLineView";
import { useStore } from "@/store/useStore";

interface Props {
  content: string;
}

export default function MarkdownPreviewer({ content }: Props) {
  const { searchVisible } = useStore();
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const modeBeforeSearch = useRef<"preview" | "source">("preview");
  const searchForcedSource = useRef(false);

  useEffect(() => {
    if (searchVisible) {
      if (!searchForcedSource.current) {
        modeBeforeSearch.current = mode;
        searchForcedSource.current = true;
      }
      if (mode !== "source") setMode("source");
      return;
    }

    if (!searchVisible && searchForcedSource.current) {
      searchForcedSource.current = false;
      setMode(modeBeforeSearch.current);
    }
  }, [mode, searchVisible]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-bg-secondary px-4 py-2">
        <button
          type="button"
          onClick={() => setMode("preview")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            mode === "preview"
              ? "bg-accent text-white"
              : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          }`}
        >
          <Eye size={14} />
          预览
        </button>
        <button
          type="button"
          onClick={() => setMode("source")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            mode === "source"
              ? "bg-accent text-white"
              : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          }`}
        >
          <Code size={14} />
          源码
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {mode === "preview" ? (
          <div className="markdown-preview h-full w-full overflow-auto p-6 text-text-primary">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <VirtualizedLineView lines={content.split("\n")} />
        )}
      </div>
    </div>
  );
}
