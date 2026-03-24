// @ts-nocheck
import { buildModeHostedGatewayPaymentUrl, extractHostedPaymentSessionId } from "../../../index.js";

export async function buildPaymentUrl(input, runtime = {}) {
  return buildModeHostedGatewayPaymentUrl(
    input,
    {
      fallbackIssuer: "tenant_delegated",
      storedIssuer: "tenant_delegated",
    },
    runtime,
  );
}

export { extractHostedPaymentSessionId };
