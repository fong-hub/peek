export interface HtmlPreviewContext {
  filePath?: string | null;
  rootPath?: string | null;
}

export type AssetUrlBuilder = (filePath: string) => string;
export type HtmlFileReader = (filePath: string) => Promise<string>;

const URL_WITH_SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const EXTERNAL_SCHEME_RE =
  /^(?:https?:|data:|javascript:|mailto:|tel:|blob:|about:)/i;

function extractDirectoryPath(path: string): string {
  return path.replace(/[/\\][^/\\]*$/, "");
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function ensureTrailingSlash(path: string): string {
  return /[/\\]$/.test(path) ? path : `${path}/`;
}

function decodeUrlPath(pathname: string): string {
  const normalizedPath = decodeURIComponent(pathname);

  if (/^\/[A-Za-z]:\//.test(normalizedPath)) {
    return normalizedPath.slice(1);
  }

  return normalizedPath;
}

function isAssetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "asset:" ||
      parsed.hostname === "asset.localhost"
    );
  } catch {
    return false;
  }
}

function getEffectiveRootPath({
  filePath,
  rootPath,
}: HtmlPreviewContext): string | null {
  if (!filePath) {
    return rootPath ?? null;
  }

  if (!rootPath) {
    return extractDirectoryPath(filePath);
  }

  const normalizedFilePath = normalizePath(filePath);
  const normalizedRootPath = normalizePath(rootPath);

  if (
    normalizedFilePath === normalizedRootPath ||
    normalizedFilePath.startsWith(`${normalizedRootPath}/`)
  ) {
    return rootPath;
  }

  return extractDirectoryPath(filePath);
}

function injectAfterFirstMatch(
  content: string,
  pattern: RegExp,
  value: string
): string {
  return content.replace(pattern, (match) => `${match}${value}`);
}

