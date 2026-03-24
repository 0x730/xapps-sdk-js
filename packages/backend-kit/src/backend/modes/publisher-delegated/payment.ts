// @ts-nocheck
import { buildPaymentUrl as buildPublisherDelegatedPaymentUrl } from "./paymentSession.js";

export const paymentMode = "publisher_delegated";
export const paymentModeLabel = "Gateway delegated by publisher";
export const paymentModeDescription =
  "Gateway executes checkout with publisher-scoped delegated credentials and delegated signing.";
export const paymentSessionModel = {
  uses_gateway_payment_session: true,
  tenant_owns_payment_page: false,
  tenant_owns_payment_session_endpoints: false,
  tenant_calls_gateway_payment_session_api_directly: false,
  tenant_session_reference: "gateway-hosted delegated session only",
};
export const requiredSettings = [
  "backend guard ingest API key",
  "delegated publisher payment credential refs in the manifest/guard config",
  "publisher delegated payment return secret or secret ref",
];
export const paymentResponsibilities = [
  "keep publisher-delegated payment lane configured",
  "provide delegated publisher credential/signing configuration",
  "reuse gateway-hosted checkout returned by the platform",
];
export const paymentEndpoints = [];

export const referenceEndpointGroup = {
  key: "publisher_delegated_payment_reference",
  label: "Publisher-delegated payment reference",
  when_to_use:
    "Use this when checkout is still gateway-hosted but publisher delegated credentials/signing are required.",
  endpoints: [],
  notes: [
    "Existing xapps keep the gateway-hosted payment page for this mode too.",
    "The backend participates through guard execution and delegated publisher configuration.",
  ],
};

export async function buildPaymentUrl(input, runtime = {}) {
  return buildPublisherDelegatedPaymentUrl(input, runtime);
}

export async function registerRoutes() {}
