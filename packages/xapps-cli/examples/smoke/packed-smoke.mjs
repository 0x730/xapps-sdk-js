import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(scriptDir, "..", "..");
const repoRoot = path.resolve(pkgDir, "..", "..");
const tmpBase = path.resolve(repoRoot, "tmp");
fs.mkdirSync(tmpBase, { recursive: true });

const tmpRoot = fs.mkdtempSync(path.join(tmpBase, "xapps-cli-packed-smoke-"));
const extractedDir = path.join(tmpRoot, "package");
const installedNodeModulesDir = path.join(tmpRoot, "node_modules");
const installedScopeDir = path.join(installedNodeModulesDir, "@xapps-platform");
const installedCliDir = path.join(installedScopeDir, "cli");
const installedBinDir = path.join(installedNodeModulesDir, ".bin");
const installedBinPath = path.join(installedBinDir, "xapps");
const appDir = path.join(tmpRoot, "app");
const manifestPath = path.join(appDir, "manifest.json");
const vectorsPath = path.join(appDir, "vectors.json");
const bundlePath = path.join(tmpRoot, "artifacts", "bundle.json");
const remoteBundlePath = path.join(tmpRoot, "artifacts", "remote-bundle.json");
const openApiPath = path.join(tmpRoot, "openapi.yaml");
const importedManifestPath = path.join(tmpRoot, "imported-manifest.json");

function run(cmd, args, cwd, extraEnv = {}) {
  execFileSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

async function runAsync(cmd, args, cwd, extraEnv = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        ...extraEnv,
      },
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Command failed: ${cmd} ${args.join(" ")}${signal ? ` (signal=${signal})` : ` (code=${code})`}`,
        ),
      );
    });
  });
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate smoke server port");
  }
  return address.port;
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(() => resolve()));
}

function installPackedWorkspacePackage() {
  fs.mkdirSync(installedScopeDir, { recursive: true });
  fs.mkdirSync(installedBinDir, { recursive: true });
  fs.cpSync(extractedDir, installedCliDir, { recursive: true });

  for (const dependency of ["server-sdk", "openapi-import", "xapp-manifest"]) {
    const target = path.resolve(repoRoot, "node_modules", "@xapps-platform", dependency);
    const link = path.join(installedScopeDir, dependency);
    fs.symlinkSync(target, link);
  }

  fs.symlinkSync("../@xapps-platform/cli/dist/cli.cjs", installedBinPath);
}

function packPackage(dir) {
  const packDestination = path.join(tmpRoot, "pack");
  fs.mkdirSync(packDestination, { recursive: true });
  run("npm", ["pack", "--pack-destination", packDestination], dir, {
    npm_config_cache: path.join(tmpRoot, "npm-cache"),
    npm_config_loglevel: "warn",
  });
  const tarballs = fs
    .readdirSync(packDestination)
    .filter((entry) => entry.endsWith(".tgz"))
    .sort();
  const filename = tarballs.at(-1);
  if (typeof filename !== "string") {
    throw new Error(`No tarball produced for ${dir}`);
  }
  return path.resolve(packDestination, filename);
}

console.log("xapps-cli packed smoke: start");

run("npm", ["run", "build", "--workspace", "packages/xapp-manifest"], repoRoot);
run("npm", ["run", "build", "--workspace", "packages/openapi-import"], repoRoot);
run("npm", ["run", "build", "--workspace", "packages/server-sdk"], repoRoot);
run("npm", ["run", "build", "--workspace", "packages/xapps-cli"], repoRoot);

const tarballPath = packPackage(pkgDir);
fs.mkdirSync(extractedDir, { recursive: true });
run("tar", ["-xzf", tarballPath, "-C", extractedDir, "--strip-components=1"], repoRoot);

const extractedManifest = JSON.parse(
  fs.readFileSync(path.join(extractedDir, "package.json"), "utf8"),
);
if (extractedManifest.name !== "@xapps-platform/cli") {
  throw new Error(`Unexpected packed package name: ${extractedManifest.name}`);
}

const cliPath = path.join(extractedDir, "dist", "cli.cjs");
if (!fs.existsSync(cliPath)) {
  throw new Error(`missing packed CLI entrypoint: ${cliPath}`);
}

installPackedWorkspacePackage();

run(installedBinPath, ["--help"], tmpRoot);
run(installedBinPath, ["init", "--out", appDir, "--name", "Packed Smoke CLI"], tmpRoot);

if (!fs.existsSync(manifestPath)) {
  throw new Error(`expected manifest from packed smoke init: ${manifestPath}`);
}

fs.writeFileSync(
  vectorsPath,
  JSON.stringify(
    {
      vectors: [
        {
          name: "example_tool contract",
          tool_name: "example_tool",
          input: { message: "hello" },
          expected_output: { echoed: "hello" },
        },
      ],
    },
    null,
    2,
  ),
);

run(installedBinPath, ["validate", "--from", manifestPath], tmpRoot);
run(installedBinPath, ["test", "--from", manifestPath, "--vectors", vectorsPath], tmpRoot);
run(installedBinPath, ["publish", "--yes", "--from", manifestPath, "--out", bundlePath], tmpRoot);
run(installedBinPath, ["logs", "--from", bundlePath, "--json"], tmpRoot);

fs.writeFileSync(
  openApiPath,
  `openapi: 3.0.3
info:
  title: Packed Smoke Import API
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

run(
  installedBinPath,
  [
    "import",
    "--from",
    openApiPath,
    "--out",
    importedManifestPath,
    "--endpoint",
    "https://api.example.com",
  ],
  tmpRoot,
);
run(installedBinPath, ["validate", "--from", importedManifestPath], tmpRoot);

const remoteFlow = {
  listedClients: false,
  importedManifest: null,
  publishedVersion: false,
  listedXapps: false,
  listedCredentials: false,
  createdCredential: null,
};

const server = http.createServer(async (req, res) => {
  const url = String(req.url || "");
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const bodyText = Buffer.concat(chunks).toString("utf8");

  res.setHeader("content-type", "application/json");

  if (req.method === "GET" && url === "/v1/publisher/clients") {
    remoteFlow.listedClients = true;
    res.statusCode = 200;
    res.end(JSON.stringify({ items: [{ id: "client_1", slug: "smoke-tenant" }] }));
    return;
  }

  if (req.method === "POST" && url === "/v1/publisher/import-manifest") {
    remoteFlow.importedManifest = JSON.parse(bodyText || "{}");
    res.statusCode = 201;
    res.end(JSON.stringify({ xappId: "xapp_1", versionId: "ver_1" }));
    return;
  }

  if (req.method === "POST" && url === "/v1/publisher/xapp-versions/ver_1/publish") {
    remoteFlow.publishedVersion = true;
    res.statusCode = 200;
    res.end(JSON.stringify({ version: { id: "ver_1", status: "published" } }));
    return;
  }

  if (req.method === "GET" && url === "/v1/publisher/xapps") {
    remoteFlow.listedXapps = true;
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        items: [
          {
            id: "xapp_1",
            slug: remoteFlow.importedManifest?.slug || "packed-smoke-cli",
            target_client_id: "client_1",
          },
        ],
      }),
    );
    return;
  }

  if (req.method === "GET" && url === "/v1/publisher/xapps/xapp_1/versions") {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        items: [{ id: "ver_1", status: "published", published_at: "2026-03-27T00:00:00Z" }],
      }),
    );
    return;
  }

  if (req.method === "GET" && url === "/v1/publisher/xapp-versions/ver_1/endpoints") {
    res.statusCode = 200;
    res.end(JSON.stringify({ items: [{ id: "ep_prod", env: "prod" }] }));
    return;
  }

  if (req.method === "GET" && url === "/v1/publisher/endpoints/ep_prod/credentials") {
    remoteFlow.listedCredentials = true;
    res.statusCode = 200;
    res.end(JSON.stringify({ items: [] }));
    return;
  }

  if (req.method === "POST" && url === "/v1/publisher/endpoints/ep_prod/credentials") {
    remoteFlow.createdCredential = JSON.parse(bodyText || "{}");
    res.statusCode = 201;
    res.end(
      JSON.stringify({
        credential: { id: "cred_1", auth_type: "api_key_header", active_kid: "kid_1" },
      }),
    );
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ message: "not found" }));
});

