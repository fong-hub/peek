import { init, parse } from "es-module-lexer";
import {
  resolveHtmlUrlToPath,
  type AssetUrlBuilder,
  type HtmlFileReader,
  type HtmlPreviewContext,
} from "@/utils/htmlPreview";

export type ModulePathResolver = (sourcePath: string) => Promise<string>;
export type ModuleWriter = (sourcePath: string, content: string) => Promise<string>;

interface ModuleRecord {
  path: string;
  source: string;
  imports: ReturnType<typeof parse>[0];
}

interface Replacement {
  start: number;
  end: number;
  value: string;
}

function isLocalModuleSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:") ||
    specifier.startsWith("asset:") ||
    /^https?:\/\/asset\.localhost\//i.test(specifier)
  );
}

function isJavaScriptModule(path: string): boolean {
  const cleanPath = path.split("#")[0].split("?")[0];
  return /\.(?:[cm]?js|jsx)$/i.test(cleanPath) || !/\.[^/\\]+$/.test(cleanPath);
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function applyReplacements(source: string, replacements: Replacement[]): string {
  let transformed = source;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    transformed =
      transformed.slice(0, replacement.start) +
      replacement.value +
      transformed.slice(replacement.end);
  }
  return transformed;
}

export async function cacheLocalModuleGraph(
  entryPath: string,
  context: HtmlPreviewContext,
  readFile: HtmlFileReader,
  resolveOutputPath: ModulePathResolver,
  writeModule: ModuleWriter,
  buildAssetUrl: AssetUrlBuilder,
  entrySource?: string
): Promise<string> {
  const modules = new Map<string, ModuleRecord>();

  const discover = async (modulePath: string): Promise<void> => {
    if (modules.has(modulePath)) return;

    const source = modulePath === entryPath && entrySource !== undefined
      ? entrySource
      : await readFile(modulePath);
    await init;
    const imports = parse(source)[0];
    modules.set(modulePath, { path: modulePath, source, imports });

    await Promise.all(
      imports.map(async (moduleImport) => {
        const specifier = moduleImport.n;
        if (!specifier || !isLocalModuleSpecifier(specifier)) return;

        const dependencyPath = resolveHtmlUrlToPath(specifier, {
          filePath: modulePath,
          rootPath: context.rootPath,
        });
        if (dependencyPath && isJavaScriptModule(dependencyPath)) {
          await discover(dependencyPath);
        }
      })
    );
  };

  await discover(entryPath);

  const outputPaths = new Map<string, string>();
  await Promise.all(
    Array.from(modules.keys()).map(async (modulePath) => {
      outputPaths.set(modulePath, await resolveOutputPath(modulePath));
    })
  );

  const moduleUrls = new Map<string, string>();
  for (const module of modules.values()) {
    const outputPath = outputPaths.get(module.path);
    if (outputPath) {
      moduleUrls.set(
        module.path,
        `${buildAssetUrl(outputPath)}?v=${hashText(module.source)}`
      );
    }
  }

  await Promise.all(
    Array.from(modules.values()).map(async (module) => {
      const replacements: Replacement[] = [];

      for (const moduleImport of module.imports) {
        if (moduleImport.d === -2) {
          replacements.push({
            start: moduleImport.s,
            end: moduleImport.e,
            value: `({ url: ${JSON.stringify(buildAssetUrl(module.path))} })`,
          });
          continue;
        }

        const specifier = moduleImport.n;
        if (!specifier || !isLocalModuleSpecifier(specifier)) continue;

        const dependencyPath = resolveHtmlUrlToPath(specifier, {
          filePath: module.path,
          rootPath: context.rootPath,
        });
        if (!dependencyPath) continue;

        const dependencyUrl = moduleUrls.get(dependencyPath) ?? buildAssetUrl(dependencyPath);
        replacements.push({
          start: moduleImport.s,
          end: moduleImport.e,
          value: moduleImport.d > -1 ? JSON.stringify(dependencyUrl) : dependencyUrl,
        });
      }

      await writeModule(module.path, applyReplacements(module.source, replacements));
    })
  );

  const entryUrl = moduleUrls.get(entryPath);
  if (!entryUrl) throw new Error(`Failed to cache module graph for ${entryPath}`);
  return entryUrl;
}
