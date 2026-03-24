// @ts-nocheck
export function readRecord(value) {
  return value && typeof value === "object" ? value : {};
}

export function readString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function readList(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeAllowedOrigins(value) {
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

export function normalizeApiKeys(value) {
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

export function normalizeOwnerIssuer(value, fallback = "tenant") {
  const normalized = readString(value, fallback).trim().toLowerCase();
  return normalized === "publisher" ? "publisher" : "tenant";
}

export function normalizeHostModes(hostSurfaces) {
  return readList(hostSurfaces)
    .map((entry) =>
      entry && typeof entry === "object"
        ? {
            key: readString(entry.key).trim(),
            label: readString(entry.label).trim(),
          }
        : null,
    )
    .filter((entry) => entry && entry.key && entry.label);
}

export function resolvePlatformSecretRefFromEnv(input = {}) {
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

export function normalizeBackendKitOptions(input = {}, deps = {}) {
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
  const gateway = readRecord(input.gateway);
  const branding = readRecord(input.branding);
  const reference = readRecord(input.reference);
  const subjectProfiles = readRecord(input.subjectProfiles);
  const overrides = readRecord(input.overrides);
  const defaultHost = readRecord(defaults.host);
  const defaultPayments = readRecord(defaults.payments);
  const defaultGateway = readRecord(defaults.gateway);

  return {
    host: {
      enableReference: host.enableReference !== false && defaultHost.enableReference !== false,
      enableLifecycle: host.enableLifecycle !== false && defaultHost.enableLifecycle !== false,
      enableBridge: host.enableBridge !== false && defaultHost.enableBridge !== false,
      allowedOrigins: normalizeAllowedOrigins(host.allowedOrigins ?? defaultHost.allowedOrigins),
      bootstrap: {
        apiKeys: normalizeApiKeys(
          readRecord(host.bootstrap).apiKeys ?? defaultHost.bootstrap?.apiKeys,
        ),
        signingSecret:
          readString(readRecord(host.bootstrap).signingSecret).trim() ||
          readString(defaultHost.bootstrap?.signingSecret).trim(),
        ttlSeconds:
          Number(readRecord(host.bootstrap).ttlSeconds ?? defaultHost.bootstrap?.ttlSeconds) > 0
            ? Math.floor(
                Number(readRecord(host.bootstrap).ttlSeconds ?? defaultHost.bootstrap?.ttlSeconds),
              )
            : 300,
      },
    },
    payments: {
      enabledModes: normalizeEnabledModes(payments.enabledModes),
      ownerIssuer: normalizeOwnerIssuer(payments.ownerIssuer, defaultPayments.ownerIssuer),
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
        filePath: readString(readRecord(assets.paymentPage).filePath),
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
          ? subjectProfiles.resolveCandidates
          : null,
    },
    overrides: {
      hostProxyService:
        overrides.hostProxyService && typeof overrides.hostProxyService === "object"
          ? overrides.hostProxyService
          : null,
      gatewayClient:
        overrides.gatewayClient && typeof overrides.gatewayClient === "object"
          ? overrides.gatewayClient
          : null,
      paymentHandler:
        overrides.paymentHandler && typeof overrides.paymentHandler === "object"
          ? overrides.paymentHandler
          : null,
      resolvePolicyRequest:
        typeof overrides.resolvePolicyRequest === "function"
          ? overrides.resolvePolicyRequest
          : null,
    },
  };
}
