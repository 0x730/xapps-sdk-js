import { useEffect } from "react";
import type { GuardDecision, WidgetExpandResult, WidgetHostAdapter } from "./types";
import {
  getDefaultWidgetRuntimeLocale,
  resolveWidgetRuntimeText,
  translateWidgetRuntime,
} from "./i18n";
import {
  asRecord,
  normalizeExpandStage,
  normalizeOperationalSurfacePlacement,
  readBool,
  readFirstString,
  readPath,
  readString,
  readStringArray,
  readTrimmedString,
} from "./runtimeReaders";

type UiBridgeMessage = {
  type?: string;
  data?: unknown;
  payload?: unknown;
  id?: string;
  message?: unknown;
  variant?: unknown;
  title?: unknown;
  path?: unknown;
};

function tierRank(value: unknown): number {
  const tier = String(value || "")
    .trim()
    .toLowerCase();
  if (!tier) return -1;
  if (tier === "free") return 0;
  if (tier === "starter") return 1;
  if (tier === "pro") return 2;
  if (tier === "enterprise") return 3;
  const asNumber = Number(tier);
  return Number.isFinite(asNumber) ? asNumber : -1;
}

function isSettledPaymentStatus(value: unknown): boolean {
  const normalized = readTrimmedString(value).toLowerCase();
  return normalized === "paid" || normalized === "settled" || normalized === "succeeded";
}

function readMessageRecord(event: MessageEvent): UiBridgeMessage | null {
  const message = asRecord(event.data);
  return Object.keys(message).length ? (message as UiBridgeMessage) : null;
}

function readNormalizedPolicyKind(value: unknown): string {
  return readTrimmedString(value).toLowerCase();
}

function inferPolicyKind(
  guardSlug: string,
  context: Record<string, unknown>,
  config: Record<string, unknown>,
) {
  const policy = asRecord(config.policy);
  const explicit = readNormalizedPolicyKind(
    readFirstString(
      config.guard_kind,
      config.guard_type,
      config.policy_kind,
      policy.kind,
      context.guard_kind,
      context.policy_kind,
    ),
  );
  if (explicit) return explicit;
  if (["action-confirm", "platform.confirmation", "confirmation-check"].includes(guardSlug)) {
    return "confirmation";
  }
  if (["stepup-auth", "platform.step_up", "step-up-auth"].includes(guardSlug)) return "step_up";
  if (["payment-gate", "platform.payment", "payment-check"].includes(guardSlug)) return "payment";
  if (["subscription-check", "platform.subscription", "entitlement-check"].includes(guardSlug)) {
    return "subscription";
  }
  return "generic";
}

