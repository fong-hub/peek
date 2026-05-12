#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "❌ 请提供版本号"
  echo "用法: ./scripts/release.sh <version>"
  echo "示例: ./scripts/release.sh 1.0.0-beta.5"
  exit 1
fi

# 检查当前分支
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  当前分支是 $BRANCH，建议切换到 main 分支发布"
  read -p "是否继续? (y/N): " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 检查工作区是否干净
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠️  工作区有未提交的更改:"
  git status --short
  read -p "是否继续? (y/N): " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 检查 gh CLI
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
echo ""
echo "🚀 开始发布 Peek v${VERSION}"
echo "========================================"

# 1. 同步版本号
echo ""
echo "📝 步骤 1/6: 同步版本号..."
node scripts/sync-version.js "$VERSION"

# 2. 提交版本更新
echo ""
echo "📝 步骤 2/6: 提交版本更新..."
git add -A
git commit -m "chore: bump version to ${VERSION}" || echo "⚠️  没有需要提交的更改"

# 3. 创建 tag
echo ""
echo "🏷️  步骤 3/6: 创建 tag v${VERSION}..."
git tag -a "v${VERSION}" -m "Release v${VERSION}" || {
  echo "⚠️  tag v${VERSION} 已存在，是否强制更新? (y/N)"
  read -r confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    git tag -fa "v${VERSION}" -m "Release v${VERSION}"
  fi
}

# 4. 推送到远程
echo ""
echo "🌐 步骤 4/6: 推送到远程..."
git push origin "$(git branch --show-current)"
git push origin "v${VERSION}"

# 5. 构建
echo ""
echo "🔨 步骤 5/6: 构建 Release..."
./scripts/build-release.sh

# 6. 创建 GitHub Release 并上传
echo ""
echo "📤 步骤 6/6: 创建 GitHub Release 并上传..."

# 检测构建产物
BUNDLE_DIR="src-tauri/target/release/bundle"
ASSETS=()

# macOS DMG
for f in "$BUNDLE_DIR"/dmg/*.dmg; do
  [ -f "$f" ] && ASSETS+=("$f")
done

# macOS App (通常不需要单独上传，DMG 已包含)
# Windows MSI
for f in "$BUNDLE_DIR"/msi/*.msi; do
  [ -f "$f" ] && ASSETS+=("$f")
done

if [ ${#ASSETS[@]} -eq 0 ]; then
  echo "⚠️  未找到构建产物，跳过上传"
else
  echo "📦 找到的构建产物:"
  for f in "${ASSETS[@]}"; do
    echo "   - $(basename "$f")"
  done

  # 创建 Release
  gh release create "v${VERSION}" \
    --repo "$REPO" \
    --title "Peek v${VERSION}" \
    --generate-notes \
    "${ASSETS[@]}"

  echo ""
  echo "✅ GitHub Release 创建成功!"
fi

# 生成并上传 latest.json
echo ""
echo "📄 生成 latest.json..."
node scripts/generate-latest-json.js "$VERSION" "${ASSETS[@]}"

if [ -f "latest.json" ]; then
  echo "📤 上传 latest.json..."
  gh release upload "v${VERSION}" latest.json --repo "$REPO" --clobber
  echo "✅ latest.json 已上传"
fi

echo ""
echo "========================================"
echo "🎉 Peek v${VERSION} 发布完成!"
echo ""
echo "🔗 Release 页面: https://github.com/${REPO}/releases/tag/v${VERSION}"
echo "========================================"
