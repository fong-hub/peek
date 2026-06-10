<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" height="128" alt="Peek Logo">
</p>

# Peek — 开发者文件预览器

Peek 是一款基于 Tauri + React 的本地开发者文件预览器，聚焦 Markdown、JSON、HTML、代码、纯文本和日志等文本类内容的快速浏览体验。

## 技术栈

- **框架**: [Tauri v2](https://tauri.app/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS v4](https://tailwindcss.com/)
- **状态管理**: [Zustand](https://github.com/pmndrs/zustand)
- **图标**: [Lucide React](https://lucide.dev/)

## 功能特性

- ✅ **多格式支持**: Markdown、JSON、HTML、代码、纯文本、日志文件
- ✅ **文件夹浏览**: 左侧文件树，支持拖入文件夹浏览项目
- ✅ **极速打开**: 系统对话框（Ctrl/Cmd + O）+ 拖拽打开
- ✅ **智能识别**: 自动根据文件扩展名识别类型
- ✅ **Markdown 渲染**: 完整支持 GFM 语法、代码高亮、表格
- ✅ **JSON 格式化展示**: 自动格式化并带行号预览
- ✅ **HTML 双模式**: 渲染预览与源码查看一键切换
- ✅ **日志高亮**: 行号展示，ERROR/WARN/INFO/DEBUG 级别颜色区分
- ✅ **最近打开与恢复**: 支持最近记录、恢复上次工作区
- ✅ **界面状态记忆**: 记住主题、侧边栏宽度、信息面板状态
- ✅ **命令行打开**: 支持 `peek <path>` / `peek open <path>` / `peek --help` / `peek --version`
- ✅ **CLI 单实例转发**: 已启动时再次执行 `peek` 会复用当前窗口并切换到目标路径
- ✅ **深色/浅色主题**: 一键切换，全程无闪烁
- ✅ **快捷键**: Ctrl/Cmd + O 打开，ESC 关闭

## 项目结构

```
peek/
├── src/                          # React 前端源码
│   ├── App.tsx                   # 应用入口
│   ├── main.tsx                  # React 挂载点
│   ├── index.css                 # 全局样式 + Tailwind
│   ├── components/               # UI 组件
│   │   ├── Header.tsx            # 顶部栏（打开/关闭/主题）
│   │   ├── Sidebar.tsx           # 左侧文件树
│   │   ├── EmptyState.tsx        # 空状态引导
│   │   ├── FileDropZone.tsx      # 文件拖拽区域
│   │   └── PreviewContainer.tsx  # 预览器路由
│   ├── previewers/               # 各类文件预览器
│   │   ├── MarkdownPreviewer.tsx
│   │   ├── JsonPreviewer.tsx
│   │   ├── TextPreviewer.tsx
│   │   ├── HtmlPreviewer.tsx
│   │   └── LogPreviewer.tsx
│   ├── store/
│   │   └── useStore.ts           # Zustand 全局状态
│   └── utils/
│       ├── fileTree.ts           # 文件树构建工具
│       └── fileTypes.ts          # 文件类型检测工具
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/main.rs               # 主进程入口
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Tauri 配置
│   └── capabilities/default.json # 权限声明
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

## 开发环境准备

1. **Node.js** (v20+)
2. **Rust** (通过 [rustup](https://rustup.rs/) 安装)
3. 推荐配置 Cargo 国内镜像（如遇网络问题）:
   ```toml
   # ~/.cargo/config.toml
   [source.crates-io]
   replace-with = 'tuna'
   [source.tuna]
   registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"
   ```

## 常用命令

```bash
# 安装依赖
npm install

# 开发模式（热更新）
npm run tauri:dev

# 前端单独构建
npm run build

# 生产打包（生成 .app / .exe）
npm run tauri:build
```

## 命令行打开

开发构建或打包后的可执行文件都支持直接传入路径：

```bash
./src-tauri/target/release/peek README.md
./src-tauri/target/release/peek open /path/to/folder
./src-tauri/target/release/peek --help
./src-tauri/target/release/peek --version
```

打包后的 macOS 应用可以安装一个 PATH 包装脚本：

```bash
npm run cli:install
```

默认会安装到 `~/.local/bin/peek`。如果需要全局命令：

```bash
npm run cli:install -- --bin-dir /usr/local/bin
```

如果你的应用不在 `/Applications/Peek.app`，可以显式指定：

```bash
npm run cli:install -- --app "/Applications/Peek.app"
```

安装后即可直接使用：

```bash
peek README.md
peek .
peek open ~/project
peek --help
peek --version
```

当 Peek 已经在运行时，再次执行 `peek <path>` 会复用当前窗口并切换到新路径，不会再启动第二个实例。

## 打包产物

| 平台 | 命令 | 输出路径 |
|------|------|----------|
| macOS | `npm run tauri:build` | `src-tauri/target/release/bundle/dmg/` |
| Windows | `npm run tauri:build -- --target x86_64-pc-windows-msvc` | `src-tauri/target/release/bundle/msi/` |

## 后续规划

- [ ] 大文件虚拟滚动优化
- [ ] 更多格式支持（CSV、YAML、XML）
- [ ] macOS QuickLook 扩展
- [ ] 多标签页预览
- [ ] 插件系统

## License

MIT
