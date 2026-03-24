// @ts-nocheck
import {
  buildPaymentAction,
  hasUpstreamPaymentVerified,
  normalizeAllowedIssuers,
  resolveMergedContext,
  resolvePriceAmount,
} from "../../policies/common.js";

export { buildPaymentAction, hasUpstreamPaymentVerified, resolveMergedContext, resolvePriceAmount };

function readOwnerIssuer(paymentSettings) {
  const raw = String(paymentSettings?.ownerIssuer || "")
    .trim()
    .toLowerCase();
  return raw === "publisher" ? "publisher" : "tenant";
}

export function resolveExpectedPaymentIssuer(_guardConfig, paymentSettings = {}) {
  return readOwnerIssuer(paymentSettings);
}

export function resolveAllowedIssuers(guardConfig, paymentSettings = {}) {
  return normalizeAllowedIssuers(guardConfig, readOwnerIssuer(paymentSettings));
}
