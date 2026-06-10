// 不支持预览的二进制文件扩展名
const BINARY_EXTENSIONS = new Set([
  // 镜像和压缩包
  "dmg", "iso", "img", "pkg", "deb", "rpm",
  "zip", "rar", "7z", "tar", "gz", "bz2", "xz", "zst",
  // 可执行文件
  "exe", "dll", "so", "dylib", "app", "bin",
  // 视频
  "mp4", "avi", "mkv", "mov", "wmv", "flv", "webm",
  // 音频
  "mp3", "wav", "flac", "aac", "ogg", "m4a",
  // 字体
  "ttf", "otf", "woff", "woff2", "eot",
  // 文档
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  // 数据库
  "db", "sqlite", "sqlite3",
  // 其他
  "class", "jar", "war", "ear", "pyc", "o", "a", "lib",
]);

export const LARGE_FILE_MODE_THRESHOLD = 2 * 1024 * 1024;
export const MAX_LARGE_FILE_PREVIEW_LINES = 5000;
export const MAX_LARGE_FILE_PREVIEW_CHARS = 300_000;

/**
 * 检查文件是否是二进制文件（不支持预览）
 */
export function isBinaryFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * 检查文件大小是否超过限制
 */
export function shouldUseLargeFileMode(size: number): boolean {
  return size > LARGE_FILE_MODE_THRESHOLD;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
