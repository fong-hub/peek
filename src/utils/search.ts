import type { FileInfo } from "@/store/useStore";
import { parseCsvContent } from "@/utils/csv";

export interface TextMatch {
  start: number;
  end: number;
}

export interface LineMatch extends TextMatch {
  index: number;
  lineIndex: number;
}

export function findTextMatches(text: string, query: string): TextMatch[] {
  const normalizedQuery = query.toLocaleLowerCase();
  if (!normalizedQuery) return [];

  const normalizedText = text.toLocaleLowerCase();
  const matches: TextMatch[] = [];
  let position = 0;

  while (position <= normalizedText.length - normalizedQuery.length) {
    const start = normalizedText.indexOf(normalizedQuery, position);
    if (start === -1) break;
    matches.push({ start, end: start + normalizedQuery.length });
    position = start + Math.max(1, normalizedQuery.length);
  }

  return matches;
}

export function findLineMatches(lines: string[], query: string): LineMatch[] {
  const matches: LineMatch[] = [];

  lines.forEach((line, lineIndex) => {
    findTextMatches(line, query).forEach((match) => {
      matches.push({ ...match, index: matches.length, lineIndex });
    });
  });

  return matches;
}

export function getSearchableContent(file: FileInfo): string | null {
  if (["image", "pdf", "unsupported", "unknown"].includes(file.type)) {
    return null;
  }

  if (file.type === "json") {
    try {
      return JSON.stringify(JSON.parse(file.content), null, 2);
    } catch {
      return file.content;
    }
  }

  if (file.type === "csv") {
    const parsed = parseCsvContent(file.content);
    const headers = parsed.headers.map((header, index) => header || `列 ${index + 1}`);
    return [...headers, ...parsed.rows.flat()].join("\n");
  }

  return file.content;
}

export function wrapMatchIndex(index: number, matchCount: number): number {
  if (matchCount <= 0) return 0;
  return (index + matchCount) % matchCount;
}
