// @ts-nocheck
import { buildPaymentUrl as buildTenantDelegatedPaymentUrl } from "./paymentSession.js";

export const paymentMode = "tenant_delegated";
export const paymentModeLabel = "Gateway delegated by tenant";
export const paymentModeDescription =
  "Gateway executes checkout with tenant-scoped delegated credentials and delegated signing.";
export const paymentSessionModel = {
  uses_gateway_payment_session: true,
  tenant_owns_payment_page: false,
  tenant_owns_payment_session_endpoints: false,
  tenant_calls_gateway_payment_session_api_directly: false,
  tenant_session_reference: "gateway-hosted delegated session only",
};
export const requiredSettings = [
  "XCONECT_GUARD_INGEST_API_KEY",
  "delegated payment credential refs in the manifest/guard config",
  "XCONECT_TENANT_PAYMENT_RETURN_SECRET or XCONECT_TENANT_PAYMENT_RETURN_SECRET_REF",
];
export const paymentResponsibilities = [
  "keep tenant-delegated payment lane configured",
  "provide delegated credential/signing configuration",
  "reuse gateway-hosted checkout returned by the platform",
];
export const paymentEndpoints = [];

export const referenceEndpointGroup = {
  key: "tenant_delegated_payment_reference",
  label: "Tenant-delegated payment reference",
  when_to_use:
    "Use this when checkout is still gateway-hosted but tenant delegated credentials/signing are required.",
  endpoints: [],
  notes: [
    "Existing xapps keep the gateway-hosted payment page for this mode too.",
    "The tenant backend participates through guard execution and delegated tenant configuration.",
  ],
};

export async function buildPaymentUrl(input, runtime = {}) {
  return buildTenantDelegatedPaymentUrl(input, runtime);
}

export async function registerRoutes() {}
