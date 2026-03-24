import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const pkgDir = path.resolve(root, "packages", "widget-sdk");
const outdir = path.resolve(pkgDir, "dist");
const embedOutdir = path.resolve(root, "dist", "sdk");
const tscBin = path.resolve(root, "node_modules", "typescript", "bin", "tsc");

fs.mkdirSync(outdir, { recursive: true });
fs.mkdirSync(embedOutdir, { recursive: true });

await esbuild.build({
  entryPoints: [path.resolve(pkgDir, "src", "index.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: path.resolve(outdir, "index.js"),
  sourcemap: true,
});

await esbuild.build({
  entryPoints: [path.resolve(pkgDir, "src", "adapter.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: path.resolve(outdir, "adapter.js"),
  sourcemap: true,
});

await esbuild.build({
  entryPoints: [path.resolve(pkgDir, "src", "react.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: path.resolve(outdir, "react.js"),
  sourcemap: true,
  external: ["react"],
});

await esbuild.build({
  entryPoints: [path.resolve(pkgDir, "src", "adapter.ts")],
  bundle: true,
  format: "iife",
  globalName: "XappsWidgetSdk",
  platform: "browser",
  target: ["es2020"],
  outfile: path.resolve(embedOutdir, "xapps-adapter.js"),
  sourcemap: true,
  minify: false,
});

execFileSync(tscBin, ["-p", path.resolve(pkgDir, "tsconfig.build.json"), "--pretty", "false"], {
  stdio: "inherit",
});
execFileSync("node", [path.resolve(root, "scripts", "check-widget-sdk-size.mjs")], {
  stdio: "inherit",
});

console.log("[build-widget-sdk] Built to packages/widget-sdk/dist + dist/sdk/xapps-adapter.js");
