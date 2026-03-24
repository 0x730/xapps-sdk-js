// @ts-nocheck
import { buildModeHostedGatewayPaymentUrl, extractHostedPaymentSessionId } from "../../../index.js";

export async function buildPaymentUrl(input, runtime = {}) {
  return buildModeHostedGatewayPaymentUrl(
    input,
    {
      fallbackIssuer: "gateway",
      storedIssuer: "gateway",
    },
    runtime,
  );
}

export { extractHostedPaymentSessionId };
