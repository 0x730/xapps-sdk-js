import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const examplesDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(examplesDir, "..", "..");
const distDir = path.resolve(pkgDir, "dist");
const indexJs = path.resolve(distDir, "index.js");
const indexDts = path.resolve(distDir, "index.d.ts");
const cssFile = path.resolve(distDir, "marketplace.css");

for (const target of [indexJs, indexDts, cssFile]) {
  if (!fs.existsSync(target)) {
    throw new Error(`Missing built artifact: ${path.relative(pkgDir, target)}`);
  }
}

const builtSource = fs.readFileSync(indexJs, "utf8");
for (const symbol of ["MarketplaceProvider", "MarketplaceApp", "WidgetView"]) {
  if (!builtSource.includes(symbol)) {
    throw new Error(`Expected build output to mention ${symbol}`);
  }
}

console.log("[marketplace-ui smoke] build artifacts look publishable");
