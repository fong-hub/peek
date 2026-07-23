import { appCacheDir, join } from "@tauri-apps/api/path";
import { BaseDirectory, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";

const HTML_PREVIEW_CACHE_DIR = "html-preview-cache";

function hashString(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function ensureHtmlPreviewCacheDir() {
  await mkdir(HTML_PREVIEW_CACHE_DIR, {
    baseDir: BaseDirectory.AppCache,
    recursive: true,
  });
}

export async function writeHtmlPreviewFile(
  sourceKey: string,
  content: string
): Promise<string> {
  const fileName = `${hashString(sourceKey)}-${hashString(content)}.html`;

  await ensureHtmlPreviewCacheDir();
  await writeTextFile(`${HTML_PREVIEW_CACHE_DIR}/${fileName}`, content, {
    baseDir: BaseDirectory.AppCache,
  });

  const cacheRoot = await appCacheDir();
  return join(cacheRoot, HTML_PREVIEW_CACHE_DIR, fileName);
}

export async function getHtmlPreviewModulePath(sourcePath: string): Promise<string> {
  const cacheRoot = await appCacheDir();
  return join(cacheRoot, HTML_PREVIEW_CACHE_DIR, `${hashString(sourcePath)}.js`);
}

export async function writeHtmlPreviewModuleFile(
  sourcePath: string,
  content: string
): Promise<string> {
  const fileName = `${hashString(sourcePath)}.js`;
  await ensureHtmlPreviewCacheDir();
  await writeTextFile(`${HTML_PREVIEW_CACHE_DIR}/${fileName}`, content, {
    baseDir: BaseDirectory.AppCache,
  });
  return getHtmlPreviewModulePath(sourcePath);
}
