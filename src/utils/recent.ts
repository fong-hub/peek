const STORAGE_KEY = "peek_recent_paths";
const MAX_RECENT = 10;

export interface RecentItem {
  path: string;
  name: string;
  isDirectory: boolean;
  timestamp: number;
}

export function getRecentItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as RecentItem[];
    return items.filter((item) => item.path && item.name);
  } catch {
    return [];
  }
}

export function addRecentItem(path: string, name: string, isDirectory: boolean) {
  const items = getRecentItems();
  const filtered = items.filter((item) => item.path !== path);
  filtered.unshift({ path, name, isDirectory, timestamp: Date.now() });
  const trimmed = filtered.slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function removeRecentItem(path: string) {
  const items = getRecentItems();
  const filtered = items.filter((item) => item.path !== path);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearRecentItems() {
  localStorage.removeItem(STORAGE_KEY);
}
