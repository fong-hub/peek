export type ThemeMode = "dark" | "light";

export interface UiPreferences {
  theme: ThemeMode;
  sidebarVisible: boolean;
  sidebarWidth: number;
  infoPanelVisible: boolean;
}

export interface SessionSnapshot {
  rootPath: string | null;
  selectedPath: string | null;
  filePath: string | null;
  tabPaths: string[];
  activeTabPath: string | null;
}

const UI_PREFERENCES_KEY = "peek_ui_preferences";
const CURRENT_SESSION_KEY = "peek_current_session";
const LAST_SESSION_KEY = "peek_last_session";

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  theme: "dark",
  sidebarVisible: true,
  sidebarWidth: 256,
  infoPanelVisible: true,
};

export const EMPTY_SESSION: SessionSnapshot = {
  rootPath: null,
  selectedPath: null,
  filePath: null,
  tabPaths: [],
  activeTabPath: null,
};

function isBrowserAvailable(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getStoredUiPreferences(): UiPreferences {
  if (!isBrowserAvailable()) {
    return DEFAULT_UI_PREFERENCES;
  }

  const parsed = safeParse<Partial<UiPreferences>>(localStorage.getItem(UI_PREFERENCES_KEY));
  return {
    theme: parsed?.theme === "light" ? "light" : DEFAULT_UI_PREFERENCES.theme,
    sidebarVisible: typeof parsed?.sidebarVisible === "boolean"
      ? parsed.sidebarVisible
      : DEFAULT_UI_PREFERENCES.sidebarVisible,
    sidebarWidth: typeof parsed?.sidebarWidth === "number"
      ? parsed.sidebarWidth
      : DEFAULT_UI_PREFERENCES.sidebarWidth,
    infoPanelVisible: typeof parsed?.infoPanelVisible === "boolean"
      ? parsed.infoPanelVisible
      : DEFAULT_UI_PREFERENCES.infoPanelVisible,
  };
}

export function saveUiPreferences(preferences: UiPreferences) {
  if (!isBrowserAvailable()) return;
  localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferences));
}

function normalizeSessionSnapshot(value: Partial<SessionSnapshot> | null): SessionSnapshot {
  const legacyFilePath = typeof value?.filePath === "string" ? value.filePath : null;
  const tabPaths = Array.isArray(value?.tabPaths)
    ? Array.from(new Set(value.tabPaths.filter((path): path is string => typeof path === "string")))
    : legacyFilePath
      ? [legacyFilePath]
      : [];
  const requestedActivePath = typeof value?.activeTabPath === "string"
    ? value.activeTabPath
    : legacyFilePath;
  const activeTabPath = requestedActivePath && tabPaths.includes(requestedActivePath)
    ? requestedActivePath
    : tabPaths.at(-1) ?? null;

  return {
    rootPath: typeof value?.rootPath === "string" ? value.rootPath : null,
    selectedPath: typeof value?.selectedPath === "string" ? value.selectedPath : null,
    filePath: activeTabPath,
    tabPaths,
    activeTabPath,
  };
}

export function getCurrentSession(): SessionSnapshot {
  if (!isBrowserAvailable()) return EMPTY_SESSION;
  return normalizeSessionSnapshot(
    safeParse<Partial<SessionSnapshot>>(localStorage.getItem(CURRENT_SESSION_KEY))
  );
}

export function saveCurrentSession(session: SessionSnapshot) {
  if (!isBrowserAvailable()) return;
  localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
}

export function getLastSession(): SessionSnapshot {
  if (!isBrowserAvailable()) return EMPTY_SESSION;
  return normalizeSessionSnapshot(
    safeParse<Partial<SessionSnapshot>>(localStorage.getItem(LAST_SESSION_KEY))
  );
}

export function saveLastSession(session: SessionSnapshot) {
  if (!isBrowserAvailable()) return;
  localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session));
}

export function isEmptySession(session: SessionSnapshot): boolean {
  return !session.rootPath && session.tabPaths.length === 0 && !session.filePath;
}
