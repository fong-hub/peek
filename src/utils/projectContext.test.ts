import { describe, expect, it } from "vitest";
import { getPathName, getProjectContextPath } from "@/utils/projectContext";

describe("project context", () => {
  it("prefers the workspace root over the active file", () => {
    expect(getProjectContextPath("/workspace", "/workspace/src/main.ts")).toBe(
      "/workspace"
    );
  });

  it("uses a standalone file when no workspace is open", () => {
    expect(getProjectContextPath(null, "/tmp/sample.ts")).toBe("/tmp/sample.ts");
    expect(getProjectContextPath(null, null)).toBeNull();
  });

  it("formats a compact path label", () => {
    expect(getPathName("/workspace/peek")).toBe("peek");
    expect(getPathName(null)).toBe("当前目录");
  });
});
