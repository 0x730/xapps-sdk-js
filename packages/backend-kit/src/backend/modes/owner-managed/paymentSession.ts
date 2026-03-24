// @ts-nocheck
import { buildModeHostedGatewayPaymentUrl, extractHostedPaymentSessionId } from "../../../index.js";

export async function buildPaymentUrl(input, runtime = {}) {
  const ownerIssuer =
    String(runtime?.paymentSettings?.ownerIssuer || "")
      .trim()
      .toLowerCase() === "publisher"
      ? "publisher"
      : "tenant";
  return buildModeHostedGatewayPaymentUrl(
    input,
    {
      fallbackIssuer: ownerIssuer,
      storedIssuer: ownerIssuer,
      allowDefaultSecretFallback: true,
    },
    runtime,
  );
}

export { extractHostedPaymentSessionId };
