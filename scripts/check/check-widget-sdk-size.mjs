import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..", "..");
const maxGzipBytes = 10 * 1024;

const targets = [
  "packages/widget-sdk/dist/index.js",
  "packages/widget-sdk/dist/react.js",
  "packages/widget-sdk/dist/adapter.js",
  "dist/sdk/xapps-adapter.js",
];

let failed = false;

for (const relativePath of targets) {
  const filePath = path.resolve(root, relativePath);
  if (!fs.existsSync(filePath)) {
    console.error(`[check-widget-sdk-size] missing file: ${relativePath}`);
    failed = true;
    continue;
  }
  const source = fs.readFileSync(filePath);
  const gzipSize = zlib.gzipSync(source).byteLength;
  const status = gzipSize <= maxGzipBytes ? "ok" : "too-large";
  console.log(`[check-widget-sdk-size] ${relativePath} gzip=${gzipSize} bytes (${status})`);
  if (gzipSize > maxGzipBytes) failed = true;
}

if (failed) {
  console.error(`[check-widget-sdk-size] failed: max gzip size is ${maxGzipBytes} bytes`);
  process.exit(1);
}
