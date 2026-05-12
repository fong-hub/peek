#!/usr/bin/env node
/**
 * 同步版本号到项目所有配置文件中
 * 用法: node scripts/sync-version.js <version>
 * 示例: node scripts/sync-version.js 1.0.0-beta.5
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];
if (!version) {
  console.error("❌ 请提供版本号，例如: node scripts/sync-version.js 1.0.0-beta.5");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");

// 1. package.json
const packageJsonPath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
packageJson.version = version;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
console.log(`✅ package.json: ${packageJson.version}`);

// 2. src-tauri/Cargo.toml
const cargoTomlPath = path.join(root, "src-tauri", "Cargo.toml");
let cargoToml = fs.readFileSync(cargoTomlPath, "utf-8");
cargoToml = cargoToml.replace(
  /^version = ".*"/m,
  `version = "${version}"`
);
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log(`✅ src-tauri/Cargo.toml: ${version}`);

// 3. src-tauri/tauri.conf.json
const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log(`✅ src-tauri/tauri.conf.json: ${tauriConf.version}`);

// 4. latest.json.example (更新版本号和 notes)
const latestExamplePath = path.join(root, "latest.json.example");
if (fs.existsSync(latestExamplePath)) {
  let latestJson = JSON.parse(fs.readFileSync(latestExamplePath, "utf-8"));
  latestJson.version = version;
  latestJson.notes = `Release v${version}`;
  latestJson.pub_date = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const repoUrl = "https://github.com/fong-hub/peek";
  const platforms = latestJson.platforms || {};
  for (const key of Object.keys(platforms)) {
    const ext = key.startsWith("windows") ? "msi" : "dmg";
    const archLabel = key.includes("aarch64") ? "aarch64" : key.includes("x86_64") ? "x64" : "universal";
    platforms[key].url = `${repoUrl}/releases/download/v${version}/Peek_${version}_${archLabel}.${ext}`;
  }
  fs.writeFileSync(latestExamplePath, JSON.stringify(latestJson, null, 2) + "\n");
  console.log(`✅ latest.json.example: ${version}`);
}

console.log(`\n🎉 版本号已同步为 ${version}`);
console.log("💡 提示: 如果需要更新 latest.json 中的签名(signature)，请手动修改。");
