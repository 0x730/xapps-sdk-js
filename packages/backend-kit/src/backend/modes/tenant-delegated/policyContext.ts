// @ts-nocheck
import {
  buildPaymentAction,
  hasUpstreamPaymentVerified,
  normalizeAllowedIssuers,
  resolveMergedContext,
  resolvePriceAmount,
} from "../../policies/common.js";

export { buildPaymentAction, hasUpstreamPaymentVerified, resolveMergedContext, resolvePriceAmount };

export function resolveExpectedPaymentIssuer() {
  return "tenant_delegated";
}

export function resolveAllowedIssuers(guardConfig) {
  return normalizeAllowedIssuers(guardConfig, "tenant_delegated");
}
