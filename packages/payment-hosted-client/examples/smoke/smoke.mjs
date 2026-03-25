import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const examplesDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(examplesDir, "..", "..");
const entryFile = path.resolve(pkgDir, "dist", "index.js");
const { createHostedPaymentClient } = await import(pathToFileURL(entryFile).href);

const client = createHostedPaymentClient({
  fetchImpl: async (url) =>
    new Response(
      JSON.stringify({
        result: {
          payment_session_id: "pay_123",
          accepts: [{ scheme: "mock" }],
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
});

const session = await client.getSession({ paymentSessionId: "pay_123" });
if (session.payment_session_id !== "pay_123") {
  throw new Error("Unexpected session result from hosted payment client smoke");
}

console.log("[payment-hosted-client smoke] fetch contract works");
