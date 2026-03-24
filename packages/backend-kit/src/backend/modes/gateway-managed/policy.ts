// @ts-nocheck
import { resolveAllowedIssuers, resolveExpectedPaymentIssuer } from "./policyContext.js";
import {
  buildPaymentPolicyAllowedResult,
  buildPaymentPolicyBlockedResult,
  resolvePolicyRequestCommon,
} from "../../policies/common.js";
import { extractHostedPaymentSessionId } from "./paymentSession.js";
import { buildPaymentUrl, paymentMode } from "./payment.js";

export const policyResponsibilities = [
  "verify signed payment evidence for the gateway-managed lane",
  "block and return the gateway-hosted payment action when evidence is missing",
];
export const policyEndpoints = [
  {
    method: "POST",
    path: "/xapps/requests",
    purpose: "Runs the tenant payment policy for gateway-managed xapps.",
  },
];

function buildAllowedResult(input) {
  return buildPaymentPolicyAllowedResult(input, { paymentMode });
}

export async function buildBlockedResult(input, runtime = {}) {
  return buildPaymentPolicyBlockedResult(input, {
    buildPaymentUrl: (payload) => buildPaymentUrl(payload, runtime),
    extractHostedPaymentSessionId,
    modeMeta: { paymentMode },
  });
}

export async function resolvePolicyResult(input, runtime = {}) {
  if (input.paidByVerifiedEvidence && !input.verificationFailure) {
    return buildAllowedResult(input);
  }
  return buildBlockedResult(input, runtime);
}

export async function resolvePolicyRequest(payloadInput, { log, paymentRuntime = {} }) {
  return resolvePolicyRequestCommon({
    payloadInput,
    log,
    resolveAllowedIssuers,
    resolveExpectedPaymentIssuer,
    resolveModeResult: resolvePolicyResult,
    paymentRuntime,
  });
}
