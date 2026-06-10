import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Search } from "lucide-react";
import { parseCsvContent } from "@/utils/csv";

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
  const [query, setQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const parsed = useMemo(() => parseCsvContent(content), [content]);
  const filteredRows = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    const baseRows = loweredQuery
      ? parsed.rows.filter((row) =>
          row.some((cell) => cell.toLowerCase().includes(loweredQuery))
        )
      : parsed.rows;

    if (sortColumn === null) {
      return baseRows;
    }

    return [...baseRows].sort((left, right) => {
      const result = compareCsvValues(
        left[sortColumn] ?? "",
        right[sortColumn] ?? ""
      );
      return sortDirection === "asc" ? result : -result;
    });
  }, [parsed.rows, query, sortColumn, sortDirection]);

  if (parsed.columnCount === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-text-muted">
        CSV 内容为空
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border bg-bg-secondary px-4 py-2">
        <div className="text-xs text-text-muted">
          {parsed.rows.length} 行数据
          {parsed.hasHeader ? "，已识别首行为表头" : "，未识别到表头"}
          {parsed.delimiter === "\t" ? "，分隔符: TAB" : `，分隔符: ${parsed.delimiter}`}
        </div>
        <div className="relative w-full max-w-xs">
          <Search
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索单元格..."
            className="w-full rounded-md border border-transparent bg-bg-tertiary py-1.5 pl-7 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {parsed.error && (
        <div className="border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning">
          {parsed.error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
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
                      <span>{header || `列 ${index + 1}`}</span>
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
            {filteredRows.map((row, rowIndex) => (
              <tr
                key={`${rowIndex}-${row.join("|")}`}
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
                      {cell || " "}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-text-muted">
            没有匹配的数据
          </div>
        )}
      </div>
    </div>
  );
}
