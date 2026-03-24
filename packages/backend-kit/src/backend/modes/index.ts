// @ts-nocheck
import * as gatewayManagedPayment from "./gateway-managed/payment.js";
import * as gatewayManagedPolicy from "./gateway-managed/policy.js";
import * as tenantDelegatedPayment from "./tenant-delegated/payment.js";
import * as tenantDelegatedPolicy from "./tenant-delegated/policy.js";
import * as publisherDelegatedPayment from "./publisher-delegated/payment.js";
import * as publisherDelegatedPolicy from "./publisher-delegated/policy.js";
import * as ownerManagedPayment from "./owner-managed/payment.js";
import * as ownerManagedPolicy from "./owner-managed/policy.js";

const BACKEND_MODE_HANDLERS = {
  gateway_managed: {
    ...gatewayManagedPayment,
    ...gatewayManagedPolicy,
  },
  tenant_delegated: {
    ...tenantDelegatedPayment,
    ...tenantDelegatedPolicy,
  },
  publisher_delegated: {
    ...publisherDelegatedPayment,
    ...publisherDelegatedPolicy,
  },
  owner_managed: {
    ...ownerManagedPayment,
    ...ownerManagedPolicy,
  },
};

const BACKEND_MODE_ENDPOINT_GROUPS = [
  gatewayManagedPayment.referenceEndpointGroup,
  tenantDelegatedPayment.referenceEndpointGroup,
  publisherDelegatedPayment.referenceEndpointGroup,
  ownerManagedPayment.referenceEndpointGroup,
];

const BACKEND_MODE_REFERENCE_DETAILS = [
  {
    key: "gateway_managed",
    label: gatewayManagedPayment.paymentModeLabel,
    description: gatewayManagedPayment.paymentModeDescription,
    payment_session_model: gatewayManagedPayment.paymentSessionModel,
    required_settings: gatewayManagedPayment.requiredSettings,
    payment_responsibilities: gatewayManagedPayment.paymentResponsibilities,
    payment_endpoints: gatewayManagedPayment.paymentEndpoints,
    policy_responsibilities: gatewayManagedPolicy.policyResponsibilities,
    policy_endpoints: gatewayManagedPolicy.policyEndpoints,
    guide_path: "packages/backend-kit/src/backend/modes/gateway-managed/payment.ts",
  },
  {
    key: "tenant_delegated",
    label: tenantDelegatedPayment.paymentModeLabel,
    description: tenantDelegatedPayment.paymentModeDescription,
    payment_session_model: tenantDelegatedPayment.paymentSessionModel,
    required_settings: tenantDelegatedPayment.requiredSettings,
    payment_responsibilities: tenantDelegatedPayment.paymentResponsibilities,
    payment_endpoints: tenantDelegatedPayment.paymentEndpoints,
    policy_responsibilities: tenantDelegatedPolicy.policyResponsibilities,
    policy_endpoints: tenantDelegatedPolicy.policyEndpoints,
    guide_path: "packages/backend-kit/src/backend/modes/tenant-delegated/payment.ts",
  },
  {
    key: "publisher_delegated",
    label: publisherDelegatedPayment.paymentModeLabel,
    description: publisherDelegatedPayment.paymentModeDescription,
    payment_session_model: publisherDelegatedPayment.paymentSessionModel,
    required_settings: publisherDelegatedPayment.requiredSettings,
    payment_responsibilities: publisherDelegatedPayment.paymentResponsibilities,
    payment_endpoints: publisherDelegatedPayment.paymentEndpoints,
    policy_responsibilities: publisherDelegatedPolicy.policyResponsibilities,
    policy_endpoints: publisherDelegatedPolicy.policyEndpoints,
    guide_path: "packages/backend-kit/src/backend/modes/publisher-delegated/payment.ts",
  },
  {
    key: "owner_managed",
    reference_key: ownerManagedPayment.referenceMode,
    label: ownerManagedPayment.paymentModeLabel,
    description: ownerManagedPayment.paymentModeDescription,
    payment_session_model: ownerManagedPayment.paymentSessionModel,
    required_settings: ownerManagedPayment.requiredSettings,
    payment_responsibilities: ownerManagedPayment.paymentResponsibilities,
    payment_endpoints: ownerManagedPayment.paymentEndpoints,
    policy_responsibilities: ownerManagedPolicy.policyResponsibilities,
    policy_endpoints: ownerManagedPolicy.policyEndpoints,
    guide_path: "packages/backend-kit/src/backend/modes/owner-managed/payment.ts",
  },
];

