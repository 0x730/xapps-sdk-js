export type StringRecord = Record<string, unknown>;

export type HostSurface = {
  key: string;
  label: string;
};

export type BackendKitNormalizedOptions = {
  host: {
    enableReference: boolean;
    enableLifecycle: boolean;
    enableBridge: boolean;
    allowedOrigins: string[];
    bootstrap: {
      apiKeys: string[];
      signingSecret: string;
      ttlSeconds: number;
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
  defaults?: StringRecord;
  normalizeEnabledModes?: (value: unknown) => string[];
};

export function readRecord(value: unknown): StringRecord {
  return value && typeof value === "object" ? (value as StringRecord) : {};
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

export function normalizeOwnerIssuer(
  value: unknown,
  fallback: "tenant" | "publisher" = "tenant",
): "tenant" | "publisher" {
  const normalized = readString(value, fallback).trim().toLowerCase();
  return normalized === "publisher" ? "publisher" : "tenant";
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
  const defaults = readRecord(deps.defaults);
  const normalizeEnabledModes =
    typeof deps.normalizeEnabledModes === "function" ? deps.normalizeEnabledModes : null;
  if (!normalizeEnabledModes) {
    throw new TypeError("normalizeEnabledModes is required");
  }

  const host = readRecord(input.host);
  const payments = readRecord(input.payments);
  const assets = readRecord(input.assets);
  const seedLogo = readRecord(assets.seedLogo);
  const paymentPage = readRecord(assets.paymentPage);
  const gateway = readRecord(input.gateway);
  const branding = readRecord(input.branding);
  const reference = readRecord(input.reference);
  const subjectProfiles = readRecord(input.subjectProfiles);
  const overrides = readRecord(input.overrides);
  const defaultHost = readRecord(defaults.host);
  const defaultPayments = readRecord(defaults.payments);
  const defaultGateway = readRecord(defaults.gateway);
  const hostBootstrap = readRecord(host.bootstrap);
  const defaultHostBootstrap = readRecord(defaultHost.bootstrap);

  return {
    host: {
      enableReference: host.enableReference !== false && defaultHost.enableReference !== false,
      enableLifecycle: host.enableLifecycle !== false && defaultHost.enableLifecycle !== false,
      enableBridge: host.enableBridge !== false && defaultHost.enableBridge !== false,
      allowedOrigins: normalizeAllowedOrigins(host.allowedOrigins ?? defaultHost.allowedOrigins),
      bootstrap: {
        apiKeys: normalizeApiKeys(hostBootstrap.apiKeys ?? defaultHostBootstrap.apiKeys),
        signingSecret:
          readString(hostBootstrap.signingSecret).trim() ||
          readString(defaultHostBootstrap.signingSecret).trim(),
        ttlSeconds:
          Number(hostBootstrap.ttlSeconds ?? defaultHostBootstrap.ttlSeconds) > 0
            ? Math.floor(Number(hostBootstrap.ttlSeconds ?? defaultHostBootstrap.ttlSeconds))
            : 300,
      },
    },
    payments: {
      enabledModes: normalizeEnabledModes(payments.enabledModes),
      ownerIssuer: normalizeOwnerIssuer(
        payments.ownerIssuer,
        normalizeOwnerIssuer(defaultPayments.ownerIssuer),
      ),
      paymentUrl: readString(payments.paymentUrl).trim() || readString(defaultPayments.paymentUrl),
      returnSecret:
        typeof payments.returnSecret === "string"
          ? payments.returnSecret
          : readString(defaultPayments.returnSecret),
      returnSecretRef:
        typeof payments.returnSecretRef === "string"
          ? payments.returnSecretRef
          : readString(defaultPayments.returnSecretRef),
      returnUrlAllowlist:
        typeof payments.returnUrlAllowlist === "string"
          ? payments.returnUrlAllowlist
          : readString(defaultPayments.returnUrlAllowlist),
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
      baseUrl: readString(gateway.baseUrl).trim() || readString(defaultGateway.baseUrl),
      apiKey: readString(gateway.apiKey).trim() || readString(defaultGateway.apiKey),
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
}
