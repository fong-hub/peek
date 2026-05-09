# Peek — 极速文件预览器

Peek 是一款基于 Tauri + React 的本地文件预览器，主打“零延迟”查看体验。无论是 Markdown 的美观渲染、JSON 的结构化展示，还是纯文本、日志等常见格式，Peek 都能在瞬间以最优雅的方式呈现。

## 技术栈

- **框架**: [Tauri v2](https://tauri.app/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS v4](https://tailwindcss.com/)
- **状态管理**: [Zustand](https://github.com/pmndrs/zustand)
- **图标**: [Lucide React](https://lucide.dev/)

## 功能特性

- ✅ **多格式支持**: Markdown、JSON、HTML、纯文本、日志文件
- ✅ **极速打开**: 系统对话框（Ctrl/Cmd + O）+ 拖拽打开
- ✅ **智能识别**: 自动根据文件扩展名识别类型
- ✅ **Markdown 渲染**: 完整支持 GFM 语法、代码高亮、表格
- ✅ **JSON 折叠树**: 可展开/折叠的结构化浏览
- ✅ **HTML 双模式**: 渲染预览与源码查看一键切换
- ✅ **日志高亮**: 行号展示，ERROR/WARN/INFO/DEBUG 级别颜色区分
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

## 打包产物

| 平台 | 命令 | 输出路径 |
|------|------|----------|
| macOS | `npm run tauri:build` | `src-tauri/target/release/bundle/dmg/` |
| Windows | `npm run tauri:build -- --target x86_64-pc-windows-msvc` | `src-tauri/target/release/bundle/msi/` |

## 后续规划

- [ ] 大文件虚拟滚动优化
- [ ] 更多格式支持（CSV、YAML、XML）
- [ ] 命令行支持 `peek <file>`
- [ ] macOS QuickLook 扩展
- [ ] 多标签页预览
- [ ] 插件系统

## License

MIT
