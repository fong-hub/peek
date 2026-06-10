#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "❌ 请提供版本号"
  echo "用法: ./scripts/release.sh <version>"
  echo "示例: ./scripts/release.sh 1.1.0"
  exit 1
fi

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "❌ 当前分支是 $BRANCH，请切换到 main 后再发布"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ 工作区有未提交的更改，请先提交后再执行 release 脚本"
  git status --short
  exit 1
fi

if ! command -v gh &> /dev/null; then
  echo "❌ 请先安装 GitHub CLI (gh)"
  echo "   macOS: brew install gh"
  echo "   其他: https://cli.github.com/"
  exit 1
fi

# 检查 gh 是否已登录
if ! gh auth status &> /dev/null; then
  echo "❌ 请先登录 GitHub CLI: gh auth login"
  exit 1
fi

REPO="fong-hub/peek"
TAG="v${VERSION}"
BUNDLE_DIR="src-tauri/target/release/bundle"

collect_assets() {
  local pattern
  ASSETS=()
  local -a patterns=(
    "*.dmg"
    "*.app.tar.gz"
    "*.msi"
    "*.msi.zip"
    "*-setup.exe"
    "*-setup.exe.zip"
  )

  for pattern in "${patterns[@]}"; do
    while IFS= read -r asset; do
      [ -n "$asset" ] && ASSETS+=("$asset")
    done < <(find "$BUNDLE_DIR" -type f -name "$pattern" | sort)
  done
}

echo ""
echo "🚀 开始发布 Peek v${VERSION}"
echo "========================================"

echo ""
echo "📝 步骤 1/6: 同步版本号..."
node scripts/sync-version.js "$VERSION"

echo ""
echo "📝 步骤 2/6: 提交版本更新..."
git add -A
git commit -m "chore: release v${VERSION}" || echo "⚠️  没有需要提交的更改"

echo ""
echo "🔨 步骤 3/6: 构建 Release..."
./scripts/build-release.sh

echo ""
echo "📦 收集构建产物..."
collect_assets

if [ ${#ASSETS[@]} -eq 0 ]; then
  echo "❌ 未找到可上传的构建产物"
  exit 1
fi

for asset in "${ASSETS[@]}"; do
  echo "   - $(basename "$asset")"
done

echo ""
echo "📄 步骤 4/6: 生成 latest.json..."
node scripts/generate-latest-json.js "$VERSION" "${ASSETS[@]}"

echo ""
echo "🏷️  步骤 5/6: 创建并推送 tag..."
if git rev-parse "$TAG" >/dev/null 2>&1; then
  git tag -fa "$TAG" -m "Release ${TAG}"
else
  git tag -a "$TAG" -m "Release ${TAG}"
fi

git push origin "$BRANCH"
git push origin "refs/tags/${TAG}" --force

echo ""
echo "📤 步骤 6/6: 创建 GitHub Release 并上传..."
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "${ASSETS[@]}" latest.json --repo "$REPO" --clobber
else
  gh release create "$TAG" \
    --repo "$REPO" \
    --title "Peek v${VERSION}" \
    --generate-notes \
    "${ASSETS[@]}" \
    latest.json
fi

echo ""
echo "✅ GitHub Release 已更新"

echo ""
echo "========================================"
echo "🎉 Peek v${VERSION} 发布完成!"
echo ""
echo "🔗 Release 页面: https://github.com/${REPO}/releases/tag/${TAG}"
echo "========================================"
