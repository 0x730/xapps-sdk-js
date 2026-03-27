import fs from "node:fs";
import { createHash, createHmac } from "node:crypto";
import http, { type IncomingMessage } from "node:http";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import {
  createPublisherApiClient,
  PublisherApiClientError,
  parseXappManifest,
} from "@xapps-platform/server-sdk";
import { buildDevRefs } from "./devStatus.js";
import { runContextExportCommand } from "./contextCommands.js";
import {
  runImportCommand,
  runInitCommand,
  runTestCommand,
  runValidateCommand,
} from "./commands/manifestCommands.js";
import {
  runAiCheckCliCommand,
  runAiPlanCliCommand,
  runDevCommand,
  runPublisherCliCommand,
} from "./commands/devCommands.js";

type CliArgValue = string | boolean | string[];
type CliArgs = Record<string, CliArgValue>;
type CliConfigProfile = {
  token?: string;
  apiKey?: string;
  publishUrl?: string;
  releaseChannel?: string;
  registryTarget?: string;
  logsUrl?: string;
  tunnelToken?: string;
  signingKey?: string;
  versionConflict?: "fail" | "allow";
};
type CliConfigFile = {
  defaultProfile?: string;
  profiles?: Record<string, CliConfigProfile>;
};

const DEFAULT_PUBLISH_BUNDLES_DIR = path.join("artifacts", "xapps-publish");

export class CliError extends Error {
  code: string;
  details?: Record<string, unknown>;
  exitCode?: number;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    options?: { exitCode?: number },
  ) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.details = details;
    this.exitCode = options?.exitCode;
  }
}

function printUsage() {
  console.log(`xapps CLI

Usage:
  Public/stable publish surface:
  xapps import --from <openapi-file-or-url> --out <manifest.json> [options]
  xapps init --out <directory> [options]
  xapps validate --from <manifest.json>
  xapps test --from <manifest.json> --vectors <test-vectors.json>
  xapps publish --from <manifest.json> [options]
  xapps logs [options]
  xapps publisher endpoint credential set [options]
  xapps publisher endpoint credential ensure [options]

  Local/repo-only helpers:
  xapps dev --from <manifest.json> [options]
  xapps context export --from <manifest.json> [options]
  xapps tunnel --target <base-url> [options]
  xapps ai plan --mode internal --from <manifest.json> [--preset <internal-v1>] [--flow <name>] [--mocks-dir <dir>] [--guidance <text> | --guidance-file <file> | --ask-guidance] [--llm] [--llm-model <model>] [--llm-timeout-ms <n>] [--apply-manifest-hints] [--json]
    Example guidance: "Infer complete form fields from mockups, build a step wizard, add supported preview sections, and exclude payment screens because payment is handled by guards."
    LLM flags: --llm-api-key <key> --llm-base-url <url> --llm-model <model> --llm-timeout-ms <n> (default model: gpt-5.2, default timeout: 30000ms)
  xapps ai check --mode internal --plan <plan.json> [--policy <policy.json> | --policy-preset <internal-readonly>] [--json]
  xapps dev status refs [--json]
  xapps dev check v1 [--json]
  xapps dev check flow --name <flow> [--json] [--run] [--artifacts-dir <dir>]
  xapps dev check flow --from <flow.json> [--json] [--run] [--artifacts-dir <dir>]
  xapps dev check flow init --out <flow.json> --type <ai-artifacts|manual-loop> [--flow-id <id>] [--manifest <path>] [--policy <path>] [--smoke-script <path>] [--json]
  xapps dev check flow lint --from <flow.json> [--json]

Global options:
  --profile <name>           Profile name from ~/.xapps/config (or env XAPPS_CLI_PROFILE)

Import options:
  --name <name>               App name (default: OpenAPI info.title)
  --slug <slug>               Manifest slug (default: slugified app name)
  --version <semver>          Manifest version (default: 1.0.0)
  --description <text>        Manifest description
  --endpoint <base_url>       Endpoint base_url (default: https://api.example.com)
  --endpoint-env <env>        Endpoint env key (default: prod)
  --fetch-timeout-ms <n>      Remote OpenAPI fetch timeout in ms (default: 10000)

Init options:
  --name <name>               App name (default: My Xapp)
  --slug <slug>               Manifest slug (default: slugified app name)
  --version <semver>          Manifest version (default: 1.0.0)
  --force                     Overwrite existing files

Test options:
  --from <manifest.json>      Manifest file to validate against
  --vectors <vectors.json>    Request/response contract vectors

Publish options:
  --from <manifest.json>      Manifest file to package
  --out <file-or-dir>         Output file or directory (default: artifacts/xapps-publish/<slug>/<version>)
  --dry-run                   Validate + print summary only (no files written)
  --yes                       Skip release confirmation prompt (required in non-interactive mode)
  --force                     Overwrite target artifact if it exists
  --publish-url <url>         Optional remote publish endpoint (POST bundle JSON)
  --publisher-gateway-url <url>  Optional local gateway publisher API base URL (uses /publisher/* routes)
  --target-client-slug <slug> Resolve tenant slug to target_client_id via --publisher-gateway-url for publish
  --replace <A=B>             Replace placeholder/text A with literal B in manifest before publish (repeatable)
  --replace-env <A=ENV>       Replace placeholder/text A with process.env[ENV] before publish (repeatable)
  --bump-version <kind>       Bump manifest version before publish: patch|minor|major
  --write-manifest-version    Write bumped version back to source manifest file (only version field is persisted)
  --allow-unresolved-placeholders  Skip preflight failure when __PLACEHOLDER__ tokens remain after replacements
  --token <token>             Bearer token for --publish-url (or env XAPPS_CLI_TOKEN)
  --api-key <key>             API key header value (or env XAPPS_CLI_API_KEY)
  --signing-key <key>         HMAC key for signed publish metadata headers (or env XAPPS_CLI_SIGNING_KEY)
  --version-conflict <mode>   Version conflict policy: fail|allow (default: fail)
  --release-channel <name>    Release channel label for remote publish handoff (default: stable)
  --registry-target <name>    Registry target/namespace label for remote publish handoff
  --idempotency-key <key>     Idempotency key header for --publish-url handoff
  --timeout-ms <n>            Remote publish timeout in ms (default: 10000)
  --retry-attempts <n>        Remote publish retry attempts for transient failures (default: 1)
  --retry-backoff-ms <n>      Base backoff between publish retries (default: 250)

Publisher endpoint credential set/ensure options:
  --gateway-url <url>         Gateway base URL (auto-uses /v1 if path omitted)
  --api-key <key>             Publisher API key (or env XAPPS_CLI_API_KEY)
  --token <token>             Publisher bearer token (or env XAPPS_CLI_TOKEN)
  --endpoint-id <id>          Endpoint id (optional if using --xapp-slug + --env)
  --xapp-slug <slug>          Resolve endpoint by publisher xapp slug
  --target-client-slug <slug> Resolve the tenant-scoped xapp variant before endpoint lookup
  --env <name>                Endpoint env when resolving by xapp slug (default: prod)
  --auth-type <type>          Endpoint auth type (default: api-key)
  --header-name <name>        API key header name for api-key header auth (default: x-xplace-api-key)
  --secret-env <ENV>          Read initial credential key secret from environment variable
  --secret-stdin              Read initial credential key secret from stdin
  --secret-ref <ref>          Store a gateway secret provider reference instead of literal secret
  --key-status <status>       Initial key status (default: active)
  --key-algorithm <alg>       Initial key algorithm (default: hmac-sha256)
  --json                      Machine-readable output

Logs options:
  --from <bundle.json>        Read a single local publish bundle
  --dir <path>                Scan publish bundles in directory (default: artifacts/xapps-publish)
  --limit <n>                 Max entries (default: 10)
  --json                      Print JSON output
  --logs-url <url>            Optional remote logs endpoint (GET)
  --token <token>             Bearer token for --logs-url (or env XAPPS_CLI_TOKEN)
  --api-key <key>             API key header value (or env XAPPS_CLI_API_KEY)
  --cursor <value>            Optional pagination cursor for remote logs
  --lease-id <value>          Optional managed log stream lease identifier
  --checkpoint <value>        Optional managed log stream checkpoint token
  --severity <value>          Optional remote filter (ex: error or error,warn)
  --since <iso>               Optional remote filter start timestamp
  --until <iso>               Optional remote filter end timestamp
  --follow                    Keep polling remote logs and resume from next cursor
  --follow-interval-ms <n>    Poll interval for --follow mode (default: 2000)
  --follow-max-cycles <n>     Optional max follow polling cycles (for automation/testing)
  --follow-cursor-file <path> Persist/restore follow cursor state to local file
  --timeout-ms <n>            Remote logs timeout in ms (default: 10000)
  --retry-attempts <n>        Remote logs retry attempts for transient failures (default: 1)
  --retry-backoff-ms <n>      Base backoff between logs retries (default: 250)

Context export options:
  export --from <manifest.json>   Manifest file to export deterministic context from
  --out <file>                    Write context JSON to file (default: stdout)
  --preset <name>                 Optional repo-only context preset (Phase 1: internal-v1)

Tunnel options:
  --target <base-url>         Relay target base URL (required)
  --allow-target-hosts <csv>  Explicit target host allowlist (default: 127.0.0.1,localhost,::1)
  --host <host>               Relay bind host (default: 127.0.0.1)
  --listen-port <port>        Relay bind port (default: 4041)
  --session-id <id>           Stable tunnel session id (optional)
  --session-file <path>       Persist/reuse session id across restarts
  --session-policy <mode>     Session lifecycle policy: reuse|require|rotate (default: reuse)
  --require-auth-token <tok>  Require inbound relay token (header x-xapps-tunnel-token or Bearer)
  --upstream-timeout-ms <n>   Upstream request timeout in ms (default: 15000)
  --retry-attempts <n>        Upstream retry attempts for GET/HEAD/OPTIONS transient failures (default: 1)
  --retry-backoff-ms <n>      Base backoff between upstream retries (default: 200)
  --once                      Start, print config, and exit

Dev options:
  --from <manifest.json>      Manifest file to validate/watch
  --dry-run <request.json>    Inspect a request payload against manifest tools
  --port <port>               Mock callback server port (default: 4011)
  --host <host>               Mock callback server host (default: 127.0.0.1)
  --once                      Validate + dry-run only; skip watch/server
  --no-watch                  Disable manifest watch loop

Notes:
  - Public/stable surface focuses on manifest authoring, validation, publish, logs, and publisher endpoint credentials.
  - AI/internal preset/dev-check commands are repo-only helpers and require the xapps monorepo checkout.
`);
}

