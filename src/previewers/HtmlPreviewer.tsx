import { useState, useMemo, useEffect, useCallback } from "react";
import { Eye, Code } from "lucide-react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "@/store/useStore";
import { detectFileType } from "@/utils/fileTypes";

interface Props {
  content: string;
}

/** 注入 iframe 的脚本：拦截所有本地导航并通知父窗口 */
const NAVIGATION_INTERCEPT_SCRIPT = `
<script>
(function() {
  function isLocalUrl(url) {
    return url && !url.match(/^https?:/i) && !url.match(/^data:/i) && !url.match(/^javascript:/i);
  }
  function notifyNavigate(url) {
    window.parent.postMessage({ type: 'peek-navigate', url: url }, '*');
  }

  // 拦截 location.href setter
  try {
    var locProto = Object.getPrototypeOf(window.location);
    var hrefDesc = Object.getOwnPropertyDescriptor(locProto, 'href') || Object.getOwnPropertyDescriptor(window.location, 'href');
    if (hrefDesc && hrefDesc.set) {
      Object.defineProperty(window.location, 'href', {
        get: function() { return hrefDesc.get.call(window.location); },
        set: function(url) {
          if (isLocalUrl(url)) { notifyNavigate(url); return; }
          hrefDesc.set.call(window.location, url);
        }
      });
    }
  } catch(e) {}

  // 拦截 location.assign / replace
  var origAssign = window.location.assign;
  window.location.assign = function(url) {
    if (isLocalUrl(url)) { notifyNavigate(url); return; }
    origAssign.call(window.location, url);
  };
  var origReplace = window.location.replace;
  window.location.replace = function(url) {
    if (isLocalUrl(url)) { notifyNavigate(url); return; }
    origReplace.call(window.location, url);
  };

  // 拦截 window.open
  var origOpen = window.open;
  window.open = function(url, target, features) {
    if (url && isLocalUrl(url)) { notifyNavigate(url); return null; }
    return origOpen.apply(this, arguments);
  };

  // 拦截点击（包含动态添加的元素）
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document.body) {
      if (el.tagName === 'A' && el.href) {
        if (isLocalUrl(el.href)) {
          e.preventDefault();
          e.stopPropagation();
          notifyNavigate(el.href);
          return false;
        }
        // 外部链接用新标签打开
        e.preventDefault();
        e.stopPropagation();
        window.open(el.href, '_blank');
        return false;
      }
      el = el.parentElement;
    }
  }, true);

  // 拦截表单提交
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form.action && isLocalUrl(form.action)) {
      e.preventDefault();
      notifyNavigate(form.action);
    }
  }, true);
})();
</script>
`;

/** 注入 iframe 的脚本：拦截嵌套 iframe 的本地 src，通过 postMessage 让父窗口加载内容 */
const IFRAME_INTERCEPT_SCRIPT = `
<script>
(function() {
  function isLocalUrl(url) {
    return url && !url.match(/^https?:/i) && !url.match(/^about:/i) && !url.match(/^data:/i);
  }

  function handleIframe(iframe, url) {
    if (url && isLocalUrl(url)) {
      iframe.removeAttribute('src');
      window.parent.postMessage({
        type: 'peek-iframe-navigate',
        url: url,
        id: iframe.id || ''
      }, '*');
    }
  }

  // 覆盖 HTMLIFrameElement.prototype.src setter，从根本上拦截所有 src 赋值
  try {
    var srcProp = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    if (srcProp && srcProp.set) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        get: function() { return srcProp.get.call(this); },
        set: function(url) {
          if (isLocalUrl(url)) {
            handleIframe(this, url);
            return;
          }
          srcProp.set.call(this, url);
        }
      });
    }
  } catch(e) {}

  // 处理已有的 iframe
  document.querySelectorAll('iframe').forEach(function(iframe) {
    var url = iframe.getAttribute('src');
    if (url && isLocalUrl(url)) {
      iframe.removeAttribute('src');
      window.parent.postMessage({
        type: 'peek-iframe-navigate',
        url: url,
        id: iframe.id || ''
      }, '*');
    }
  });

  // 监听动态添加的 iframe
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(function(node) {
          if (node.tagName === 'IFRAME') {
            var url = node.getAttribute('src');
            if (url && isLocalUrl(url)) {
              node.removeAttribute('src');
              window.parent.postMessage({
                type: 'peek-iframe-navigate',
                url: url,
                id: node.id || ''
              }, '*');
            }
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('iframe').forEach(function(iframe) {
              var url = iframe.getAttribute('src');
              if (url && isLocalUrl(url)) {
                iframe.removeAttribute('src');
                window.parent.postMessage({
                  type: 'peek-iframe-navigate',
                  url: url,
                  id: iframe.id || ''
                }, '*');
              }
            });
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 接收父窗口返回的 iframe 内容
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'peek-iframe-content') {
      var iframe = document.getElementById(e.data.id);
      if (iframe) {
        iframe.srcdoc = e.data.content;
      }
    }
  });
})();
</script>
`;

/**
 * 在 iframe 中，某些 WebView 对 100vh 的计算会基于外层窗口而非 iframe 本身，
 * 导致使用了 100vh 的页面底部元素（如 fixed 定位的 tab bar）被截断。
 * 这里将 CSS 中的 100vh 替换为 100%，并注入 html{height:100%} 确保百分比生效。
 */
function fixViewportUnits(content: string): string {
  // 替换 <style> 标签内的 100vh
  let result = content.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open: string, css: string, close: string) => {
      return open + css.replace(/100vh/g, "100%") + close;
    }
  );

  // 替换内联 style 属性中的 100vh
  result = result.replace(
    /style="([^"]*)"/gi,
    (_match, styles: string) => {
      return 'style="' + styles.replace(/100vh/g, "100%") + '"';
    }
  );

  return result;
}

