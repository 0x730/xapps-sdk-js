import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const pkgDir = path.resolve(root, "packages", "payment-hosted-client");
const outdir = path.resolve(pkgDir, "dist");
const tscBin = path.resolve(root, "node_modules", "typescript", "bin", "tsc");

fs.mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [path.resolve(pkgDir, "src", "index.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: path.resolve(outdir, "index.js"),
  sourcemap: true,
});

execFileSync(tscBin, ["-p", path.resolve(pkgDir, "tsconfig.build.json"), "--pretty", "false"], {
  stdio: "inherit",
});

console.log("[build-payment-hosted-client] Built to packages/payment-hosted-client/dist");