const port = await listen(server);
try {
  await runAsync(
    installedBinPath,
    [
      "publish",
      "--yes",
      "--from",
      manifestPath,
      "--out",
      remoteBundlePath,
      "--publisher-gateway-url",
      `http://127.0.0.1:${port}`,
      "--target-client-slug",
      "smoke-tenant",
      "--api-key",
      "xplace-dev-api-key",
    ],
    tmpRoot,
  );

  await runAsync(
    installedBinPath,
    [
      "publisher",
      "endpoint",
      "credential",
      "ensure",
      "--gateway-url",
      `http://127.0.0.1:${port}`,
      "--api-key",
      "xplace-dev-api-key",
      "--xapp-slug",
      extractedManifest.name === "@xapps-platform/cli"
        ? remoteFlow.importedManifest?.slug || "packed-smoke-cli"
        : "packed-smoke-cli",
      "--target-client-slug",
      "smoke-tenant",
      "--env",
      "prod",
      "--auth-type",
      "api-key",
      "--header-name",
      "x-xplace-api-key",
      "--secret-env",
      "XPLACE_XAPP_INGEST_API_KEY",
      "--json",
    ],
    tmpRoot,
    { XPLACE_XAPP_INGEST_API_KEY: "packed-secret-1" },
  );
} finally {
  await closeServer(server);
}

if (!remoteFlow.listedClients) {
  throw new Error("packed smoke remote flow did not resolve tenant clients");
}
if (remoteFlow.importedManifest?.target_client_id !== "client_1") {
  throw new Error("packed smoke remote publish did not inject target_client_id");
}
if (!remoteFlow.publishedVersion) {
  throw new Error("packed smoke remote publish did not hit publisher publish route");
}
if (!remoteFlow.listedXapps || !remoteFlow.listedCredentials) {
  throw new Error("packed smoke remote credential ensure did not resolve publisher state");
}
if (remoteFlow.createdCredential?.config?.headerName !== "x-xplace-api-key") {
  throw new Error("packed smoke remote credential ensure did not create expected header config");
}
if (remoteFlow.createdCredential?.initialKey?.secret !== "packed-secret-1") {
  throw new Error("packed smoke remote credential ensure did not pass expected secret");
}

console.log("xapps-cli packed smoke: ok");
