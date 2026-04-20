export type StringRecord = Record<string, unknown>;

export type HostSurface = {
  key: string;
  label: string;
};

export type HostBootstrapConsumeJti = (input: {
  jti: string;
  subjectId: string | null;
  origin: string | null;
  iat: number | null;
  exp: number | null;
  token: string;
  type: "host_bootstrap";
}) => boolean | Promise<boolean>;

export type HostSessionActivate = (input: {
  jti: string;
  subjectId: string | null;
  iat: number | null;
  exp: number | null;
  idleTtlSeconds: number;
  token: string;
  type: "host_session";
}) => boolean | Promise<boolean>;

export type HostSessionTouch = (input: {
  jti: string;
  subjectId: string | null;
  iat: number | null;
  exp: number | null;
  idleTtlSeconds: number;
  token: string;
  type: "host_session";
}) => boolean | { active?: boolean } | Promise<boolean | { active?: boolean }>;

export type HostSessionIsRevokedJti = (input: {
  jti: string;
  subjectId: string | null;
  iat: number | null;
  exp: number | null;
  token: string;
  type: "host_session";
}) => boolean | Promise<boolean>;

export type HostSessionRevokeJti = (input: {
  jti: string;
  subjectId: string | null;
  iat: number | null;
  exp: number | null;
  token: string;
  type: "host_session";
}) => boolean | Promise<boolean>;

export type HostSessionStore = {
  activate?: HostSessionActivate | null;
  touch?: HostSessionTouch | null;
  isRevoked?: HostSessionIsRevokedJti | null;
  revoke?: HostSessionRevokeJti | null;
};

export type HostSessionResolveSameOriginSubjectId = NonNullable<
  BackendKitNormalizedOptions["host"]["session"]["resolveSameOriginSubjectId"]
>;

export type HostSessionRateLimitExchange = NonNullable<
  BackendKitNormalizedOptions["host"]["session"]["rateLimitExchange"]
>;

export type HostSessionAuditExchange = NonNullable<
  BackendKitNormalizedOptions["host"]["session"]["auditExchange"]
>;

export type BackendKitNormalizedOptions = {
  host: {
    enableReference: boolean;
    enableLifecycle: boolean;
    enableBridge: boolean;
    allowedOrigins: string[];
    bootstrap: {
      apiKeys: string[];
      signingSecret: string;
      signingKeyId: string;
      verifierKeys: Record<string, string>;
      ttlSeconds: number;
      consumeJti:
        | ((input: {
            jti: string;
            subjectId: string | null;
            origin: string | null;
            iat: number | null;
            exp: number | null;
            token: string;
            type: "host_bootstrap";
          }) => boolean | Promise<boolean>)
        | null;
    };
    session: {
      signingSecret: string;
      signingKeyId: string;
      verifierKeys: Record<string, string>;
      cookieName: string;
      absoluteTtlSeconds: number;
      idleTtlSeconds: number;
      cookiePath: string;
      cookieDomain: string;
      cookieSameSite: "auto" | "Lax" | "Strict" | "None";
      cookieSecure: "auto" | boolean;
      store: {
        activate: HostSessionActivate | null;
        touch: HostSessionTouch | null;
        isRevoked: HostSessionIsRevokedJti | null;
        revoke: HostSessionRevokeJti | null;
      };
      resolveSameOriginSubjectId:
        | ((input: {
            request: unknown;
            subjectId: string | null;
          }) => string | null | Promise<string | null>)
        | null;
      rateLimitExchange:
        | ((input: {
            request: unknown;
            subjectId: string | null;
            origin: string | null;
            jti: string | null;
            iat: number | null;
            exp: number | null;
            token: string;
            type: "host_bootstrap";
          }) => boolean | { allowed?: boolean } | Promise<boolean | { allowed?: boolean }>)
        | null;
      auditExchange:
        | ((input: {
            request: unknown;
            ok: boolean;
            subjectId: string | null;
            origin: string | null;
            jti: string | null;
            iat: number | null;
            exp: number | null;
            token: string;
            type: "host_bootstrap";
            reason?: string | null;
            sessionJti?: string | null;
            sessionExp?: number | null;
          }) => void | Promise<void>)
        | null;
    };
  };
  payments: {
    enabledModes: string[];
    ownerIssuer: "tenant" | "publisher";
    paymentUrl: string;
    returnSecret: string;
    returnSecretRef: string;
    returnUrlAllowlist: string;
  };
  assets: {
    seedLogo: {
      filePath: string;
      routePath: string;
      contentType: string;
    };
    paymentPage: {
      filePath: string;
    };
  };
  gateway: {
    baseUrl: string;
    apiKey: string;
  };
  branding: {
    tenantName: string;
    serviceName: string;
    stackLabel: string;
  };
  reference: {
    tenant: string;
    workspace: string;
    stack: string;
    mode: string;
    tenantPolicySlugs: unknown[];
    proofSources: unknown[];
    sdkPaths: StringRecord;
    hostSurfaces: unknown[];
    notes: unknown[];
    embedSdkCandidateFiles: unknown[];
    referenceAssets: StringRecord;
  };
  subjectProfiles: {
    workspace: string;
    source: string;
    catalogJson: string;
    defaultProfiles: unknown[];
    resolveCandidates: ((...args: unknown[]) => unknown) | null;
    resolveCatalogCustomerProfile: ((...args: unknown[]) => unknown) | null;
  };
  overrides: {
    hostProxyService: StringRecord | null;
    gatewayClient: StringRecord | null;
    paymentHandler: StringRecord | null;
    resolvePolicyRequest: ((...args: unknown[]) => unknown) | null;
  };
};

