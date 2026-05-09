import { useStore } from "@/store/useStore";
import EmptyState from "./EmptyState";
import MarkdownPreviewer from "@/previewers/MarkdownPreviewer";
import JsonPreviewer from "@/previewers/JsonPreviewer";
import TextPreviewer from "@/previewers/TextPreviewer";
import HtmlPreviewer from "@/previewers/HtmlPreviewer";
import LogPreviewer from "@/previewers/LogPreviewer";

export default function PreviewContainer() {
  const { file } = useStore();

  if (!file) {
    return <EmptyState />;
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
    case "text":
    default:
      return <TextPreviewer content={file.content} fileName={file.name} />;
  }
}
