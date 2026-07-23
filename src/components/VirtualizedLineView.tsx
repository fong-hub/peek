import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_LINE_HEIGHT,
  getVirtualWindow,
  shouldVirtualizeLines,
} from "@/utils/virtualization";
import { useStore } from "@/store/useStore";
import { findLineMatches, type LineMatch } from "@/utils/search";

interface Props {
  lines: string[];
  getRowClassName?: (index: number) => string;
  getLineClassName?: (line: string, index: number) => string;
  wrapLines?: boolean;
}

export default function VirtualizedLineView({
  lines,
  getRowClassName,
  getLineClassName,
  wrapLines = true,
}: Props) {
  const { searchVisible, searchQuery, activeSearchMatch } = useStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const virtualized = shouldVirtualizeLines(lines.length);
  const searchMatches = useMemo(
    () => searchVisible ? findLineMatches(lines, searchQuery) : [],
    [lines, searchQuery, searchVisible]
  );
  const matchesByLine = useMemo(() => {
    const byLine = new Map<number, LineMatch[]>();
    searchMatches.forEach((match) => {
      const current = byLine.get(match.lineIndex) ?? [];
      current.push(match);
      byLine.set(match.lineIndex, current);
    });
    return byLine;
  }, [searchMatches]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      setContainerHeight(element.clientHeight);
    });

    setContainerHeight(element.clientHeight);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const activeMatch = searchMatches[activeSearchMatch];
    const element = containerRef.current;
    if (!activeMatch || !element) return;

    if (virtualized) {
      element.scrollTop = Math.max(
        0,
        activeMatch.lineIndex * DEFAULT_LINE_HEIGHT - element.clientHeight / 2
      );
      return;
    }

    element
      .querySelector<HTMLElement>(`[data-search-match="${activeMatch.index}"]`)
      ?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [activeSearchMatch, searchMatches, virtualized]);

  const windowState = useMemo(
    () =>
      getVirtualWindow({
        totalLines: lines.length,
        scrollTop,
        containerHeight,
      }),
    [containerHeight, lines.length, scrollTop]
  );

  const visibleLines = virtualized
    ? lines.slice(windowState.startIndex, windowState.endIndex)
    : lines;
  const textClassName =
    wrapLines && !virtualized
      ? "whitespace-pre-wrap break-all"
      : "whitespace-pre";

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto"
      onScroll={(event) => {
        if (virtualized) {
          setScrollTop(event.currentTarget.scrollTop);
        }
      }}
    >
      <div className="min-w-full font-mono text-sm leading-relaxed">
        {virtualized && <div style={{ height: windowState.topSpacerHeight }} />}

        {visibleLines.map((line, visibleIndex) => {
          const actualIndex = virtualized
            ? windowState.startIndex + visibleIndex
            : visibleIndex;

          return (
            <div
              key={actualIndex}
              className={`flex px-2 py-0.5 hover:bg-bg-secondary/30 transition-colors ${
                getRowClassName?.(actualIndex) ?? ""
              }`}
              style={virtualized ? { height: DEFAULT_LINE_HEIGHT } : undefined}
            >
              <span className="text-text-muted select-none w-12 text-right mr-3 flex-shrink-0 text-xs pt-0.5">
                {actualIndex + 1}
              </span>
              <span
                className={`${textClassName} ${getLineClassName?.(line, actualIndex) ?? "text-text-primary"}`}
              >
                {renderLineWithMatches(
                  line,
                  matchesByLine.get(actualIndex) ?? [],
                  activeSearchMatch
                )}
              </span>
            </div>
          );
        })}

        {virtualized && (
          <div style={{ height: windowState.bottomSpacerHeight }} />
        )}
      </div>
    </div>
  );
}

function renderLineWithMatches(
  line: string,
  matches: LineMatch[],
  activeMatchIndex: number
) {
  if (matches.length === 0) return line || " ";

  const fragments: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match) => {
    if (match.start > cursor) {
      fragments.push(line.slice(cursor, match.start));
    }
    fragments.push(
      <mark
        key={match.index}
        data-search-match={match.index}
        className={match.index === activeMatchIndex ? "search-match-active" : "search-match"}
      >
        {line.slice(match.start, match.end)}
      </mark>
    );
    cursor = match.end;
  });

  if (cursor < line.length) fragments.push(line.slice(cursor));
  return fragments;
}
