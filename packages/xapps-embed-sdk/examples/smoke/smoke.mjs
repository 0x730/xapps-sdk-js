import {
  createHostApiClient,
  createHostPaymentResumeState,
} from "../../dist/xapps-embed-sdk.esm.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let capturedRequest = null;

const api = createHostApiClient({
  baseUrl: "https://tenant.example.test",
  timeoutMs: 500,
  fetchImpl: async (url, init) => {
    capturedRequest = { url: String(url), init };
    return {
      ok: true,
      status: 200,
      headers: {
        get: (key) => (String(key).toLowerCase() === "content-type" ? "application/json" : null),
      },
      async json() {
        return { subjectId: "subject_123" };
      },
      async text() {
        return "";
      },
    };
  },
});

console.log("embed-sdk smoke: start");

const apiResult = await api("/api/resolve-subject", { email: "daniel.vladescu@gmail.com" });
assert(apiResult.subjectId === "subject_123", "host api client response mismatch");
assert(
  capturedRequest?.url === "https://tenant.example.test/api/resolve-subject",
  "host api client base url resolution mismatch",
);
assert(
  String(capturedRequest?.init?.headers?.["Content-Type"] || "") === "application/json",
  "host api client should send json content type",
);

const paymentState = createHostPaymentResumeState(
  "https://host.example.test/catalog?xapps_payment_contract=xapps.payment.v1" +
    "&xapps_payment_session_id=ps_123" +
    "&xapps_payment_status=completed" +
    "&xapps_payment_receipt_id=rcpt_123" +
    "&xapps_payment_amount=5000" +
    "&xapps_payment_currency=usd" +
    "&xapps_payment_ts=2026-03-24T10%3A00%3A00.000Z" +
    "&xapps_payment_issuer=tenant" +
    "&xapps_payment_sig=signed",
);
assert(paymentState.hasInitialPaymentParams === true, "payment state should detect initial params");
assert(
  paymentState.getPendingPaymentParams().get("xapps_payment_session_id") === "ps_123",
  "payment state should expose pending params",
);
assert(
  paymentState
    .buildHostReturnUrl({ baseUrl: "https://host.example.test/catalog" })
    .includes("xapps_payment_session_id=ps_123"),
  "payment state should rebuild host return url",
);

console.log("embed-sdk smoke: ok");
