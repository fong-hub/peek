import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import rehypeSlug from "rehype-slug";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Code, Eye } from "lucide-react";
import VirtualizedLineView from "@/components/VirtualizedLineView";
import { useStore } from "@/store/useStore";

import { resolveMarkdownLink } from "@/utils/markdownLink";
import { loadPreviewFile } from "@/utils/openPreview";

const headingPrefix = "peek-md-";

interface Props {
  filePath: string;
  content: string;
}

export default function MarkdownPreviewer({ content, filePath }: Props) {
  const { searchVisible } = useStore();
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const modeBeforeSearch = useRef<"preview" | "source">("preview");
  const searchForcedSource = useRef(false);

  const pendingFragment = useRef("");
  const navigation = useRef(0);
  const preview = useRef<HTMLDivElement>(null);

  function scrollToFragment(fragment: string) {
    const element = document.getElementById(headingPrefix + fragment);
    if (element && preview.current?.contains(element)) element.scrollIntoView();
  }

  useEffect(() => {
    if (pendingFragment.current) scrollToFragment(pendingFragment.current);
    pendingFragment.current = "";
    return () => { navigation.current++; };
  }, [filePath]);

  async function followLink(event: MouseEvent<HTMLAnchorElement>) {
    const href = event.currentTarget.getAttribute("href") ?? "";
    try {
      const target = resolveMarkdownLink(href, filePath);
      if (!target) {
        if (!href) event.preventDefault();
        return;
      }
      event.preventDefault();
      const request = ++navigation.current;
      if (target.path === filePath) {
        if (target.fragment) scrollToFragment(target.fragment);
        else preview.current?.scrollTo(0, 0);
        return;
      }
      const file = await loadPreviewFile(target.path);
      if (request !== navigation.current || useStore.getState().file?.path !== filePath) return;
      pendingFragment.current = target.fragment;
      useStore.getState().setFile(file, false);
    } catch (error) {
      event.preventDefault();
      console.warn("[Peek] 无法打开 Markdown 链接", href, error);
    }
  }

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
          <div key={filePath} ref={preview} className="markdown-preview h-full w-full overflow-auto p-6 text-text-primary">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeSlug, { prefix: headingPrefix }], rehypeHighlight]}
              components={{ a: ({ node: _node, ...props }) => <a {...props} onClick={followLink} /> }}
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
