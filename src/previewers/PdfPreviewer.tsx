import { useMemo } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { ExternalLink } from "lucide-react";

interface Props {
  filePath: string;
}

export default function PdfPreviewer({ filePath }: Props) {
  const pdfSrc = useMemo(() => convertFileSrc(filePath), [filePath]);

  return (
    <div className="w-full h-full flex flex-col bg-bg-primary">
      <div className="flex items-center justify-between border-b border-border bg-bg-secondary px-4 py-2">
        <div className="text-xs text-text-muted">
          PDF 预览依赖系统 WebView；如果当前环境不支持，可直接用默认应用打开。
        </div>
        <button
          onClick={() => void invoke("open_path", { path: filePath })}
          className="inline-flex items-center gap-1.5 rounded-md bg-bg-tertiary px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <ExternalLink size={13} />
          默认应用打开
        </button>
      </div>
      <div className="flex-1 overflow-hidden bg-white">
        <object
          data={pdfSrc}
          type="application/pdf"
          className="w-full h-full"
        >
          <div className="flex h-full items-center justify-center px-6 text-sm text-text-muted">
            当前环境无法内嵌 PDF，请使用右上角按钮打开系统预览。
          </div>
        </object>
      </div>
    </div>
  );
}
