// @ts-nocheck
function trimTrailingSlash(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

export function resolveBackendBaseUrl(input) {
  return trimTrailingSlash(input?.backendBaseUrl);
}

export function resolveHostConfigUrl(input) {
  const explicit = String(input?.hostConfigPath || "").trim();
  if (explicit) return explicit;
  const backendBaseUrl = resolveBackendBaseUrl(input);
  return backendBaseUrl ? `${backendBaseUrl}/api/host-config` : "/api/host-config";
}

export function resolveHostApiBasePath(input) {
  const explicit = String(input?.apiBasePath || "").trim();
  if (explicit) return explicit;
  const backendBaseUrl = resolveBackendBaseUrl(input);
  return backendBaseUrl ? `${backendBaseUrl}/api` : "/api";
}

export function resolveBridgeEndpoints(input) {
  const apiBasePath = resolveHostApiBasePath(input);
  const explicit =
    input?.bridgeEndpoints && typeof input.bridgeEndpoints === "object"
      ? input.bridgeEndpoints
      : {};
  return {
    tokenRefresh: String(explicit.tokenRefresh || `${apiBasePath}/bridge/token-refresh`).trim(),
    sign: String(explicit.sign || `${apiBasePath}/bridge/sign`).trim(),
    vendorAssertion: String(
      explicit.vendorAssertion || `${apiBasePath}/bridge/vendor-assertion`,
    ).trim(),
  };
}
