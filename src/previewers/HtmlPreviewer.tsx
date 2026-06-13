import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Eye, Code } from "lucide-react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "@/store/useStore";
import { loadPreviewFile } from "@/utils/openPreview";
import {
  prepareHtmlPreviewContent,
  resolveHtmlUrlToPath,
} from "@/utils/htmlPreview";
import { writeHtmlPreviewFile } from "@/utils/htmlPreviewCache";

interface Props {
  content: string;
}

export default function HtmlPreviewer({ content }: Props) {
  const { file, folder, setFile } = useStore();
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const htmlContext = useMemo(
    () => ({
      filePath: file?.path,
      rootPath: folder.rootPath,
    }),
    [file?.path, folder.rootPath]
  );

  const resolvePath = useCallback(
    (url: string): string | null => resolveHtmlUrlToPath(url, htmlContext),
    [htmlContext]
  );

  const postViewportHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      return;
    }

    iframe.contentWindow.postMessage(
      {
        type: "peek-viewport-size",
        height: iframe.clientHeight,
      },
      "*"
    );
  }, []);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.data?.type === "peek-viewport-request") {
        postViewportHeight();
        return;
      }

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
          const processed = await prepareHtmlPreviewContent(
            text,
            {
              filePath: targetPath,
              rootPath: folder.rootPath,
            },
            convertFileSrc,
            readTextFile
          );
          const previewPath = await writeHtmlPreviewFile(targetPath, processed);
          const previewUrl = convertFileSrc(previewPath);

          const iframe = document.querySelector(
            "iframe[data-peek-html-preview='true']"
          ) as HTMLIFrameElement | null;
          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
              { type: "peek-iframe-content", frameId, url: previewUrl },
              "*"
            );
          }
        } catch (error) {
          console.error("[Peek] 加载嵌套 iframe 内容失败:", targetPath, error);
        }
      }
    },
    [folder.rootPath, postViewportHeight, resolvePath, setFile]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    if (mode !== "preview" || !file?.path) {
      setPreviewUrl("");
      return;
    }

    let cancelled = false;

    const buildPreview = async () => {
      try {
        const processed = await prepareHtmlPreviewContent(
          content,
          htmlContext,
          convertFileSrc,
          readTextFile
        );
        const previewPath = await writeHtmlPreviewFile(file.path, processed);
        if (!cancelled) {
          setPreviewUrl(convertFileSrc(previewPath));
        }
      } catch (error) {
        console.error("[Peek] 生成 HTML 预览失败:", file.path, error);
        if (!cancelled) {
          setPreviewUrl("");
        }
      }
    };

    void buildPreview();

    return () => {
      cancelled = true;
    };
  }, [content, file?.path, htmlContext, mode]);

  useEffect(() => {
    if (mode !== "preview") {
      return;
    }

    postViewportHeight();
  }, [mode, postViewportHeight, previewUrl]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      postViewportHeight();
    });

    observer.observe(iframe);
    return () => observer.disconnect();
  }, [postViewportHeight, previewUrl]);

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
          previewUrl ? (
            <iframe
              ref={iframeRef}
              className="absolute inset-0 w-full h-full border-none bg-white"
              data-peek-html-preview="true"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-top-navigation-by-user-activation"
              src={previewUrl}
              onLoad={postViewportHeight}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-white text-sm text-text-secondary">
              HTML 预览生成中...
            </div>
          )
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
