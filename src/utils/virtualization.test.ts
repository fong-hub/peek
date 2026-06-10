import { describe, expect, it } from "vitest";
import {
  DEFAULT_LINE_HEIGHT,
  getVirtualWindow,
  shouldVirtualizeLines,
} from "@/utils/virtualization";

describe("virtualization helpers", () => {
  it("only virtualizes large line sets", () => {
    expect(shouldVirtualizeLines(50)).toBe(false);
    expect(shouldVirtualizeLines(500)).toBe(true);
  });

  it("computes a stable visible window with overscan", () => {
    const windowState = getVirtualWindow({
      totalLines: 1000,
      scrollTop: 560,
      containerHeight: 280,
      lineHeight: DEFAULT_LINE_HEIGHT,
      overscan: 4,
    });

    expect(windowState.startIndex).toBe(16);
    expect(windowState.endIndex).toBe(34);
    expect(windowState.topSpacerHeight).toBe(448);
    expect(windowState.bottomSpacerHeight).toBe((1000 - 34) * DEFAULT_LINE_HEIGHT);
  });
});
