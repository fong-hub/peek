import { describe, expect, it } from "vitest";
import { detectCsvDelimiter, parseCsvContent } from "@/utils/csv";

describe("csv parsing", () => {
  it("detects comma and tab delimiters", () => {
    expect(detectCsvDelimiter("name,age\nalice,20")).toBe(",");
    expect(detectCsvDelimiter("name\tage\nalice\t20")).toBe("\t");
  });

  it("parses quoted values and multiline cells", () => {
    const parsed = parseCsvContent(
      'name,notes\nalice,"line 1\nline 2"\nbob,"say ""hi"""'
    );

    expect(parsed.headers).toEqual(["name", "notes"]);
    expect(parsed.rows).toEqual([
      ["alice", "line 1\nline 2"],
      ["bob", 'say "hi"'],
    ]);
  });

  it("generates fallback headers when there is no explicit header row", () => {
    const parsed = parseCsvContent("1,2,3");

    expect(parsed.hasHeader).toBe(false);
    expect(parsed.headers).toEqual(["列 1", "列 2", "列 3"]);
    expect(parsed.rows).toEqual([["1", "2", "3"]]);
  });
});
