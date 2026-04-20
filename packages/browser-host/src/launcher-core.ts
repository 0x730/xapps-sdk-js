export const DEFAULT_HOST_BOOTSTRAP_URL = "/api/browser/host-bootstrap";
export const DEFAULT_IDENTITY_STORAGE_KEY = "xapps_host_identity_v1";

export type HostIdentifierInput = {
  idType?: string;
  value?: string;
  hint?: string;
};

export type HostIdentityInput = {
  subjectId?: string;
  type?: string;
  identifier?: HostIdentifierInput | null;
  email?: string;
  name?: string;
  metadata?: Record<string, unknown> | null;
};

export type HostBootstrapResult = {
  subjectId: string;
  bootstrapToken: string;
  expiresIn: number;
  email?: string | null;
  name?: string | null;
};

export type StoredHostIdentity = HostIdentityInput & {
  bootstrapToken?: string;
  bootstrapExpiresAt?: string;
  resolvedAt?: string;
};

type FetchLike = typeof fetch;

function getLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseStoredIdentity(storageKey = DEFAULT_IDENTITY_STORAGE_KEY): StoredHostIdentity | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey) || "";
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseExpiry(identity: StoredHostIdentity | null) {
  const iso = String(identity?.bootstrapExpiresAt || "").trim();
  if (!iso) return null;
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeString(value: unknown, { lower = false } = {}) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return lower ? normalized.toLowerCase() : normalized;
}

function normalizeIdentifier(input: HostIdentifierInput | null | undefined) {
  if (!input || typeof input !== "object") return null;
  const idType = normalizeString(input.idType);
  const value = normalizeString(input.value);
  const hint = normalizeString(input.hint);
  if (!idType || !value) return null;
  return {
    idType,
    value,
    ...(hint ? { hint } : {}),
  };
}