function defaultGuardDecision(message: UiBridgeMessage): GuardDecision {
  const locale = getDefaultWidgetRuntimeLocale();
  const data = asRecord(message.data ?? message.payload);
  const guardSlug = String(data.guardSlug ?? data.guard_slug ?? "").trim();
  const trigger = String(data.trigger || "before:tool_run");
  const context = asRecord(data.context);
  const config = data.config === null ? null : asRecord(data.config);
  const configRecord = config ?? {};
  const policy = asRecord(configRecord.policy);
  const kind = inferPolicyKind(guardSlug, context, configRecord);
  const defaultReason = readFirstString(policy.reason, configRecord.reason);
  const defaultMessage =
    resolveWidgetRuntimeText(policy.message, locale) ||
    resolveWidgetRuntimeText(configRecord.message, locale);
  const failReason = defaultReason || "guard_not_satisfied";
  const failMessage =
    defaultMessage || translateWidgetRuntime("guard_requirements_not_satisfied", locale);
  const details = { context, config: configRecord, policy_kind: kind };

  const passIfAny = readStringArray(policy.pass_if_any ?? configRecord.pass_if_any);
  const passIfAll = readStringArray(policy.pass_if_all ?? configRecord.pass_if_all);
  const failIfAny = readStringArray(policy.fail_if_any ?? configRecord.fail_if_any);
  if (
    failIfAny.some((p) => readBool(readPath(context, p)) || readBool(readPath(configRecord, p)))
  ) {
    return {
      guard_slug: guardSlug || "unknown",
      trigger,
      status: "failed",
      satisfied: false,
      reason: defaultReason || "guard_condition_failed",
      message: failMessage,
      details,
    };
  }
  if (passIfAny.length > 0 || passIfAll.length > 0) {
    const anyPassed =
      passIfAny.length === 0 ||
      passIfAny.some((p) => readBool(readPath(context, p)) || readBool(readPath(configRecord, p)));
    const allPassed = passIfAll.every(
      (p) => readBool(readPath(context, p)) || readBool(readPath(configRecord, p)),
    );
    if (anyPassed && allPassed) {
      return { guard_slug: guardSlug || "unknown", trigger, status: "passed", satisfied: true };
    }
  }

  if (kind === "confirmation") {
    const confirmed =
      readBool(context.confirmed) ||
      readBool(asRecord(context.confirmation).confirmed) ||
      readBool(configRecord.confirmed) ||
      readBool(asRecord(configRecord.confirmation).confirmed);
    if (confirmed) return { guard_slug: guardSlug, trigger, status: "passed", satisfied: true };
    return {
      guard_slug: guardSlug || "unknown",
      trigger,
      status: "failed",
      satisfied: false,
      reason: defaultReason || "confirmation_required",
      message:
        defaultMessage || translateWidgetRuntime("confirmation_required_before_continuing", locale),
      details,
    };
  }

  if (kind === "step_up" || kind === "stepup") {
    const verified =
      readBool(context.step_up_verified) ||
      readBool(context.stepUpVerified) ||
      readBool(configRecord.step_up_verified) ||
      readBool(configRecord.verified);
    if (verified) return { guard_slug: guardSlug, trigger, status: "passed", satisfied: true };
    return {
      guard_slug: guardSlug || "unknown",
      trigger,
      status: "failed",
      satisfied: false,
      reason: defaultReason || "step_up_required",
      message: defaultMessage || translateWidgetRuntime("step_up_authentication_required", locale),
      details,
    };
  }

  if (kind === "payment") {
    const trustedEvidenceVerified =
      readBool(context.__xapps_payment_evidence_verified) ||
      readBool(configRecord.__xapps_payment_evidence_verified);
    const paidSignalsPresent =
      readBool(context.paid) ||
      readBool(context.payment_verified) ||
      isSettledPaymentStatus(context.payment_status) ||
      readBool(configRecord.paid) ||
      readBool(configRecord.payment_verified) ||
      isSettledPaymentStatus(configRecord.payment_status);
    const paid = trustedEvidenceVerified && paidSignalsPresent;
    if (paid) return { guard_slug: guardSlug, trigger, status: "passed", satisfied: true };
    return {
      guard_slug: guardSlug || "unknown",
      trigger,
      status: "failed",
      satisfied: false,
      reason: defaultReason || "payment_required",
      message:
        defaultMessage || translateWidgetRuntime("payment_required_before_continuing", locale),
      details,
    };
  }

  if (kind === "subscription") {
    const required = context.required_tier ?? configRecord.required_tier ?? configRecord.min_tier;
    const current = context.current_tier ?? configRecord.current_tier;
    if (!required) {
      return { guard_slug: guardSlug || "unknown", trigger, status: "passed", satisfied: true };
    }
    const currentRank = tierRank(current);
    const requiredRank = tierRank(required);
    if (currentRank >= 0 && requiredRank >= 0 && currentRank >= requiredRank) {
      return { guard_slug: guardSlug || "unknown", trigger, status: "passed", satisfied: true };
    }
    return {
      guard_slug: guardSlug || "unknown",
      trigger,
      status: "failed",
      satisfied: false,
      reason: defaultReason || "subscription_missing",
      message: defaultMessage || translateWidgetRuntime("subscription_tier_insufficient", locale),
      details: { ...details, current_tier: current ?? null, required_tier: required },
    };
  }

  if (kind === "allow" || kind === "pass") {
    return { guard_slug: guardSlug || "unknown", trigger, status: "passed", satisfied: true };
  }
  if (kind === "deny" || kind === "fail") {
    return {
      guard_slug: guardSlug || "unknown",
      trigger,
      status: "failed",
      satisfied: false,
      reason: failReason,
      message: failMessage,
      details,
    };
  }

  return {
    guard_slug: guardSlug || "unknown",
    trigger,
    status: "failed",
    satisfied: false,
    reason: defaultReason || "unsupported_guard_slug",
    message:
      defaultMessage ||
      translateWidgetRuntime("unsupported_guard", locale, { guardSlug: guardSlug || "unknown" }),
    details,
  };
}

