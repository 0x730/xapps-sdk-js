// @ts-nocheck
import { buildPaymentUrl as buildGatewayManagedPaymentUrl } from "./paymentSession.js";

export const paymentMode = "gateway_managed";
export const paymentModeLabel = "Gateway managed";
export const paymentModeDescription =
  "Gateway owns hosted checkout and provider execution. Tenant mainly consumes the lane.";
export const paymentSessionModel = {
  uses_gateway_payment_session: true,
  tenant_owns_payment_page: false,
  tenant_owns_payment_session_endpoints: false,
  tenant_calls_gateway_payment_session_api_directly: false,
  tenant_session_reference: "gateway-hosted session only",
};
export const requiredSettings = [
  "GUARD_INGEST_API_KEY",
  "TENANT_PAYMENT_RETURN_SECRET or TENANT_PAYMENT_RETURN_SECRET_REF",
];
export const paymentResponsibilities = [
  "keep gateway-managed payment lane configured",
  "do not implement a tenant payment page for this mode",
  "reuse gateway-hosted checkout returned by the platform",
];
export const paymentEndpoints = [];

export const referenceEndpointGroup = {
  key: "gateway_managed_payment_reference",
  label: "Gateway-managed payment reference",
  when_to_use:
    "Use this when the tenant keeps the first-lane managed payment flow and the gateway owns checkout orchestration.",
  endpoints: [],
  notes: [
    "Existing xapps use the gateway-hosted payment page for this mode.",
    "The tenant backend participates through guard execution and tenant configuration, not through a tenant payment page.",
  ],
};

export async function buildPaymentUrl(input, runtime = {}) {
  return buildGatewayManagedPaymentUrl(input, runtime);
}

export async function registerRoutes() {}
