// @ts-nocheck
import {
  EmbedHostProxyInputError,
  EmbedHostProxyNotConfiguredError,
  GatewayApiClientError,
} from "@xapps-platform/server-sdk";
import crypto from "node:crypto";

const HOST_BOOTSTRAP_HEADER = "x-xapps-host-bootstrap";
const HOST_SESSION_COOKIE_NAME = "xapps_host_session";
const HOST_BOOTSTRAP_TYPE = "host_bootstrap";
const HOST_BOOTSTRAP_VERSION = 2;
const HOST_BOOTSTRAP_ISSUER = "xapps_host_bootstrap";
const HOST_BOOTSTRAP_AUDIENCE = "xapps_host_api";
const HOST_SESSION_TYPE = "host_session";
const HOST_SESSION_VERSION = 2;
const HOST_SESSION_ISSUER = "xapps_host_session";
const HOST_SESSION_AUDIENCE = "xapps_host_api";
const HOST_SESSION_TTL_SECONDS = 1800;

function toBase64Url(input) {
  return Buffer.from(String(input), "utf8").toString("base64url");
}

function fromBase64UrlJson(input) {
  const raw = Buffer.from(String(input || ""), "base64url").toString("utf8");
  return JSON.parse(raw);
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  return raw ? raw.replace(/\/+$/, "").toLowerCase() : "";
}

function normalizeAllowedOrigins(allowedOrigins = []) {
  return Array.isArray(allowedOrigins)
    ? allowedOrigins.map((entry) => normalizeOrigin(entry)).filter(Boolean)
    : [];
}

export function readBodyRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function requireHostProxyService(hostProxyService) {
  if (!hostProxyService || typeof hostProxyService.getHostConfig !== "function") {
    throw new EmbedHostProxyNotConfiguredError("Host proxy service is not configured");
  }
  return hostProxyService;
}

export function readRequestOrigin(request) {
  return normalizeOrigin(request?.headers?.origin);
}

function readHostBootstrapToken(request) {
  return String(request?.headers?.[HOST_BOOTSTRAP_HEADER] || "").trim();
}

export function readDeprecatedHostBootstrapHeaderWarning(
  request,
  bootstrap = {},
  route = "",
): boolean {
  const token = readHostBootstrapToken(request);
  if (!token) return false;
  const message =
    "host bootstrap header is deprecated outside /api/host-session/exchange and will be removed";
  const deprecatedWarn = bootstrap?.deprecatedWarn;
  if (typeof deprecatedWarn === "function") {
    void Promise.resolve(
      deprecatedWarn({
        request,
        route,
        headerName: HOST_BOOTSTRAP_HEADER,
        message,
      }),
    ).catch((error) => {
      if (typeof request?.log?.warn === "function") {
        request.log.warn({ err: error }, "host-bootstrap deprecated warning hook failed");
      } else {
        console.warn("host-bootstrap deprecated warning hook failed", error);
      }
    });
    return true;
  }
  if (deprecatedWarn === true) {
    if (typeof request?.log?.warn === "function") {
      request.log.warn(
        {
          route,
          headerName: HOST_BOOTSTRAP_HEADER,
        },
        message,
      );
    } else {
      console.warn(message, { route, headerName: HOST_BOOTSTRAP_HEADER });
    }
    return true;
  }
  return false;
}

