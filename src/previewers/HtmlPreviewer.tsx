import { useState, useMemo, useEffect, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Eye, Code } from "lucide-react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "@/store/useStore";
import { loadPreviewFile } from "@/utils/openPreview";
import {
  processHtmlContent,
  resolveHtmlUrlToPath,
} from "@/utils/htmlPreview";

interface Props {
  content: string;
}

export default function HtmlPreviewer({ content }: Props) {
  const { file, folder, setFile } = useStore();
  const [mode, setMode] = useState<"preview" | "source">("preview");

  const htmlContext = useMemo(
    () => ({
      filePath: file?.path,
      rootPath: folder.rootPath,
    }),
    [file?.path, folder.rootPath]
  );

  const srcDoc = useMemo(
    () =>
      mode === "preview"
        ? processHtmlContent(content, htmlContext, convertFileSrc)
        : "",
    [content, htmlContext, mode]
  );

  const resolvePath = useCallback(
    (url: string): string | null => resolveHtmlUrlToPath(url, htmlContext),
    [htmlContext]
  );

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.data?.type === "peek-navigate") {
        const targetPath = resolvePath(String(event.data.url ?? ""));
        if (!targetPath) {
          return;
        }

        try {
          const fileInfo = await loadPreviewFile(targetPath);
          setFile(fileInfo, false);
        } catch (error) {
          console.error("[Peek] 打开链接文件失败:", targetPath, error);
        }
        return;
      }

      if (event.data?.type === "peek-iframe-navigate") {
        const { url, frameId }: { url: string; frameId: string } = event.data;
        const targetPath = resolvePath(url);
        if (!targetPath) {
          return;
        }

        try {
          const text = await readTextFile(targetPath);
          const processed = processHtmlContent(
            text,
            {
              filePath: targetPath,
              rootPath: folder.rootPath,
            },
            convertFileSrc
          );

          const iframe = document.querySelector(
            "iframe[data-peek-html-preview='true']"
          ) as HTMLIFrameElement | null;
          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
              { type: "peek-iframe-content", frameId, content: processed },
              "*"
            );
          }
        } catch (error) {
          console.error("[Peek] 加载嵌套 iframe 内容失败:", targetPath, error);
        }
      }
    },
    [folder.rootPath, resolvePath, setFile]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

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
      <div className="flex-1 relative">
        {mode === "preview" ? (
          <iframe
            className="absolute inset-0 w-full h-full border-none bg-white"
            data-peek-html-preview="true"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-top-navigation-by-user-activation"
            srcDoc={srcDoc}
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
