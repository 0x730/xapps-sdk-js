import { createPublisherApiClient, PublisherApiClientError } from "@xapps-platform/server-sdk";
import fs from "node:fs";

type CliArgs = Record<string, string | boolean>;

type CliErrorFactory = (code: string, message: string, details?: Record<string, unknown>) => Error;

type PublisherCommandDeps = {
  argString: (args: CliArgs, ...keys: string[]) => string | undefined;
  argFlag: (args: CliArgs, key: string) => boolean;
  makeCliError: CliErrorFactory;
};

function normalizePublisherGatewayApiBaseUrl(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const parsed = new URL(raw);
  const pathname = parsed.pathname || "/";
  if (pathname === "/" || pathname === "") {
    parsed.pathname = "/v1";
  }
  return parsed.toString().replace(/\/+$/g, "");
}

function parseHttpUrlOrThrow(value: string, flagName: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) throw new Error(`Invalid ${flagName}: empty`);
  try {
    const url = new URL(trimmed);
    if (!/^https?:$/.test(url.protocol)) {
      throw new Error(`unsupported protocol ${url.protocol}`);
    }
    return url.toString();
  } catch (err: any) {
    throw new Error(`Invalid ${flagName}: ${err?.message || String(err)}`);
  }
}

function resolveSecretInput(
  args: CliArgs,
  deps: PublisherCommandDeps,
): {
  secret?: string;
  secretRef?: string;
  source: "env" | "stdin" | "secret_ref";
  sourceName?: string;
} {
  const secretRef = deps.argString(args, "secret-ref");
  const secretEnvName = deps.argString(args, "secret-env");
  const secretStdin = deps.argFlag(args, "secret-stdin");
  const selected = [Boolean(secretRef), Boolean(secretEnvName), Boolean(secretStdin)].filter(
    Boolean,
  ).length;
  if (selected !== 1) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Provide exactly one of --secret-ref, --secret-env, or --secret-stdin",
    );
  }
  if (secretRef) {
    return { secretRef, source: "secret_ref" };
  }
  if (secretEnvName) {
    const envValue = String(process.env[secretEnvName] || "");
    if (!envValue.trim()) {
      throw deps.makeCliError(
        "CLI_INVALID_ARGS",
        `Environment variable is empty or missing for --secret-env ${secretEnvName}`,
      );
    }
    return { secret: envValue, source: "env", sourceName: secretEnvName };
  }
  // Read from fd 0 synchronously to keep CLI code simple/deterministic for scripts.
  const secret = fs.readFileSync(0, "utf8");
  if (!String(secret || "").trim()) {
    throw deps.makeCliError("CLI_INVALID_ARGS", "--secret-stdin provided but stdin is empty");
  }
  return { secret, source: "stdin" };
}

function pickLatestVersion(items: Array<Record<string, unknown>>): Record<string, unknown> | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const published = items.filter((v) => String((v as any).status || "") === "published");
  const target = published.length > 0 ? published : items;
  return [...target].sort((a, b) =>
    String((b as any).published_at || (b as any).created_at || "").localeCompare(
      String((a as any).published_at || (a as any).created_at || ""),
    ),
  )[0] as Record<string, unknown>;
}

