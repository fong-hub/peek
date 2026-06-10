import VirtualizedLineView from "@/components/VirtualizedLineView";
import type { FilePreviewMeta } from "@/store/useStore";
import { formatFileSize } from "@/utils/fileUtils";

interface Props {
  content: string;
  fileName: string;
  previewMeta?: FilePreviewMeta;
}

function LargeFileNotice({ previewMeta }: { previewMeta: FilePreviewMeta }) {
  if (!previewMeta.isLargeFile) {
    return null;
  }

  return (
    <div className="border-b border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
      大文件模式：仅加载前 {previewMeta.previewedLineCount ?? 0} 行进行预览
      {previewMeta.sizeBytes ? `，源文件 ${formatFileSize(previewMeta.sizeBytes)}` : ""}
      {previewMeta.previewedBytes
        ? `，当前片段 ${formatFileSize(previewMeta.previewedBytes)}`
        : ""}
      。已关闭富渲染，优先保证打开速度和滚动流畅度。
    </div>
  );
}

export default function TextPreviewer({
  content,
  fileName,
  previewMeta,
}: Props) {
  const lines = content.split("\n");

  return (
    <div className="w-full h-full flex flex-col">
      {previewMeta?.isLargeFile && (
        <LargeFileNotice previewMeta={previewMeta} />
      )}
      <div className="flex-1 overflow-hidden">
        <VirtualizedLineView
          lines={lines}
          wrapLines={!previewMeta?.isLargeFile}
          getLineClassName={() =>
            fileName.endsWith(".log") ? "text-text-secondary" : "text-text-primary"
          }
        />
      </div>
    </div>
  );
}