type NormalizeOptionsDeps = {
  normalizeEnabledModes?: (value: unknown) => string[];
};

export function readRecord(value: unknown): StringRecord {
  return value && typeof value === "object" ? (value as StringRecord) : {};
}

function readFirstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = readString(value).trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

export function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function readList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeAllowedOrigins(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => readString(entry).trim().replace(/\/+$/, "")).filter(Boolean);
  }
  const raw = readString(value).trim();
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((entry) => readString(entry).trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function normalizeApiKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => readString(entry).trim()).filter(Boolean);
  }
  const raw = readString(value).trim();
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((entry) => readString(entry).trim())
    .filter(Boolean);
}

export function normalizeSigningVerifierKeys(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.entries(value as StringRecord).reduce<Record<string, string>>((acc, [key, raw]) => {
    const normalizedKey = readString(key).trim();
    const normalizedValue = readString(raw).trim();
    if (!normalizedKey || !normalizedValue) {
      return acc;
    }
    acc[normalizedKey] = normalizedValue;
    return acc;
  }, {});
}

export function normalizeOwnerIssuer(
  value: unknown,
  fallback: "tenant" | "publisher" = "tenant",
): "tenant" | "publisher" {
  const normalized = readString(value, fallback).trim().toLowerCase();
  return normalized === "publisher" ? "publisher" : "tenant";
}

export function normalizeCookieSameSite(
  value: unknown,
  fallback: "auto" | "Lax" | "Strict" | "None" = "auto",
): "auto" | "Lax" | "Strict" | "None" {
  const normalized = readString(value, fallback).trim().toLowerCase();
  if (normalized === "lax") return "Lax";
  if (normalized === "strict") return "Strict";
  if (normalized === "none") return "None";
  return "auto";
}

export function normalizeCookieSecure(
  value: unknown,
  fallback: "auto" | boolean = "auto",
): "auto" | boolean {
  if (typeof value === "boolean") return value;
  const normalized = readString(value, String(fallback)).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return "auto";
}

export function normalizeHostModes(hostSurfaces: unknown): HostSurface[] {
  return readList(hostSurfaces)
    .map((entry) =>
      entry && typeof entry === "object"
        ? {
            key: readString((entry as StringRecord).key).trim(),
            label: readString((entry as StringRecord).label).trim(),
          }
        : null,
    )
    .filter((entry): entry is HostSurface => Boolean(entry && entry.key && entry.label));
}

function pickTypedFunction<T>(...values: unknown[]): T | null {
  for (const value of values) {
    if (typeof value === "function") {
      return value as T;
    }
  }
  return null;
}

function resolveSessionAbsoluteTtl(sessionInput: StringRecord): number {
  const rawTtl = sessionInput.absoluteTtlSeconds;
  return Number(rawTtl) > 0 ? Math.floor(Number(rawTtl)) : 1800;
}