async function resolveEndpointIdOrThrow(
  args: CliArgs,
  deps: PublisherCommandDeps,
  client: ReturnType<typeof createPublisherApiClient>,
): Promise<{ endpointId: string; endpointEnv: string; xappSlug?: string }> {
  const endpointIdArg = deps.argString(args, "endpoint-id");
  const xappSlug = deps.argString(args, "xapp-slug");
  const targetClientSlug = deps.argString(args, "target-client-slug", "target_client_slug");
  const endpointEnv = deps.argString(args, "env") || "prod";
  if (endpointIdArg) {
    return { endpointId: endpointIdArg, endpointEnv, ...(xappSlug ? { xappSlug } : {}) };
  }
  if (!xappSlug) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Provide --endpoint-id or (--xapp-slug and optional --env)",
    );
  }
  let targetClientId = "";
  if (targetClientSlug) {
    const clients = await client.listClients();
    const matches = (clients.items || []).filter(
      (item) => String((item as any).slug || "") === targetClientSlug,
    );
    if (matches.length === 0) {
      throw deps.makeCliError(
        "CLI_NOT_FOUND",
        `Publisher client not found for slug=${targetClientSlug}`,
      );
    }
    if (matches.length > 1) {
      throw deps.makeCliError(
        "CLI_CONFLICT",
        `Publisher client slug matched multiple rows: ${targetClientSlug}`,
      );
    }
    targetClientId = String((matches[0] as any).id || "").trim();
    if (!targetClientId) {
      throw deps.makeCliError(
        "CLI_INVALID_RESPONSE",
        `Resolved client id is missing for slug=${targetClientSlug}`,
      );
    }
  }
  const xapps = await client.listXapps();
  const candidates = (xapps.items || []).filter((item) => {
    if (String((item as any).slug || "") !== xappSlug) return false;
    if (!targetClientId) return true;
    return String((item as any).target_client_id || "") === targetClientId;
  });
  if (candidates.length === 0) {
    throw deps.makeCliError(
      "CLI_NOT_FOUND",
      targetClientId
        ? `Publisher xapp not found for slug=${xappSlug} target_client_slug=${targetClientSlug}`
        : `Publisher xapp not found for slug=${xappSlug}`,
    );
  }
  if (candidates.length > 1) {
    throw deps.makeCliError(
      "CLI_CONFLICT",
      targetClientId
        ? `Multiple publisher xapps matched slug=${xappSlug} target_client_slug=${targetClientSlug}`
        : `Multiple publisher xapps matched slug=${xappSlug}; pass --target-client-slug`,
    );
  }
  const xapp = candidates[0] as Record<string, unknown>;
  if (!String((xapp as any).id || "")) {
    throw deps.makeCliError("CLI_NOT_FOUND", `Publisher xapp not found for slug=${xappSlug}`);
  }
  const versions = await client.listXappVersions(String((xapp as any).id));
  const version = pickLatestVersion(versions.items as Array<Record<string, unknown>>);
  if (!version || !String((version as any).id || "")) {
    throw deps.makeCliError(
      "CLI_NOT_FOUND",
      `No publisher xapp versions found for slug=${xappSlug}`,
    );
  }
  const endpoints = await client.listEndpoints(String((version as any).id));
  const endpoint = endpoints.items.find(
    (item) => String((item as any).env || "").trim() === endpointEnv,
  );
  if (!endpoint || !String((endpoint as any).id || "")) {
    throw deps.makeCliError(
      "CLI_NOT_FOUND",
      `Endpoint not found for xapp=${xappSlug} env=${endpointEnv}`,
    );
  }
  return { endpointId: String((endpoint as any).id), endpointEnv, xappSlug };
}

function normalizeAuthTypeForMatch(input: unknown): string {
  const raw = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!raw) return "";
  if (raw === "none") return "none";
  if (raw.includes("api") && raw.includes("key")) return "api_key_header";
  if (raw === "header") return "header";
  if (raw === "hmac" || raw === "hmacsha256") return "hmac";
  return raw;
}

function readCredentialHeaderName(item: Record<string, unknown>): string {
  const direct = (item as any).auth_header_name;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const configRaw = (item as any).config ?? (item as any).config_jsonb;
  const cfg =
    configRaw && typeof configRaw === "string"
      ? (() => {
          try {
            return JSON.parse(configRaw);
          } catch {
            return null;
          }
        })()
      : configRaw;
  if (cfg && typeof cfg === "object") {
    const header = (cfg as any).headerName ?? (cfg as any).header_name;
    if (typeof header === "string" && header.trim()) return header.trim();
  }
  return "";
}

