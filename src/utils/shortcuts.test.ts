// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHORTCUTS,
  matchesShortcut,
  normalizeShortcutBindings,
  shortcutFromKeyboardEvent,
} from "@/utils/shortcuts";

describe("keyboard shortcuts", () => {
  it("matches the platform primary modifier without accepting extra modifiers", () => {
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "f", ctrlKey: true }), "Mod+F")).toBe(true);
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, shiftKey: true }), "Mod+F")).toBe(false);
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "Tab", ctrlKey: true, shiftKey: true }), "Ctrl+Shift+Tab")).toBe(true);
  });

  it("records and normalizes keyboard events", () => {
    expect(shortcutFromKeyboardEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, shiftKey: true })
    )).toBe("Mod+Shift+K");
  });

  it("migrates missing and invalid stored bindings to defaults", () => {
    expect(normalizeShortcutBindings({ find: "Alt+K", closeTab: "W" })).toEqual({
      ...DEFAULT_SHORTCUTS,
      find: "Alt+K",
    });
  });
});
