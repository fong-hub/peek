import { useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";

interface Props {
  filePath: string;
  fileName: string;
}

type DisplayMode = "fit" | "original";

export default function ImagePreviewer({ filePath, fileName }: Props) {
  const [zoom, setZoom] = useState(1);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("fit");
  const [hasError, setHasError] = useState(false);
  const imageSrc = useMemo(() => convertFileSrc(filePath), [filePath]);

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-text-muted">
        图片加载失败，请尝试用默认应用打开
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-bg-primary">
      <div className="flex items-center justify-between border-b border-border bg-bg-secondary px-4 py-2">
        <div className="text-xs text-text-muted">{fileName}</div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDisplayMode("fit")}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              displayMode === "fit"
                ? "bg-accent/10 text-accent"
                : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            }`}
          >
            <Minimize2 size={13} className="inline-block mr-1" />
            适应窗口
          </button>
          <button
            onClick={() => setDisplayMode("original")}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              displayMode === "original"
                ? "bg-accent/10 text-accent"
                : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            }`}
          >
            <Maximize2 size={13} className="inline-block mr-1" />
            原始尺寸
          </button>
          <button
            onClick={() => setZoom((value) => Math.max(0.25, Number((value - 0.25).toFixed(2))))}
            className="rounded-md p-1.5 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
            title="缩小"
          >
            <Minus size={14} />
          </button>
          <span className="min-w-14 text-center text-xs text-text-muted">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((value) => Math.min(4, Number((value + 0.25).toFixed(2))))}
            className="rounded-md p-1.5 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
            title="放大"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setDisplayMode("fit");
            }}
            className="rounded-md p-1.5 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
            title="重置"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] bg-[length:16px_16px]">
        <div className="flex min-h-full min-w-full items-center justify-center p-8">
          <img
            src={imageSrc}
            alt={fileName}
            onError={() => setHasError(true)}
            className={displayMode === "fit" ? "max-w-full max-h-full object-contain" : "max-w-none"}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
          />
        </div>
      </div>
    </div>
  );
}