function readRequestBearerToken(request) {
  const raw = String(request?.headers?.authorization || "").trim();
  if (!raw) return "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

function readTrimmedString(...values) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export function readExecutionPlaneToken(request, ...fallbackValues) {
  return readRequestBearerToken(request) || readTrimmedString(...fallbackValues);
}

function parseCookieHeader(request) {
  const raw = String(request?.headers?.cookie || "").trim();
  if (!raw) return {};
  return raw.split(";").reduce((acc, entry) => {
    const [rawName, ...rest] = String(entry || "").split("=");
    const name = String(rawName || "").trim();
    if (!name) return acc;
    const value = rest.join("=");
    try {
      acc[name] = decodeURIComponent(String(value || "").trim());
    } catch {
      acc[name] = String(value || "").trim();
    }
    return acc;
  }, {});
}

function readHostSessionCookie(request, cookieName = HOST_SESSION_COOKIE_NAME) {
  const cookies = parseCookieHeader(request);
  return String(cookies?.[cookieName] || "").trim();
}

function resolveHostSessionCookieName(session = {}) {
  return String(session?.cookieName || HOST_SESSION_COOKIE_NAME).trim() || HOST_SESSION_COOKIE_NAME;
}

function resolveHostSessionSigningSecret(session = {}) {
  return String(session?.signingSecret || "").trim();
}

function resolveSigningVerifierKeys(config = {}) {
  const verifierKeys =
    config?.verifierKeys &&
    typeof config.verifierKeys === "object" &&
    !Array.isArray(config.verifierKeys)
      ? config.verifierKeys
      : {};
  return Object.entries(verifierKeys).reduce((acc, [key, value]) => {
    const normalizedKey = String(key || "").trim();
    const normalizedValue = String(value || "").trim();
    if (normalizedKey && normalizedValue) {
      acc[normalizedKey] = normalizedValue;
    }
    return acc;
  }, {});
}

function resolveSigningContext(config = {}) {
  const signingSecret = String(config?.signingSecret || "").trim();
  const signingKeyId = String(config?.signingKeyId || "").trim();
  const verifierKeys = resolveSigningVerifierKeys(config);
  if (signingKeyId && signingSecret && !verifierKeys[signingKeyId]) {
    verifierKeys[signingKeyId] = signingSecret;
  }
  return {
    signingSecret,
    signingKeyId,
    verifierKeys,
  };
}

function resolveHostSessionAbsoluteTtlSeconds(session = {}) {
  return Number(session?.absoluteTtlSeconds) > 0
    ? Math.floor(Number(session.absoluteTtlSeconds))
    : HOST_SESSION_TTL_SECONDS;
}

function resolveHostSessionIdleTtlSeconds(session = {}) {
  return Number(session?.idleTtlSeconds) > 0 ? Math.floor(Number(session.idleTtlSeconds)) : 0;
}

function resolveHostSessionCookiePath(session = {}) {
  return String(session?.cookiePath || "/api").trim() || "/api";
}

function resolveHostSessionCookieDomain(session = {}) {
  return String(session?.cookieDomain || "").trim();
}

export function requireRequestedHostBootstrapOrigin(origin, allowedOrigins = []) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    throw new EmbedHostProxyInputError("host bootstrap origin is required", 400);
  }
  if (!isOriginAllowed(normalizedOrigin, allowedOrigins)) {
    throw new EmbedHostProxyInputError("host bootstrap origin is not allowed", 403);
  }
  return normalizedOrigin;
}

function issueSignedHostToken(payload, signingSecret) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", String(signingSecret))
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function issueHostBootstrapToken(payload, signingSecret) {
  return issueSignedHostToken(payload, signingSecret);
}

function issueHostSessionToken(payload, signingSecret) {
  return issueSignedHostToken(payload, signingSecret);
}

function resolveVerificationSecret(payload, config = {}, tokenLabel) {
  const { signingSecret, signingKeyId, verifierKeys } = resolveSigningContext(config);
  const payloadKid = String(payload?.kid || "").trim();
  if (payloadKid) {
    const resolved = String(verifierKeys[payloadKid] || "").trim();
    if (!resolved) {
      throw new EmbedHostProxyInputError(`${tokenLabel} kid is invalid`, 401);
    }
    return resolved;
  }
  if (!signingSecret) {
    throw new EmbedHostProxyInputError(`${tokenLabel} is invalid`, 401);
  }
  if (signingKeyId && !verifierKeys[signingKeyId]) {
    throw new EmbedHostProxyNotConfiguredError(`${tokenLabel} verification is not configured`);
  }
  return signingSecret;
}

