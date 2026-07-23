import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { parseCsvContent } from "@/utils/csv";
import { useStore } from "@/store/useStore";
import { findTextMatches, type TextMatch } from "@/utils/search";

interface Props {
  content: string;
}

type SortDirection = "asc" | "desc";

function compareCsvValues(left: string, right: string): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftIsNumber = left.trim() !== "" && !Number.isNaN(leftNumber);
  const rightIsNumber = right.trim() !== "" && !Number.isNaN(rightNumber);

  if (leftIsNumber && rightIsNumber) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, "zh-CN", { numeric: true, sensitivity: "base" });
}

export default function CsvPreviewer({ content }: Props) {
  const { searchVisible, searchQuery, activeSearchMatch } = useStore();
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const parsed = useMemo(() => parseCsvContent(content), [content]);
  const displayedRows = useMemo(() => {
    const baseRows = parsed.rows.map((cells, sourceIndex) => ({ cells, sourceIndex }));
    if (sortColumn === null) {
      return baseRows;
    }

    return [...baseRows].sort((left, right) => {
      const result = compareCsvValues(
        left.cells[sortColumn] ?? "",
        right.cells[sortColumn] ?? ""
      );
      return sortDirection === "asc" ? result : -result;
    });
  }, [parsed.rows, sortColumn, sortDirection]);
  const matchesByCell = useMemo(() => {
    const matches = new Map<string, Array<TextMatch & { index: number }>>();
    let matchIndex = 0;

    const addCell = (id: string, value: string) => {
      const cellMatches = searchVisible ? findTextMatches(value, searchQuery) : [];
      matches.set(
        id,
        cellMatches.map((match) => ({ ...match, index: matchIndex++ }))
      );
    };

    parsed.headers.forEach((header, columnIndex) => {
      addCell(`h-${columnIndex}`, header || `列 ${columnIndex + 1}`);
    });
    parsed.rows.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => addCell(`r-${rowIndex}-${columnIndex}`, cell));
    });

    return matches;
  }, [parsed.headers, parsed.rows, searchQuery, searchVisible]);

  useEffect(() => {
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-search-match="${activeSearchMatch}"]`)
      ?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [activeSearchMatch, matchesByCell]);

  if (parsed.columnCount === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-text-muted">
        CSV 内容为空
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center border-b border-border bg-bg-secondary px-4 py-2">
        <div className="text-xs text-text-muted">
          {parsed.rows.length} 行数据
          {parsed.hasHeader ? "，已识别首行为表头" : "，未识别到表头"}
          {parsed.delimiter === "\t" ? "，分隔符: TAB" : `，分隔符: ${parsed.delimiter}`}
        </div>
      </div>

      {parsed.error && (
        <div className="border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning">
          {parsed.error}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-bg-secondary">
            <tr>
              <th className="border-b border-border px-3 py-2 text-left text-xs font-medium text-text-muted">
                #
              </th>
              {parsed.headers.map((header, index) => {
                const active = sortColumn === index;

                return (
                  <th
                    key={`${header}-${index}`}
                    className="border-b border-border px-3 py-2 text-left text-xs font-medium text-text-primary"
                  >
                    <button
                      onClick={() => {
                        if (sortColumn === index) {
                          setSortDirection((current) =>
                            current === "asc" ? "desc" : "asc"
                          );
                        } else {
                          setSortColumn(index);
                          setSortDirection("asc");
                        }
                      }}
                      className="flex items-center gap-1.5 hover:text-accent transition-colors"
                    >
                      <span>
                        {renderCellMatches(
                          header || `列 ${index + 1}`,
                          matchesByCell.get(`h-${index}`) ?? [],
                          activeSearchMatch
                        )}
                      </span>
                      {active ? (
                        sortDirection === "asc" ? (
                          <ArrowUpAZ size={13} />
                        ) : (
                          <ArrowDownAZ size={13} />
                        )
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayedRows.map(({ cells: row, sourceIndex }, rowIndex) => (
              <tr
                key={`${sourceIndex}-${row.join("|")}`}
                className={rowIndex % 2 === 0 ? "bg-bg-primary" : "bg-bg-secondary/20"}
              >
                <td className="border-b border-border/60 px-3 py-2 align-top text-xs text-text-muted">
                  {rowIndex + 1}
                </td>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className="border-b border-border/60 px-3 py-2 align-top text-text-secondary"
                  >
                    <span className="whitespace-pre-wrap break-all">
                      {renderCellMatches(
                        cell,
                        matchesByCell.get(`r-${sourceIndex}-${cellIndex}`) ?? [],
                        activeSearchMatch
                      )}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </div>
  );
}

function renderCellMatches(
  value: string,
  matches: Array<TextMatch & { index: number }>,
  activeMatchIndex: number
) {
  if (matches.length === 0) return value || " ";

  const fragments: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match) => {
    if (match.start > cursor) fragments.push(value.slice(cursor, match.start));
    fragments.push(
      <mark
        key={match.index}
        data-search-match={match.index}
        className={match.index === activeMatchIndex ? "search-match-active" : "search-match"}
      >
        {value.slice(match.start, match.end)}
      </mark>
    );
    cursor = match.end;
  });

  if (cursor < value.length) fragments.push(value.slice(cursor));
  return fragments;
}
