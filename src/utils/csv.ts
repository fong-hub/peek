export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  columnCount: number;
  delimiter: string;
  hasHeader: boolean;
  error?: string;
}

const DELIMITER_CANDIDATES = [",", ";", "\t"];

function normalizeRows(rows: string[][], columnCount: number): string[][] {
  return rows.map((row) => {
    if (row.length === columnCount) {
      return row;
    }

    return [...row, ...Array.from({ length: columnCount - row.length }, () => "")];
  });
}

export function detectCsvDelimiter(content: string): string {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return ",";
  }

  let bestDelimiter = ",";
  let bestScore = -1;

  for (const delimiter of DELIMITER_CANDIDATES) {
    const score = firstLine.split(delimiter).length - 1;
    if (score > bestScore) {
      bestDelimiter = delimiter;
      bestScore = score;
    }
  }

  return bestDelimiter;
}

export function parseCsvContent(
  content: string,
  delimiter = detectCsvDelimiter(content)
): CsvParseResult {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  let error: string | undefined;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (inQuotes) {
    error = "CSV 引号未闭合，当前预览可能不完整";
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  if (rows[0]?.[0]?.charCodeAt(0) === 0xfeff) {
    rows[0][0] = rows[0][0].slice(1);
  }

  const columnCount = rows.reduce(
    (max, row) => Math.max(max, row.length),
    0
  );

  if (columnCount === 0) {
    return {
      headers: [],
      rows: [],
      columnCount: 0,
      delimiter,
      hasHeader: false,
      error,
    };
  }

  const normalizedRows = normalizeRows(rows, columnCount);
  const hasHeader = normalizedRows.length > 1;
  const headers = hasHeader
    ? normalizedRows[0]
    : Array.from({ length: columnCount }, (_, index) => `列 ${index + 1}`);
  const dataRows = hasHeader ? normalizedRows.slice(1) : normalizedRows;

  return {
    headers,
    rows: dataRows,
    columnCount,
    delimiter,
    hasHeader,
    error,
  };
}