function parseArgs(argv: string[]): { command: string; args: CliArgs } {
  const [command = "", ...rest] = argv;
  const args: CliArgs = {};
  let subcommandCount = 0;

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      subcommandCount += 1;
      if (subcommandCount === 1) args._subcommand = token;
      else if (subcommandCount === 2) args._subcommand2 = token;
      else if (subcommandCount === 3) args._subcommand3 = token;
      continue;
    }

    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      if (args[key] === undefined) {
        args[key] = true;
      } else if (Array.isArray(args[key])) {
        (args[key] as string[]).push("true");
      } else if (typeof args[key] === "string") {
        args[key] = [args[key] as string, "true"];
      }
      continue;
    }

    if (args[key] === undefined) {
      args[key] = next;
    } else if (Array.isArray(args[key])) {
      (args[key] as string[]).push(next);
    } else if (typeof args[key] === "string") {
      args[key] = [args[key] as string, next];
    } else {
      args[key] = [next];
    }
    i += 1;
  }

  return { command, args };
}

function argString(args: CliArgs, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i -= 1) {
        const item = value[i];
        if (typeof item === "string" && item.trim()) return item.trim();
      }
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function argStrings(args: CliArgs, ...keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const value = args[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) out.push(item.trim());
      }
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      out.push(value.trim());
    }
  }
  return out;
}

function argFlag(args: CliArgs, key: string): boolean {
  const value = args[key];
  if (value === true) return true;
  if (Array.isArray(value)) return value.includes("true");
  return false;
}

function shellEscapeArg(value: string): string {
  const input = String(value ?? "");
  if (/^[A-Za-z0-9_./:-]+$/.test(input)) return input;
  return `'${input.replace(/'/g, `'"'"'`)}'`;
}

function applyFlowCommandTemplates(command: string, params: { artifactsDir: string }): string {
  return String(command || "").replaceAll("{{ARTIFACTS_DIR}}", params.artifactsDir);
}

function normalizePublisherGatewayApiBaseUrl(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const parsed = new URL(raw);
  const pathname = parsed.pathname || "/";
  if (pathname === "/" || pathname === "") {
    parsed.pathname = "/v1";
    return parsed.toString().replace(/\/+$/g, "");
  }
  return parsed.toString().replace(/\/+$/g, "");
}

function defaultCliConfigPath() {
  return path.join(os.homedir(), ".xapps", "config");
}

function parseVersionConflictPolicy(
  value: string | undefined,
  fallback: "fail" | "allow" = "fail",
): "fail" | "allow" {
  if (!value) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "fail" || normalized === "allow") return normalized;
  throw new CliError(
    "CLI_INVALID_OPTION",
    `Invalid --version-conflict: ${value} (expected fail|allow)`,
    { label: "--version-conflict", value },
  );
}

type ManifestReplaceRule = {
  from: string;
  to: string;
  source: "literal" | "env";
  sourceName?: string;
};

function parseManifestReplaceLiteral(raw: string): ManifestReplaceRule {
  const idx = raw.indexOf("=");
  if (idx <= 0) {
    throw new CliError("CLI_INVALID_OPTION", `Invalid --replace value: ${raw} (expected FROM=TO)`, {
      label: "--replace",
      value: raw,
    });
  }
  const from = raw.slice(0, idx).trim();
  const to = raw.slice(idx + 1);
  if (!from) {
    throw new CliError("CLI_INVALID_OPTION", `Invalid --replace value: ${raw} (empty FROM)`, {
      label: "--replace",
      value: raw,
    });
  }
  return { from, to, source: "literal" };
}

function parseManifestReplaceEnv(raw: string): ManifestReplaceRule {
  const idx = raw.indexOf("=");
  if (idx <= 0) {
    throw new CliError(
      "CLI_INVALID_OPTION",
      `Invalid --replace-env value: ${raw} (expected FROM=ENV_VAR)`,
      { label: "--replace-env", value: raw },
    );
  }
  const from = raw.slice(0, idx).trim();
  const envName = raw.slice(idx + 1).trim();
  if (!from || !envName) {
    throw new CliError(
      "CLI_INVALID_OPTION",
      `Invalid --replace-env value: ${raw} (empty FROM or ENV_VAR)`,
      { label: "--replace-env", value: raw },
    );
  }
  const envValue = process.env[envName];
  if (typeof envValue !== "string" || envValue.length === 0) {
    throw new CliError(
      "CLI_INVALID_OPTION",
      `Environment variable missing/empty for --replace-env ${envName}`,
      { label: "--replace-env", value: raw, env: envName },
    );
  }
  return { from, to: envValue, source: "env", sourceName: envName };
}

function applyManifestReplaceRulesDeep<T>(input: T, rules: ManifestReplaceRule[]): T {
  if (!rules.length) return input;
  const replaceToken = (raw: string): string => {
    let next = raw;
    for (const rule of rules) {
      next = next.split(rule.from).join(rule.to);
    }
    return next;
  };
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      return replaceToken(value);
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[replaceToken(k)] = walk(v);
      }
      return out;
    }
    return value;
  };
  return walk(input) as T;
}

function findUnresolvedPlaceholderTokens(input: unknown): string[] {
  const seen = new Set<string>();
  const re = /__[A-Z0-9_]+__/g;
  const collect = (raw: string) => {
    const matches = raw.match(re);
    if (matches) for (const m of matches) seen.add(m);
  };
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      collect(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        collect(k);
        walk(v);
      }
      return;
    }
  };
  walk(input);
  return Array.from(seen).sort();
}

type VersionBumpKind = "patch" | "minor" | "major";

function parseVersionBumpKind(value: string | undefined): VersionBumpKind | null {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "patch" || normalized === "minor" || normalized === "major") {
    return normalized;
  }
  throw new CliError(
    "CLI_INVALID_OPTION",
    `Invalid --bump-version: ${value} (expected patch|minor|major)`,
    { label: "--bump-version", value },
  );
}

function bumpSemverVersionOrThrow(version: string, kind: VersionBumpKind): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || "").trim());
  if (!match) {
    throw new CliError("CLI_INVALID_OPTION", `Cannot ${kind}-bump non-semver version: ${version}`, {
      label: "--bump-version",
      version,
    });
  }
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  if (kind === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (kind === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

function parseTunnelSessionPolicy(
  value: string | undefined,
  fallback: "reuse" | "require" | "rotate" = "reuse",
): "reuse" | "require" | "rotate" {
  if (!value) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "reuse" || normalized === "require" || normalized === "rotate") {
    return normalized;
  }
  throw new CliError(
    "CLI_INVALID_OPTION",
    `Invalid --session-policy: ${value} (expected reuse|require|rotate)`,
    { label: "--session-policy", value },
  );
}

function parseReleaseLabel(
  label: string | undefined,
  fallback: string,
  optionName: string,
): string {
  const raw = String(label || fallback || "")
    .trim()
    .toLowerCase();
  if (!raw)
    return String(fallback || "")
      .trim()
      .toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(raw)) {
    throw new CliError(
      "CLI_INVALID_OPTION",
      `Invalid ${optionName}: ${label} (expected 1-64 chars: a-z, 0-9, ., _, -)`,
      { label: optionName, value: label },
    );
  }
  return raw;
}

type TunnelSessionState = {
  sessionId: string;
  target?: string;
  updatedAt?: string;
  schemaVersion?: number;
};

function parseCsvSet(value: string | undefined, fallbackCsv: string): Set<string> {
  const raw = String(value || fallbackCsv);
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function randomSessionId(prefix = "tnl"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveCursorStatePath(rawPath: string): string {
  return path.resolve(process.cwd(), rawPath);
}

type LogsResumeState = {
  cursor?: string;
  leaseId?: string;
  checkpoint?: string;
};

function loadLogsResumeState(filePathRaw: string): LogsResumeState {
  const filePath = resolveCursorStatePath(filePathRaw);
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return {};
    if (!raw.startsWith("{")) {
      // Backward compatible plain cursor-file format.
      return { cursor: raw };
    }
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      throw new Error("resume state must be a JSON object");
    }
    const cursor =
      typeof (parsed as any).cursor === "string"
        ? String((parsed as any).cursor)
        : typeof (parsed as any).next_cursor === "string"
          ? String((parsed as any).next_cursor)
          : "";
    const leaseId =
      typeof (parsed as any).lease_id === "string"
        ? String((parsed as any).lease_id)
        : typeof (parsed as any).leaseId === "string"
          ? String((parsed as any).leaseId)
          : "";
    const checkpoint =
      typeof (parsed as any).checkpoint === "string"
        ? String((parsed as any).checkpoint)
        : typeof (parsed as any).checkpoint_token === "string"
          ? String((parsed as any).checkpoint_token)
          : typeof (parsed as any).checkpointToken === "string"
            ? String((parsed as any).checkpointToken)
            : "";
    return {
      ...(cursor ? { cursor } : {}),
      ...(leaseId ? { leaseId } : {}),
      ...(checkpoint ? { checkpoint } : {}),
    };
  } catch (err: any) {
    throw new CliError(
      "CLI_CURSOR_STATE_IO",
      `Failed reading cursor state file: ${filePath} (${err?.message || String(err)})`,
      { filePath },
    );
  }
}

function saveLogsResumeState(filePathRaw: string, state: LogsResumeState) {
  const filePath = resolveCursorStatePath(filePathRaw);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const cursor = String(state.cursor || "").trim();
    const leaseId = String(state.leaseId || "").trim();
    const checkpoint = String(state.checkpoint || "").trim();
    if (!leaseId && !checkpoint) {
      fs.writeFileSync(filePath, `${cursor}\n`);
      return;
    }
    const payload = {
      v: 1,
      ...(cursor ? { cursor } : {}),
      ...(leaseId ? { lease_id: leaseId } : {}),
      ...(checkpoint ? { checkpoint } : {}),
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  } catch (err: any) {
    throw new CliError(
      "CLI_CURSOR_STATE_IO",
      `Failed writing cursor state file: ${filePath} (${err?.message || String(err)})`,
      { filePath },
    );
  }
}