function findMatchingEndpointCredential(
  items: Array<Record<string, unknown>>,
  input: { authType: string; headerName: string },
): Record<string, unknown> | null {
  const wantAuth = normalizeAuthTypeForMatch(input.authType);
  const wantHeader = String(input.headerName || "")
    .trim()
    .toLowerCase();
  for (const item of items) {
    const authMatch = normalizeAuthTypeForMatch((item as any).auth_type) === wantAuth;
    if (!authMatch) continue;
    if (wantAuth === "api_key_header" || wantAuth === "header") {
      const existingHeader = readCredentialHeaderName(item).toLowerCase();
      if (wantHeader && existingHeader !== wantHeader) continue;
    }
    return item;
  }
  return null;
}

export async function runPublisherEndpointCredentialSetCommand(
  args: CliArgs,
  deps: PublisherCommandDeps,
) {
  const gatewayUrlRaw =
    deps.argString(args, "gateway-url", "publisher-gateway-url") ||
    process.env.XAPPS_CLI_PUBLISHER_GATEWAY_URL;
  if (!gatewayUrlRaw) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Missing required argument: --gateway-url <url> (or --publisher-gateway-url)",
    );
  }
  const gatewayUrl = normalizePublisherGatewayApiBaseUrl(
    parseHttpUrlOrThrow(gatewayUrlRaw, "--gateway-url"),
  );
  const apiKey = deps.argString(args, "api-key", "apiKey") || process.env.XAPPS_CLI_API_KEY || "";
  const token = deps.argString(args, "token") || process.env.XAPPS_CLI_TOKEN || "";
  if (!apiKey && !token) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Missing auth: provide --api-key or --token (or XAPPS_CLI_API_KEY/XAPPS_CLI_TOKEN)",
    );
  }

  let endpointId = "";

  const authType = deps.argString(args, "auth-type") || "api-key";
  const headerName = deps.argString(args, "header-name") || "x-xplace-api-key";
  const keyStatus = deps.argString(args, "key-status") || "active";
  const keyAlgorithm = deps.argString(args, "key-algorithm") || "hmac-sha256";
  const secretInput = resolveSecretInput(args, deps);

  const client = createPublisherApiClient({ baseUrl: gatewayUrl, apiKey, token });

  try {
    endpointId = (await resolveEndpointIdOrThrow(args, deps, client)).endpointId;

    const result = await client.createEndpointCredential(endpointId, {
      authType,
      config: {
        headerName,
      },
      initialKey: {
        ...(secretInput.secret ? { secret: secretInput.secret } : {}),
        ...(secretInput.secretRef ? { secretRef: secretInput.secretRef } : {}),
        status: keyStatus,
        algorithm: keyAlgorithm,
      },
    });

    const credential = (result as any).credential || {};
    const output = {
      ok: true,
      gateway_url: gatewayUrl,
      endpoint_id: endpointId,
      auth_type: String((credential as any).auth_type || authType),
      credential_id: String((credential as any).id || ""),
      active_kid: String((credential as any).active_kid || ""),
      secret_source: secretInput.source,
      ...(secretInput.sourceName ? { secret_env: secretInput.sourceName } : {}),
      header_name: headerName,
    };
    if (deps.argFlag(args, "json")) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    console.log(
      `Publisher endpoint credential set: endpoint=${output.endpoint_id} credential=${output.credential_id || "-"} auth=${output.auth_type} header=${output.header_name} secret_source=${output.secret_source}`,
    );
  } catch (err: any) {
    if (err instanceof PublisherApiClientError) {
      throw deps.makeCliError(
        `CLI_${err.code}`,
        `Publisher endpoint credential set failed: ${err.message}`,
        { status: err.status, details: err.details, gateway_url: gatewayUrl },
      );
    }
    throw err;
  }
}