function normalizeMetadata(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

export function normalizeHostIdentityInput(input: HostIdentityInput | null | undefined) {
  const normalized = input && typeof input === "object" ? input : {};
  const subjectId = normalizeString(normalized.subjectId);
  const type = normalizeString(normalized.type);
  const identifier = normalizeIdentifier(normalized.identifier);
  const email = normalizeString(normalized.email, { lower: true });
  const name = normalizeString(normalized.name);
  const metadata = normalizeMetadata(normalized.metadata);
  return {
    ...(subjectId ? { subjectId } : {}),
    ...(type ? { type } : {}),
    ...(identifier ? { identifier } : {}),
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export function readStoredHostIdentity(storageKey = DEFAULT_IDENTITY_STORAGE_KEY) {
  const identity = parseStoredIdentity(storageKey);
  return identity && typeof identity === "object" ? identity : null;
}

export function readRecoverableHostIdentity(
  storageKey = DEFAULT_IDENTITY_STORAGE_KEY,
  currentUrl: string | URL | null | undefined = typeof window !== "undefined"
    ? window.location?.href
    : "",
) {
  const storedIdentity = readStoredHostIdentity(storageKey);
  if (storedIdentity) return storedIdentity;
  const urlValue =
    currentUrl instanceof URL
      ? currentUrl
      : typeof currentUrl === "string" && currentUrl.trim()
        ? new URL(
            currentUrl,
            typeof window !== "undefined" && typeof window.location?.href === "string"
              ? window.location.href
              : "http://localhost",
          )
        : null;
  const subjectId = normalizeString(urlValue?.searchParams.get("subjectId"));
  return subjectId ? { subjectId } : null;
}

export function clearStoredHostIdentity(storageKey = DEFAULT_IDENTITY_STORAGE_KEY) {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // ignore localStorage failures
  }
}

export function writeStoredHostIdentity(
  storageKey = DEFAULT_IDENTITY_STORAGE_KEY,
  identity: StoredHostIdentity | null,
) {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    if (!identity || typeof identity !== "object") {
      storage.removeItem(storageKey);
      return;
    }
    storage.setItem(storageKey, JSON.stringify(identity));
  } catch {
    // ignore localStorage failures
  }
}

export function readActiveHostIdentity(storageKey = DEFAULT_IDENTITY_STORAGE_KEY) {
  const identity = readStoredHostIdentity(storageKey);
  if (!identity) return null;
  const bootstrapToken = normalizeString(identity.bootstrapToken);
  const expiresAt = parseExpiry(identity);
  const subjectId = normalizeString(identity.subjectId);
  const identifier = normalizeIdentifier(identity.identifier);
  if ((!subjectId && !identifier) || !bootstrapToken) {
    if (!subjectId && !identifier) {
      clearStoredHostIdentity(storageKey);
      return null;
    }
  }
  if (bootstrapToken && expiresAt !== null && expiresAt <= Date.now()) {
    return null;
  }
  return identity;
}

export function normalizeHostBootstrapResult(
  data: Record<string, unknown> | null | undefined,
  fallbackSubjectId = "",
): HostBootstrapResult {
  const normalized = data && typeof data === "object" ? data : {};
  const subjectId = normalizeString(
    (normalized as Record<string, unknown>).subjectId || fallbackSubjectId,
  );
  const bootstrapToken = normalizeString((normalized as Record<string, unknown>).bootstrapToken);
  const expiresIn = Number((normalized as Record<string, unknown>).expiresIn) || 300;
  if (!subjectId) {
    throw new Error("resolve-subject response missing subjectId");
  }
  if (!bootstrapToken) {
    throw new Error("host-bootstrap response missing bootstrapToken");
  }
  return {
    subjectId,
    bootstrapToken,
    expiresIn,
    email: normalizeString((normalized as Record<string, unknown>).email) || null,
    name: normalizeString((normalized as Record<string, unknown>).name) || null,
  };
}

export async function executeHostBootstrap(
  input: HostIdentityInput,
  options: {
    hostBootstrapUrl?: string;
    fetchImpl?: FetchLike;
    fallbackMessage?: string;
  } = {},
) {
  const hostBootstrapUrl = options.hostBootstrapUrl || DEFAULT_HOST_BOOTSTRAP_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(String(hostBootstrapUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalizeHostIdentityInput(input)),
  });
  const raw = await response.text();
  const data = (() => {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();
  if (!response.ok) {
    throw new Error(String(data?.message || options.fallbackMessage || "host bootstrap failed"));
  }
  return normalizeHostBootstrapResult(data, normalizeString(input?.subjectId));
}

export function buildStoredHostIdentity(
  currentIdentity: StoredHostIdentity | null | undefined,
  result: HostBootstrapResult,
  input: HostIdentityInput = {},
  extras: Record<string, unknown> = {},
): StoredHostIdentity {
  const normalizedInput = normalizeHostIdentityInput(input);
  return {
    ...(currentIdentity && typeof currentIdentity === "object" ? currentIdentity : {}),
    ...normalizedInput,
    ...extras,
    subjectId: result.subjectId,
    bootstrapToken: result.bootstrapToken,
    bootstrapExpiresAt: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
    resolvedAt: new Date().toISOString(),
  };
}

export async function refreshStoredHostIdentity(
  storageKey = DEFAULT_IDENTITY_STORAGE_KEY,
  hostBootstrapUrl = DEFAULT_HOST_BOOTSTRAP_URL,
  fetchImpl?: FetchLike,
) {
  const identity = readStoredHostIdentity(storageKey);
  const normalized = normalizeHostIdentityInput(identity || {});
  if (!normalized.subjectId && !normalized.identifier && !normalized.email) {
    throw new Error("Stored host identity is missing subject identity for silent re-bootstrap");
  }
  const refreshed = await executeHostBootstrap(normalized, {
    hostBootstrapUrl,
    fetchImpl,
    fallbackMessage: "host bootstrap refresh failed",
  });
  const nextIdentity = buildStoredHostIdentity(identity, refreshed, normalized);
  writeStoredHostIdentity(storageKey, nextIdentity);
  return nextIdentity;
}

export function createHostIdentityAdapters(
  storageKey = DEFAULT_IDENTITY_STORAGE_KEY,
  options: {
    readIdentity?: (storageKey: string) => StoredHostIdentity | null;
    refreshIdentity?: (storageKey: string) => Promise<StoredHostIdentity | null>;
  } = {},
) {
  const readIdentity =
    typeof options.readIdentity === "function"
      ? options.readIdentity
      : (nextStorageKey: string) => readActiveHostIdentity(nextStorageKey);
  const adapters: {
    readStoredJson: (storageKey: string) => StoredHostIdentity | null;
    refreshStoredJson?: (storageKey: string) => Promise<StoredHostIdentity | null>;
  } = {
    readStoredJson: () => readIdentity(storageKey),
  };
  if (typeof options.refreshIdentity === "function") {
    adapters.refreshStoredJson = () => options.refreshIdentity!(storageKey);
  }
  return adapters;
}
