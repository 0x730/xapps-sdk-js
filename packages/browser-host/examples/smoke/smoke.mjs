import {
  buildFeaturePaywall,
  flattenXappMonetizationCatalog,
  getDefaultXappMonetizationScopeKind,
  resolveBackendBaseUrl,
  resolveBridgeEndpoints,
  resolveHostApiBasePath,
  resolveHostConfigUrl,
  resolveXmsModeForPackage,
  summarizeXappMonetizationSnapshot,
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

assert(
  getDefaultXappMonetizationScopeKind({
    context: { subject_id: "sub_123", installation_id: "inst_123" },
  }) === "subject",
  "default monetization scope mismatch",
);

const flattenedCatalog = flattenXappMonetizationCatalog([
  {
    id: "off_123",
    slug: "creator_default_paywall",
    packages: [
      {
        id: "pkg_123",
        slug: "creator_credits_500",
        title: { en: "Creator Credits 500" },
        package_kind: "credit_pack",
        product: { product_family: "credit_pack" },
        prices: [{ id: "price_123", amount: "79", currency: "RON", billing_period: "one_time" }],
      },
    ],
  },
]);
assert(flattenedCatalog.length === 1, "flattened monetization catalog mismatch");
assert(resolveXmsModeForPackage(flattenedCatalog[0]).key === "credit_wallet", "xms mode mismatch");
const featurePaywall = buildFeaturePaywall({
  feature: { requirements: { credits: 250 } },
  packages: flattenedCatalog,
});
assert(featurePaywall.activePackage?.packageId === "pkg_123", "feature paywall mismatch");
const snapshotSummary = summarizeXappMonetizationSnapshot({
  access_projection: {
    entitlement_state: "active",
    has_current_access: true,
    tier: "creator_team_hybrid_access",
    credits_remaining: "500",
    balance_state: "sufficient",
  },
  current_subscription: {
    status: "active",
    tier: "creator_team_hybrid_access",
    overdue_policy: { has_current_access: true },
  },
});
assert(snapshotSummary.accessCoverage.coverageLabel === "Available", "snapshot coverage mismatch");
assert(snapshotSummary.wallet.creditsRemaining === "500", "snapshot wallet mismatch");

console.log("browser-host smoke: ok");