function validateHostedSecurityOptions(host: BackendKitNormalizedOptions["host"]) {
  if (host.bootstrap.apiKeys.length > 0 && !readString(host.bootstrap.signingSecret).trim()) {
    throw new TypeError(
      "host.bootstrap.signingSecret is required when host.bootstrap.apiKeys is configured",
    );
  }
  if (host.bootstrap.apiKeys.length > 0 && !readString(host.session.signingSecret).trim()) {
    throw new TypeError(
      "host.session.signingSecret is required when host.bootstrap.apiKeys is configured",
    );
  }
  if (host.bootstrap.apiKeys.length > 0 && typeof host.session.store.isRevoked !== "function") {
    throw new TypeError(
      "host.session.store.isRevoked is required when host.bootstrap.apiKeys is configured",
    );
  }
  if (host.bootstrap.apiKeys.length > 0 && typeof host.session.store.revoke !== "function") {
    throw new TypeError(
      "host.session.store.revoke is required when host.bootstrap.apiKeys is configured",
    );
  }
  if (host.bootstrap.apiKeys.length > 0 && host.session.idleTtlSeconds > 0) {
    if (typeof host.session.store.activate !== "function") {
      throw new TypeError(
        "host.session.store.activate is required when host.session.idleTtlSeconds is configured",
      );
    }
    if (typeof host.session.store.touch !== "function") {
      throw new TypeError(
        "host.session.store.touch is required when host.session.idleTtlSeconds is configured",
      );
    }
  }
}