function injectBeforeFirstMatch(
  content: string,
  pattern: RegExp,
  value: string
): string {
  return content.replace(pattern, `${value}$&`);
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getTagAttribute(tag: string, attrName: string): string | null {
  const pattern = new RegExp(
    `\\b${attrName}\\s*=\\s*(["'])([^"']*)(\\1)`,
    "i"
  );
  const match = pattern.exec(tag);
  return match?.[2] ?? null;
}

function hasStylesheetRel(tag: string): boolean {
  const rel = getTagAttribute(tag, "rel");
  if (!rel) {
    return false;
  }

  return rel
    .split(/\s+/)
    .some((part) => part.trim().toLowerCase() === "stylesheet");
}

function rewriteTagAttribute(
  content: string,
  tagName: string,
  attrName: string,
  rewrite: (value: string) => string
): string {
  const pattern = new RegExp(
    `(<${tagName}\\b[^>]*?\\b${attrName}\\s*=\\s*)(["'])([^"']+)(\\2)`,
    "gi"
  );

  return content.replace(pattern, (_match, prefix, quote, value, suffix) => {
    return `${prefix}${quote}${rewrite(value)}${suffix}`;
  });
}

export function toFileUrl(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const prefix = normalizedPath.startsWith("/") ? "file://" : "file:///";

  return prefix + encodeURI(normalizedPath);
}

export function fromFileUrl(url: string): string {
  const parsed = new URL(url);
  return decodeUrlPath(parsed.pathname);
}

export function fromAssetUrl(url: string): string | null {
  if (!isAssetUrl(url)) {
    return null;
  }

  const parsed = new URL(url);
  return decodeUrlPath(parsed.pathname);
}

export function resolveHtmlUrlToPath(
  rawUrl: string,
  context: HtmlPreviewContext
): string | null {
  const sanitizedUrl = rawUrl.split("#")[0].split("?")[0].trim();
  if (!sanitizedUrl) {
    return null;
  }

  if (sanitizedUrl.startsWith("file://")) {
    return fromFileUrl(sanitizedUrl);
  }

  const assetPath = fromAssetUrl(sanitizedUrl);
  if (assetPath) {
    return assetPath;
  }

  if (
    sanitizedUrl.startsWith("#") ||
    sanitizedUrl.startsWith("//") ||
    EXTERNAL_SCHEME_RE.test(sanitizedUrl)
  ) {
    return null;
  }

  if (URL_WITH_SCHEME_RE.test(sanitizedUrl) || !context.filePath) {
    return null;
  }

  const currentDir = extractDirectoryPath(context.filePath);

  if (sanitizedUrl.startsWith("/")) {
    const rootPath = getEffectiveRootPath(context) ?? currentDir;
    return fromFileUrl(
      new URL(
        sanitizedUrl.replace(/^\/+/, ""),
        toFileUrl(ensureTrailingSlash(rootPath))
      ).toString()
    );
  }

  return fromFileUrl(
    new URL(sanitizedUrl, toFileUrl(ensureTrailingSlash(currentDir))).toString()
  );
}

export function resolveHtmlResourceUrl(
  rawUrl: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder
): string {
  const localPath = resolveHtmlUrlToPath(rawUrl, context);
  if (!localPath) {
    return rawUrl;
  }

  return buildAssetUrl(localPath);
}

export function rewriteCssUrls(
  cssText: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder
): string {
  let rewritten = cssText.replace(
    /url\(\s*(['"]?)([^)"']+)\1\s*\)/gi,
    (match, quote: string, value: string) => {
      if (!value || value.startsWith("#")) {
        return match;
      }

      const nextValue = resolveHtmlResourceUrl(value, context, buildAssetUrl);
      return `url(${quote}${nextValue}${quote})`;
    }
  );

  rewritten = rewritten.replace(
    /@import\s+(['"])([^"']+)\1/gi,
    (_match, quote: string, value: string) => {
      const nextValue = resolveHtmlResourceUrl(value, context, buildAssetUrl);
      return `@import ${quote}${nextValue}${quote}`;
    }
  );

  return rewritten;
}

/** 注入 iframe 的脚本：拦截所有本地导航并通知父窗口 */
const NAVIGATION_INTERCEPT_SCRIPT = `
<script>
(function() {
  function isAssetUrl(url) {
    return /^asset:/i.test(url)
      || /^https?:\\/\\/asset\\.localhost\\//i.test(url);
  }
  function isLocalUrl(url) {
    return url
      && !isAssetUrl(url)
      && !url.match(/^https?:/i)
      && !url.match(/^data:/i)
      && !url.match(/^javascript:/i)
      && !url.match(/^mailto:/i)
      && !url.match(/^tel:/i)
      && !url.match(/^blob:/i)
      && !url.match(/^\\/\\//);
  }
  function notifyNavigate(url) {
    window.parent.postMessage({ type: 'peek-navigate', url: url }, '*');
  }

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

  var origOpen = window.open;
  window.open = function(url, target, features) {
    if (url && isLocalUrl(url)) { notifyNavigate(url); return null; }
    return origOpen.apply(this, arguments);
  };

  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document.body) {
      if (el.tagName === 'A') {
        var rawHref = el.getAttribute('href') || el.href;
        if (!rawHref) return;

        if (isLocalUrl(rawHref)) {
          e.preventDefault();
          e.stopPropagation();
          notifyNavigate(rawHref);
          return false;
        }

        e.preventDefault();
        e.stopPropagation();
        window.open(rawHref, '_blank');
        return false;
      }
      el = el.parentElement;
    }
  }, true);

  document.addEventListener('submit', function(e) {
    var form = e.target;
    var rawAction = form.getAttribute('action') || form.action;
    if (rawAction && isLocalUrl(rawAction)) {
      e.preventDefault();
      notifyNavigate(rawAction);
    }
  }, true);
})();
</script>
`;

/** 注入 iframe 的脚本：拦截嵌套 iframe 的本地 src，通过 postMessage 让父窗口加载内容 */
const IFRAME_INTERCEPT_SCRIPT = `
<script>
(function() {
  var iframeCounter = 0;

  function isAssetUrl(url) {
    return /^asset:/i.test(url)
      || /^https?:\\/\\/asset\\.localhost\\//i.test(url);
  }

  function isLocalUrl(url) {
    return url
      && !isAssetUrl(url)
      && !url.match(/^https?:/i)
      && !url.match(/^about:/i)
      && !url.match(/^data:/i)
      && !url.match(/^blob:/i)
      && !url.match(/^\\/\\//);
  }

  function ensureFrameId(iframe) {
    var existing = iframe.getAttribute('data-peek-frame-id');
    if (existing) return existing;

    var nextId = iframe.id || ('peek-iframe-' + (++iframeCounter));
    iframe.setAttribute('data-peek-frame-id', nextId);
    return nextId;
  }

  function notifyIframeNavigate(iframe, url) {
    window.parent.postMessage({
      type: 'peek-iframe-navigate',
      url: url,
      frameId: ensureFrameId(iframe)
    }, '*');
  }

  function handleIframe(iframe, url) {
    if (!url || !isLocalUrl(url)) return;
    iframe.removeAttribute('src');
    notifyIframeNavigate(iframe, url);
  }

  function findIframeByFrameId(frameId) {
    if (!frameId) return null;

    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i += 1) {
      if (iframes[i].getAttribute('data-peek-frame-id') === frameId) {
        return iframes[i];
      }
    }

    return null;
  }

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

  document.querySelectorAll('iframe').forEach(function(iframe) {
    var url = iframe.getAttribute('src');
    if (url && isLocalUrl(url)) {
      handleIframe(iframe, url);
    }
  });

  function startObserver() {
    var target = document.body || document.documentElement;
    if (!target) return;

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function(node) {
            if (node.tagName === 'IFRAME') {
              var url = node.getAttribute('src');
              if (url && isLocalUrl(url)) {
                handleIframe(node, url);
              }
            }
            if (node.querySelectorAll) {
              node.querySelectorAll('iframe').forEach(function(iframe) {
                var url = iframe.getAttribute('src');
                if (url && isLocalUrl(url)) {
                  handleIframe(iframe, url);
                }
              });
            }
          });
        }
      });
    });

    observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'peek-iframe-content') {
      var iframe = findIframeByFrameId(e.data.frameId);
      if (iframe) {
        if (typeof e.data.url === 'string' && e.data.url) {
          iframe.src = e.data.url;
          return;
        }
        iframe.srcdoc = e.data.content;
      }
    }
  });
})();
</script>
`;

/** 注入脚本，通过 window.frameElement 获取 iframe 实际高度并修正 body 尺寸 */
const VIEWPORT_FIX_SCRIPT = `
<script>
(function() {
  function replyToChildViewportRequest(sourceWindow) {
    if (!sourceWindow) return false;

    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i += 1) {
      try {
        if (iframes[i].contentWindow === sourceWindow) {
          sourceWindow.postMessage({
            type: 'peek-viewport-size',
            height: iframes[i].clientHeight
          }, '*');
          return true;
        }
      } catch (e) {}
    }

    return false;
  }

  function applyHeight(height) {
    if (!height) return;
    var style = document.getElementById('peek-viewport-fix');
    if (!style) {
      style = document.createElement('style');
      style.id = 'peek-viewport-fix';
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = 'html,body{min-height:' + height + 'px!important}body>*{min-height:' + height + 'px!important}';
  }

  function fixViewport() {
    try {
      var frame = window.frameElement;
      if (frame) {
        applyHeight(frame.clientHeight);
        return;
      }
    } catch (e) {}

    window.parent.postMessage({ type: 'peek-viewport-request' }, '*');
  }

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'peek-viewport-request') {
      if (replyToChildViewportRequest(e.source)) {
        return;
      }
      window.parent.postMessage({ type: 'peek-viewport-request' }, '*');
      return;
    }

    if (e.data && e.data.type === 'peek-viewport-size') {
      applyHeight(Number(e.data.height) || 0);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixViewport);
  } else {
    fixViewport();
  }
  window.addEventListener('resize', fixViewport);
})();
</script>
`;

/**
 * 在 iframe 中，某些 WebView 对 100vh 的计算会基于外层窗口而非 iframe 本身，
 * 导致使用了 100vh 的页面底部元素被截断。
 */
function fixViewportUnits(content: string): string {
  let result = content.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open: string, css: string, close: string) => {
      return open + css.replace(/100vh/g, "100%") + close;
    }
  );

  result = result.replace(
    /style="([^"]*)"/gi,
    (_match, styles: string) => {
      return 'style="' + styles.replace(/100vh/g, "100%") + '"';
    }
  );

  return result;
}

