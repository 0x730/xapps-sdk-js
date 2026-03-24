import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const entry = path.resolve(root, "packages", "xapps-embed-sdk", "src", "index.ts");
const outdir = path.resolve(root, "dist", "sdk");

if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

async function main() {
  await build({
    entryPoints: [entry],
    bundle: true,
    sourcemap: true,
    minify: false,
    format: "esm",
    outfile: path.join(outdir, "xapps-embed-sdk.esm.js"),
    platform: "browser",
    target: ["es2020"],
  });

  await build({
    entryPoints: [entry],
    bundle: true,
    sourcemap: true,
    minify: false,
    format: "iife",
    globalName: "XappsEmbed",
    outfile: path.join(outdir, "xapps-embed-sdk.umd.js"),
    platform: "browser",
    target: ["es2020"],
  });

  console.log("[build-embed-sdk] Built SDK to dist/sdk");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
