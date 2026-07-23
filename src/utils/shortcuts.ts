export const SHORTCUT_ACTIONS = [
  "openFile",
  "find",
  "closeTab",
  "reopenClosedTab",
  "nextTab",
  "previousTab",
] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];
export type ShortcutBindings = Record<ShortcutAction, string>;

export const DEFAULT_SHORTCUTS: ShortcutBindings = {
  openFile: "Mod+O",
  find: "Mod+F",
  closeTab: "Mod+W",
  reopenClosedTab: "Mod+Shift+T",
  nextTab: "Ctrl+Tab",
  previousTab: "Ctrl+Shift+Tab",
};

const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift"]);

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function normalizeKey(key: string): string {
  if (key === " ") return "Space";
  if (key === "Esc") return "Escape";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;

  const modifiers: string[] = [];
  const usesPrimaryModifier = isMacPlatform() ? event.metaKey : event.ctrlKey;

  if (usesPrimaryModifier) modifiers.push("Mod");
  if (event.ctrlKey && !usesPrimaryModifier) modifiers.push("Ctrl");
  if (event.metaKey && !usesPrimaryModifier) modifiers.push("Meta");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");

  return [...modifiers, normalizeKey(event.key)].join("+");
}

export function isValidShortcut(shortcut: string): boolean {
  const parts = shortcut.split("+").filter(Boolean);
  if (parts.length < 2) return false;

  const key = parts.at(-1) ?? "";
  return !["Mod", "Ctrl", "Meta", "Alt", "Shift"].includes(key);
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split("+");
  const key = parts.at(-1);
  if (!key) return false;

  const needsMod = parts.includes("Mod");
  const needsCtrl = parts.includes("Ctrl");
  const needsMeta = parts.includes("Meta");
  const needsAlt = parts.includes("Alt");
  const needsShift = parts.includes("Shift");
  const modUsesMeta = isMacPlatform();
  const primaryPressed = modUsesMeta ? event.metaKey : event.ctrlKey;
  const ctrlAllowed = needsCtrl || (needsMod && !modUsesMeta);
  const metaAllowed = needsMeta || (needsMod && modUsesMeta);

  return normalizeKey(event.key) === key
    && (needsMod ? primaryPressed : true)
    && event.ctrlKey === ctrlAllowed
    && event.metaKey === metaAllowed
    && event.altKey === needsAlt
    && event.shiftKey === needsShift;
}

export function formatShortcut(shortcut: string): string {
  const isMac = isMacPlatform();
  return shortcut
    .split("+")
    .map((part) => {
      if (part === "Mod") return isMac ? "⌘" : "Ctrl";
      if (part === "Meta") return isMac ? "⌘" : "Meta";
      if (part === "Ctrl") return isMac ? "⌃" : "Ctrl";
      if (part === "Alt") return isMac ? "⌥" : "Alt";
      if (part === "Shift") return isMac ? "⇧" : "Shift";
      if (part === "ArrowUp") return "↑";
      if (part === "ArrowDown") return "↓";
      if (part === "ArrowLeft") return "←";
      if (part === "ArrowRight") return "→";
      return part;
    })
    .join(isMac ? "" : "+");
}

export function normalizeShortcutBindings(
  value: Partial<ShortcutBindings> | undefined
): ShortcutBindings {
  return SHORTCUT_ACTIONS.reduce<ShortcutBindings>((bindings, action) => {
    const candidate = value?.[action];
    bindings[action] = typeof candidate === "string" && isValidShortcut(candidate)
      ? candidate
      : DEFAULT_SHORTCUTS[action];
    return bindings;
  }, { ...DEFAULT_SHORTCUTS });
}
