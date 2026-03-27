import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const packageRoot = path.resolve(repoRoot, "packages/xapps-embed-sdk");
const sourceDir = path.resolve(repoRoot, "dist/sdk");
const targetDir = path.resolve(packageRoot, "dist");

async function ensureFile(filePath) {
  await fs.access(filePath);
}

async function main() {
  const esmSource = path.resolve(sourceDir, "xapps-embed-sdk.esm.js");
  const umdSource = path.resolve(sourceDir, "xapps-embed-sdk.umd.js");

  try {
    await ensureFile(esmSource);
    await ensureFile(umdSource);
  } catch {
    throw new Error(
      "Missing embed-sdk build artifacts. Run `npm run build:sdk` before packing xapps-embed-sdk.",
    );
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.copyFile(esmSource, path.resolve(targetDir, "xapps-embed-sdk.esm.js"));
  await fs.copyFile(umdSource, path.resolve(targetDir, "xapps-embed-sdk.umd.js"));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