function verifyHostBootstrapToken(token, bootstrap = {}) {
  const parts = String(token || "")
    .trim()
    .split(".");
  if (parts.length !== 2) {
    throw new EmbedHostProxyInputError("host bootstrap token is malformed", 401);
  }
  const [encodedPayload, receivedSignature] = parts;
  let payload;
  try {
    payload = fromBase64UrlJson(encodedPayload);
  } catch {
    throw new EmbedHostProxyInputError("host bootstrap token payload is invalid", 401);
  }
  if (!payload || typeof payload !== "object") {
    throw new EmbedHostProxyInputError("host bootstrap token payload is invalid", 401);
  }
  const signingSecret = resolveVerificationSecret(payload, bootstrap, "host bootstrap token");
  const expectedSignature = crypto
    .createHmac("sha256", String(signingSecret))
    .update(encodedPayload)
    .digest("base64url");
  const received = Buffer.from(receivedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new EmbedHostProxyInputError("host bootstrap token is invalid", 401);
  }
  if (String(payload.type || "").trim() !== HOST_BOOTSTRAP_TYPE) {
    throw new EmbedHostProxyInputError("host bootstrap token type is invalid", 401);
  }
  if (Number(payload.v || 0) !== HOST_BOOTSTRAP_VERSION) {
    throw new EmbedHostProxyInputError("host bootstrap token version is invalid", 401);
  }
  if (String(payload.iss || "").trim() !== HOST_BOOTSTRAP_ISSUER) {
    throw new EmbedHostProxyInputError("host bootstrap token issuer is invalid", 401);
  }
  if (String(payload.aud || "").trim() !== HOST_BOOTSTRAP_AUDIENCE) {
    throw new EmbedHostProxyInputError("host bootstrap token audience is invalid", 401);
  }
  if (!String(payload.jti || "").trim()) {
    throw new EmbedHostProxyInputError("host bootstrap token jti is invalid", 401);
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp || 0) <= now) {
    throw new EmbedHostProxyInputError("host bootstrap token expired", 401);
  }
  return payload;
}

function verifyHostSessionToken(token, session = {}) {
  const parts = String(token || "")
    .trim()
    .split(".");
  if (parts.length !== 2) {
    throw new EmbedHostProxyInputError("host session token is malformed", 401);
  }
  const [encodedPayload, receivedSignature] = parts;
  let payload;
  try {
    payload = fromBase64UrlJson(encodedPayload);
  } catch {
    throw new EmbedHostProxyInputError("host session token payload is invalid", 401);
  }
  if (!payload || typeof payload !== "object") {
    throw new EmbedHostProxyInputError("host session token payload is invalid", 401);
  }
  const signingSecret = resolveVerificationSecret(payload, session, "host session token");
  const expectedSignature = crypto
    .createHmac("sha256", String(signingSecret))
    .update(encodedPayload)
    .digest("base64url");
  const received = Buffer.from(receivedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new EmbedHostProxyInputError("host session token is invalid", 401);
  }
  if (String(payload.type || "").trim() !== HOST_SESSION_TYPE) {
    throw new EmbedHostProxyInputError("host session token type is invalid", 401);
  }
  if (Number(payload.v || 0) !== HOST_SESSION_VERSION) {
    throw new EmbedHostProxyInputError("host session token version is invalid", 401);
  }
  if (String(payload.iss || "").trim() !== HOST_SESSION_ISSUER) {
    throw new EmbedHostProxyInputError("host session token issuer is invalid", 401);
  }
  if (String(payload.aud || "").trim() !== HOST_SESSION_AUDIENCE) {
    throw new EmbedHostProxyInputError("host session token audience is invalid", 401);
  }
  if (!String(payload.jti || "").trim()) {
    throw new EmbedHostProxyInputError("host session token jti is invalid", 401);
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp || 0) <= now) {
    throw new EmbedHostProxyInputError("host session token expired", 401);
  }
  return payload;
}