function loadTunnelSessionState(filePathRaw: string): TunnelSessionState | null {
  const filePath = path.resolve(process.cwd(), filePathRaw);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return null;
    if (!raw.startsWith("{")) {
      // Backward compatible session-id only format.
      return { sessionId: raw };
    }
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      throw new Error("session state must be a JSON object");
    }
    const sessionId =
      typeof (parsed as any).session_id === "string"
        ? String((parsed as any).session_id).trim()
        : typeof (parsed as any).sessionId === "string"
          ? String((parsed as any).sessionId).trim()
          : "";
    if (!sessionId) {
      throw new Error("session_id is required");
    }
    const target =
      typeof (parsed as any).target === "string" ? String((parsed as any).target).trim() : "";
    const updatedAt =
      typeof (parsed as any).updated_at === "string"
        ? String((parsed as any).updated_at).trim()
        : typeof (parsed as any).updatedAt === "string"
          ? String((parsed as any).updatedAt).trim()
          : "";
    const schemaVersion =
      typeof (parsed as any).v === "number"
        ? Number((parsed as any).v)
        : typeof (parsed as any).version === "number"
          ? Number((parsed as any).version)
          : undefined;
    return {
      sessionId,
      ...(target ? { target } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      ...(schemaVersion !== undefined ? { schemaVersion } : {}),
    };
  } catch (err: any) {
    throw new CliError(
      "CLI_TUNNEL_SESSION_IO",
      `Failed reading tunnel session file: ${filePath} (${err?.message || String(err)})`,
      { filePath },
    );
  }
}

function saveTunnelSessionState(filePathRaw: string, state: TunnelSessionState) {
  const filePath = path.resolve(process.cwd(), filePathRaw);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const payload = {
      v: 1,
      session_id: state.sessionId,
      ...(state.target ? { target: state.target } : {}),
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  } catch (err: any) {
    throw new CliError(
      "CLI_TUNNEL_SESSION_IO",
      `Failed writing tunnel session file: ${filePath} (${err?.message || String(err)})`,
      { filePath },
    );
  }
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stableStringify(input: Record<string, unknown>): string {
  const keys = Object.keys(input).sort((a, b) => a.localeCompare(b));
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = input[key];
  return JSON.stringify(out);
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort((a, b) =>
      a.localeCompare(b),
    )) {
      out[key] = canonicalizeJson((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function parseCliConfig(raw: string, sourcePath: string): CliConfigFile {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CliError("CLI_CONFIG_INVALID", "config root must be a JSON object", {
        sourcePath,
      });
    }
    return parsed as CliConfigFile;
  } catch (err: any) {
    if (err instanceof CliError) throw err;
    throw new CliError(
      "CLI_CONFIG_INVALID",
      `Invalid CLI config JSON (${sourcePath}): ${err?.message || String(err)}`,
      { sourcePath },
    );
  }
}

function loadCliConfig(_args: CliArgs): { config: CliConfigFile; configPath: string | null } {
  const configPath = process.env.XAPPS_CLI_CONFIG || defaultCliConfigPath();
  if (!fs.existsSync(configPath)) {
    return { config: {}, configPath: null };
  }
  const raw = fs.readFileSync(configPath, "utf8");
  return { config: parseCliConfig(raw, configPath), configPath };
}

function getProfile(args: CliArgs): {
  profileName: string;
  profile: CliConfigProfile;
  configPath: string | null;
} {
  const { config, configPath } = loadCliConfig(args);
  const profileName =
    argString(args, "profile") || process.env.XAPPS_CLI_PROFILE || config.defaultProfile || "";
  if (!profileName) {
    return { profileName: "", profile: {}, configPath };
  }
  const profile = config.profiles?.[profileName];
  if (!profile || typeof profile !== "object") {
    const configLabel = configPath || defaultCliConfigPath();
    throw new CliError(
      "CLI_PROFILE_NOT_FOUND",
      `Unknown CLI profile '${profileName}' in ${configLabel}`,
      {
        profileName,
        configPath: configLabel,
      },
    );
  }
  return { profileName, profile, configPath };
}

async function confirmPublishOrThrow(summary: Record<string, unknown>) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError(
      "CLI_CONFIRM_REQUIRED",
      "Publish confirmation required in non-interactive mode. Re-run with --yes.",
    );
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `Release ${summary.slug}@${summary.version} (tools=${summary.tools}, widgets=${summary.widgets})? [y/N] `,
    );
    const normalized = String(answer || "")
      .trim()
      .toLowerCase();
    if (normalized !== "y" && normalized !== "yes") {
      throw new CliError("CLI_CONFIRM_DECLINED", "Publish cancelled by user.");
    }
  } finally {
    rl.close();
  }
}

async function readInput(from: string, fetchTimeoutMs: number): Promise<string> {
  if (/^https?:\/\//i.test(from)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
    try {
      const res = await fetch(from, { signal: controller.signal });
      if (!res.ok) {
        throw new CliError(
          "CLI_REMOTE_FETCH_ERROR",
          `Failed to fetch OpenAPI URL (${res.status}): ${from}`,
          {
            from,
            status: res.status,
            timeout_ms: fetchTimeoutMs,
          },
        );
      }
      return await res.text();
    } catch (err: any) {
      if (err instanceof CliError) throw err;
      if (err?.name === "AbortError") {
        throw new CliError(
          "CLI_REMOTE_FETCH_ERROR",
          `OpenAPI fetch timed out after ${fetchTimeoutMs}ms: ${from}`,
          { from, timeout_ms: fetchTimeoutMs },
        );
      }
      throw new CliError("CLI_REMOTE_FETCH_ERROR", `Failed to fetch OpenAPI URL: ${from}`, {
        from,
        timeout_ms: fetchTimeoutMs,
        cause: String(err?.message || err || "fetch_failed"),
      });
    } finally {
      clearTimeout(timer);
    }
  }
  const absolute = path.resolve(process.cwd(), from);
  return fs.readFileSync(absolute, "utf8");
}

