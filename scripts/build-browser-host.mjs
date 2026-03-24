import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const pkgDir = path.resolve(root, "packages", "browser-host");
const srcDir = path.resolve(pkgDir, "src");
const outdir = path.resolve(pkgDir, "dist");
const tscBin = path.resolve(root, "node_modules", "typescript", "bin", "tsc");

function collectTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absPath = path.resolve(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(absPath);
    return entry.isFile() && absPath.endsWith(".ts") ? [absPath] : [];
  });
}

fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

const entryPoints = collectTsFiles(srcDir);
if (entryPoints.length === 0) {
  throw new Error("[build-browser-host] No TypeScript source files found");
}

await esbuild.build({
  entryPoints,
  outdir,
  outbase: srcDir,
  bundle: false,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
});

execFileSync(tscBin, ["-p", path.resolve(pkgDir, "tsconfig.build.json"), "--pretty", "false"], {
  stdio: "inherit",
});

console.log("[build-browser-host] Built to packages/browser-host/dist");