function rewriteHtmlResourceUrls(
  content: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder
): string {
  let rewritten = content;
  const rewrite = (value: string) =>
    resolveHtmlResourceUrl(value, context, buildAssetUrl);

  for (const tagName of ["script", "img", "source", "audio", "video", "embed"]) {
    rewritten = rewriteTagAttribute(rewritten, tagName, "src", rewrite);
  }

  for (const tagName of ["video", "source"]) {
    rewritten = rewriteTagAttribute(rewritten, tagName, "poster", rewrite);
  }

  rewritten = rewriteTagAttribute(rewritten, "link", "href", rewrite);
  rewritten = rewriteTagAttribute(rewritten, "object", "data", rewrite);

  rewritten = rewritten.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open: string, css: string, close: string) => {
      return open + rewriteCssUrls(css, context, buildAssetUrl) + close;
    }
  );

  rewritten = rewritten.replace(
    /style="([^"]*)"/gi,
    (_match, styles: string) => {
      return `style="${rewriteCssUrls(styles, context, buildAssetUrl)}"`;
    }
  );

  return rewritten;
}

export async function inlineLocalStylesheets(
  content: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder,
  readFile: HtmlFileReader
): Promise<string> {
  const matches = Array.from(content.matchAll(/<link\b[^>]*>/gi));
  if (matches.length === 0) {
    return content;
  }

  let rebuilt = "";
  let lastIndex = 0;

  for (const match of matches) {
    const tag = match[0];
    const start = match.index ?? 0;
    const end = start + tag.length;

    rebuilt += content.slice(lastIndex, start);
    lastIndex = end;

    if (!hasStylesheetRel(tag)) {
      rebuilt += tag;
      continue;
    }

    const href = getTagAttribute(tag, "href");
    if (!href) {
      rebuilt += tag;
      continue;
    }

    const cssPath = resolveHtmlUrlToPath(href, context);
    if (!cssPath) {
      rebuilt += tag;
      continue;
    }

    try {
      const css = await readFile(cssPath);
      const rewrittenCss = rewriteCssUrls(
        css,
        {
          filePath: cssPath,
          rootPath: context.rootPath,
        },
        buildAssetUrl
      );
      const media = getTagAttribute(tag, "media");
      const mediaAttr = media
        ? ` media="${escapeHtmlAttribute(media)}"`
        : "";
      rebuilt += `<style data-peek-inline-style="true" data-peek-source="${escapeHtmlAttribute(
        cssPath
      )}"${mediaAttr}>${rewrittenCss}</style>`;
    } catch {
      rebuilt += tag;
    }
  }

  rebuilt += content.slice(lastIndex);
  return rebuilt;
}

