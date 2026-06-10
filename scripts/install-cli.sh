#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${APP_PATH:-/Applications/Peek.app}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
COMMAND_NAME="${COMMAND_NAME:-peek}"

usage() {
  cat <<'EOF'
用法: ./scripts/install-cli.sh [--app /path/to/Peek.app|/path/to/peek] [--bin-dir /path/to/bin] [--name peek]

示例:
  ./scripts/install-cli.sh
  ./scripts/install-cli.sh --bin-dir /usr/local/bin
  ./scripts/install-cli.sh --app "/Applications/Peek.app"
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)
      APP_PATH="${2:-}"
      shift 2
      ;;
    --bin-dir)
      BIN_DIR="${2:-}"
      shift 2
      ;;
    --name)
      COMMAND_NAME="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      echo >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -d "$APP_PATH" ]]; then
  TARGET="$APP_PATH/Contents/MacOS/peek"
else
  TARGET="$APP_PATH"
fi

if [[ ! -x "$TARGET" ]]; then
  echo "未找到可执行文件: $TARGET" >&2
  exit 1
fi

mkdir -p "$BIN_DIR"

TARGET_ESCAPED="$(printf '%q' "$TARGET")"
LAUNCHER_PATH="$BIN_DIR/$COMMAND_NAME"

cat > "$LAUNCHER_PATH" <<EOF
#!/usr/bin/env bash
exec $TARGET_ESCAPED "\$@"
EOF

chmod +x "$LAUNCHER_PATH"

echo "已安装 CLI: $LAUNCHER_PATH"
echo "目标可执行文件: $TARGET"

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo
  echo "当前 PATH 不包含 $BIN_DIR"
  echo "请把下面这行加入你的 shell 配置文件："
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
fi
