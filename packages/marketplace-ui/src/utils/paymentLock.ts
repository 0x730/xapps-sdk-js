export type PaymentReconcileState =
  | "none"
  | "confirming_payment"
  | "still_pending"
  | "confirmed_paid"
  | "failed";

export type PaymentLockResolution = {
  isLocked: boolean;
  reason: string;
  actionKind: string;
  actionUrl: string;
  ctaLabel: string;
  message: string;
  paymentSessionId: string | null;
  paymentAttemptState: string;
  reconcileState: PaymentReconcileState;
  monetizationState: Record<string, unknown> | null;
};

type PaymentLockTranslate = (key: string, fallback: string) => string;
type PaymentLockOptions = {
  reconcileState?: PaymentReconcileState | null;
  requestStatus?: string | null;
  paymentStatus?: string | null;
  t?: PaymentLockTranslate;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveAction(summary: Record<string, unknown>): Record<string, unknown> {
  const topAction = asRecord(summary.action);
  if (Object.keys(topAction).length > 0) return topAction;
  const details = asRecord(summary.details);
  const detailsAction = asRecord(details.action);
  if (Object.keys(detailsAction).length > 0) return detailsAction;
  const guard = asRecord(summary.guard);
  const guardAction = asRecord(guard.action);
  if (Object.keys(guardAction).length > 0) return guardAction;
  return {};
}

function normalizeActionKind(raw: string): string {
  return readString(raw).toLowerCase();
}

function resolveText(t: PaymentLockTranslate | undefined, key: string, fallback: string): string {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function isSettledPaymentStatus(value: unknown): boolean {
  const normalized = readString(value).toLowerCase();
  return (
    normalized === "paid" ||
    normalized === "settled" ||
    normalized === "succeeded" ||
    normalized === "completed"
  );
}

function resolveCtaLabel(actionKind: string, t?: PaymentLockTranslate): string {
  if (actionKind === "complete_payment") {
    return resolveText(t, "payment_lock.complete_payment", "Complete Payment");
  }
  if (actionKind === "payment_required") {
    return resolveText(t, "payment_lock.complete_payment", "Complete Payment");
  }
  return resolveText(t, "payment_lock.continue", "Continue");
}

function resolveLockMessage(
  reason: string,
  paymentAttemptState: string,
  reconcileState: PaymentReconcileState,
  t?: PaymentLockTranslate,
): string {
  if (reconcileState === "confirming_payment") {
    return resolveText(
      t,
      "payment_lock.confirming_payment_finality",
      "Confirming payment finality with provider.",
    );
  }
  if (reconcileState === "still_pending") {
    return resolveText(
      t,
      "payment_lock.pending_retry_confirm",
      "Payment is still pending at provider. Retry confirm in a few seconds.",
    );
  }
  if (reconcileState === "confirmed_paid") {
    return resolveText(
      t,
      "payment_lock.confirmed_refresh",
      "Payment is confirmed. Refresh to continue.",
    );
  }
  if (reconcileState === "failed") {
    return resolveText(
      t,
      "payment_lock.not_settled_new_attempt",
      "Payment is not settled. Complete a new payment attempt.",
    );
  }
  const attempt = readString(paymentAttemptState).toLowerCase();
  if (attempt === "requires_action") {
    return resolveText(
      t,
      "payment_lock.requires_additional_action",
      "Payment requires additional action. Complete payment to continue.",
    );
  }
  if (attempt === "failed") {
    return resolveText(
      t,
      "payment_lock.attempt_failed",
      "Last payment attempt failed. Complete payment to continue.",
    );
  }
  if (attempt === "replayed") {
    return resolveText(
      t,
      "payment_lock.evidence_used",
      "Payment evidence was already used. Start a new payment attempt.",
    );
  }
  if (reason === "payment_receipt_already_used") {
    return resolveText(
      t,
      "payment_lock.evidence_consumed",
      "Payment evidence was already consumed. Start a new payment attempt.",
    );
  }
  if (reason === "payment_evidence_missing" || reason === "payment_required") {
    return resolveText(
      t,
      "payment_lock.required_before_request",
      "Payment is required before this request can proceed.",
    );
  }
  return resolveText(
    t,
    "payment_lock.required_before_request",
    "Payment is required before this request can proceed.",
  );
}

export function resolvePaymentLockStateFromGuardSummary(
  summaryInput: unknown,
  options?: PaymentLockOptions,
): PaymentLockResolution {
  const summary = asRecord(summaryInput);
  const action = resolveAction(summary);
  const actionKind = normalizeActionKind(String(action.kind ?? summary.reason ?? ""));
  const actionUrl = readString(action.url);
  const reason = readString(summary.reason).toLowerCase();
  const monetizationState = asRecord(summary.monetization_state);
  const paymentSessionId =
    readString(monetizationState.payment_session_id) || readString(action.payment_session_id);
  const paymentAttemptState = readString(monetizationState.payment_attempt_state).toLowerCase();
  const reconcileState = ((): PaymentReconcileState => {
    const candidate = readString(options?.reconcileState).toLowerCase();
    if (
      candidate === "confirming_payment" ||
      candidate === "still_pending" ||
      candidate === "confirmed_paid" ||
      candidate === "failed"
    ) {
      return candidate;
    }
    return "none";
  })();
  const isPaymentKind = actionKind === "complete_payment" || actionKind === "payment_required";
  const isPaymentReason =
    reason === "payment_required" ||
    reason === "payment_evidence_missing" ||
    reason === "payment_receipt_already_used";
  const requestStatus = readString(options?.requestStatus).toUpperCase();
  const paymentSettled = isSettledPaymentStatus(options?.paymentStatus);
  const isHeldForPayment = requestStatus === "PAYMENT_PENDING";
  const isResolvedPastHold = paymentSettled && requestStatus !== "" && !isHeldForPayment;
  const isLocked = !isResolvedPastHold && (isPaymentKind || isPaymentReason);

  return {
    isLocked,
    reason,
    actionKind,
    actionUrl,
    ctaLabel: resolveCtaLabel(actionKind, options?.t),
    message: resolveLockMessage(reason, paymentAttemptState, reconcileState, options?.t),
    paymentSessionId: paymentSessionId || null,
    paymentAttemptState: paymentAttemptState || "unknown",
    reconcileState,
    monetizationState: Object.keys(monetizationState).length > 0 ? monetizationState : null,
  };
}
