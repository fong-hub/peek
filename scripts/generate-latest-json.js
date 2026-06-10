#!/usr/bin/env node
/**
 * 根据版本号和 updater 构建产物生成 latest.json
 * 用法: node scripts/generate-latest-json.js <version> [asset1 asset2 ...]
 * 示例: node scripts/generate-latest-json.js 1.1.0 src-tauri/target/release/bundle/macos/Peek.app.tar.gz
 */

import fs from "fs";
import path from "path";
const version = process.argv[2];
const assets = process.argv.slice(3).filter((asset) => !asset.endsWith(".sig"));

if (!version) {
  console.error("❌ 请提供版本号，例如: node scripts/generate-latest-json.js 1.1.0");
  process.exit(1);
}

const repoUrl = "https://github.com/fong-hub/peek";
const pubDate = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const macArchByProcess = process.arch === "arm64" ? "aarch64" : "x86_64";

const platformDefinitions = [
  {
    targetKeys: ["darwin-aarch64", "darwin-aarch64-app"],
    patterns: [/(aarch64|arm64).*\.app\.tar\.gz$/i],
    genericAsset: macArchByProcess === "aarch64",
    exampleAsset: "Peek.app.tar.gz",
  },
  {
    targetKeys: ["darwin-x86_64", "darwin-x86_64-app"],
    patterns: [/(x64|x86_64).*\.app\.tar\.gz$/i],
    genericAsset: macArchByProcess === "x86_64",
    exampleAsset: "Peek.app.tar.gz",
  },
  {
    targetKeys: ["windows-x86_64", "windows-x86_64-msi"],
    patterns: [/(x64|x86_64).*\.msi\.zip$/i],
    genericAsset: false,
    exampleAsset: `Peek_${version}_x64.msi.zip`,
  },
  {
    targetKeys: ["windows-aarch64", "windows-aarch64-msi"],
    patterns: [/aarch64.*\.msi\.zip$/i],
    genericAsset: false,
    exampleAsset: `Peek_${version}_aarch64.msi.zip`,
  },
];

const platforms = {};

function readSignature(assetPath) {
  const signaturePath = `${assetPath}.sig`;

  if (!fs.existsSync(signaturePath)) {
    throw new Error(`缺少签名文件: ${signaturePath}`);
  }

  return fs.readFileSync(signaturePath, "utf-8").trim();
}

for (const { targetKeys, patterns, genericAsset } of platformDefinitions) {
  const matched = assets.find((asset) => {
    const name = path.basename(asset);
    if (patterns.some((pattern) => pattern.test(name))) {
      return true;
    }
    return genericAsset && /\.app\.tar\.gz$/i.test(name);
  });
  if (matched) {
    const entry = {
      signature: readSignature(matched),
      url: `${repoUrl}/releases/download/v${version}/${path.basename(matched)}`,
    };

    for (const targetKey of targetKeys) {
      platforms[targetKey] = entry;
    }
  }
}

if (assets.length > 0 && Object.keys(platforms).length === 0) {
  console.error("❌ 未识别到可用于 updater 的构建产物");
  process.exit(1);
}

// 未提供实际构建产物时，生成占位模板。
if (assets.length === 0) {
  console.log("⚠️  未提供构建产物，生成模板 latest.json（URL 为占位符）");

  for (const { targetKeys, exampleAsset } of platformDefinitions) {
    const entry = {
      signature: "",
      url: `${repoUrl}/releases/download/v${version}/${exampleAsset}`,
    };

    for (const targetKey of targetKeys) {
      platforms[targetKey] = entry;
    }
  }
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
