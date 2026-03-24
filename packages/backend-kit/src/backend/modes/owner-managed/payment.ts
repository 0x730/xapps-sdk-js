// @ts-nocheck
import { buildPaymentUrl as buildOwnerManagedPaymentUrl } from "./paymentSession.js";
import paymentAssetRoutes from "./paymentAssets.js";
import paymentPageApiRoutes from "./paymentPageApi.js";

export const paymentMode = "owner_managed";
export const referenceMode = "owner_managed";
export const paymentModeLabel = "Owner managed";
export const paymentModeDescription =
  "The owner controls the payment page flow. The packaged sample payment page is the default reference seam for this path.";
export const paymentPagePath = "/tenant-payment.html";
export const paymentSessionModel = {
  uses_gateway_payment_session: true,
  tenant_owns_payment_page: true,
  tenant_owns_payment_session_endpoints: true,
  tenant_calls_gateway_payment_session_api_directly: true,
  tenant_session_reference: "tenant page proxies gateway session through /api/tenant-payment/*",
};
export const requiredSettings = [
  "XCONECT_GUARD_INGEST_API_KEY",
  "XCONECT_TENANT_PAYMENT_URL",
  "XCONECT_TENANT_PAYMENT_RETURN_SECRET or XCONECT_TENANT_PAYMENT_RETURN_SECRET_REF",
];
export const paymentResponsibilities = [
  "serve the tenant payment page",
  "implement tenant payment session endpoints",
  "complete/client-settle the hosted gateway session from the tenant page",
];
export const paymentEndpoints = [
  {
    method: "GET",
    path: "/tenant-payment.html",
    purpose: "Serves the tenant-owned payment page.",
  },
  {
    method: "GET",
    path: "/api/tenant-payment/session",
    purpose: "Loads the current hosted gateway session for the tenant page.",
  },
  {
    method: "POST",
    path: "/api/tenant-payment/complete",
    purpose: "Advances the hosted gateway session from the tenant page.",
  },
  {
    method: "POST",
    path: "/api/tenant-payment/client-settle",
    purpose: "Fallback client settlement for the tenant page flow.",
  },
];

export const referenceEndpointGroup = {
  key: "owner_managed_payment_reference",
  label: "Owner-managed payment page reference",
  when_to_use:
    "Use this when the owner keeps the owner-managed lane and the packaged sample payment page is used.",
  endpoints: paymentEndpoints,
};

export async function buildPaymentUrl(input, runtime = {}) {
  return buildOwnerManagedPaymentUrl(input, runtime);
}

export async function registerRoutes(fastify, { paymentRuntime = {} } = {}) {
  await fastify.register(paymentAssetRoutes, { paymentRuntime });
  await fastify.register(paymentPageApiRoutes, { paymentRuntime });
}
