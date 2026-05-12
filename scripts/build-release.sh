#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🔨 开始构建 Peek Release..."

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
