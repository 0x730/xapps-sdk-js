import {
  resolveBackendBaseUrl,
  resolveBridgeEndpoints,
  resolveHostApiBasePath,
  resolveHostConfigUrl,
} from "../../dist/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log("browser-host smoke: start");

const backendBaseUrl = resolveBackendBaseUrl({ backendBaseUrl: "https://tenant.example.test///" });
assert(backendBaseUrl === "https://tenant.example.test", "backend base url should trim slashes");

const hostConfigUrl = resolveHostConfigUrl({ backendBaseUrl });
assert(hostConfigUrl === "https://tenant.example.test/api/host-config", "host config url mismatch");

const apiBasePath = resolveHostApiBasePath({ backendBaseUrl });
assert(apiBasePath === "https://tenant.example.test/api", "host api base path mismatch");

const endpoints = resolveBridgeEndpoints({ backendBaseUrl });
assert(
  endpoints.tokenRefresh === "https://tenant.example.test/api/bridge/token-refresh",
  "token refresh endpoint mismatch",
);
assert(
  endpoints.vendorAssertion === "https://tenant.example.test/api/bridge/vendor-assertion",
  "vendor assertion endpoint mismatch",
);

console.log("browser-host smoke: ok");
