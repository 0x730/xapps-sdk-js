import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(scriptDir, "..", "..");
const cliPath = path.resolve(pkgDir, "dist", "cli.cjs");

if (!fs.existsSync(cliPath)) {
  throw new Error(`missing built CLI entrypoint: ${cliPath}`);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xapps-cli-smoke-"));
const appDir = path.join(tmpRoot, "app");
const manifestPath = path.join(appDir, "manifest.json");
const vectorsPath = path.join(appDir, "vectors.json");
const bundlePath = path.join(tmpRoot, "artifacts", "bundle.json");
const openApiPath = path.join(tmpRoot, "openapi.yaml");
const importedManifestPath = path.join(tmpRoot, "imported-manifest.json");

execFileSync(process.execPath, [cliPath, "init", "--out", appDir, "--name", "Smoke CLI"], {
  cwd: tmpRoot,
  stdio: "inherit",
});

if (!fs.existsSync(manifestPath)) {
  throw new Error(`expected manifest from smoke init: ${manifestPath}`);
}

fs.writeFileSync(
  vectorsPath,
  JSON.stringify(
    {
      vectors: [
        {
          name: "example_tool contract",
          tool_name: "example_tool",
          input: {
            message: "hello",
          },
          expected_output: {
            echoed: "hello",
          },
        },
      ],
    },
    null,
    2,
  ),
);

execFileSync(process.execPath, [cliPath, "validate", "--from", manifestPath], {
  cwd: tmpRoot,
  stdio: "inherit",
});

execFileSync(
  process.execPath,
  [cliPath, "test", "--from", manifestPath, "--vectors", vectorsPath],
  {
    cwd: tmpRoot,
    stdio: "inherit",
  },
);

execFileSync(
  process.execPath,
  [cliPath, "publish", "--yes", "--from", manifestPath, "--out", bundlePath],
  {
    cwd: tmpRoot,
    stdio: "inherit",
  },
);

execFileSync(process.execPath, [cliPath, "logs", "--from", bundlePath, "--json"], {
  cwd: tmpRoot,
  stdio: "inherit",
});

fs.writeFileSync(
  openApiPath,
  `openapi: 3.0.3
info:
  title: Smoke Import API
paths:
  /ping:
    get:
      operationId: ping
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok:
                    type: boolean
`,
);

execFileSync(
  process.execPath,
  [
    cliPath,
    "import",
    "--from",
    openApiPath,
    "--out",
    importedManifestPath,
    "--endpoint",
    "https://api.example.com",
  ],
  {
    cwd: tmpRoot,
    stdio: "inherit",
  },
);

execFileSync(process.execPath, [cliPath, "validate", "--from", importedManifestPath], {
  cwd: tmpRoot,
  stdio: "inherit",
});

console.log("xapps-cli smoke: ok");
