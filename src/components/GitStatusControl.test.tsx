// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GitStatusControl, { type GitRepositoryInfo } from "@/components/GitStatusControl";
import { useStore } from "@/store/useStore";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

let root: Root;
let container: HTMLDivElement;

const repository: GitRepositoryInfo = {
  rootPath: "/workspace/peek",
  branch: "main",
  upstream: "origin/main",
  ahead: 1,
  behind: 2,
  dirty: true,
};

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation((command: string) => {
    if (command === "get_git_repository_info") return Promise.resolve(repository);
    if (command === "git_pull") {
      return Promise.resolve({
        success: true,
        output: "Updating files",
        repository: { ...repository, behind: 0 },
      });
    }
    return Promise.reject(new Error(`Unexpected command: ${command}`));
  });
  useStore.setState({
    file: null,
    folder: { rootPath: "/workspace/peek", tree: [], selectedPath: null },
    terminalVisible: false,
    terminalNotices: [],
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Git status control", () => {
  it("appears for a repository and sends pull output to the terminal", async () => {
    await act(async () => {
      root.render(<GitStatusControl />);
    });

    const pullButton = container.querySelector<HTMLButtonElement>(
      "button[aria-label='拉取代码']"
    );
    expect(container.textContent).toContain("main");
    expect(pullButton?.disabled).toBe(false);

    await act(async () => {
      pullButton?.click();
    });

    expect(useStore.getState().terminalVisible).toBe(true);
    expect(useStore.getState().terminalNotices.map((notice) => notice.text)).toEqual([
      '$ git -C "/workspace/peek" pull --ff-only',
      "Updating files",
    ]);
    expect(invokeMock).toHaveBeenCalledWith("git_pull", { path: "/workspace/peek" });
  });
});
