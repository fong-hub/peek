import { useState, useRef, useEffect } from "react";
import { Eye, Code } from "lucide-react";
import { useStore } from "@/store/useStore";

interface Props {
  content: string;
}

export default function HtmlPreviewer({ content }: Props) {
  const { file } = useStore();
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (mode === "preview" && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        // 注入base标签以正确解析相对路径资源
        let processedContent = content;
        if (file?.path) {
          // 提取文件所在目录作为base路径
          const pathParts = file.path.split(/[/\\]/);
          pathParts.pop(); // 移除文件名
          const basePath = pathParts.join("/") + "/";
          const baseTag = `<base href="file://${basePath}">`;

          // 在head标签后插入base标签，如果没有head则在html后插入
          if (processedContent.includes("<head>")) {
            processedContent = processedContent.replace("<head>", `<head>${baseTag}`);
          } else if (processedContent.includes("<html>")) {
            processedContent = processedContent.replace("<html>", `<html><head>${baseTag}</head>`);
          } else {
            processedContent = baseTag + processedContent;
          }
        }

        doc.open();
        doc.write(processedContent);
        doc.close();
      }
    }
  }, [content, mode, file]);

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
          <div className="font-mono text-sm leading-relaxed">
            {content.split("\n").map((line, index) => (
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
        )}
      </div>
    </div>
  );
}
