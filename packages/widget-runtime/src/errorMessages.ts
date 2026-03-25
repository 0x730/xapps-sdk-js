function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readGuardBlockedContext(data: unknown): {
  code: string;
  message: string;
  guardSlug: string;
  reason: string;
  action: Record<string, unknown>;
  paymentAttemptState: string;
  finalityState: string;
} {
  const body = asRecord(data);
  const envelope = asRecord(body.error);
  const guard = asRecord(body.guard);
  const details = asRecord(body.details);
  const guardDetails = asRecord(guard.details);
  const mergedDetails = Object.keys(details).length > 0 ? details : guardDetails;
  const monetizationState = asRecord((mergedDetails as any).monetization_state);
  const action = asRecord(body.action);
  const guardAction = asRecord(guard.action);
  const code = readString(body.code) || readString(envelope.code);
  const message = readString(body.message) || readString(envelope.message);
  const guardSlug =
    readString(body.guardSlug) || readString(body.guard_slug) || readString(guard.slug);
  const reason =
    readString(body.reason) || readString(body.guard_reason) || readString(guard.reason);

  return {
    code,
    message,
    guardSlug,
    reason,
    action: Object.keys(action).length > 0 ? action : guardAction,
    paymentAttemptState: readString(monetizationState.payment_attempt_state).toLowerCase(),
    finalityState: readString(
      (body as any).finality_state || monetizationState.finality_state,
    ).toLowerCase(),
  };
}

function renderActionHint(action: Record<string, unknown>): string {
  const kind = readString(action.kind);
  if (!kind) return "";
  const url = readString(action.url);
  if (kind === "upgrade_subscription") {
    return `Action: upgrade subscription${url ? ` (${url})` : ""}`;
  }
  if (kind === "complete_payment") {
    return `Action: complete payment${url ? ` (${url})` : ""}`;
  }
  if (kind === "step_up_auth") {
    const method = readString(action.method);
    const detail = method ? ` (${method})` : "";
    return `Action: complete step-up authentication${detail}${url ? ` (${url})` : ""}`;
  }
  if (kind === "confirm_action") {
    const msg = readString(action.message);
    return msg ? `Action: confirm action (${msg})` : "Action: confirm action";
  }
  if (kind === "complete_subject_profile") {
    const title = readString(action.title);
    return title ? `Action: ${title}` : "Action: complete subject profile";
  }
  return "";
}

function resolvePaymentLockHint(input: {
  action: Record<string, unknown>;
  reason: string;
  paymentAttemptState: string;
  finalityState: string;
}): string {
  const actionKind = readString(input.action.kind).toLowerCase();
  if (!(actionKind === "complete_payment" || actionKind === "payment_required")) return "";
  if (input.finalityState === "confirmed_paid") {
    return "Payment confirmed. Refresh and retry.";
  }
  if (input.finalityState === "still_pending") {
    return "Payment still pending at provider. Retry confirm shortly.";
  }
  if (input.finalityState === "failed") {
    return "Payment not settled. Complete a new payment attempt.";
  }
  if (input.paymentAttemptState === "requires_action") {
    return "Payment requires additional action. Complete payment to continue.";
  }
  if (input.paymentAttemptState === "failed") {
    return "Last payment attempt failed. Complete payment to continue.";
  }
  if (input.paymentAttemptState === "replayed" || input.reason === "payment_receipt_already_used") {
    return "Payment evidence already used. Start a new payment attempt.";
  }
  if (input.reason === "payment_evidence_missing" || input.reason === "payment_required") {
    return "Payment is required before this request can proceed.";
  }
  return "";
}

export function formatRequestErrorMessage(data: unknown, status: number): string {
  const body = asRecord(data);
  const text = typeof data === "string" ? data.trim() : "";
  const ctx = readGuardBlockedContext(data);
  const message = ctx.message || readString(body.message) || text || `HTTP ${status}`;
  const details: string[] = [];
  if (ctx.code === "GUARD_BLOCKED" || ctx.guardSlug || ctx.reason) {
    if (ctx.guardSlug) details.push(`guard=${ctx.guardSlug}`);
    if (ctx.reason) details.push(`reason=${ctx.reason}`);
    const actionHint = renderActionHint(ctx.action);
    if (actionHint) details.push(actionHint);
    const lockHint = resolvePaymentLockHint({
      action: ctx.action,
      reason: ctx.reason,
      paymentAttemptState: ctx.paymentAttemptState,
      finalityState: ctx.finalityState,
    });
    if (lockHint) details.push(lockHint);
  }
  return details.length > 0 ? `${message} (${details.join("; ")})` : message;
}
