import { describe, expect, it } from "vitest";
import {
  findLineMatches,
  findTextMatches,
  getSearchableContent,
  wrapMatchIndex,
} from "@/utils/search";
import type { FileInfo } from "@/store/useStore";

function file(type: FileInfo["type"], content: string): FileInfo {
  return { name: `sample.${type}`, path: `/tmp/sample.${type}`, type, content };
}

describe("file search", () => {
  it("finds case-insensitive non-overlapping matches", () => {
    expect(findTextMatches("Peek peek PEEK", "peek")).toEqual([
      { start: 0, end: 4 },
      { start: 5, end: 9 },
      { start: 10, end: 14 },
    ]);
    expect(findTextMatches("aaaa", "aa")).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });

  it("maps matches to lines in navigation order", () => {
    expect(findLineMatches(["alpha beta", "BETA"], "beta")).toEqual([
      { start: 6, end: 10, index: 0, lineIndex: 0 },
      { start: 0, end: 4, index: 1, lineIndex: 1 },
    ]);
  });

  it("uses the same formatted content shown by structured previewers", () => {
    expect(getSearchableContent(file("json", '{"name":"Peek"}'))).toContain(
      '  "name": "Peek"'
    );
    expect(getSearchableContent(file("csv", ",value\nalpha,one"))).toBe(
      "列 1\nvalue\nalpha\none"
    );
    expect(getSearchableContent(file("image", ""))).toBeNull();
  });

  it("wraps result navigation in both directions", () => {
    expect(wrapMatchIndex(3, 3)).toBe(0);
    expect(wrapMatchIndex(-1, 3)).toBe(2);
    expect(wrapMatchIndex(10, 0)).toBe(0);
  });
});
