// @ts-nocheck
import {
  EmbedHostProxyInputError,
  EmbedHostProxyNotConfiguredError,
  GatewayApiClientError,
} from "@xapps-platform/server-sdk";
import crypto from "node:crypto";

const HOST_BOOTSTRAP_HEADER = "x-xapps-host-bootstrap";

function toBase64Url(input) {
  return Buffer.from(String(input), "utf8").toString("base64url");
}

function fromBase64UrlJson(input) {
  const raw = Buffer.from(String(input || ""), "base64url").toString("utf8");
  return JSON.parse(raw);
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  return raw ? raw.replace(/\/+$/, "") : "";
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

function issueHostBootstrapToken(payload, signingSecret) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", String(signingSecret))
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyHostBootstrapToken(token, signingSecret) {
  const parts = String(token || "")
    .trim()
    .split(".");
  if (parts.length !== 2) {
    throw new EmbedHostProxyInputError("host bootstrap token is malformed", 401);
  }
  const [encodedPayload, receivedSignature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", String(signingSecret))
    .update(encodedPayload)
    .digest("base64url");
  const received = Buffer.from(receivedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new EmbedHostProxyInputError("host bootstrap token is invalid", 401);
  }
  const payload = fromBase64UrlJson(encodedPayload);
  if (!payload || typeof payload !== "object") {
    throw new EmbedHostProxyInputError("host bootstrap token payload is invalid", 401);
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp || 0) <= now) {
    throw new EmbedHostProxyInputError("host bootstrap token expired", 401);
  }
  return payload;
}

export function readHostBootstrapContext(request, bootstrap = {}) {
  const signingSecret = String(bootstrap?.signingSecret || "").trim();
  const token = readHostBootstrapToken(request);
  if (!token || !signingSecret) return null;
  const payload = verifyHostBootstrapToken(token, signingSecret);
  const requestOrigin = readRequestOrigin(request);
  const tokenOrigin = normalizeOrigin(payload.origin);
  if (tokenOrigin && requestOrigin && tokenOrigin !== requestOrigin) {
    throw new EmbedHostProxyInputError("host bootstrap token origin mismatch", 401);
  }
  return {
    subjectId: String(payload.subjectId || "").trim() || null,
    email: String(payload.email || "").trim() || null,
    name: String(payload.name || "").trim() || null,
    origin: tokenOrigin || null,
    token,
  };
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
  ttlSeconds,
}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = Number(ttlSeconds) > 0 ? Math.floor(Number(ttlSeconds)) : 300;
  const bootstrapToken = issueHostBootstrapToken(
    {
      v: 1,
      type: "host_bootstrap",
      subjectId: String(subjectId || "").trim(),
      email: String(email || "").trim(),
      name: String(name || "").trim(),
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

export function isOriginAllowed(origin, allowedOrigins = []) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return true;
  const normalizedAllowedOrigins = normalizeAllowedOrigins(allowedOrigins);
  if (normalizedAllowedOrigins.length === 0) {
    return true;
  }
  return normalizedAllowedOrigins.includes(normalizedOrigin);
}

export function applyHostApiCorsHeaders(reply, request, allowedOrigins = []) {
  const origin = readRequestOrigin(request);
  if (!origin) return;
  const normalizedAllowedOrigins = normalizeAllowedOrigins(allowedOrigins);
  if (normalizedAllowedOrigins.length === 0) return;
  if (!normalizedAllowedOrigins.includes(origin)) return;
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
}

export function ensureHostApiOriginAllowed(request, reply, allowedOrigins = []) {
  const origin = readRequestOrigin(request);
  if (!origin) return true;
  if (!isOriginAllowed(origin, allowedOrigins)) {
    reply.code(403).send({ message: "Origin is not allowed" });
    return false;
  }
  applyHostApiCorsHeaders(reply, request, allowedOrigins);
  return true;
}

export function sendHostApiPreflight(request, reply, allowedOrigins = []) {
  const origin = readRequestOrigin(request);
  if (origin && !isOriginAllowed(origin, allowedOrigins)) {
    return reply.code(403).send({ message: "Origin is not allowed" });
  }
  applyHostApiCorsHeaders(reply, request, allowedOrigins);
  const requestedHeaders = String(
    request?.headers?.["access-control-request-headers"] || "",
  ).trim();
  reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  reply.header(
    "Access-Control-Allow-Headers",
    requestedHeaders || "Content-Type, Authorization, X-Xapps-Host-Bootstrap",
  );
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
