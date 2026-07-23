// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SearchBar from "@/components/SearchBar";
import VirtualizedLineView from "@/components/VirtualizedLineView";
import { useStore, type FileInfo } from "@/store/useStore";

let root: Root;
let container: HTMLDivElement;

const sampleFile: FileInfo = {
  name: "sample.txt",
  path: "/tmp/sample.txt",
  type: "text",
  content: "Peek first\nsecond peek\nPEEK third",
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  useStore.setState({
    file: sampleFile,
    tabs: [sampleFile],
    activeTabPath: sampleFile.path,
    searchVisible: true,
    searchQuery: "peek",
    activeSearchMatch: 0,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("search bar", () => {
  it("counts, highlights, and navigates matches", async () => {
    await act(async () => {
      root.render(
        <div style={{ height: 300 }}>
          <SearchBar />
          <VirtualizedLineView lines={sampleFile.content.split("\n")} />
        </div>
      );
    });

    const input = container.querySelector<HTMLInputElement>("input[aria-label='搜索当前文件']");
    const matches = container.querySelectorAll("mark[data-search-match]");
    expect(input).not.toBeNull();
    expect(container.textContent).toContain("1 / 3");
    expect(matches).toHaveLength(3);
    expect(matches[0].className).toBe("search-match-active");

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(useStore.getState().activeSearchMatch).toBe(1);
    expect(container.textContent).toContain("2 / 3");
    expect(container.querySelectorAll("mark[data-search-match]")[1].className).toBe(
      "search-match-active"
    );
  });

  it("closes without closing the active file when Escape is pressed", async () => {
    await act(async () => {
      root.render(<SearchBar />);
    });
    const input = container.querySelector<HTMLInputElement>("input[aria-label='搜索当前文件']");

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(useStore.getState().searchVisible).toBe(false);
    expect(useStore.getState().file).toBe(sampleFile);
  });
});
