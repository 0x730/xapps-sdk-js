function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readPaymentEvidenceFromLocation(): Record<string, unknown> | null {
  if (typeof window === "undefined" || !window.location) return null;
  const params = new URLSearchParams(window.location.search || "");
  const contract = String(params.get("xapps_payment_contract") || "").trim();
  const paymentSessionId = String(params.get("xapps_payment_session_id") || "").trim();
  const status = String(params.get("xapps_payment_status") || "")
    .trim()
    .toLowerCase();
  const receiptId = String(params.get("xapps_payment_receipt_id") || "").trim();
  const amount = String(params.get("xapps_payment_amount") || "").trim();
  const currency = String(params.get("xapps_payment_currency") || "")
    .trim()
    .toUpperCase();
  const ts = String(params.get("xapps_payment_ts") || "").trim();
  const issuer = String(params.get("xapps_payment_issuer") || "")
    .trim()
    .toLowerCase();
  const xappId = String(params.get("xapp_id") || params.get("xapps_payment_xapp_id") || "").trim();
  const toolName = String(
    params.get("tool_name") || params.get("xapps_payment_tool_name") || "",
  ).trim();
  const authorityLane = String(params.get("xapps_payment_authority_lane") || "")
    .trim()
    .toLowerCase();
  const signingLane = String(params.get("xapps_payment_signing_lane") || "")
    .trim()
    .toLowerCase();
  const resolverSource = String(params.get("xapps_payment_resolver_source") || "").trim();
  const subjectId = String(params.get("xapps_payment_subject_id") || "").trim();
  const installationId = String(params.get("xapps_payment_installation_id") || "").trim();
  const clientId = String(params.get("xapps_payment_client_id") || "").trim();
  const sig = String(params.get("xapps_payment_sig") || "").trim();
  if (
    !contract ||
    !paymentSessionId ||
    !status ||
    !receiptId ||
    !amount ||
    !currency ||
    !ts ||
    !issuer ||
    !sig
  ) {
    return null;
  }
  return {
    contract,
    payment_session_id: paymentSessionId,
    status,
    receipt_id: receiptId,
    amount,
    currency,
    ts,
    issuer,
    ...(xappId ? { xapp_id: xappId } : {}),
    ...(toolName ? { tool_name: toolName } : {}),
    ...(authorityLane ? { authority_lane: authorityLane } : {}),
    ...(signingLane ? { signing_lane: signingLane } : {}),
    ...(resolverSource ? { resolver_source: resolverSource } : {}),
    ...(subjectId ? { subject_id: subjectId } : {}),
    ...(installationId ? { installation_id: installationId } : {}),
    ...(clientId ? { client_id: clientId } : {}),
    sig,
  };
}

export function hasReturnedPaidPaymentEvidence(): boolean {
  const evidence = readPaymentEvidenceFromLocation();
  if (!evidence) return false;
  return (
    String(evidence.status || "")
      .trim()
      .toLowerCase() === "paid"
  );
}

function isPaymentGuardKind(guard: unknown): boolean {
  const record = asRecord(guard);
  const action = asRecord(record.action);
  const kind = String(action.kind || record.reason || "")
    .trim()
    .toLowerCase();
  return kind === "complete_payment" || kind === "payment_required";
}

function getGuardSlug(guard: unknown): string {
  const record = asRecord(guard);
  return String(record.guardSlug || asRecord(record.guard).slug || "").trim();
}

export function attachReturnedPaymentEvidence(
  guardOrchestration: Record<string, unknown> | undefined,
  guard: unknown,
): Record<string, unknown> {
  const base =
    guardOrchestration && typeof guardOrchestration === "object" ? { ...guardOrchestration } : {};
  if (!isPaymentGuardKind(guard)) return base;
  const guardSlug = getGuardSlug(guard);
  if (!guardSlug) return base;
  const evidence = readPaymentEvidenceFromLocation();
  if (!evidence || !hasReturnedPaidPaymentEvidence()) return base;
  const current = asRecord(base[guardSlug]);
  return {
    ...base,
    [guardSlug]: {
      ...current,
      payment: evidence,
    },
  };
}
