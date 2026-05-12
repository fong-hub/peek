#!/usr/bin/env node
/**
 * 根据版本号和构建产物生成 latest.json
 * 用法: node scripts/generate-latest-json.js <version> [asset1 asset2 ...]
 * 示例: node scripts/generate-latest-json.js 1.0.0-beta.5 src-tauri/target/release/bundle/dmg/Peek_1.0.0-beta.5_aarch64.dmg
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];
const assets = process.argv.slice(3);

if (!version) {
  console.error("❌ 请提供版本号，例如: node scripts/generate-latest-json.js 1.0.0-beta.5");
  process.exit(1);
}

const repoUrl = "https://github.com/fong-hub/peek";
const pubDate = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

// 平台映射
const platformMap = {
  "darwin-aarch64": { pattern: /aarch64.*\.dmg$/i, ext: "dmg" },
  "darwin-x86_64": { pattern: /x64.*\.dmg$|x86_64.*\.dmg$/i, ext: "dmg" },
  "windows-x86_64": { pattern: /x64.*\.msi$|x86_64.*\.msi$/i, ext: "msi" },
  "windows-aarch64": { pattern: /aarch64.*\.msi$/i, ext: "msi" },
};

const platforms = {};

for (const [platformKey, { pattern }] of Object.entries(platformMap)) {
  const matched = assets.find((a) => pattern.test(path.basename(a)));
  if (matched) {
    platforms[platformKey] = {
      signature: "", // 签名需要手动填入或使用 Tauri 签名工具生成
      url: `${repoUrl}/releases/download/v${version}/${path.basename(matched)}`,
    };
  }
}

// 如果没有传构建产物，生成模板（使用占位符 URL）
if (Object.keys(platforms).length === 0) {
  console.log("⚠️  未提供构建产物，生成模板 latest.json（URL 为占位符）");
  platforms["darwin-aarch64"] = {
    signature: "",
    url: `${repoUrl}/releases/download/v${version}/Peek_${version}_aarch64.dmg`,
  };
  platforms["darwin-x86_64"] = {
    signature: "",
    url: `${repoUrl}/releases/download/v${version}/Peek_${version}_x64.dmg`,
  };
  platforms["windows-x86_64"] = {
    signature: "",
    url: `${repoUrl}/releases/download/v${version}/Peek_${version}_x64.msi`,
  };
}

const latestJson = {
  version,
  notes: `Release v${version}`,
  pub_date: pubDate,
  platforms,
};

const outputPath = path.resolve("latest.json");
fs.writeFileSync(outputPath, JSON.stringify(latestJson, null, 2) + "\n");

console.log(`✅ latest.json 已生成: ${outputPath}`);
console.log(JSON.stringify(latestJson, null, 2));