export function resolvePlatformSecretRefFromEnv(
  input: { name?: string | null; scope?: string | null; scopeId?: string | null } = {},
): string {
  const name = String(input?.name || "")
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .toUpperCase();
  const scope = String(input?.scope || "")
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .toUpperCase();
  const scopeId = String(input?.scopeId || "")
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .toUpperCase();
  const candidates = [
    scope && scopeId && name ? `PLATFORM_SECRET__${scope}__${scopeId}__${name}` : "",
    scope && name ? `PLATFORM_SECRET__${scope}__${name}` : "",
    name ? `PLATFORM_SECRET__${name}` : "",
  ].filter(Boolean);
  for (const key of candidates) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

export function normalizeBackendKitOptions(
  input: StringRecord = {},
  deps: NormalizeOptionsDeps = {},
): BackendKitNormalizedOptions {
  const normalizeEnabledModes =
    typeof deps.normalizeEnabledModes === "function" ? deps.normalizeEnabledModes : null;
  if (!normalizeEnabledModes) {
    throw new TypeError("normalizeEnabledModes is required");
  }

  const host = readRecord(input.host);
  const bootstrap = readRecord(host.bootstrap);
  const session = readRecord(host.session);
  const store = readRecord(session.store);
  const payments = readRecord(input.payments);
  const gateway = readRecord(input.gateway);
  const assets = readRecord(input.assets);
  const seedLogo = readRecord(assets.seedLogo);
  const paymentPage = readRecord(assets.paymentPage);
  const branding = readRecord(input.branding);
  const reference = readRecord(input.reference);
  const subjectProfiles = readRecord(input.subjectProfiles);
  const overrides = readRecord(input.overrides);
  const sessionTtl = resolveSessionAbsoluteTtl(session);

  const normalized: BackendKitNormalizedOptions = {
    host: {
      enableReference: host.enableReference !== false,
      enableLifecycle: host.enableLifecycle !== false,
      enableBridge: host.enableBridge !== false,
      allowedOrigins: normalizeAllowedOrigins(host.allowedOrigins),
      bootstrap: {
        apiKeys: normalizeApiKeys(bootstrap.apiKeys),
        signingSecret: readString(bootstrap.signingSecret).trim(),
        signingKeyId: readString(bootstrap.signingKeyId).trim(),
        verifierKeys: normalizeSigningVerifierKeys(bootstrap.verifierKeys),
        ttlSeconds:
          Number(bootstrap.ttlSeconds) > 0 ? Math.floor(Number(bootstrap.ttlSeconds)) : 300,
        consumeJti: pickTypedFunction<HostBootstrapConsumeJti>(bootstrap.consumeJti),
      },
      session: {
        signingSecret: readString(session.signingSecret).trim(),
        signingKeyId: readString(session.signingKeyId).trim(),
        verifierKeys: normalizeSigningVerifierKeys(session.verifierKeys),
        cookieName:
          readString(session.cookieName, "xapps_host_session").trim() || "xapps_host_session",
        absoluteTtlSeconds: sessionTtl,
        idleTtlSeconds:
          Number(session.idleTtlSeconds) > 0 ? Math.floor(Number(session.idleTtlSeconds)) : 0,
        cookiePath: readString(session.cookiePath, "/").trim() || "/",
        cookieDomain: readString(session.cookieDomain).trim(),
        cookieSameSite: normalizeCookieSameSite(session.cookieSameSite, "auto"),
        cookieSecure: normalizeCookieSecure(session.cookieSecure, "auto"),
        store: {
          activate: pickTypedFunction<HostSessionActivate>(store.activate),
          touch: pickTypedFunction<HostSessionTouch>(store.touch),
          isRevoked: pickTypedFunction<HostSessionIsRevokedJti>(store.isRevoked),
          revoke: pickTypedFunction<HostSessionRevokeJti>(store.revoke),
        },
        resolveSameOriginSubjectId: pickTypedFunction<HostSessionResolveSameOriginSubjectId>(
          session.resolveSameOriginSubjectId,
        ),
        rateLimitExchange: pickTypedFunction<HostSessionRateLimitExchange>(
          session.rateLimitExchange,
        ),
        auditExchange: pickTypedFunction<HostSessionAuditExchange>(session.auditExchange),
      },
    },
    payments: {
      enabledModes: normalizeEnabledModes(payments.enabledModes),
      ownerIssuer: normalizeOwnerIssuer(payments.ownerIssuer),
      paymentUrl: readFirstNonEmptyString(payments.paymentUrl, payments.tenantPaymentUrl),
      returnSecret: readString(payments.returnSecret),
      returnSecretRef: readString(payments.returnSecretRef),
      returnUrlAllowlist: readString(payments.returnUrlAllowlist),
    },
    assets: {
      seedLogo: {
        filePath: readString(seedLogo.filePath),
        routePath: readString(seedLogo.routePath),
        contentType: readString(seedLogo.contentType, "image/svg+xml").trim() || "image/svg+xml",
      },
      paymentPage: {
        filePath: readString(paymentPage.filePath),
      },
    },
    gateway: {
      baseUrl: readString(gateway.baseUrl).trim(),
      apiKey: readString(gateway.apiKey).trim(),
    },
    branding: {
      tenantName: readString(branding.tenantName),
      serviceName: readString(branding.serviceName),
      stackLabel: readString(branding.stackLabel),
    },
    reference: {
      tenant: readString(reference.tenant),
      workspace: readString(reference.workspace),
      stack: readString(reference.stack),
      mode: readString(reference.mode),
      tenantPolicySlugs: readList(reference.tenantPolicySlugs),
      proofSources: readList(reference.proofSources),
      sdkPaths: readRecord(reference.sdkPaths),
      hostSurfaces: readList(reference.hostSurfaces),
      notes: readList(reference.notes),
      embedSdkCandidateFiles: readList(reference.embedSdkCandidateFiles),
      referenceAssets: readRecord(reference.referenceAssets),
    },
    subjectProfiles: {
      workspace: readString(subjectProfiles.workspace),
      source: readString(subjectProfiles.source),
      catalogJson: readString(subjectProfiles.catalogJson),
      defaultProfiles: readList(subjectProfiles.defaultProfiles),
      resolveCandidates:
        typeof subjectProfiles.resolveCandidates === "function"
          ? (...args: unknown[]) =>
              (subjectProfiles.resolveCandidates as (...args: unknown[]) => unknown)(...args)
          : null,
      resolveCatalogCustomerProfile:
        typeof subjectProfiles.resolveCatalogCustomerProfile === "function"
          ? (...args: unknown[]) =>
              (subjectProfiles.resolveCatalogCustomerProfile as (...args: unknown[]) => unknown)(
                ...args,
              )
          : null,
    },
    overrides: {
      hostProxyService:
        overrides.hostProxyService && typeof overrides.hostProxyService === "object"
          ? (overrides.hostProxyService as StringRecord)
          : null,
      gatewayClient:
        overrides.gatewayClient && typeof overrides.gatewayClient === "object"
          ? (overrides.gatewayClient as StringRecord)
          : null,
      paymentHandler:
        overrides.paymentHandler && typeof overrides.paymentHandler === "object"
          ? (overrides.paymentHandler as StringRecord)
          : null,
      resolvePolicyRequest:
        typeof overrides.resolvePolicyRequest === "function"
          ? (...args: unknown[]) =>
              (overrides.resolvePolicyRequest as (...args: unknown[]) => unknown)(...args)
          : null,
    },
  };
  validateHostedSecurityOptions(normalized.host);
  return normalized;
}