/** 注入脚本，通过 window.frameElement 获取 iframe 实际高度并修正 body 尺寸 */
const VIEWPORT_FIX_SCRIPT = `
<script>
(function() {
  function fixViewport() {
    var frame = window.frameElement;
    if (!frame) return;
    var h = frame.clientHeight;
    var style = document.getElementById('peek-viewport-fix');
    if (!style) {
      style = document.createElement('style');
      style.id = 'peek-viewport-fix';
      document.head.appendChild(style);
    }
    style.textContent = 'html,body{min-height:' + h + 'px!important}body>*{min-height:' + h + 'px!important}';
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixViewport);
  } else {
    fixViewport();
  }
  window.addEventListener('resize', fixViewport);
})();
</script>
`;

function processHtmlContent(content: string, filePath?: string): string {
  let processedContent = content;

  // 修正 viewport 单位
  processedContent = fixViewportUnits(processedContent);

  // 将 viewport meta 中的 maximum-scale 去掉，避免某些 WebView 中缩放导致布局异常
  processedContent = processedContent.replace(
    /<meta[^>]*name=["']viewport["'][^>]*>/i,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
  );

  // 注入 base 标签以正确解析相对路径资源
  if (filePath) {
    const pathParts = filePath.split(/[/\\]/);
    pathParts.pop(); // 移除文件名
    const basePath = pathParts.join("/") + "/";
    const baseTag = `<base href="file://${basePath}">`;

    if (processedContent.includes("<head>")) {
      processedContent = processedContent.replace("<head>", `<head>${baseTag}`);
    } else if (processedContent.includes("<html>")) {
      processedContent = processedContent.replace(
        "<html>",
        `<html><head>${baseTag}</head>`
      );
    } else {
      processedContent = baseTag + processedContent;
    }
  }

  // 在 </body> 前注入所有脚本
  const injectedScripts =
    VIEWPORT_FIX_SCRIPT + NAVIGATION_INTERCEPT_SCRIPT + IFRAME_INTERCEPT_SCRIPT;
  if (processedContent.includes("</body>")) {
    processedContent = processedContent.replace("</body>", `${injectedScripts}</body>`);
  } else if (processedContent.includes("</html>")) {
    processedContent = processedContent.replace("</html>", `${injectedScripts}</html>`);
  } else {
    processedContent += injectedScripts;
  }

  return processedContent;
}

export default function HtmlPreviewer({ content }: Props) {
  const { file, setFile } = useStore();
  const [mode, setMode] = useState<"preview" | "source">("preview");

  const srcDoc = useMemo(
    () => (mode === "preview" ? processHtmlContent(content, file?.path) : ""),
    [content, mode, file?.path]
  );

  /** 解析相对路径为绝对路径 */
  const resolvePath = useCallback(
    (url: string): string => {
      const currentDir = file?.path
        ? file.path.split(/[/\\]/).slice(0, -1).join("/")
        : "";
      let targetPath = url;
      if (url.startsWith("file://")) {
        targetPath = url.replace("file://", "");
      } else if (!url.startsWith("/")) {
        targetPath = currentDir ? `${currentDir}/${url}` : url;
      }
      return targetPath.split("#")[0].split("?")[0];
    },
    [file?.path]
  );

  /** 监听 iframe 发来的本地导航消息，读取对应文件并切换预览 */
  const handleMessage = useCallback(
    async (e: MessageEvent) => {
      if (e.data?.type === "peek-navigate") {
        const url: string = e.data.url;
        const targetPath = resolvePath(url);

        try {
          const text = await readTextFile(targetPath);
          const name = targetPath.split(/[/\\]/).pop() || "unknown";
          setFile({
            name,
            path: targetPath,
            content: text,
            type: detectFileType(name),
          });
        } catch (err) {
          console.error("[Peek] 打开链接文件失败:", targetPath, err);
        }
        return;
      }

      if (e.data?.type === "peek-iframe-navigate") {
        const { url, id }: { url: string; id: string } = e.data;
        const targetPath = resolvePath(url);

        try {
          const text = await readTextFile(targetPath);
          const processed = processHtmlContent(text, targetPath);
          // 将内容传回 iframe
          const iframe = document.querySelector(
            'iframe[srcdoc]'
          ) as HTMLIFrameElement | null;
          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
              { type: "peek-iframe-content", id, content: processed },
              "*"
            );
          }
        } catch (err) {
          console.error("[Peek] 加载嵌套 iframe 内容失败:", targetPath, err);
        }
        return;
      }
    },
    [resolvePath, setFile]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary">
        <button
          onClick={() => setMode("preview")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
            mode === "preview"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
        >
          <Eye size={14} />
          预览
        </button>
        <button
          onClick={() => setMode("source")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
            mode === "source"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
        >
          <Code size={14} />
          源码
        </button>
      </div>
      <div className="flex-1 relative">
        {mode === "preview" ? (
          <iframe
            className="absolute inset-0 w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-top-navigation-by-user-activation"
            srcDoc={srcDoc}
          />
        ) : (
          <div className="font-mono text-sm leading-relaxed">
            {content.split("\n").map((line, index) => (
              <div
                key={index}
                className="flex px-2 py-0.5 hover:bg-bg-secondary/30 transition-colors"
              >
                <span className="text-text-muted select-none w-12 text-right mr-3 flex-shrink-0 text-xs pt-0.5">
                  {index + 1}
                </span>
                <span className="text-text-primary whitespace-pre-wrap break-all">
                  {line || " "}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
