import { useStore } from "@/store/useStore";
import EmptyState from "./EmptyState";
import FileInfoPanel from "./FileInfoPanel";
import MarkdownPreviewer from "@/previewers/MarkdownPreviewer";
import JsonPreviewer from "@/previewers/JsonPreviewer";
import TextPreviewer from "@/previewers/TextPreviewer";
import HtmlPreviewer from "@/previewers/HtmlPreviewer";
import LogPreviewer from "@/previewers/LogPreviewer";
import CsvPreviewer from "@/previewers/CsvPreviewer";
import ImagePreviewer from "@/previewers/ImagePreviewer";
import PdfPreviewer from "@/previewers/PdfPreviewer";
import UnsupportedPreviewer from "@/previewers/UnsupportedPreviewer";
import type { FileInfo, PreviewType } from "@/store/useStore";
import SearchBar from "./SearchBar";

export default function PreviewContainer() {
  const { file } = useStore();

  if (!file) {
    return <EmptyState />;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <FileInfoPanel />
      <SearchBar />
      <div className="flex-1 overflow-hidden">
        {renderPreviewer(file)}
      </div>
    </div>
  );
}

function renderPreviewer(file: FileInfo) {
  if (file.type === "unsupported") {
    return (
      <UnsupportedPreviewer
        fileName={file.name}
        filePath={file.path}
        reason={file.content}
      />
    );
  }

  if (shouldUseLargeFileFallback(file.type, file.previewMeta?.isLargeFile)) {
    return (
      <TextPreviewer
        content={file.content}
        fileName={file.name}
        previewMeta={file.previewMeta}
      />
    );
  }

  switch (file.type) {
    case "markdown":
      return <MarkdownPreviewer content={file.content} />;
    case "json":
      return <JsonPreviewer content={file.content} />;
    case "html":
      return <HtmlPreviewer content={file.content} />;
    case "log":
      return <LogPreviewer content={file.content} />;
    case "csv":
      return <CsvPreviewer content={file.content} />;
    case "image":
      return <ImagePreviewer filePath={file.path} fileName={file.name} />;
    case "pdf":
      return <PdfPreviewer filePath={file.path} />;
    case "text":
    default:
      return (
        <TextPreviewer
          content={file.content}
          fileName={file.name}
          previewMeta={file.previewMeta}
        />
      );
  }
}

function shouldUseLargeFileFallback(
  type: PreviewType,
  isLargeFile = false
): boolean {
  if (!isLargeFile) {
    return false;
  }

  return type !== "image" && type !== "pdf" && type !== "unsupported";
}