export function readHostBootstrapContext(request, bootstrap = {}) {
  const signingSecret = String(bootstrap?.signingSecret || "").trim();
  const token = readHostBootstrapToken(request);
  if (!token || !signingSecret) return null;
  const payload = verifyHostBootstrapToken(token, bootstrap);
  const requestOrigin = readRequestOrigin(request);
  const tokenOrigin = normalizeOrigin(payload.origin);
  if (!tokenOrigin) {
    throw new EmbedHostProxyInputError("host bootstrap token origin is missing", 401);
  }
  if (!requestOrigin) {
    throw new EmbedHostProxyInputError("host bootstrap request origin is required", 401);
  }
  if (tokenOrigin !== requestOrigin) {
    throw new EmbedHostProxyInputError("host bootstrap token origin mismatch", 401);
  }
  return {
    subjectId: String(payload.subjectId || "").trim() || null,
    origin: tokenOrigin || null,
    jti: String(payload.jti || "").trim() || null,
    iat: Number.isFinite(Number(payload.iat)) ? Math.floor(Number(payload.iat)) : null,
    exp: Number.isFinite(Number(payload.exp)) ? Math.floor(Number(payload.exp)) : null,
    token,
  };
}

export async function consumeHostBootstrapReplay(context, bootstrap = {}) {
  const consumeJti = typeof bootstrap?.consumeJti === "function" ? bootstrap.consumeJti : null;
  if (!consumeJti) {
    throw new EmbedHostProxyNotConfiguredError(
      "Host session exchange replay protection is not configured",
    );
  }
  const accepted = await consumeJti({
    jti: String(context?.jti || "").trim(),
    subjectId: String(context?.subjectId || "").trim() || null,
    origin: String(context?.origin || "").trim() || null,
    iat: Number.isFinite(Number(context?.iat)) ? Math.floor(Number(context.iat)) : null,
    exp: Number.isFinite(Number(context?.exp)) ? Math.floor(Number(context.exp)) : null,
    token: String(context?.token || "").trim(),
    type: HOST_BOOTSTRAP_TYPE,
  });
  if (accepted !== true) {
    throw new EmbedHostProxyInputError("host bootstrap token replay detected", 409);
  }
}

