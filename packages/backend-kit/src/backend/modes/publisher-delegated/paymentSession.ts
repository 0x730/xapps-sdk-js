// @ts-nocheck
import { buildModeHostedGatewayPaymentUrl, extractHostedPaymentSessionId } from "../../../index.js";

export async function buildPaymentUrl(input, runtime = {}) {
  return buildModeHostedGatewayPaymentUrl(
    input,
    {
      fallbackIssuer: "publisher_delegated",
      storedIssuer: "publisher_delegated",
    },
    runtime,
  );
}

export { extractHostedPaymentSessionId };