export async function runPublisherEndpointCredentialEnsureCommand(
  args: CliArgs,
  deps: PublisherCommandDeps,
) {
  const gatewayUrlRaw =
    deps.argString(args, "gateway-url", "publisher-gateway-url") ||
    process.env.XAPPS_CLI_PUBLISHER_GATEWAY_URL;
  if (!gatewayUrlRaw) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Missing required argument: --gateway-url <url> (or --publisher-gateway-url)",
    );
  }
  const gatewayUrl = normalizePublisherGatewayApiBaseUrl(
    parseHttpUrlOrThrow(gatewayUrlRaw, "--gateway-url"),
  );
  const apiKey = deps.argString(args, "api-key", "apiKey") || process.env.XAPPS_CLI_API_KEY || "";
  const token = deps.argString(args, "token") || process.env.XAPPS_CLI_TOKEN || "";
  if (!apiKey && !token) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Missing auth: provide --api-key or --token (or XAPPS_CLI_API_KEY/XAPPS_CLI_TOKEN)",
    );
  }

  const authType = deps.argString(args, "auth-type") || "api-key";
  const headerName = deps.argString(args, "header-name") || "x-xplace-api-key";
  const keyStatus = deps.argString(args, "key-status") || "active";
  const keyAlgorithm = deps.argString(args, "key-algorithm") || "hmac-sha256";

  const client = createPublisherApiClient({ baseUrl: gatewayUrl, apiKey, token });

  try {
    const resolved = await resolveEndpointIdOrThrow(args, deps, client);
    const endpointId = resolved.endpointId;
    const existing = await client.listEndpointCredentials(endpointId);
    const match = findMatchingEndpointCredential(existing.items as Array<Record<string, unknown>>, {
      authType,
      headerName,
    });
    if (match) {
      const output = {
        ok: true,
        ensured: true,
        created: false,
        gateway_url: gatewayUrl,
        endpoint_id: endpointId,
        credential_id: String((match as any).id || ""),
        auth_type: String((match as any).auth_type || authType),
        header_name: readCredentialHeaderName(match) || headerName,
        active_kid: String((match as any).active_kid || ""),
      };
      if (deps.argFlag(args, "json")) {
        console.log(JSON.stringify(output, null, 2));
        return;
      }
      console.log(
        `Publisher endpoint credential ensure: endpoint=${output.endpoint_id} credential=${output.credential_id || "-"} auth=${output.auth_type} header=${output.header_name} outcome=existing`,
      );
      return;
    }

    const secretInput = resolveSecretInput(args, deps);
    const result = await client.createEndpointCredential(endpointId, {
      authType,
      config: {
        headerName,
      },
      initialKey: {
        ...(secretInput.secret ? { secret: secretInput.secret } : {}),
        ...(secretInput.secretRef ? { secretRef: secretInput.secretRef } : {}),
        status: keyStatus,
        algorithm: keyAlgorithm,
      },
    });
    const credential = (result as any).credential || {};
    const output = {
      ok: true,
      ensured: true,
      created: true,
      gateway_url: gatewayUrl,
      endpoint_id: endpointId,
      auth_type: String((credential as any).auth_type || authType),
      credential_id: String((credential as any).id || ""),
      active_kid: String((credential as any).active_kid || ""),
      secret_source: secretInput.source,
      ...(secretInput.sourceName ? { secret_env: secretInput.sourceName } : {}),
      header_name: headerName,
    };
    if (deps.argFlag(args, "json")) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    console.log(
      `Publisher endpoint credential ensure: endpoint=${output.endpoint_id} credential=${output.credential_id || "-"} auth=${output.auth_type} header=${output.header_name} outcome=created secret_source=${output.secret_source}`,
    );
  } catch (err: any) {
    if (err instanceof PublisherApiClientError) {
      throw deps.makeCliError(
        `CLI_${err.code}`,
        `Publisher endpoint credential ensure failed: ${err.message}`,
        { status: err.status, details: err.details, gateway_url: gatewayUrl },
      );
    }
    throw err;
  }
}