function readRequestBaseUrl(request) {
  const forwardedProto = String(request?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  const forwardedHost = String(request?.headers?.["x-forwarded-host"] || "")
    .split(",")[0]
    ?.trim();
  const protocol = String(forwardedProto || request?.protocol || "http")
    .trim()
    .toLowerCase();
  const host = String(forwardedHost || request?.headers?.host || "").trim();
  return host ? `${protocol}://${host}` : "";
}

function isCrossOriginRequest(request) {
  const origin = readRequestOrigin(request);
  const baseUrl = readRequestBaseUrl(request);
  return Boolean(origin && baseUrl && origin !== baseUrl);
}

function shouldUseSecureCookie(request) {
  const baseUrl = readRequestBaseUrl(request).toLowerCase();
  return (
    baseUrl.startsWith("https://") ||
    baseUrl.startsWith("http://localhost") ||
    baseUrl.startsWith("http://127.0.0.1") ||
    baseUrl.startsWith("http://[::1]")
  );
}

function resolveSessionCookieSecure(request, session = {}) {
  if (typeof session?.cookieSecure === "boolean") {
    return session.cookieSecure;
  }
  return shouldUseSecureCookie(request);
}

function resolveSessionCookieSameSite(request, session = {}) {
  const configured = String(session?.cookieSameSite || "").trim();
  if (configured === "Lax" || configured === "Strict" || configured === "None") {
    return configured;
  }
  const origin = readRequestOrigin(request);
  const baseUrl = readRequestBaseUrl(request);
  return origin && baseUrl && origin !== baseUrl ? "None" : "Lax";
}

function buildSetCookieHeader(name, value, request, maxAgeSeconds, session = {}) {
  const parts = [
    `${String(name || HOST_SESSION_COOKIE_NAME).trim() || HOST_SESSION_COOKIE_NAME}=${encodeURIComponent(String(value || "").trim())}`,
    `Path=${resolveHostSessionCookiePath(session)}`,
    "HttpOnly",
    `Max-Age=${Math.max(0, Number(maxAgeSeconds) || 0)}`,
    `SameSite=${resolveSessionCookieSameSite(request, session)}`,
  ];
  const cookieDomain = resolveHostSessionCookieDomain(session);
  if (cookieDomain) {
    parts.push(`Domain=${cookieDomain}`);
  }
  if (resolveSessionCookieSecure(request, session)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function buildClearedHostSessionCookieHeader(request, session = {}) {
  return buildSetCookieHeader(resolveHostSessionCookieName(session), "", request, 0, session);
}

export async function readHostSessionContext(request, session = {}) {
  const signingSecret = resolveHostSessionSigningSecret(session);
  const cookieName = resolveHostSessionCookieName(session);
  const token = readHostSessionCookie(request, cookieName);
  if (!token || !signingSecret) return null;
  const payload = verifyHostSessionToken(token, session);
  const sessionStore =
    session?.store && typeof session.store === "object" && !Array.isArray(session.store)
      ? session.store
      : {};
  const isRevoked = typeof sessionStore?.isRevoked === "function" ? sessionStore.isRevoked : null;
  if (!isRevoked) {
    throw new EmbedHostProxyNotConfiguredError("Host session revocation is not configured");
  }
  const revoked = await isRevoked({
    jti: String(payload.jti || "").trim(),
    subjectId: String(payload.subjectId || "").trim() || null,
    iat: Number.isFinite(Number(payload.iat)) ? Math.floor(Number(payload.iat)) : null,
    exp: Number.isFinite(Number(payload.exp)) ? Math.floor(Number(payload.exp)) : null,
    token,
    type: HOST_SESSION_TYPE,
  });
  if (revoked === true) {
    throw new EmbedHostProxyInputError("host session revoked", 401);
  }
  const idleTtlSeconds = resolveHostSessionIdleTtlSeconds(session);
  if (idleTtlSeconds > 0) {
    const touch = typeof sessionStore?.touch === "function" ? sessionStore.touch : null;
    if (!touch) {
      throw new EmbedHostProxyNotConfiguredError("Host session idle timeout is not configured");
    }
    const touched = await touch({
      jti: String(payload.jti || "").trim(),
      subjectId: String(payload.subjectId || "").trim() || null,
      iat: Number.isFinite(Number(payload.iat)) ? Math.floor(Number(payload.iat)) : null,
      exp: Number.isFinite(Number(payload.exp)) ? Math.floor(Number(payload.exp)) : null,
      idleTtlSeconds,
      token,
      type: HOST_SESSION_TYPE,
    });
    const active =
      touched === true ||
      (touched &&
        typeof touched === "object" &&
        !Array.isArray(touched) &&
        touched.active !== false);
    if (!active) {
      throw new EmbedHostProxyInputError("host session idle expired", 401);
    }
  }
  return {
    subjectId: String(payload.subjectId || "").trim() || null,
    sessionMode: "host_session",
    jti: String(payload.jti || "").trim() || null,
    iat: Number.isFinite(Number(payload.iat)) ? Math.floor(Number(payload.iat)) : null,
    exp: Number.isFinite(Number(payload.exp)) ? Math.floor(Number(payload.exp)) : null,
    token,
  };
}

export async function activateHostSession(context, session = {}) {
  const idleTtlSeconds = resolveHostSessionIdleTtlSeconds(session);
  if (idleTtlSeconds <= 0) return;
  const sessionStore =
    session?.store && typeof session.store === "object" && !Array.isArray(session.store)
      ? session.store
      : {};
  const activate = typeof sessionStore?.activate === "function" ? sessionStore.activate : null;
  if (!activate) {
    throw new EmbedHostProxyNotConfiguredError("Host session idle timeout is not configured");
  }
  const activated = await activate({
    jti: String(context?.jti || "").trim(),
    subjectId: String(context?.subjectId || "").trim() || null,
    iat: Number.isFinite(Number(context?.iat)) ? Math.floor(Number(context.iat)) : null,
    exp: Number.isFinite(Number(context?.exp)) ? Math.floor(Number(context.exp)) : null,
    idleTtlSeconds,
    token: String(context?.token || "").trim(),
    type: HOST_SESSION_TYPE,
  });
  if (activated !== true) {
    throw new EmbedHostProxyInputError("host session activation failed", 409);
  }
}

export async function revokeHostSession(context, session = {}) {
  const sessionStore =
    session?.store && typeof session.store === "object" && !Array.isArray(session.store)
      ? session.store
      : {};
  const revoke = typeof sessionStore?.revoke === "function" ? sessionStore.revoke : null;
  if (!revoke) {
    throw new EmbedHostProxyNotConfiguredError("Host session revocation is not configured");
  }
  const revoked = await revoke({
    jti: String(context?.jti || "").trim(),
    subjectId: String(context?.subjectId || "").trim() || null,
    iat: Number.isFinite(Number(context?.iat)) ? Math.floor(Number(context.iat)) : null,
    exp: Number.isFinite(Number(context?.exp)) ? Math.floor(Number(context.exp)) : null,
    token: String(context?.token || "").trim(),
    type: HOST_SESSION_TYPE,
  });
  if (revoked !== true) {
    throw new EmbedHostProxyInputError("host session revocation failed", 409);
  }
}

export async function readHostAuthContext(request, session = {}) {
  const sessionContext = await readHostSessionContext(request, session);
  if (sessionContext) return sessionContext;
  if (isCrossOriginRequest(request)) {
    throw new EmbedHostProxyInputError("host session is required", 401);
  }
  return null;
}

export async function resolveTrustedHostSubjectId(request, authContext, subjectId, session = {}) {
  const trustedSubjectId = String(authContext?.subjectId || "").trim();
  if (trustedSubjectId) return trustedSubjectId;
  const candidateSubjectId = String(subjectId || "").trim() || null;
  const resolveSameOriginSubjectId =
    typeof session?.resolveSameOriginSubjectId === "function"
      ? session.resolveSameOriginSubjectId
      : null;
  if (!resolveSameOriginSubjectId) {
    throw new EmbedHostProxyInputError("same-origin subject resolution is required", 401);
  }
  const resolvedSubjectId = String(
    (await resolveSameOriginSubjectId({
      request,
      subjectId: candidateSubjectId,
    })) || "",
  ).trim();
  if (!resolvedSubjectId) {
    throw new EmbedHostProxyInputError("same-origin subject resolution failed", 401);
  }
  return resolvedSubjectId;
}

export function requireHostBootstrapRequest(request, bootstrap = {}) {
  const allowedApiKeys = Array.isArray(bootstrap?.apiKeys)
    ? bootstrap.apiKeys.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  const signingSecret = String(bootstrap?.signingSecret || "").trim();
  if (allowedApiKeys.length === 0 || !signingSecret) {
    throw new EmbedHostProxyNotConfiguredError("Host bootstrap is not configured");
  }
  const apiKey = String(request?.headers?.["x-api-key"] || "").trim();
  if (!apiKey || !allowedApiKeys.includes(apiKey)) {
    throw new EmbedHostProxyInputError("Invalid host bootstrap api key", 401);
  }
  return {
    apiKey,
    signingSecret,
    signingKeyId: String(bootstrap?.signingKeyId || "").trim() || null,
    ttlSeconds:
      Number.isFinite(Number(bootstrap?.ttlSeconds)) && Number(bootstrap?.ttlSeconds) > 0
        ? Math.floor(Number(bootstrap.ttlSeconds))
        : 300,
  };
}

export function buildHostBootstrapResult({
  subjectId,
  email,
  name,
  origin,
  signingSecret,
  signingKeyId,
  ttlSeconds,
}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = Number(ttlSeconds) > 0 ? Math.floor(Number(ttlSeconds)) : 300;
  const bootstrapToken = issueHostBootstrapToken(
    {
      v: HOST_BOOTSTRAP_VERSION,
      type: HOST_BOOTSTRAP_TYPE,
      iss: HOST_BOOTSTRAP_ISSUER,
      aud: HOST_BOOTSTRAP_AUDIENCE,
      ...(String(signingKeyId || "").trim() ? { kid: String(signingKeyId).trim() } : {}),
      jti: crypto.randomUUID(),
      subjectId: String(subjectId || "").trim(),
      origin: normalizeOrigin(origin),
      iat: now,
      exp: now + expiresIn,
    },
    signingSecret,
  );
  return {
    subjectId: String(subjectId || "").trim(),
    email: String(email || "").trim(),
    name: String(name || "").trim() || null,
    bootstrapToken,
    expiresIn,
  };
}

export function buildHostSessionExchangeResult({
  subjectId,
  signingSecret,
  signingKeyId,
  request,
  ttlSeconds,
  session = {},
}) {
  const resolvedSubjectId = String(subjectId || "").trim();
  if (!resolvedSubjectId) {
    throw new EmbedHostProxyInputError("host session subjectId is required", 400);
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresIn =
    Number(ttlSeconds) > 0
      ? Math.floor(Number(ttlSeconds))
      : resolveHostSessionAbsoluteTtlSeconds(session);
  const cookieName = resolveHostSessionCookieName(session);
  const sessionPayload = {
    v: HOST_SESSION_VERSION,
    type: HOST_SESSION_TYPE,
    iss: HOST_SESSION_ISSUER,
    aud: HOST_SESSION_AUDIENCE,
    ...(String(signingKeyId || "").trim() ? { kid: String(signingKeyId).trim() } : {}),
    jti: crypto.randomUUID(),
    subjectId: resolvedSubjectId,
    iat: now,
    exp: now + expiresIn,
  };
  const sessionToken = issueHostSessionToken(sessionPayload, signingSecret);
  return {
    payload: {
      ok: true,
      subjectId: resolvedSubjectId,
      expiresIn,
      sessionMode: "host_session",
    },
    setCookie: buildSetCookieHeader(cookieName, sessionToken, request, expiresIn, session),
    sessionContext: {
      jti: String(sessionPayload.jti || "").trim() || null,
      subjectId: String(sessionPayload.subjectId || "").trim() || null,
      iat: Number.isFinite(Number(sessionPayload.iat))
        ? Math.floor(Number(sessionPayload.iat))
        : null,
      exp: Number.isFinite(Number(sessionPayload.exp))
        ? Math.floor(Number(sessionPayload.exp))
        : null,
      token: sessionToken,
    },
  };
}

export function isOriginAllowed(origin, allowedOrigins = []) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return true;
  const normalizedAllowedOrigins = normalizeAllowedOrigins(allowedOrigins);
  if (normalizedAllowedOrigins.length === 0) {
    return false;
  }
  return normalizedAllowedOrigins.includes(normalizedOrigin);
}

export function resolveHostApiAllowedOrigins(request, allowedOrigins = []) {
  const normalizedAllowedOrigins = normalizeAllowedOrigins(allowedOrigins);
  if (normalizedAllowedOrigins.length > 0) {
    return normalizedAllowedOrigins;
  }
  const baseUrl = normalizeOrigin(readRequestBaseUrl(request));
  return baseUrl ? [baseUrl] : [];
}

export function applyHostApiCorsHeaders(reply, request, allowedOrigins = []) {
  const origin = readRequestOrigin(request);
  if (!origin) return;
  const normalizedAllowedOrigins = resolveHostApiAllowedOrigins(request, allowedOrigins);
  if (normalizedAllowedOrigins.length === 0) return;
  if (!normalizedAllowedOrigins.includes(origin)) return;
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Credentials", "true");
}

export function ensureHostApiOriginAllowed(request, reply, allowedOrigins = []) {
  const origin = readRequestOrigin(request);
  if (!origin) return true;
  const effectiveAllowedOrigins = resolveHostApiAllowedOrigins(request, allowedOrigins);
  if (!isOriginAllowed(origin, effectiveAllowedOrigins)) {
    reply.code(403).send({ message: "Origin is not allowed" });
    return false;
  }
  applyHostApiCorsHeaders(reply, request, effectiveAllowedOrigins);
  return true;
}

export function ensureHostApiBrowserUnsafeOriginAllowed(request, reply, allowedOrigins = []) {
  const origin = readRequestOrigin(request);
  if (!origin) {
    reply.code(403).send({ message: "Origin is required" });
    return false;
  }
  return ensureHostApiOriginAllowed(request, reply, allowedOrigins);
}

export function ensureHostApiCookieUnsafeOriginAllowed(request, reply, allowedOrigins = []) {
  return ensureHostApiBrowserUnsafeOriginAllowed(request, reply, allowedOrigins);
}

export function sendHostApiPreflight(request, reply, allowedOrigins = []) {
  const origin = readRequestOrigin(request);
  const effectiveAllowedOrigins = resolveHostApiAllowedOrigins(request, allowedOrigins);
  if (origin && !isOriginAllowed(origin, effectiveAllowedOrigins)) {
    return reply.code(403).send({ message: "Origin is not allowed" });
  }
  applyHostApiCorsHeaders(reply, request, effectiveAllowedOrigins);
  const requestedHeaders = String(
    request?.headers?.["access-control-request-headers"] || "",
  ).trim();
  reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  reply.header(
    "Access-Control-Allow-Headers",
    requestedHeaders || "Content-Type, Authorization, X-Xapps-Host-Bootstrap",
  );
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header("Access-Control-Max-Age", "600");
  return reply.code(204).send();
}

export function applyNoStoreHeaders(reply, hostProxyService) {
  const service = requireHostProxyService(hostProxyService);
  const headers = service.getNoStoreHeaders();
  reply.header("Cache-Control", headers["Cache-Control"]);
  reply.header("Pragma", headers.Pragma);
  reply.header("Expires", headers.Expires);
  return reply;
}

export function appendSetCookieHeader(reply, setCookie) {
  const normalizedSetCookie = String(setCookie || "").trim();
  if (!normalizedSetCookie) return;
  const existing = typeof reply?.getHeader === "function" ? reply.getHeader("Set-Cookie") : null;
  if (Array.isArray(existing)) {
    reply.header("Set-Cookie", [...existing.map((entry) => String(entry)), normalizedSetCookie]);
    return;
  }
  if (existing != null && String(existing).trim() !== "") {
    reply.header("Set-Cookie", [String(existing), normalizedSetCookie]);
    return;
  }
  reply.header("Set-Cookie", normalizedSetCookie);
}

export function sendServiceError(request, reply, err, fallbackMessage) {
  if (err instanceof EmbedHostProxyInputError || err instanceof EmbedHostProxyNotConfiguredError) {
    return reply.code(err.status).send({ message: err.message });
  }
  if (err instanceof GatewayApiClientError) {
    request.log.error(
      {
        gatewayError: {
          code: err.code,
          status: err.status,
          message: err.message,
          details: err.details,
        },
      },
      fallbackMessage,
    );
    return reply
      .code(err.status || 502)
      .send(
        err.details && typeof err.details === "object" ? err.details : { message: err.message },
      );
  }
  request.log.error({ err }, fallbackMessage);
  return reply.code(500).send({ message: fallbackMessage });
}
