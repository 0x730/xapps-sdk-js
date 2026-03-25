import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const pkgDir = path.resolve(root, "packages", "marketplace-ui");
const outdir = path.resolve(pkgDir, "dist");
const tscBin = path.resolve(root, "node_modules", "typescript", "bin", "tsc");

fs.mkdirSync(outdir, { recursive: true });

// 1) JS bundle
await esbuild.build({
  entryPoints: [path.resolve(pkgDir, "src", "index.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: path.resolve(outdir, "index.js"),
  sourcemap: true,
  jsx: "automatic",
  external: ["react", "react-dom", "react-router-dom"],
});

// 2) Type declarations
execFileSync(tscBin, ["-p", path.resolve(pkgDir, "tsconfig.build.json"), "--pretty", "false"], {
  stdio: "inherit",
});

fs.copyFileSync(
  path.resolve(pkgDir, "src", "marketplace.css"),
  path.resolve(outdir, "marketplace.css"),
);

console.log("[build-marketplace-ui] Built to packages/marketplace-ui/dist");
