#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🔨 开始构建 Peek Release..."

if [ -z "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" ]; then
  DEFAULT_KEY_PATH="$HOME/.tauri/peek.key"
  if [ -f "$DEFAULT_KEY_PATH" ]; then
    export TAURI_SIGNING_PRIVATE_KEY_PATH="$DEFAULT_KEY_PATH"
  fi
fi

if [ -z "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" ] || [ ! -f "${TAURI_SIGNING_PRIVATE_KEY_PATH}" ]; then
  echo "❌ 未找到 updater 签名私钥，请设置 TAURI_SIGNING_PRIVATE_KEY_PATH"
  exit 1
fi

SIGNING_KEY_PATH="${TAURI_SIGNING_PRIVATE_KEY_PATH}"
SIGNING_KEY_HEAD="$(head -n 1 "${SIGNING_KEY_PATH}" 2>/dev/null || true)"

# Tauri 2 updater signing reads the key from TAURI_SIGNING_PRIVATE_KEY.
if [ "${SIGNING_KEY_HEAD}" = "untrusted comment: minisign encrypted secret key" ]; then
  export TAURI_SIGNING_PRIVATE_KEY="$(base64 < "${SIGNING_KEY_PATH}" | tr -d '\n')"
  echo "🔐 使用旧格式 updater 私钥兼容模式: ${SIGNING_KEY_PATH}"
else
  export TAURI_SIGNING_PRIVATE_KEY="$(tr -d '\n' < "${SIGNING_KEY_PATH}")"
  echo "🔐 使用 updater 签名私钥: ${SIGNING_KEY_PATH}"
fi

export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD-}"

# 清理旧构建产物
echo "🧹 清理旧构建产物..."
rm -rf src-tauri/target/release/bundle

# 构建前端
echo "📦 构建前端..."
npm run build

# 构建 Tauri Release
echo "🚀 构建 Tauri Release（这可能需要几分钟）..."
npm run tauri build

echo ""
echo "✅ 构建完成！"
echo ""
echo "📂 构建产物目录:"
find src-tauri/target/release/bundle -type f | while read -r f; do
  size=$(du -h "$f" | cut -f1)
  echo "   $size  $f"
done
