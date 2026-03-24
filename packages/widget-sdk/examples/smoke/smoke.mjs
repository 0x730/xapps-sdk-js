import {
  hasPaymentEvidence,
  isPaymentEvidenceConsumed,
  markPaymentEvidenceConsumed,
  readPaymentEvidenceFromSearch,
} from "../../dist/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const search =
  "?xapps_payment_contract=xapps.payment.v1" +
  "&xapps_payment_session_id=ps_123" +
  "&xapps_payment_status=completed" +
  "&xapps_payment_receipt_id=rcpt_123" +
  "&xapps_payment_amount=5000" +
  "&xapps_payment_currency=usd" +
  "&xapps_payment_ts=2026-03-24T10%3A00%3A00.000Z" +
  "&xapps_payment_issuer=tenant" +
  "&xapps_payment_sig=signed" +
  "&xapp_id=xapp_123" +
  "&tool_name=issue_certificate";

const storage = {
  values: new Map(),
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  },
  setItem(key, value) {
    this.values.set(key, String(value));
  },
};

console.log("widget-sdk smoke: start");

const evidence = readPaymentEvidenceFromSearch(search);
assert(evidence, "payment evidence should parse");
assert(evidence.payment_session_id === "ps_123", "payment session id mismatch");
assert(evidence.currency === "USD", "payment currency should normalize to upper case");
assert(evidence.issuer === "tenant", "payment issuer mismatch");
assert(hasPaymentEvidence(search) === true, "hasPaymentEvidence should be true");
assert(
  isPaymentEvidenceConsumed({ evidence, storage }) === false,
  "payment evidence should start unconsumed",
);
assert(
  markPaymentEvidenceConsumed({ evidence, storage }) === true,
  "payment evidence should be marked consumed",
);
assert(
  isPaymentEvidenceConsumed({ evidence, storage }) === true,
  "payment evidence should be reported as consumed",
);

console.log("widget-sdk smoke: ok");