export const ALL_BACKEND_MODE_KEYS = Object.freeze(Object.keys(BACKEND_MODE_HANDLERS));

function normalizeModeKey(value) {
  const mode = String(value || "")
    .trim()
    .toLowerCase();
  if (mode === "tenant_managed") return "owner_managed";
  return mode;
}

export function normalizeEnabledBackendModes(enabledModes) {
  if (!Array.isArray(enabledModes) || enabledModes.length === 0) {
    return [...ALL_BACKEND_MODE_KEYS];
  }
  const selected = [];
  for (const value of enabledModes) {
    const mode = normalizeModeKey(value);
    if (ALL_BACKEND_MODE_KEYS.includes(mode) && !selected.includes(mode)) {
      selected.push(mode);
    }
  }
  return selected.length > 0 ? selected : [...ALL_BACKEND_MODE_KEYS];
}

export function getBackendModeHandlers(enabledModes) {
  const selected = normalizeEnabledBackendModes(enabledModes);
  return Object.fromEntries(selected.map((key) => [key, BACKEND_MODE_HANDLERS[key]]));
}

export function getBackendModeEndpointGroups(enabledModes) {
  const selected = new Set(normalizeEnabledBackendModes(enabledModes));
  return BACKEND_MODE_ENDPOINT_GROUPS.filter((group) => {
    if (group.key === "gateway_managed_payment_reference") return selected.has("gateway_managed");
    if (group.key === "tenant_delegated_payment_reference") return selected.has("tenant_delegated");
    if (group.key === "publisher_delegated_payment_reference") {
      return selected.has("publisher_delegated");
    }
    if (group.key === "owner_managed_payment_reference") return selected.has("owner_managed");
    return true;
  });
}

export function getBackendModeReferenceDetails(enabledModes) {
  const selected = new Set(normalizeEnabledBackendModes(enabledModes));
  return BACKEND_MODE_REFERENCE_DETAILS.filter((detail) => selected.has(detail.key));
}

function resolveCanonicalPaymentMode(payloadInput) {
  const payload = payloadInput && typeof payloadInput === "object" ? payloadInput : {};
  const guard = payload.guard && typeof payload.guard === "object" ? payload.guard : {};
  const guardConfig = guard.config && typeof guard.config === "object" ? guard.config : {};
  const mode = String(guardConfig?.payment_issuer_mode || guardConfig?.paymentIssuerMode || "")
    .trim()
    .toLowerCase();
  if (mode === "gateway_managed") return "gateway_managed";
  if (mode === "tenant_delegated") return "tenant_delegated";
  if (mode === "publisher_delegated") return "publisher_delegated";
  return "owner_managed";
}

export async function resolveBackendPaymentPolicy(
  payloadInput,
  { log, enabledModes, paymentRuntime = {} } = {},
) {
  const paymentMode = resolveCanonicalPaymentMode(payloadInput);
  const normalizedEnabledModes = normalizeEnabledBackendModes(enabledModes);
  if (!normalizedEnabledModes.includes(paymentMode)) {
    return {
      allowed: false,
      reason: "payment_mode_not_enabled",
      message: "Payment mode is not enabled for this backend.",
      details: {
        payment_mode: paymentMode,
        enabled_payment_modes: normalizedEnabledModes,
      },
    };
  }
  const backendModeHandlers = getBackendModeHandlers(normalizedEnabledModes);
  const backendModeHandler =
    backendModeHandlers[paymentMode] ||
    backendModeHandlers.owner_managed ||
    BACKEND_MODE_HANDLERS.owner_managed;
  return backendModeHandler.resolvePolicyRequest(payloadInput, { log, paymentRuntime });
}
