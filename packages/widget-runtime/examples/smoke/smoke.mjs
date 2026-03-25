import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const examplesDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(examplesDir, "..", "..");
const distDir = path.resolve(pkgDir, "dist");
const entryFile = path.resolve(distDir, "index.js");

if (!fs.existsSync(entryFile)) {
  throw new Error("Missing built artifact: dist/index.js");
}

const mod = await import(pathToFileURL(entryFile).href);

for (const exportName of ["UiKitWidget", "AppShellWidget", "WidgetRuntime", "useWidgetSession"]) {
  if (!(exportName in mod)) {
    throw new Error(`Missing export ${exportName} from dist/index.js`);
  }
}

console.log("[widget-runtime smoke] exports look publishable");
