// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { getCurrentSession } from "@/utils/session";
import { useStore, type FileInfo } from "@/store/useStore";

const SESSION_KEY = "peek_current_session";

function file(path: string): FileInfo {
  return {
    name: path.split("/").pop() ?? path,
    path,
    content: path,
    type: "text",
  };
}

beforeEach(() => {
  localStorage.clear();
  useStore.setState({
    file: null,
    tabs: [],
    activeTabPath: null,
    closedTabs: [],
    folder: { rootPath: "/workspace", tree: [], selectedPath: null },
  });
});

describe("multi-tab session", () => {
  it("migrates the previous single-file session format", () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        rootPath: "/workspace",
        selectedPath: "/workspace/a.ts",
        filePath: "/workspace/a.ts",
      })
    );

    expect(getCurrentSession()).toMatchObject({
      tabPaths: ["/workspace/a.ts"],
      activeTabPath: "/workspace/a.ts",
    });
  });

  it("deduplicates tabs and selects the adjacent tab when closing the active one", () => {
    const { setFile, closeTab } = useStore.getState();
    setFile(file("/workspace/a.ts"), false);
    setFile(file("/workspace/b.ts"), false);
    setFile(file("/workspace/c.ts"), false);
    setFile({ ...file("/workspace/b.ts"), content: "updated" }, false);

    expect(useStore.getState().tabs.map((tab) => tab.path)).toEqual([
      "/workspace/a.ts",
      "/workspace/b.ts",
      "/workspace/c.ts",
    ]);
    expect(useStore.getState().file?.content).toBe("updated");

    closeTab("/workspace/b.ts");
    expect(useStore.getState().activeTabPath).toBe("/workspace/c.ts");
    expect(getCurrentSession().tabPaths).toEqual([
      "/workspace/a.ts",
      "/workspace/c.ts",
    ]);
  });
});
