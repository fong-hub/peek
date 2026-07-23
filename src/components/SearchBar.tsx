import { useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  findTextMatches,
  getSearchableContent,
  wrapMatchIndex,
} from "@/utils/search";

export default function SearchBar() {
  const {
    file,
    searchVisible,
    searchQuery,
    activeSearchMatch,
    closeSearch,
    setSearchQuery,
    setActiveSearchMatch,
  } = useStore();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchableContent = useMemo(
    () => file ? getSearchableContent(file) : null,
    [file]
  );
  const matches = useMemo(
    () => searchableContent === null
      ? []
      : findTextMatches(searchableContent, searchQuery),
    [searchQuery, searchableContent]
  );
  const matchCount = matches.length;

  useEffect(() => {
    if (!searchVisible) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [searchVisible]);

  useEffect(() => {
    if (activeSearchMatch >= matchCount && matchCount > 0) {
      setActiveSearchMatch(0);
    }
  }, [activeSearchMatch, matchCount, setActiveSearchMatch]);

  if (!searchVisible || !file) return null;

  const move = (direction: number) => {
    setActiveSearchMatch(wrapMatchIndex(activeSearchMatch + direction, matchCount));
  };
  const currentMatch = matchCount > 0 ? activeSearchMatch + 1 : 0;
  const unsupported = searchableContent === null;

  return (
    <div className="flex min-h-10 items-center justify-end gap-1 border-b border-border bg-bg-secondary px-3 py-1.5">
      <div className="flex w-full max-w-[420px] items-center rounded-[6px] border border-border bg-bg-primary focus-within:border-accent">
        <Search size={14} className="ml-2.5 flex-shrink-0 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          disabled={unsupported}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              move(event.shiftKey ? -1 : 1);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeSearch();
            }
          }}
          placeholder={unsupported ? "当前预览不支持搜索" : "搜索当前文件"}
          aria-label="搜索当前文件"
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed"
        />
        <span
          className="min-w-14 select-none px-2 text-right text-xs tabular-nums text-text-muted"
          aria-live="polite"
        >
          {currentMatch} / {matchCount}
        </span>
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={matchCount === 0}
          className="grid h-7 w-7 place-items-center text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
          title="上一个匹配 (Shift+Enter)"
          aria-label="上一个匹配"
        >
          <ChevronUp size={15} />
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={matchCount === 0}
          className="grid h-7 w-7 place-items-center text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
          title="下一个匹配 (Enter)"
          aria-label="下一个匹配"
        >
          <ChevronDown size={15} />
        </button>
        <button
          type="button"
          onClick={closeSearch}
          className="mr-0.5 grid h-7 w-7 place-items-center text-text-secondary hover:text-text-primary"
          title="关闭搜索"
          aria-label="关闭搜索"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
