import { describe, expect, it } from "vitest";
import { detectFileType, getLanguageFromFileName } from "@/utils/fileTypes";

describe("fileTypes", () => {
  it("detects structured and binary preview types", () => {
    expect(detectFileType("report.csv")).toBe("csv");
    expect(detectFileType("diagram.png")).toBe("image");
    expect(detectFileType("manual.pdf")).toBe("pdf");
    expect(detectFileType("notes.md")).toBe("markdown");
  });

  it("maps language hints for source files", () => {
    expect(getLanguageFromFileName("server.ts")).toBe("typescript");
    expect(getLanguageFromFileName("config.yaml")).toBe("yaml");
    expect(getLanguageFromFileName("schema.xml")).toBe("xml");
  });
});
