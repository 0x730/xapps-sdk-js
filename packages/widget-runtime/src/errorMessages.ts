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

function renderActionHint(action: Record<string, unknown>, locale?: string | null): string {
  const kind = readString(action.kind);
  if (!kind) return "";
  const url = readString(action.url);
  const suffix = url ? ` (${url})` : "";
  if (kind === "upgrade_subscription") {
    return translateWidgetRuntime("action_upgrade_subscription", locale, { suffix });
  }
  if (kind === "complete_payment") {
    return translateWidgetRuntime("action_complete_payment", locale, { suffix });
  }
  if (kind === "step_up_auth") {
    const method = readString(action.method);
    const detail = method ? ` (${method})` : "";
    return translateWidgetRuntime("action_complete_step_up_authentication", locale, {
      suffix: `${detail}${suffix}`,
    });
  }
  if (kind === "confirm_action") {
    const msg = readString(action.message);
    return msg
      ? translateWidgetRuntime("action_confirm_action_message", locale, { message: msg })
      : translateWidgetRuntime("action_confirm_action", locale);
  }
  if (kind === "complete_subject_profile") {
    const title = readString(action.title);
    return title
      ? translateWidgetRuntime("action_custom", locale, { title })
      : translateWidgetRuntime("action_complete_subject_profile", locale);
  }
  return "";
}

function resolvePaymentLockHint(input: {
  action: Record<string, unknown>;
  reason: string;
  paymentAttemptState: string;
  finalityState: string;
  locale?: string | null;
}): string {
  const actionKind = readString(input.action.kind).toLowerCase();
  if (!(actionKind === "complete_payment" || actionKind === "payment_required")) return "";
  if (input.finalityState === "confirmed_paid") {
    return translateWidgetRuntime("payment_confirmed_refresh_retry", input.locale);
  }
  if (input.finalityState === "still_pending") {
    return translateWidgetRuntime("payment_pending_retry_confirm", input.locale);
  }
  if (input.finalityState === "failed") {
    return translateWidgetRuntime("payment_not_settled_new_attempt", input.locale);
  }
  if (input.paymentAttemptState === "requires_action") {
    return translateWidgetRuntime("payment_requires_additional_action", input.locale);
  }
  if (input.paymentAttemptState === "failed") {
    return translateWidgetRuntime("payment_attempt_failed", input.locale);
  }
  if (input.paymentAttemptState === "replayed" || input.reason === "payment_receipt_already_used") {
    return translateWidgetRuntime("payment_evidence_used", input.locale);
  }
  if (input.reason === "payment_evidence_missing" || input.reason === "payment_required") {
    return translateWidgetRuntime("payment_required_for_request", input.locale);
  }
  return "";
}

export function formatRequestErrorMessage(
  data: unknown,
  status: number,
  locale?: string | null,
): string {
  const body = asRecord(data);
  const text = typeof data === "string" ? data.trim() : "";
  const ctx = readGuardBlockedContext(data);
  const message = ctx.message || readString(body.message) || text || `HTTP ${status}`;
  const details: string[] = [];
  if (ctx.code === "GUARD_BLOCKED" || ctx.guardSlug || ctx.reason) {
    if (ctx.guardSlug) details.push(`guard=${ctx.guardSlug}`);
    if (ctx.reason) details.push(`reason=${ctx.reason}`);
    const actionHint = renderActionHint(ctx.action, locale);
    if (actionHint) details.push(actionHint);
    const lockHint = resolvePaymentLockHint({
      action: ctx.action,
      reason: ctx.reason,
      paymentAttemptState: ctx.paymentAttemptState,
      finalityState: ctx.finalityState,
      locale,
    });
    if (lockHint) details.push(lockHint);
  }
  return details.length > 0 ? `${message} (${details.join("; ")})` : message;
}
import { translateWidgetRuntime } from "./i18n";