/**
 * Handles UI bridge messages emitted by widget iframes/builders.
 *
 * This is intentionally host-driven: all effects are delegated to the injected `host` adapter.
 */
export function useWidgetUiBridge(host: WidgetHostAdapter) {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = readMessageRecord(event);
      if (!msg || typeof msg !== "object") return;

      const type = readString(msg.type);
      const data = msg.data;
      const payload = msg.payload;
      const id = readString(msg.id);
      const dataRecord = asRecord(data);
      const payloadRecord = asRecord(payload);
      const nestedDataPayload = asRecord(dataRecord.payload);

      if (type === "XAPPS_UI_NOTIFICATION") {
        const message = readFirstString(
          dataRecord.message,
          payloadRecord.message,
          msg.message,
          nestedDataPayload.message,
        );
        const variantCandidate = readFirstString(
          dataRecord.variant,
          payloadRecord.variant,
          msg.variant,
          nestedDataPayload.variant,
        );
        const variant =
          variantCandidate === "success" ||
          variantCandidate === "warning" ||
          variantCandidate === "error"
            ? variantCandidate
            : "info";
        if (message) host.showNotification(String(message), variant);
        return;
      }

      if (type === "XAPPS_UI_ALERT") {
        const message = readFirstString(
          dataRecord.message,
          payloadRecord.message,
          msg.message,
          nestedDataPayload.message,
        );
        const title =
          readFirstString(
            dataRecord.title,
            payloadRecord.title,
            msg.title,
            nestedDataPayload.title,
          ) || translateWidgetRuntime("alert", getDefaultWidgetRuntimeLocale());
        if (message) host.showAlert(String(message), String(title));
        return;
      }

      if (type === "XAPPS_UI_MODAL_OPEN") {
        const title =
          readFirstString(
            dataRecord.title,
            payloadRecord.title,
            msg.title,
            nestedDataPayload.title,
          ) || translateWidgetRuntime("modal", getDefaultWidgetRuntimeLocale());
        const message = readFirstString(
          dataRecord.message,
          payloadRecord.message,
          msg.message,
          nestedDataPayload.message,
        );
        host.openModal(String(title), String(message));
        return;
      }

      if (type === "XAPPS_UI_MODAL_CLOSE") {
        host.closeModal();
        return;
      }

      if (type === "XAPPS_UI_NAVIGATE") {
        const path = readFirstString(
          dataRecord.path,
          payloadRecord.path,
          msg.path,
          nestedDataPayload.path,
        );
        if (path) host.navigate(String(path));
        return;
      }

      if (type === "XAPPS_UI_REFRESH") {
        host.refresh();
        return;
      }

      if (type === "XAPPS_OPEN_OPERATIONAL_SURFACE") {
        const payloadData = asRecord(data ?? payload);
        const surface = readTrimmedString(payloadData.surface).toLowerCase();
        if (
          !host.openOperationalSurface ||
          !["requests", "payments", "invoices", "notifications"].includes(surface)
        ) {
          return;
        }
        const placement = normalizeOperationalSurfacePlacement(payloadData.placement);
        host.openOperationalSurface({
          surface: surface as "requests" | "payments" | "invoices" | "notifications",
          ...(placement ? { placement } : {}),
          ...(readTrimmedString(payloadData.xappId)
            ? { xappId: readTrimmedString(payloadData.xappId) }
            : {}),
          ...(readTrimmedString(payloadData.installationId)
            ? { installationId: readTrimmedString(payloadData.installationId) }
            : {}),
          ...(readTrimmedString(payloadData.requestId)
            ? { requestId: readTrimmedString(payloadData.requestId) }
            : {}),
          ...(readTrimmedString(payloadData.paymentSessionId)
            ? { paymentSessionId: readTrimmedString(payloadData.paymentSessionId) }
            : {}),
          ...(readTrimmedString(payloadData.invoiceId)
            ? { invoiceId: readTrimmedString(payloadData.invoiceId) }
            : {}),
          ...(readTrimmedString(payloadData.notificationId)
            ? { notificationId: readTrimmedString(payloadData.notificationId) }
            : {}),
        });
        return;
      }

      if (type === "XAPPS_UI_EXPAND_REQUEST") {
        const source = event.source as Window | null;
        const payloadData = asRecord(data ?? payload);
        const expanded = Boolean(payloadData.expanded);
        const stage = normalizeExpandStage(payloadData.stage, expanded);

        void (async () => {
          try {
            let result: WidgetExpandResult | null | undefined = undefined;
            if (typeof host.expandWidget === "function") {
              result = await host.expandWidget({
                expanded,
                ...(typeof payloadData.source === "string" ? { source: payloadData.source } : {}),
                ...(typeof payloadData.widgetId === "string"
                  ? { widgetId: payloadData.widgetId }
                  : {}),
                ...(payloadData.mode === "expand" || payloadData.mode === "collapse"
                  ? { mode: payloadData.mode }
                  : {}),
                stage,
                ...(payloadData.suggested && typeof payloadData.suggested === "object"
                  ? { suggested: asRecord(payloadData.suggested) }
                  : {}),
              });
            }
            source?.postMessage(
              {
                type: "XAPPS_UI_EXPAND_RESULT",
                ok: true,
                data:
                  result ||
                  ({
                    hostManaged: false,
                    expanded: false,
                    stage: "inline",
                  } satisfies WidgetExpandResult),
              },
              "*",
            );
          } catch (error: unknown) {
            const errorRecord = asRecord(error);
            source?.postMessage(
              {
                type: "XAPPS_UI_EXPAND_RESULT",
                ok: false,
                error: {
                  message:
                    readFirstString(errorRecord.message) ||
                    translateWidgetRuntime(
                      "expand_handling_failed",
                      getDefaultWidgetRuntimeLocale(),
                    ),
                  code: readFirstString(errorRecord.code) || "EXPAND_HANDLING_FAILED",
                },
              },
              "*",
            );
          }
        })();
        return;
      }

      if (type === "XAPPS_UI_GET_CONTEXT") {
        // Reply to the caller window with a context payload.
        // Some builders call this before/without the host providing a global `window.XappsHost`.
        const getContext = host.getContext;
        if (typeof getContext !== "function") return;

        void (async () => {
          try {
            const ctx = await getContext();
            (event.source as Window | null)?.postMessage(
              {
                type: "XAPPS_UI_GET_CONTEXT_RESULT",
                id,
                payload: ctx,
              },
              "*",
            );
          } catch {
            // ignore
          }
        })();
        return;
      }

      if (type === "XAPPS_UI_CONFIRM_REQUEST") {
        const source = event.source as Window | null;
        const payloadData = asRecord(data ?? payload);
        const title = String(
          payloadData.title ??
            translateWidgetRuntime("confirmation", getDefaultWidgetRuntimeLocale()),
        );
        const message = String(payloadData.message ?? "");
        const confirmLabel = String(
          payloadData.confirmLabel ??
            translateWidgetRuntime("continue", getDefaultWidgetRuntimeLocale()),
        );
        const cancelLabel = String(
          payloadData.cancelLabel ??
            translateWidgetRuntime("cancel", getDefaultWidgetRuntimeLocale()),
        );

        void (async () => {
          try {
            let confirmed = false;
            if (typeof host.confirmDialog === "function") {
              confirmed = Boolean(
                await host.confirmDialog({
                  title,
                  message,
                  confirmLabel,
                  cancelLabel,
                }),
              );
            } else {
              confirmed = typeof window.confirm === "function" ? window.confirm(message) : false;
            }
            source?.postMessage(
              {
                type: "XAPPS_UI_CONFIRM_RESULT",
                id,
                ok: true,
                data: { confirmed },
              },
              "*",
            );
          } catch (error: unknown) {
            const errorRecord = asRecord(error);
            source?.postMessage(
              {
                type: "XAPPS_UI_CONFIRM_RESULT",
                id,
                ok: false,
                error: {
                  message:
                    readFirstString(errorRecord.message) ||
                    translateWidgetRuntime("confirmation_failed", getDefaultWidgetRuntimeLocale()),
                  code: readFirstString(errorRecord.code) || "CONFIRMATION_FAILED",
                },
              },
              "*",
            );
          }
        })();
        return;
      }

      if (type === "XAPPS_UI_STATE_UPDATE") {
        // Optional bridge for updating host-persisted state.
        if (typeof host.updateState === "function") {
          const patch = dataRecord.patch ?? payloadRecord.patch ?? data ?? payload;
          if (patch && typeof patch === "object") host.updateState(asRecord(patch));
        }
        return;
      }

      if (type === "XAPPS_GUARD_REQUEST") {
        const resolveGuard = host.requestGuard;
        const source = event.source as Window | null;
        const correlationId = typeof id === "string" ? id : null;
        const payloadData = asRecord(data ?? payload);
        const guardSlug = String(payloadData.guardSlug ?? payloadData.guard_slug ?? "").trim();
        const trigger =
          typeof payloadData.trigger === "string" && payloadData.trigger.trim().length > 0
            ? payloadData.trigger.trim()
            : "before:tool_run";
        const context = asRecord(payloadData.context);
        const config =
          payloadData.config === null
            ? null
            : payloadData.config
              ? asRecord(payloadData.config)
              : null;

        void (async () => {
          try {
            const decision: GuardDecision = resolveGuard
              ? await resolveGuard({ guardSlug, trigger, context, config })
              : defaultGuardDecision({
                  type,
                  id: correlationId ?? undefined,
                  data: { guardSlug, trigger, context, config },
                });
            const decisionRecord = asRecord(decision);
            source?.postMessage(
              {
                type: "XAPPS_GUARD_RESULT",
                id: correlationId,
                ok: true,
                data: decision,
              },
              "*",
            );
            source?.postMessage(
              {
                type: "XAPPS_GUARD_STATUS",
                ok: true,
                data: {
                  guard_slug: decisionRecord.guard_slug ?? guardSlug,
                  trigger: decisionRecord.trigger ?? trigger,
                  status: decisionRecord.status ?? "unknown",
                  satisfied:
                    typeof decisionRecord.satisfied === "boolean"
                      ? decisionRecord.satisfied
                      : decisionRecord.status === "passed",
                  reason:
                    typeof decisionRecord.reason === "string" ? decisionRecord.reason : undefined,
                  message:
                    typeof decisionRecord.message === "string" ? decisionRecord.message : undefined,
                },
              },
              "*",
            );
          } catch (error: unknown) {
            const errorRecord = asRecord(error);
            source?.postMessage(
              {
                type: "XAPPS_GUARD_RESULT",
                id: correlationId,
                ok: false,
                error: {
                  message:
                    readFirstString(errorRecord.message) ||
                    translateWidgetRuntime("guard_evaluation_failed"),
                  code: readFirstString(errorRecord.code) || "GUARD_EVALUATION_FAILED",
                  status: errorRecord.status,
                },
              },
              "*",
            );
          }
        })();
        return;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [host]);
}
