import { describe, expect, it } from "vitest";
import { getRelativePathSegments, isSupportedFile, joinPath } from "@/utils/fileTree";

describe("fileTree helpers", () => {
  it("joins unix and windows paths", () => {
    expect(joinPath("/tmp/project", "README.md")).toBe("/tmp/project/README.md");
    expect(joinPath("C:\\work", "src")).toBe("C:\\work\\src");
  });

  it("extracts relative path segments for nested selections", () => {
    expect(
      getRelativePathSegments(
        "/Users/fong/work/code/peek",
        "/Users/fong/work/code/peek/src/components/App.tsx"
      )
    ).toEqual(["src", "components", "App.tsx"]);
  });

  it("keeps new previewable formats visible in the tree", () => {
    expect(isSupportedFile("cover.png")).toBe(true);
    expect(isSupportedFile("slides.pdf")).toBe(true);
    expect(isSupportedFile("data.csv")).toBe(true);
    expect(isSupportedFile("archive.zip")).toBe(false);
  });
});
