import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_LINE_HEIGHT,
  getVirtualWindow,
  shouldVirtualizeLines,
} from "@/utils/virtualization";

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const virtualized = shouldVirtualizeLines(lines.length);

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
                {line || " "}
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