export function processHtmlContent(
  content: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder
): string {
  let processedContent = content;

  processedContent = fixViewportUnits(processedContent);
  processedContent = rewriteHtmlResourceUrls(
    processedContent,
    context,
    buildAssetUrl
  );

  processedContent = processedContent.replace(
    /<meta[^>]*name=["']viewport["'][^>]*>/i,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
  );

  if (context.filePath) {
    const baseTag = `<base href="${buildAssetUrl(context.filePath)}">`;

    if (/<head\b[^>]*>/i.test(processedContent)) {
      processedContent = injectAfterFirstMatch(
        processedContent,
        /<head\b[^>]*>/i,
        baseTag
      );
    } else if (/<html\b[^>]*>/i.test(processedContent)) {
      processedContent = injectAfterFirstMatch(
        processedContent,
        /<html\b[^>]*>/i,
        `<head>${baseTag}</head>`
      );
    } else {
      processedContent = baseTag + processedContent;
    }
  }

  const injectedScripts =
    VIEWPORT_FIX_SCRIPT + NAVIGATION_INTERCEPT_SCRIPT + IFRAME_INTERCEPT_SCRIPT;
  if (/<\/body>/i.test(processedContent)) {
    processedContent = injectBeforeFirstMatch(
      processedContent,
      /<\/body>/i,
      injectedScripts
    );
  } else if (/<\/html>/i.test(processedContent)) {
    processedContent = injectBeforeFirstMatch(
      processedContent,
      /<\/html>/i,
      injectedScripts
    );
  } else {
    processedContent += injectedScripts;
  }

  return processedContent;
}

export async function prepareHtmlPreviewContent(
  content: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder,
  readFile: HtmlFileReader
): Promise<string> {
  const withInlineStyles = await inlineLocalStylesheets(
    content,
    context,
    buildAssetUrl,
    readFile
  );

  return processHtmlContent(withInlineStyles, context, buildAssetUrl);
}