function readJsonFile(file: string): unknown {
  const filePath = path.resolve(process.cwd(), file);
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Invalid JSON in ${filePath}: ${err?.message || String(err)}`);
  }
}

function parseManifestFromFile(from: string): {
  manifest: ReturnType<typeof parseXappManifest>;
  filePath: string;
} {
  const filePath = path.resolve(process.cwd(), from);
  const parsed = readJsonFile(from);
  return { manifest: parseXappManifest(parsed), filePath };
}

function runContextExport(args: CliArgs) {
  runContextExportCommand(args, {
    argString,
    findRepoRoot,
    parseManifestFromFile,
    buildDevRefs,
    canonicalizeJson,
    makeCliError: (code, message, details) => new CliError(code, message, details),
  });
}

async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

async function readRawRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    if (typeof chunk === "string") chunks.push(Buffer.from(chunk));
    else chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function runDryRun(args: CliArgs, manifest: ReturnType<typeof parseXappManifest>) {
  const dryRunFile = argString(args, "dry-run");
  if (!dryRunFile) return;

  const requestPath = path.resolve(process.cwd(), dryRunFile);
  const raw = fs.readFileSync(requestPath, "utf8");
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(
      `Invalid JSON in dry-run payload ${requestPath}: ${err?.message || String(err)}`,
    );
  }

  const toolName = typeof payload?.tool_name === "string" ? payload.tool_name : "";
  const tool = manifest.tools.find((item) => item.tool_name === toolName);
  const inputKeys =
    payload && typeof payload.input === "object" && payload.input
      ? Object.keys(payload.input as Record<string, unknown>)
      : [];

  console.log(
    [
      `Dry-run payload: ${requestPath}`,
      `Request id: ${typeof payload?.request_id === "string" ? payload.request_id : "n/a"}`,
      `Tool: ${toolName || "n/a"}${tool ? " (manifest match)" : " (not found in manifest)"}`,
      `Input keys: ${inputKeys.length ? inputKeys.join(", ") : "(none)"}`,
    ].join("\n"),
  );
}

function findRepoRoot(startDir = process.cwd()): string | null {
  let current = path.resolve(startDir);
  for (let i = 0; i < 8; i += 1) {
    if (
      fs.existsSync(path.join(current, "package.json")) &&
      fs.existsSync(path.join(current, "dev"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolvePublishBundlePath(
  outArg: string | undefined,
  slug: string,
  version: string,
): string {
  if (!outArg) {
    return path.resolve(process.cwd(), DEFAULT_PUBLISH_BUNDLES_DIR, slug, version, "bundle.json");
  }
  const resolved = path.resolve(process.cwd(), outArg);
  if (resolved.toLowerCase().endsWith(".json")) {
    return resolved;
  }
  return path.join(resolved, "bundle.json");
}

function parsePositiveIntOrThrow(
  value: string | undefined,
  fallback: number,
  label: string,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError(
      "CLI_INVALID_OPTION",
      `Invalid ${label}: ${value} (expected positive integer)`,
      { label, value },
    );
  }
  return parsed;
}

function parseHttpUrlOrThrow(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new CliError("CLI_INVALID_OPTION", `Invalid ${label}: ${value}`, { label, value });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CliError(
      "CLI_INVALID_OPTION",
      `Invalid ${label} protocol (http/https required): ${value}`,
      { label, value },
    );
  }
  return parsed.toString();
}

function parseListenPortOrThrow(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new CliError(
      "CLI_INVALID_OPTION",
      `Invalid --listen-port: ${value} (expected integer 1-65535)`,
      { label: "--listen-port", value },
    );
  }
  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function appendForwardedHeader(existing: string | null, next: string): string {
  const normalized = next.trim();
  if (!normalized) return existing || "";
  if (!existing) return normalized;
  return `${existing}, ${normalized}`;
}

type RetryableError = Error & { retryable?: boolean };

function makeRetryableError(message: string, retryable = false): RetryableError {
  const err = new Error(message) as RetryableError;
  err.retryable = retryable;
  return err;
}

function normalizeRemoteErrorDetails(bodyText: string): string {
  const text = String(bodyText || "").trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    if (!isPlainObject(parsed)) {
      return `body=${text.slice(0, 400)}`;
    }
    const errorCode =
      typeof parsed.error === "string"
        ? parsed.error
        : typeof parsed.code === "string"
          ? parsed.code
          : "";
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.detail === "string"
          ? parsed.detail
          : "";
    const parts: string[] = [];
    if (errorCode) parts.push(`error=${errorCode}`);
    if (message) parts.push(`message=${message.slice(0, 300)}`);
    return parts.length ? parts.join(" ") : `body=${text.slice(0, 400)}`;
  } catch {
    return `body=${text.slice(0, 400)}`;
  }
}

function buildRemoteHttpFailureMessage(input: {
  channel: "publish" | "logs";
  status: number;
  url: string;
  bodyText: string;
}): string {
  const detail = normalizeRemoteErrorDetails(input.bodyText);
  const retryable = isRetryableStatus(input.status);
  return [
    `Remote ${input.channel} failed (status=${input.status})`,
    `url=${input.url}`,
    `retryable=${retryable ? "yes" : "no"}`,
    detail,
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizePublishOutcome(raw: unknown): "created" | "updated" | "already_exists" | "" {
  const normalized = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  if (
    normalized === "created" ||
    normalized === "new" ||
    normalized === "published" ||
    normalized === "success"
  )
    return "created";
  if (normalized === "updated" || normalized === "modified" || normalized === "replaced")
    return "updated";
  if (
    normalized === "already_exists" ||
    normalized === "already-exists" ||
    normalized === "exists" ||
    normalized === "version_exists" ||
    normalized === "version-exists" ||
    normalized === "conflict"
  )
    return "already_exists";
  return "";
}

function pickPublishAckContainers(
  payload: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const containers: Array<Record<string, unknown>> = [payload];
  const nestedKeys = ["ack", "data", "publish", "release", "result"];
  for (const key of nestedKeys) {
    const value = payload[key];
    if (isPlainObject(value)) {
      containers.push(value);
    }
  }
  return containers;
}

function parsePublishAck(payload: unknown): {
  outcome?: "created" | "updated" | "already_exists";
  releaseId?: string;
  registryEntry?: string;
  provider?: string;
  hasOutcomeSignal: boolean;
} {
  if (!isPlainObject(payload)) {
    return { hasOutcomeSignal: false };
  }
  const candidates = pickPublishAckContainers(payload);
  let outcome: "created" | "updated" | "already_exists" | "" = "";
  let hasOutcomeSignal = false;
  let releaseId = "";
  let registryEntry = "";
  let provider = "";
  for (const candidate of candidates) {
    const outcomeRaw =
      candidate.outcome ??
      candidate.result ??
      candidate.status ??
      candidate.state ??
      candidate.disposition;
    if (outcomeRaw !== undefined) {
      hasOutcomeSignal = true;
      const normalized = normalizePublishOutcome(outcomeRaw);
      if (normalized) outcome = normalized;
    }
    if (!releaseId) {
      const value = candidate.release_id ?? candidate.releaseId ?? candidate.id;
      if (typeof value === "string" && value.trim()) releaseId = value.trim();
    }
    if (!registryEntry) {
      const value = candidate.registry_entry ?? candidate.registryEntry;
      if (typeof value === "string" && value.trim()) registryEntry = value.trim();
    }
    if (!provider) {
      const value = candidate.provider ?? candidate.publisher ?? candidate.vendor;
      if (typeof value === "string" && value.trim()) provider = value.trim();
    }
  }
  return {
    ...(outcome ? { outcome } : {}),
    ...(releaseId ? { releaseId } : {}),
    ...(registryEntry ? { registryEntry } : {}),
    ...(provider ? { provider } : {}),
    hasOutcomeSignal,
  };
}

function detectPublishConflict(bodyText: string): boolean {
  const text = String(bodyText || "").trim();
  if (!text) return false;
  try {
    const parsed = JSON.parse(text);
    if (!isPlainObject(parsed)) return false;
    const parts: string[] = [];
    const pushIfString = (value: unknown) => {
      if (typeof value === "string" && value.trim()) parts.push(value.trim().toLowerCase());
    };
    const containers = pickPublishAckContainers(parsed);
    for (const item of containers) {
      pushIfString(item.error);
      pushIfString(item.code);
      pushIfString(item.reason);
      pushIfString(item.message);
      pushIfString(item.outcome);
      pushIfString(item.result);
      pushIfString(item.status);
      pushIfString(item.state);
    }
    return parts.some((value) =>
      /already[_-]?exists|version[_-]?exists|version[_-]?conflict|conflict/.test(value),
    );
  } catch {
    return false;
  }
}

async function withRetries<T>(input: {
  attempts: number;
  backoffMs: number;
  action: (attempt: number) => Promise<T>;
}): Promise<T> {
  const attempts = Math.max(1, input.attempts);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await input.action(attempt);
    } catch (err: any) {
      lastError = err;
      const retryable = Boolean(err?.retryable);
      const isLast = attempt >= attempts;
      if (!retryable || isLast) {
        break;
      }
      const backoff = Math.max(0, input.backoffMs) * attempt;
      await sleep(backoff);
    }
  }
  throw lastError;
}

async function postPublishBundle(input: {
  publishUrl: string;
  token?: string;
  apiKey?: string;
  metadataHeaders?: {
    meta: string;
    signature: string;
  };
  versionConflictPolicy: "fail" | "allow";
  releaseChannel: string;
  registryTarget?: string;
  idempotencyKey?: string;
  timeoutMs: number;
  retryAttempts: number;
  retryBackoffMs: number;
  payload: unknown;
}) {
  return withRetries({
    attempts: input.retryAttempts,
    backoffMs: input.retryBackoffMs,
    action: async (attempt) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeoutMs);
      try {
        const headers = new Headers({ "content-type": "application/json" });
        if (input.token) {
          headers.set("authorization", `Bearer ${input.token}`);
        }
        if (input.apiKey) {
          headers.set("x-api-key", input.apiKey);
        }
        if (input.metadataHeaders) {
          headers.set("x-xapps-meta", input.metadataHeaders.meta);
          headers.set("x-xapps-meta-signature", input.metadataHeaders.signature);
        }
        headers.set("x-xapps-version-conflict-policy", input.versionConflictPolicy);
        headers.set("x-xapps-release-channel", input.releaseChannel);
        if (input.registryTarget) {
          headers.set("x-xapps-registry-target", input.registryTarget);
        }
        if (input.idempotencyKey) {
          headers.set("x-idempotency-key", input.idempotencyKey);
        }
        const res = await fetch(input.publishUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(input.payload),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          if (res.status === 409) {
            const details = normalizeRemoteErrorDetails(body);
            const looksLikeConflict =
              detectPublishConflict(body) || details.includes("already_exists");
            if (looksLikeConflict) {
              return {
                status: res.status,
                attempt,
                outcome: "already_exists" as const,
                detail: details,
              };
            }
          }
          const message = buildRemoteHttpFailureMessage({
            channel: "publish",
            status: res.status,
            url: input.publishUrl,
            bodyText: body,
          });
          throw makeRetryableError(message, isRetryableStatus(res.status));
        }
        const contentType = String(res.headers.get("content-type") || "").toLowerCase();
        if (contentType.includes("application/json")) {
          const payloadText = await res.text().catch(() => "");
          const trimmed = payloadText.trim();
          if (trimmed.length > 0) {
            let parsed: unknown;
            try {
              parsed = JSON.parse(trimmed);
            } catch {
              throw makeRetryableError(
                `Remote publish returned malformed JSON ack url=${input.publishUrl}`,
                false,
              );
            }
            if (isPlainObject(parsed) && (parsed as any).ok === false) {
              const detail = normalizeRemoteErrorDetails(trimmed);
              throw makeRetryableError(
                `Remote publish rejected by ack url=${input.publishUrl} ${detail}`,
                false,
              );
            }
            if (isPlainObject(parsed)) {
              const ack = parsePublishAck(parsed);
              const outcome = ack.outcome || "";
              if (outcome === "updated") {
                return {
                  status: res.status,
                  attempt,
                  outcome: "updated" as const,
                  ...(ack.releaseId ? { releaseId: ack.releaseId } : {}),
                  ...(ack.registryEntry ? { registryEntry: ack.registryEntry } : {}),
                  ...(ack.provider ? { provider: ack.provider } : {}),
                };
              }
              if (outcome === "already_exists") {
                return {
                  status: res.status,
                  attempt,
                  outcome: "already_exists" as const,
                  ...(ack.releaseId ? { releaseId: ack.releaseId } : {}),
                  ...(ack.registryEntry ? { registryEntry: ack.registryEntry } : {}),
                  ...(ack.provider ? { provider: ack.provider } : {}),
                };
              }
              if (ack.hasOutcomeSignal && !outcome) {
                throw makeRetryableError(
                  `Remote publish returned unsupported outcome url=${input.publishUrl}`,
                  false,
                );
              }
              if (ack.releaseId || ack.registryEntry || ack.provider) {
                return {
                  status: res.status,
                  attempt,
                  outcome: "created" as const,
                  ...(ack.releaseId ? { releaseId: ack.releaseId } : {}),
                  ...(ack.registryEntry ? { registryEntry: ack.registryEntry } : {}),
                  ...(ack.provider ? { provider: ack.provider } : {}),
                };
              }
            }
          }
        }
        return { status: res.status, attempt, outcome: "created" as const };
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw makeRetryableError(
            `Remote publish timed out after ${input.timeoutMs}ms url=${input.publishUrl}`,
            true,
          );
        }
        if (err?.retryable) {
          throw err;
        }
        throw makeRetryableError(
          `Remote publish request failed url=${input.publishUrl} cause=${err?.message || String(err)}`,
          true,
        );
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

async function runPublish(args: CliArgs) {
  const from = argString(args, "from");
  if (!from) {
    throw new Error("Missing required argument: --from <manifest.json>");
  }
  const dryRun = argFlag(args, "dry-run");
  const force = argFlag(args, "force");
  const filePath = path.resolve(process.cwd(), from);
  const sourceManifestObject = readJsonFile(from) as Record<string, unknown>;
  if (
    !sourceManifestObject ||
    typeof sourceManifestObject !== "object" ||
    Array.isArray(sourceManifestObject)
  ) {
    throw new CliError("CLI_INVALID_ARGS", `Manifest file must contain a JSON object: ${filePath}`);
  }
  const replaceRules = [
    ...argStrings(args, "replace").map(parseManifestReplaceLiteral),
    ...argStrings(args, "replace-env").map(parseManifestReplaceEnv),
  ];
  const bumpVersionKind = parseVersionBumpKind(argString(args, "bump-version"));
  const writeManifestVersion = argFlag(args, "write-manifest-version");
  const allowUnresolvedPlaceholders = argFlag(args, "allow-unresolved-placeholders");
  if (writeManifestVersion && !bumpVersionKind) {
    throw new CliError(
      "CLI_INVALID_ARGS",
      "--write-manifest-version requires --bump-version patch|minor|major",
    );
  }

  let manifestSourceForPublish = JSON.parse(JSON.stringify(sourceManifestObject)) as Record<
    string,
    unknown
  >;
  if (replaceRules.length > 0) {
    manifestSourceForPublish = applyManifestReplaceRulesDeep(
      manifestSourceForPublish,
      replaceRules,
    );
  }
  const sourceVersionBeforeBump = String(manifestSourceForPublish.version ?? "").trim();
  let sourceVersionAfterBump = sourceVersionBeforeBump;
  if (bumpVersionKind) {
    sourceVersionAfterBump = bumpSemverVersionOrThrow(sourceVersionBeforeBump, bumpVersionKind);
    manifestSourceForPublish.version = sourceVersionAfterBump;
  }
  const unresolvedPlaceholders = findUnresolvedPlaceholderTokens(manifestSourceForPublish);
  if (unresolvedPlaceholders.length > 0 && !allowUnresolvedPlaceholders) {
    throw new CliError(
      "CLI_INVALID_ARGS",
      `Manifest contains unresolved placeholders after replacements: ${unresolvedPlaceholders.join(", ")}`,
      { placeholders: unresolvedPlaceholders, manifest: filePath },
    );
  }
  const manifest = parseXappManifest(manifestSourceForPublish);
  const { profile } = getProfile(args);
  const publishUrlRaw =
    argString(args, "publish-url") || process.env.XAPPS_CLI_PUBLISH_URL || profile.publishUrl;
  const publishUrl = publishUrlRaw ? parseHttpUrlOrThrow(publishUrlRaw, "--publish-url") : "";
  const publisherGatewayUrlRaw =
    argString(args, "publisher-gateway-url") || process.env.XAPPS_CLI_PUBLISHER_GATEWAY_URL;
  const publisherGatewayUrl = publisherGatewayUrlRaw
    ? parseHttpUrlOrThrow(publisherGatewayUrlRaw, "--publisher-gateway-url")
    : "";
  const publisherGatewayApiBaseUrl = publisherGatewayUrl
    ? normalizePublisherGatewayApiBaseUrl(publisherGatewayUrl)
    : "";
  const targetClientSlug = argString(args, "target-client-slug", "target_client_slug");
  const token = argString(args, "token") || process.env.XAPPS_CLI_TOKEN || profile.token;
  const apiKey =
    argString(args, "api-key", "apiKey") || process.env.XAPPS_CLI_API_KEY || profile.apiKey;
  const signingKey =
    argString(args, "signing-key") || process.env.XAPPS_CLI_SIGNING_KEY || profile.signingKey;
  const versionConflictPolicy = parseVersionConflictPolicy(
    argString(args, "version-conflict"),
    profile.versionConflict || "fail",
  );
  const releaseChannel = parseReleaseLabel(
    argString(args, "release-channel") ||
      process.env.XAPPS_CLI_RELEASE_CHANNEL ||
      profile.releaseChannel,
    "stable",
    "--release-channel",
  );
  const registryTarget = parseReleaseLabel(
    argString(args, "registry-target") ||
      process.env.XAPPS_CLI_REGISTRY_TARGET ||
      profile.registryTarget,
    "",
    "--registry-target",
  );
  const retryAttempts = parsePositiveIntOrThrow(
    argString(args, "retry-attempts"),
    1,
    "--retry-attempts",
  );
  const retryBackoffMs = parsePositiveIntOrThrow(
    argString(args, "retry-backoff-ms"),
    250,
    "--retry-backoff-ms",
  );
  const timeoutMsStrict = parsePositiveIntOrThrow(
    argString(args, "timeout-ms"),
    10000,
    "--timeout-ms",
  );

  let manifestForPublish = manifest as Record<string, unknown>;
  if (targetClientSlug) {
    if (!publisherGatewayApiBaseUrl) {
      throw new CliError(
        "CLI_INVALID_ARGS",
        "Resolving --target-client-slug requires --publisher-gateway-url (tenant slug lookup uses publisher API).",
        { target_client_slug: targetClientSlug },
      );
    }
    const client = createPublisherApiClient({
      baseUrl: publisherGatewayApiBaseUrl,
      apiKey,
      token,
    });
    let clientsPayload: { items: Array<Record<string, unknown>> };
    try {
      clientsPayload = (await client.listClients()) as { items: Array<Record<string, unknown>> };
    } catch (err: any) {
      if (err instanceof PublisherApiClientError) {
        throw new CliError(
          `CLI_${err.code}`,
          `Publisher tenant lookup failed: ${err.message}`,
          {
            url: publisherGatewayUrl,
            api_base_url: publisherGatewayApiBaseUrl,
            status: err.status,
            details: err.details,
            target_client_slug: targetClientSlug,
          },
          { exitCode: 4 },
        );
      }
      throw err;
    }
    const matches = clientsPayload.items.filter(
      (item) => String(item.slug || "").trim() === targetClientSlug,
    );
    if (matches.length === 0) {
      throw new CliError(
        "CLI_INVALID_ARGS",
        `Tenant slug not found via publisher API: ${targetClientSlug}`,
        { target_client_slug: targetClientSlug, api_base_url: publisherGatewayApiBaseUrl },
      );
    }
    if (matches.length > 1) {
      throw new CliError(
        "CLI_INVALID_ARGS",
        `Tenant slug resolved ambiguously via publisher API: ${targetClientSlug}`,
        { target_client_slug: targetClientSlug, matches: matches.map((m) => m.id || m.slug) },
      );
    }
    const resolvedClientId = String(matches[0]?.id || "").trim();
    if (!resolvedClientId) {
      throw new CliError(
        "CLI_INVALID_ARGS",
        `Publisher API returned tenant without id for slug: ${targetClientSlug}`,
        { target_client_slug: targetClientSlug, match: matches[0] },
      );
    }
    manifestForPublish = {
      ...(manifest as Record<string, unknown>),
      target_client_id: resolvedClientId,
    };
  }

  if (
    !Object.prototype.hasOwnProperty.call(manifestForPublish, "target_client_id") ||
    !String((manifestForPublish as any).target_client_id || "").trim()
  ) {
    throw new CliError(
      "CLI_INVALID_ARGS",
      "Manifest publish requires target_client_id (tenant-aware publish is required). Use manifest.target_client_id or --target-client-slug with --publisher-gateway-url.",
      { manifest: filePath },
    );
  }

  const manifestJson = JSON.stringify(manifestForPublish);
  const manifestSha256 = createHash("sha256").update(manifestJson).digest("hex");
  const idempotencyKey =
    argString(args, "idempotency-key") ||
    `xapps-cli:${manifest.slug}:${manifest.version}:${manifestSha256.slice(0, 16)}`;
  const outPath = resolvePublishBundlePath(argString(args, "out"), manifest.slug, manifest.version);

  const summary = {
    slug: manifest.slug,
    version: manifest.version,
    tools: manifest.tools.length,
    widgets: manifest.widgets.length,
    manifest_sha256: manifestSha256,
    release_channel: releaseChannel,
    ...(registryTarget ? { registry_target: registryTarget } : {}),
  };

  if (dryRun) {
    console.log(
      `Publish dry-run (no deploy)\nManifest: ${filePath}\nBundle target: ${outPath}\nRemote target: ${publishUrl || "(none)"}\nSummary: ${JSON.stringify(summary)}`,
    );
    return;
  }

  if (!argFlag(args, "yes")) {
    await confirmPublishOrThrow(summary);
  }

  if (!force && fs.existsSync(outPath)) {
    throw new Error(`Publish bundle already exists: ${outPath} (use --force to overwrite)`);
  }

  if (writeManifestVersion) {
    if (sourceVersionBeforeBump !== sourceVersionAfterBump) {
      const sourceUpdated = {
        ...(sourceManifestObject as Record<string, unknown>),
        version: sourceVersionAfterBump,
      };
      fs.writeFileSync(filePath, `${JSON.stringify(sourceUpdated, null, 2)}\n`);
    }
  }

  const bundle = {
    schema_version: "xapps.publish.v0",
    generated_at: new Date().toISOString(),
    manifest_source: filePath,
    summary,
    ...(replaceRules.length > 0
      ? {
          manifest_transforms: {
            replacements: replaceRules.map((rule) => ({
              from: rule.from,
              source: rule.source,
              ...(rule.sourceName ? { source_name: rule.sourceName } : {}),
            })),
            ...(bumpVersionKind
              ? {
                  version_bump: {
                    kind: bumpVersionKind,
                    from: sourceVersionBeforeBump,
                    to: sourceVersionAfterBump,
                    ...(writeManifestVersion ? { wrote_source_manifest_version: true } : {}),
                  },
                }
              : {}),
          },
        }
      : bumpVersionKind
        ? {
            manifest_transforms: {
              version_bump: {
                kind: bumpVersionKind,
                from: sourceVersionBeforeBump,
                to: sourceVersionAfterBump,
                ...(writeManifestVersion ? { wrote_source_manifest_version: true } : {}),
              },
            },
          }
        : {}),
    release: {
      channel: releaseChannel,
      ...(registryTarget ? { registry_target: registryTarget } : {}),
      version_conflict_policy: versionConflictPolicy,
    },
    manifest: manifestForPublish,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2));
  const lines: string[] = [
    `Publish bundle created: ${outPath}`,
    `Summary: ${JSON.stringify(summary)}`,
  ];
  const metadataPayload = {
    generated_at: bundle.generated_at,
    idempotency_key: idempotencyKey,
    manifest_sha256: manifestSha256,
    slug: manifest.slug,
    version: manifest.version,
    release_channel: releaseChannel,
    ...(registryTarget ? { registry_target: registryTarget } : {}),
  };
  const metadataJson = stableStringify(metadataPayload);
  const metadataSignature = signingKey
    ? `hmac-sha256:${base64url(createHmac("sha256", signingKey).update(metadataJson).digest())}`
    : "";
  if (publishUrl) {
    const remote = await postPublishBundle({
      publishUrl,
      token,
      apiKey,
      metadataHeaders: signingKey
        ? { meta: metadataJson, signature: metadataSignature }
        : undefined,
      versionConflictPolicy,
      releaseChannel,
      registryTarget,
      idempotencyKey,
      timeoutMs: timeoutMsStrict,
      retryAttempts,
      retryBackoffMs,
      payload: bundle,
    });
    if (remote.outcome === "already_exists") {
      if (versionConflictPolicy === "allow") {
        lines.push(
          `Remote publish version conflict allowed: outcome=already_exists url=${publishUrl} attempts=${remote.attempt}`,
        );
        if (remote.releaseId || remote.registryEntry || remote.provider) {
          lines.push(
            `Remote release metadata: release_id=${remote.releaseId || "-"} registry_entry=${remote.registryEntry || "-"} provider=${remote.provider || "-"}`,
          );
        }
        console.log(lines.join("\n"));
        return;
      }
      throw new CliError(
        "CLI_VERSION_CONFLICT",
        `Remote publish version conflict: already_exists url=${publishUrl} (set --version-conflict allow to continue)`,
        { url: publishUrl, outcome: remote.outcome },
        { exitCode: 3 },
      );
    }
    lines.push(
      `Remote publish delivered: status=${remote.status} url=${publishUrl} attempts=${remote.attempt} outcome=${remote.outcome}`,
    );
    if (remote.releaseId || remote.registryEntry || remote.provider) {
      lines.push(
        `Remote release metadata: release_id=${remote.releaseId || "-"} registry_entry=${remote.registryEntry || "-"} provider=${remote.provider || "-"}`,
      );
    }
  }
  if (publisherGatewayApiBaseUrl) {
    try {
      const client = createPublisherApiClient({
        baseUrl: publisherGatewayApiBaseUrl,
        apiKey,
        token,
      });
      const result = await client.importAndPublishManifest(manifestForPublish);
      const versionStatus =
        result && result.version && typeof result.version === "object"
          ? String((result.version as any).status || "")
          : "";
      lines.push(
        `Publisher gateway import+publish delivered: base=${publisherGatewayApiBaseUrl} xapp_id=${result.xappId} version_id=${result.versionId}${versionStatus ? ` status=${versionStatus}` : ""}`,
      );
    } catch (err: any) {
      if (err instanceof PublisherApiClientError) {
        if (err.code === "PUBLISHER_API_CONFLICT") {
          const conflictCode = String((err.details as any)?.code || "").trim();
          const isVersionConflict =
            conflictCode === "VERSION_CONFLICT" ||
            /version.*exist/i.test(String(err.message || ""));
          if (isVersionConflict) {
            if (versionConflictPolicy === "allow") {
              lines.push(
                `Publisher gateway version conflict allowed: base=${publisherGatewayApiBaseUrl} outcome=already_exists`,
              );
              console.log(lines.join("\n"));
              return;
            }
            throw new CliError(
              "CLI_VERSION_CONFLICT",
              `Publisher gateway version conflict: already_exists base=${publisherGatewayApiBaseUrl} (set --version-conflict allow to continue)`,
              {
                url: publisherGatewayUrl,
                api_base_url: publisherGatewayApiBaseUrl,
                status: err.status,
                details: err.details,
              },
              { exitCode: 3 },
            );
          }
        }
        throw new CliError(
          `CLI_${err.code}`,
          `Publisher gateway publish failed: ${err.message}`,
          {
            url: publisherGatewayUrl,
            api_base_url: publisherGatewayApiBaseUrl,
            status: err.status,
            details: err.details,
          },
          { exitCode: 4 },
        );
      }
      throw err;
    }
  }
  console.log(lines.join("\n"));
}

type PublishBundleSummary = {
  bundle_path: string;
  generated_at: string;
  slug: string;
  version: string;
  tools: number;
  widgets: number;
  manifest_sha256: string;
};

type RemoteLogsResult = {
  entries: PublishBundleSummary[];
  nextCursor?: string;
  leaseId?: string;
  checkpoint?: string;
};

function normalizeBundleSummary(
  value: unknown,
  fallbackPath: string,
  fallbackGeneratedAt = "",
): PublishBundleSummary | null {
  if (!isPlainObject(value)) return null;
  const bundlePath =
    typeof value.bundle_path === "string"
      ? value.bundle_path
      : typeof value.path === "string"
        ? value.path
        : fallbackPath;
  const generatedAt =
    typeof value.generated_at === "string"
      ? value.generated_at
      : typeof value.created_at === "string"
        ? value.created_at
        : fallbackGeneratedAt;
  const slug = typeof value.slug === "string" ? value.slug.trim() : "";
  const version = typeof value.version === "string" ? value.version.trim() : "";
  const tools = typeof value.tools === "number" ? value.tools : NaN;
  const widgets = typeof value.widgets === "number" ? value.widgets : NaN;
  const manifestSha256 = typeof value.manifest_sha256 === "string" ? value.manifest_sha256 : "";
  if (!bundlePath || !generatedAt || !slug || !version) return null;
  if (!Number.isFinite(tools) || tools < 0 || !Number.isFinite(widgets) || widgets < 0) return null;
  return {
    bundle_path: bundlePath,
    generated_at: generatedAt,
    slug,
    version,
    tools,
    widgets,
    manifest_sha256: manifestSha256,
  };
}

function toBundleSummary(bundlePath: string, payload: unknown): PublishBundleSummary {
  if (!isPlainObject(payload)) {
    throw new Error(`Invalid bundle payload in ${bundlePath}`);
  }
  if (payload.schema_version !== "xapps.publish.v0") {
    throw new Error(`Unsupported bundle schema in ${bundlePath}`);
  }
  const summary = isPlainObject(payload.summary) ? payload.summary : {};
  return {
    bundle_path: bundlePath,
    generated_at: typeof payload.generated_at === "string" ? payload.generated_at : "",
    slug: typeof summary.slug === "string" ? summary.slug : "",
    version: typeof summary.version === "string" ? summary.version : "",
    tools: typeof summary.tools === "number" ? summary.tools : 0,
    widgets: typeof summary.widgets === "number" ? summary.widgets : 0,
    manifest_sha256: typeof summary.manifest_sha256 === "string" ? summary.manifest_sha256 : "",
  };
}

function collectBundleFiles(dirPath: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dirPath)) {
    return out;
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectBundleFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name === "bundle.json") {
      out.push(full);
    }
  }
  return out;
}

async function fetchRemoteLogs(input: {
  logsUrl: string;
  token?: string;
  apiKey?: string;
  timeoutMs: number;
  limit: number;
  cursor?: string;
  leaseId?: string;
  checkpoint?: string;
  severity?: string;
  since?: string;
  until?: string;
  retryAttempts: number;
  retryBackoffMs: number;
}): Promise<RemoteLogsResult> {
  return withRetries({
    attempts: input.retryAttempts,
    backoffMs: input.retryBackoffMs,
    action: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeoutMs);
      try {
        const headers = new Headers();
        if (input.token) headers.set("authorization", `Bearer ${input.token}`);
        if (input.apiKey) headers.set("x-api-key", input.apiKey);
        const url = new URL(input.logsUrl);
        if (!url.searchParams.has("limit")) {
          url.searchParams.set("limit", String(input.limit));
        }
        if (input.cursor) url.searchParams.set("cursor", input.cursor);
        if (input.leaseId) url.searchParams.set("lease_id", input.leaseId);
        if (input.checkpoint) url.searchParams.set("checkpoint", input.checkpoint);
        if (input.severity) url.searchParams.set("severity", input.severity);
        if (input.since) url.searchParams.set("since", input.since);
        if (input.until) url.searchParams.set("until", input.until);
        const res = await fetch(url, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const message = buildRemoteHttpFailureMessage({
            channel: "logs",
            status: res.status,
            url: input.logsUrl,
            bodyText: body,
          });
          throw makeRetryableError(message, isRetryableStatus(res.status));
        }
        const payload = await res.json();
        const rowsRaw = Array.isArray(payload)
          ? payload
          : isPlainObject(payload) && Array.isArray((payload as any).entries)
            ? (payload as any).entries
            : null;
        if (!rowsRaw) {
          throw makeRetryableError(
            `Remote logs returned malformed payload url=${input.logsUrl}`,
            false,
          );
        }
        const rows = rowsRaw
          .map((entry) => normalizeBundleSummary(entry, "remote://logs"))
          .filter((entry): entry is PublishBundleSummary => !!entry);
        if (rowsRaw.length > 0 && rows.length === 0) {
          throw makeRetryableError(
            `Remote logs returned malformed entries url=${input.logsUrl}`,
            false,
          );
        }
        const nextCursor =
          isPlainObject(payload) &&
          (typeof (payload as any).next_cursor === "string" ||
            typeof (payload as any).nextCursor === "string")
            ? String((payload as any).next_cursor ?? (payload as any).nextCursor ?? "")
            : "";
        const payloadHasLease =
          isPlainObject(payload) &&
          (Object.prototype.hasOwnProperty.call(payload as object, "lease_id") ||
            Object.prototype.hasOwnProperty.call(payload as object, "leaseId"));
        const payloadHasCheckpoint =
          isPlainObject(payload) &&
          (Object.prototype.hasOwnProperty.call(payload as object, "checkpoint") ||
            Object.prototype.hasOwnProperty.call(payload as object, "checkpoint_token") ||
            Object.prototype.hasOwnProperty.call(payload as object, "checkpointToken"));
        const leaseId =
          isPlainObject(payload) &&
          (typeof (payload as any).lease_id === "string" ||
            typeof (payload as any).leaseId === "string")
            ? String((payload as any).lease_id ?? (payload as any).leaseId ?? "")
            : "";
        const checkpoint =
          isPlainObject(payload) &&
          (typeof (payload as any).checkpoint === "string" ||
            typeof (payload as any).checkpoint_token === "string" ||
            typeof (payload as any).checkpointToken === "string")
            ? String(
                (payload as any).checkpoint ??
                  (payload as any).checkpoint_token ??
                  (payload as any).checkpointToken ??
                  "",
              )
            : "";
        if (payloadHasLease && !leaseId) {
          throw makeRetryableError(
            `Remote logs returned malformed lease_id field url=${input.logsUrl}`,
            false,
          );
        }
        if (payloadHasCheckpoint && !checkpoint) {
          throw makeRetryableError(
            `Remote logs returned malformed checkpoint field url=${input.logsUrl}`,
            false,
          );
        }
        return {
          entries: rows
            .sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)))
            .slice(0, input.limit),
          ...(nextCursor ? { nextCursor } : {}),
          ...(leaseId ? { leaseId } : {}),
          ...(checkpoint ? { checkpoint } : {}),
        };
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw makeRetryableError(
            `Remote logs timed out after ${input.timeoutMs}ms url=${input.logsUrl}`,
            true,
          );
        }
        if (err?.retryable) {
          throw err;
        }
        throw makeRetryableError(
          `Remote logs request failed url=${input.logsUrl} cause=${err?.message || String(err)}`,
          true,
        );
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

async function runLogs(args: CliArgs) {
  const { profile } = getProfile(args);
  const json = argFlag(args, "json");
  const limit = parsePositiveIntOrThrow(argString(args, "limit"), 10, "--limit");
  const from = argString(args, "from");
  const dir = path.resolve(process.cwd(), argString(args, "dir") || DEFAULT_PUBLISH_BUNDLES_DIR);
  const logsUrlRaw =
    argString(args, "logs-url") || process.env.XAPPS_CLI_LOGS_URL || profile.logsUrl;
  const logsUrl = logsUrlRaw ? parseHttpUrlOrThrow(logsUrlRaw, "--logs-url") : "";
  const token = argString(args, "token") || process.env.XAPPS_CLI_TOKEN || profile.token;
  const apiKey =
    argString(args, "api-key", "apiKey") || process.env.XAPPS_CLI_API_KEY || profile.apiKey;
  const cursor = argString(args, "cursor");
  const leaseId = argString(args, "lease-id");
  const checkpoint = argString(args, "checkpoint");
  const severity = argString(args, "severity");
  const since = argString(args, "since");
  const until = argString(args, "until");
  const follow = argFlag(args, "follow");
  const followCursorFile = argString(args, "follow-cursor-file");
  const followIntervalMs = parsePositiveIntOrThrow(
    argString(args, "follow-interval-ms"),
    2000,
    "--follow-interval-ms",
  );
  const followMaxCycles = parsePositiveIntOrThrow(
    argString(args, "follow-max-cycles"),
    1,
    "--follow-max-cycles",
  );
  const timeoutMs = parsePositiveIntOrThrow(argString(args, "timeout-ms"), 10000, "--timeout-ms");
  const retryAttempts = parsePositiveIntOrThrow(
    argString(args, "retry-attempts"),
    1,
    "--retry-attempts",
  );
  const retryBackoffMs = parsePositiveIntOrThrow(
    argString(args, "retry-backoff-ms"),
    250,
    "--retry-backoff-ms",
  );

  const localSummaries = logsUrl
    ? null
    : (() => {
        const bundleFiles = from ? [path.resolve(process.cwd(), from)] : collectBundleFiles(dir);
        if (!bundleFiles.length) {
          throw new Error(
            from
              ? `Bundle not found: ${path.resolve(process.cwd(), from)}`
              : `No bundles found in ${dir}`,
          );
        }
        return bundleFiles
          .map((file) => toBundleSummary(file, readJsonFile(file)))
          .sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)))
          .slice(0, limit);
      })();

  async function printRows(
    rows: PublishBundleSummary[],
    nextCursor?: string,
    leaseId?: string,
    checkpoint?: string,
  ) {
    if (!rows.length) return;
    if (json) {
      console.log(
        JSON.stringify(
          {
            count: rows.length,
            entries: rows,
            ...(nextCursor ? { next_cursor: nextCursor } : {}),
            ...(leaseId ? { lease_id: leaseId } : {}),
            ...(checkpoint ? { checkpoint } : {}),
          },
          null,
          2,
        ),
      );
      return;
    }
    const lines: string[] = [`Logs entries: ${rows.length}`];
    for (const entry of rows) {
      lines.push(
        [
          `- ${entry.slug}@${entry.version}`,
          `generated_at=${entry.generated_at || "n/a"}`,
          `tools=${entry.tools}`,
          `widgets=${entry.widgets}`,
          `bundle=${entry.bundle_path}`,
        ].join(" "),
      );
    }
    if (nextCursor) lines.push(`next_cursor=${nextCursor}`);
    if (leaseId) lines.push(`lease_id=${leaseId}`);
    if (checkpoint) lines.push(`checkpoint=${checkpoint}`);
    console.log(lines.join("\n"));
  }

  if (!logsUrl && localSummaries) {
    if (!localSummaries.length) {
      throw new Error(
        from
          ? `Bundle not found: ${path.resolve(process.cwd(), from)}`
          : `No bundles found in ${dir}`,
      );
    }
    await printRows(localSummaries);
    return;
  }

  if (!logsUrl) return;

  let currentCursor = cursor || "";
  let currentLeaseId = leaseId || "";
  let currentCheckpoint = checkpoint || "";
  if (followCursorFile) {
    const state = loadLogsResumeState(followCursorFile);
    if (!currentCursor && state.cursor) currentCursor = state.cursor;
    if (state.leaseId) currentLeaseId = state.leaseId;
    if (state.checkpoint) currentCheckpoint = state.checkpoint;
  }
  let cycles = 0;
  let seen = 0;
  while (true) {
    cycles += 1;
    try {
      const remote = await fetchRemoteLogs({
        logsUrl,
        token,
        apiKey,
        timeoutMs,
        limit,
        cursor: currentCursor || undefined,
        leaseId: currentLeaseId || undefined,
        checkpoint: currentCheckpoint || undefined,
        severity,
        since,
        until,
        retryAttempts,
        retryBackoffMs,
      });
      if (remote.entries.length) {
        seen += remote.entries.length;
        await printRows(remote.entries, remote.nextCursor, remote.leaseId, remote.checkpoint);
      } else if (!follow && seen === 0) {
        throw new Error(`No log entries returned by remote endpoint: ${logsUrl}`);
      }
      if (remote.leaseId) currentLeaseId = remote.leaseId;
      if (remote.checkpoint) currentCheckpoint = remote.checkpoint;
      if (remote.nextCursor) {
        currentCursor = remote.nextCursor;
      }
      if (followCursorFile) {
        saveLogsResumeState(followCursorFile, {
          ...(currentCursor ? { cursor: currentCursor } : {}),
          ...(currentLeaseId ? { leaseId: currentLeaseId } : {}),
          ...(currentCheckpoint ? { checkpoint: currentCheckpoint } : {}),
        });
      }
    } catch (err: any) {
      if (!follow) throw err;
      console.error(`[logs-follow] reconnecting after error: ${err?.message || String(err)}`);
    }
    if (!follow) return;
    if (cycles >= followMaxCycles) return;
    await sleep(followIntervalMs);
  }
}

async function runTunnel(args: CliArgs) {
  const { profile } = getProfile(args);
  const target = argString(args, "target");
  if (!target) {
    throw new Error("Missing required argument: --target <base-url>");
  }
  const targetBase = parseHttpUrlOrThrow(String(target).replace(/\/$/, ""), "--target").replace(
    /\/$/,
    "",
  );
  const targetHostname = new URL(targetBase).hostname.toLowerCase();
  const allowTargetHosts = parseCsvSet(
    argString(args, "allow-target-hosts") || process.env.XAPPS_CLI_TUNNEL_ALLOW_TARGET_HOSTS,
    "127.0.0.1,localhost,::1",
  );
  if (!allowTargetHosts.has(targetHostname)) {
    throw new CliError(
      "CLI_TUNNEL_TARGET_NOT_ALLOWED",
      `Tunnel target host is not allowed: ${targetHostname} (allowlist=${Array.from(allowTargetHosts).join(",")})`,
      { targetHostname, allowlist: Array.from(allowTargetHosts) },
    );
  }
  const host = argString(args, "host") || "127.0.0.1";
  const port = parseListenPortOrThrow(argString(args, "listen-port"), 4041);
  const sessionFile = argString(args, "session-file");
  const sessionIdArg = argString(args, "session-id");
  const sessionPolicy = parseTunnelSessionPolicy(argString(args, "session-policy"), "reuse");
  const sessionStateFromFile = sessionFile ? loadTunnelSessionState(sessionFile) : null;
  let sessionId = "";
  let sessionSource: "generated" | "arg" | "file" | "rotated" = "generated";
  if (sessionPolicy === "rotate") {
    if (sessionIdArg) {
      sessionId = sessionIdArg;
      sessionSource = "arg";
    } else {
      sessionId = randomSessionId("tnl");
      sessionSource = "rotated";
    }
  } else if (sessionIdArg) {
    if (
      sessionStateFromFile?.sessionId &&
      sessionStateFromFile.sessionId !== sessionIdArg &&
      sessionPolicy !== "rotate"
    ) {
      throw new CliError(
        "CLI_TUNNEL_SESSION_CONFLICT",
        `Provided --session-id does not match persisted session file (${sessionFile})`,
        {
          provided_session_id: sessionIdArg,
          persisted_session_id: sessionStateFromFile.sessionId,
          session_file: sessionFile,
          session_policy: sessionPolicy,
        },
      );
    }
    sessionId = sessionIdArg;
    sessionSource = "arg";
  } else if (sessionStateFromFile?.sessionId) {
    const persistedTarget = String(sessionStateFromFile.target || "").trim();
    if (persistedTarget && persistedTarget !== targetBase) {
      if (sessionPolicy === "require") {
        throw new CliError(
          "CLI_TUNNEL_SESSION_TARGET_MISMATCH",
          `Persisted tunnel session target does not match current --target (${persistedTarget} != ${targetBase})`,
          {
            persisted_target: persistedTarget,
            current_target: targetBase,
            session_file: sessionFile || "",
          },
        );
      }
      sessionId = randomSessionId("tnl");
      sessionSource = "rotated";
    } else {
      sessionId = sessionStateFromFile.sessionId;
      sessionSource = "file";
    }
  } else if (sessionPolicy === "require") {
    throw new CliError(
      "CLI_TUNNEL_SESSION_REQUIRED",
      "Session policy 'require' needs existing --session-file state or explicit --session-id",
      {
        session_file: sessionFile || "",
        session_policy: sessionPolicy,
      },
    );
  } else {
    sessionId = randomSessionId("tnl");
    sessionSource = "generated";
  }
  if (sessionFile) {
    saveTunnelSessionState(sessionFile, {
      sessionId,
      target: targetBase,
    });
  }
  const once = argFlag(args, "once");
  const requiredToken =
    argString(args, "require-auth-token") ||
    process.env.XAPPS_CLI_TUNNEL_TOKEN ||
    profile.tunnelToken ||
    undefined;
  const upstreamTimeoutMs = parsePositiveIntOrThrow(
    argString(args, "upstream-timeout-ms"),
    15000,
    "--upstream-timeout-ms",
  );
  const retryAttempts = parsePositiveIntOrThrow(
    argString(args, "retry-attempts"),
    1,
    "--retry-attempts",
  );
  const retryBackoffMs = parsePositiveIntOrThrow(
    argString(args, "retry-backoff-ms"),
    200,
    "--retry-backoff-ms",
  );
  const idempotentMethods = new Set(["GET", "HEAD", "OPTIONS"]);
  const startedAt = new Date().toISOString();
  let proxiedRequests = 0;
  let proxyErrors = 0;
  let lastUpstreamStatus = 0;

  const announce = `xapps tunnel relay\nSession: ${sessionId}\nSession policy: ${sessionPolicy}\nSession source: ${sessionSource}\nListen: http://${host}:${port}\nTarget: ${targetBase}\nAllowlist: ${Array.from(allowTargetHosts).join(",")}\nMode: local relay baseline (no external public URL)\nUpstream timeout: ${upstreamTimeoutMs}ms`;
  if (once) {
    console.log(announce);
    return;
  }

  const server = http.createServer(async (req, res) => {
    const method = (req.method || "GET").toUpperCase();
    const requestUrl = req.url || "/";
    const headerToken =
      typeof req.headers["x-xapps-tunnel-token"] === "string"
        ? req.headers["x-xapps-tunnel-token"]
        : undefined;
    const authHeader =
      typeof req.headers.authorization === "string" ? req.headers.authorization.trim() : "";
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : undefined;
    const suppliedToken = headerToken || bearerToken;
    if (requiredToken && suppliedToken !== requiredToken) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: "tunnel_auth_required",
          message: "Missing or invalid tunnel auth token",
        }),
      );
      return;
    }

    if (requestUrl === "/__ready") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          tunnel: "ready",
          session_id: sessionId,
          session_policy: sessionPolicy,
          session_source: sessionSource,
          target: targetBase,
        }),
      );
      return;
    }

    if (requestUrl === "/__status") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          tunnel: "status",
          session_id: sessionId,
          session_policy: sessionPolicy,
          session_source: sessionSource,
          session_file: sessionFile || null,
          target: targetBase,
          listen: { host, port },
          started_at: startedAt,
          proxied_requests: proxiedRequests,
          proxy_errors: proxyErrors,
          last_upstream_status: lastUpstreamStatus || null,
        }),
      );
      return;
    }

    const body = await readRawRequestBody(req);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue;
      const lower = key.toLowerCase();
      if (lower === "host") continue;
      if (
        lower === "connection" ||
        lower === "keep-alive" ||
        lower === "proxy-authorization" ||
        lower === "proxy-authenticate" ||
        lower === "te" ||
        lower === "trailers" ||
        lower === "transfer-encoding" ||
        lower === "upgrade"
      ) {
        continue;
      }
      if (Array.isArray(value)) headers.set(key, value.join(", "));
      else headers.set(key, String(value));
    }
    headers.set(
      "x-forwarded-host",
      appendForwardedHeader(headers.get("x-forwarded-host"), `${host}:${port}`),
    );
    headers.set(
      "x-forwarded-proto",
      appendForwardedHeader(headers.get("x-forwarded-proto"), "http"),
    );
    headers.set(
      "x-forwarded-port",
      appendForwardedHeader(headers.get("x-forwarded-port"), String(port)),
    );
    if (req.socket?.remoteAddress) {
      const existingForwardedFor = headers.get("x-forwarded-for");
      headers.set(
        "x-forwarded-for",
        appendForwardedHeader(existingForwardedFor, req.socket.remoteAddress),
      );
    }

    const targetUrl = `${targetBase}${requestUrl}`;
    try {
      const attempts = idempotentMethods.has(method) ? retryAttempts : 1;
      const upstream = await withRetries({
        attempts,
        backoffMs: retryBackoffMs,
        action: async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), upstreamTimeoutMs);
          try {
            const resUpstream = await fetch(targetUrl, {
              method,
              headers,
              body: method === "GET" || method === "HEAD" ? undefined : body,
              signal: controller.signal,
            });
            if (isRetryableStatus(resUpstream.status)) {
              throw makeRetryableError(`upstream status ${resUpstream.status}`, true);
            }
            return resUpstream;
          } catch (err: any) {
            if (err?.name === "AbortError") {
              throw makeRetryableError("upstream timeout", true);
            }
            if (err?.retryable) throw err;
            throw makeRetryableError(err?.message || String(err), true);
          } finally {
            clearTimeout(timer);
          }
        },
      });
      const upstreamBody = Buffer.from(await upstream.arrayBuffer());
      res.statusCode = upstream.status;
      proxiedRequests += 1;
      lastUpstreamStatus = upstream.status;
      upstream.headers.forEach((value, key) => {
        if (key.toLowerCase() === "transfer-encoding") return;
        res.setHeader(key, value);
      });
      res.end(upstreamBody);
      console.log(
        `[tunnel] ${method} ${requestUrl} -> ${targetUrl} status=${upstream.status} bytes=${upstreamBody.length}`,
      );
    } catch (err: any) {
      proxyErrors += 1;
      const timeout = String(err?.message || "")
        .toLowerCase()
        .includes("timeout");
      res.statusCode = timeout ? 504 : 502;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: timeout ? "upstream_timeout" : "upstream_unreachable",
          message: err?.message || String(err),
        }),
      );
      console.error(
        `[tunnel] upstream error ${method} ${requestUrl}: ${err?.message || String(err)}`,
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(announce);

  await new Promise<void>((resolve) => {
    const shutdown = () => server.close(() => resolve());
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

export async function runCli(argv: string[]) {
  try {
    const { command, args } = parseArgs(argv);
    if (!command || command === "--help" || command === "-h" || command === "help") {
      printUsage();
      return;
    }

    if (command === "import") {
      await runImportCommand(args, {
        argString,
        argFlag,
        readInput,
        parsePositiveIntOrThrow,
        parseManifestFromFile,
        readJsonFile,
      });
      return;
    }
    if (command === "validate") {
      runValidateCommand(args, {
        argString,
        argFlag,
        readInput,
        parsePositiveIntOrThrow,
        parseManifestFromFile,
        readJsonFile,
      });
      return;
    }
    if (command === "test") {
      runTestCommand(args, {
        argString,
        argFlag,
        readInput,
        parsePositiveIntOrThrow,
        parseManifestFromFile,
        readJsonFile,
      });
      return;
    }
    if (command === "publish") {
      await runPublish(args);
      return;
    }
    if (command === "logs") {
      await runLogs(args);
      return;
    }
    if (command === "context") {
      const subcommand = argString(args, "_subcommand");
      if (subcommand !== "export") {
        throw new CliError("CLI_INVALID_ARGS", "Missing required subcommand: context export");
      }
      runContextExport(args);
      return;
    }
    if (command === "tunnel") {
      await runTunnel(args);
      return;
    }
    if (command === "init") {
      runInitCommand(args, {
        argString,
        argFlag,
        readInput,
        parsePositiveIntOrThrow,
        parseManifestFromFile,
        readJsonFile,
      });
      return;
    }
    if (command === "dev") {
      await runDevCommand(args, {
        argString,
        argFlag,
        shellEscapeArg,
        applyFlowCommandTemplates,
        findRepoRoot,
        readJsonFile,
        parseManifestFromFile,
        runDryRun,
        buildDevRefs,
        canonicalizeJson,
        readRequestBody,
        makeCliError: (code, message, details) => new CliError(code, message, details),
      });
      return;
    }
    if (command === "ai") {
      const subcommand = argString(args, "_subcommand");
      if (subcommand === "plan") {
        await runAiPlanCliCommand(args, {
          argString,
          argFlag,
          shellEscapeArg,
          applyFlowCommandTemplates,
          findRepoRoot,
          readJsonFile,
          parseManifestFromFile,
          runDryRun,
          buildDevRefs,
          canonicalizeJson,
          readRequestBody,
          makeCliError: (code, message, details) => new CliError(code, message, details),
        });
        return;
      }
      if (subcommand === "check") {
        await runAiCheckCliCommand(args, {
          argString,
          argFlag,
          shellEscapeArg,
          applyFlowCommandTemplates,
          findRepoRoot,
          readJsonFile,
          parseManifestFromFile,
          runDryRun,
          buildDevRefs,
          canonicalizeJson,
          readRequestBody,
          makeCliError: (code, message, details) => new CliError(code, message, details),
        });
        return;
      }
      throw new CliError("CLI_INVALID_ARGS", "Missing required subcommand: ai plan|check");
    }
    if (command === "publisher") {
      await runPublisherCliCommand(args, {
        argString,
        argFlag,
        shellEscapeArg,
        applyFlowCommandTemplates,
        findRepoRoot,
        readJsonFile,
        parseManifestFromFile,
        runDryRun,
        buildDevRefs,
        canonicalizeJson,
        readRequestBody,
        makeCliError: (code, message, details) => new CliError(code, message, details),
      });
      return;
    }

    throw new CliError("CLI_UNKNOWN_COMMAND", `Unknown command: ${command}`);
  } catch (err: any) {
    if (err instanceof CliError) throw err;
    const message = String(err?.message || err || "Unknown CLI error");
    let code = "CLI_RUNTIME_ERROR";
    if (message.includes("Missing required argument")) code = "CLI_INVALID_ARGS";
    else if (message.includes("Missing required arguments")) code = "CLI_INVALID_ARGS";
    else if (message.includes("Invalid --")) code = "CLI_INVALID_OPTION";
    else if (message.includes("Invalid JSON")) code = "CLI_INVALID_JSON";
    else if (message.includes("Unknown CLI profile")) code = "CLI_PROFILE_NOT_FOUND";
    else if (message.includes("Invalid CLI config JSON")) code = "CLI_CONFIG_INVALID";
    else if (message.includes("Unsupported --mode")) code = "CLI_AI_MODE_UNSUPPORTED";
    else if (message.includes("Invalid AI policy JSON")) code = "CLI_AI_POLICY_INVALID";
    else if (message.includes("ai check failed")) code = "CLI_AI_PLAN_INVALID";
    else if (message.includes("unsupported outcome")) code = "CLI_REMOTE_PUBLISH_ACK_INVALID";
    else if (message.includes("Remote publish")) code = "CLI_REMOTE_PUBLISH_ERROR";
    else if (message.includes("Remote logs")) code = "CLI_REMOTE_LOGS_ERROR";
    else if (message.includes("No bundles found")) code = "CLI_BUNDLE_NOT_FOUND";
    else if (message.includes("Bundle not found")) code = "CLI_BUNDLE_NOT_FOUND";
    throw new CliError(code, message);
  }
}

if (/(?:^|[\\/])cli\.(?:cjs|mjs|js)$/.test(String(process.argv[1] || ""))) {
  runCli(process.argv.slice(2)).catch((err) => {
    const code = typeof err?.code === "string" ? err.code : "CLI_RUNTIME_ERROR";
    const message = err?.message || String(err);
    console.error(`[${code}] ${message}`);
    const exitCode = Number.isInteger(err?.exitCode) ? err.exitCode : 1;
    process.exit(exitCode);
  });
}
