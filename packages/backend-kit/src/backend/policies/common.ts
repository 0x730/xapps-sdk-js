// @ts-nocheck
import {
  buildPaymentGuardAction,
  hasUpstreamPaymentVerified as hasUpstreamPaymentVerifiedFromSdk,
  normalizePaymentAllowedIssuers as normalizePaymentAllowedIssuersFromSdk,
  resolveMergedPaymentGuardContext,
  resolvePaymentGuardPriceAmount,
} from "@xapps/server-sdk";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toNumericAmount(amount) {
  if (typeof amount === "number") return amount;
  if (typeof amount === "string" && amount.trim() && Number.isFinite(Number(amount))) {
    return Number(amount);
  }
  return amount;
}

export function hasUpstreamPaymentVerified(value) {
  return hasUpstreamPaymentVerifiedFromSdk(value);
}

export function resolveMergedContext(payloadInput) {
  return resolveMergedPaymentGuardContext(asObject(payloadInput));
}

export function resolvePriceAmount(guardConfig, context) {
  return resolvePaymentGuardPriceAmount(asObject(guardConfig), asObject(context));
}

export function buildPaymentAction(action) {
  return buildPaymentGuardAction(asObject(action));
}

export function normalizeAllowedIssuers(guardConfig, fallbackIssuer) {
  return normalizePaymentAllowedIssuersFromSdk(asObject(guardConfig), String(fallbackIssuer || ""));
}

export function buildPaymentPolicyAllowedResult(input, modeMeta = {}) {
  return {
    allowed: true,
    reason: String(input.policy?.reason || "tenant_payment_passed"),
    message: "Tenant payment policy satisfied",
    details: {
      payment_status: input.verifiedPayment?.status || input.plainStatus || "paid",
      orchestrationApproved: input.orchestrationApproved,
      gatewayPaymentVerified: input.gatewayPaymentVerified,
      paidByGatewayHint: false,
      paidByPlainStatusFallback: false,
      paidByVerifiedEvidence: input.paidByVerifiedEvidence,
      verified_contract: input.verifiedPayment?.contract || null,
      payment_mode: modeMeta.paymentMode || null,
      ...(modeMeta.referenceMode ? { reference_mode: modeMeta.referenceMode } : {}),
    },
  };
}

export function buildPaymentGuardFailClosedResult(upstreamStatus) {
  return {
    allowed: false,
    reason: "payment_session_create_failed",
    message: "Payment session could not be created at this time",
    action: {
      kind: "complete_payment",
      label: "Open Payment",
      title: "Complete Payment",
    },
    details: {
      uiRequired: true,
      orchestration: {
        mode: "blocking",
        surface: "redirect",
        status: "failed_dependency",
      },
      upstream_status: Number(upstreamStatus || 500) || 500,
    },
  };
}

export async function buildPaymentPolicyBlockedResult(
  input,
  { buildPaymentUrl, extractHostedPaymentSessionId, modeMeta = {} },
) {
  const paymentUrl = await buildPaymentUrl(input);
  return {
    allowed: false,
    reason: input.failReason,
    message:
      input.verificationFailure?.ok === false ? "Payment verification failed" : input.baseMessage,
    action: buildPaymentAction({
      url: paymentUrl,
      label: input.actionCfg?.label,
      title: input.actionCfg?.title,
      target: input.actionCfg?.target,
    }),
    details: {
      uiRequired: true,
      orchestration: {
        mode: "blocking",
        surface: String(input.guardConfig?.ui_mode || "redirect"),
        status: "pending_user_action",
        payment_session_id: extractHostedPaymentSessionId(paymentUrl),
        payment_mode: modeMeta.paymentMode || null,
        ...(modeMeta.referenceMode ? { reference_mode: modeMeta.referenceMode } : {}),
      },
      payment_status: input.plainStatus || null,
      expected_amount: toNumericAmount(input.amount),
      expected_currency: input.currency,
      ...(input.verificationFailure?.ok === false
        ? { verification_failure: input.verificationFailure }
        : {}),
    },
  };
}

export async function buildPaymentPolicyInput({
  payloadInput,
  log,
  resolveAllowedIssuers,
  resolveExpectedPaymentIssuer,
  paymentHandler,
  paymentRuntime = {},
  paymentSettings = {},
  guardSlugDefault = "tenant-payment-policy",
}) {
  const payload = payloadInput && typeof payloadInput === "object" ? payloadInput : {};
  const context = resolveMergedContext(payload);
  const policyContext = asObject(payload.policyContext);
  const payloadWithContext = { ...payload, context };
  const guard = payload.guard && typeof payload.guard === "object" ? payload.guard : {};
  const guardConfig = guard.config && typeof guard.config === "object" ? guard.config : {};
  const policy =
    guardConfig.policy && typeof guardConfig.policy === "object" ? guardConfig.policy : {};
  const actionCfg =
    guardConfig.action && typeof guardConfig.action === "object" ? guardConfig.action : {};
  const guardSlug = String(guard.slug || guardSlugDefault).trim();
  const orchestration =
    context.orchestration && typeof context.orchestration === "object" ? context.orchestration : {};
  const orchestrationEntry =
    orchestration[guardSlug] && typeof orchestration[guardSlug] === "object"
      ? orchestration[guardSlug]
      : {};
  const orchestrationPayment =
    orchestrationEntry.payment && typeof orchestrationEntry.payment === "object"
      ? orchestrationEntry.payment
      : null;

  const allowOrchestrationBypassConfigured = Boolean(
    guardConfig.allow_orchestration_bypass ?? guardConfig.allowOrchestrationBypass,
  );
  if (allowOrchestrationBypassConfigured) {
    log.warn("Ignoring allow_orchestration_bypass in canonical payment verification mode.");
  }
  const orchestrationApproved = false;

  const amount = resolvePriceAmount(guardConfig, context);
  const currency = String(guardConfig?.pricing?.currency || guardConfig.currency || "USD")
    .trim()
    .toUpperCase();
  const settings = asObject(paymentSettings);
  const allowedIssuers = resolveAllowedIssuers(guardConfig, settings, paymentRuntime);
  const expectedIssuer =
    allowedIssuers[0] || resolveExpectedPaymentIssuer(guardConfig, settings, paymentRuntime);
  const plainStatus = String(payload.payment_status || payload?.payment?.status || "")
    .trim()
    .toLowerCase();
  const gatewayPaymentVerified =
    hasUpstreamPaymentVerified(payload.payment_verified) ||
    hasUpstreamPaymentVerified(payload.paymentVerified) ||
    hasUpstreamPaymentVerified(policyContext.payment_verified) ||
    hasUpstreamPaymentVerified(policyContext.paymentVerified);
  let verifiedPayment = null;
  let verificationFailure = null;

  const hasVerificationSecret =
    String(settings.returnSecret || "").trim().length > 0 ||
    String(settings.returnSecretRef || "").trim().length > 0 ||
    Boolean(paymentHandler && typeof paymentHandler.handleVerifyEvidence === "function");

  if (
    gatewayPaymentVerified &&
    orchestrationPayment &&
    String(orchestrationPayment.status || "")
      .trim()
      .toLowerCase() === "paid"
  ) {
    verifiedPayment = orchestrationPayment;
  } else if (hasVerificationSecret && paymentHandler?.handleVerifyEvidence) {
    const verificationPayload = orchestrationPayment
      ? { ...payloadWithContext, ...(orchestrationPayment || {}) }
      : payloadWithContext;
    const verifyResult = await paymentHandler.handleVerifyEvidence({
      payload: verificationPayload,
      maxAgeSeconds: Number(guardConfig.payment_return_max_age_s || 900) || 900,
      expected: {
        issuer: expectedIssuer,
        issuers: allowedIssuers,
        amount,
        currency,
        xapp_id: String(context.xappId || context.xapp_id || "") || undefined,
        tool_name: String(context.toolName || context.tool_name || "") || undefined,
        subject_id: String(context.subjectId || context.subject_id || "") || undefined,
        installation_id:
          String(context.installationId || context.installation_id || "") || undefined,
        client_id: String(context.clientId || context.client_id || "") || undefined,
      },
    });
    if (verifyResult.ok) {
      verifiedPayment = verifyResult.evidence;
    } else if (verifyResult.reason !== "payment_evidence_not_found") {
      verificationFailure = verifyResult;
    }
  }

  const paidByVerifiedEvidence = Boolean(verifiedPayment);
  if (!hasVerificationSecret) {
    log.warn(
      "Payment guard verification secret/secret_ref is not configured; canonical mode is fail-closed.",
    );
  }

  const baseReason = String(policy.reason || "payment_required").trim() || "payment_required";
  const baseMessage = String(policy.message || "Payment is required before continuing.").trim();
  const failReason = verificationFailure?.ok === false ? verificationFailure.reason : baseReason;
  return {
    payload: payloadWithContext,
    context,
    guard,
    guardConfig,
    policy,
    amount,
    currency,
    plainStatus,
    orchestrationApproved,
    gatewayPaymentVerified,
    verifiedPayment,
    paidByVerifiedEvidence,
    verificationFailure,
    failReason,
    baseMessage,
    actionCfg,
  };
}

export async function resolvePolicyRequestCommon({
  payloadInput,
  log,
  resolveAllowedIssuers,
  resolveExpectedPaymentIssuer,
  resolveModeResult,
  paymentRuntime = {},
  guardSlugDefault,
}) {
  const input = await buildPaymentPolicyInput({
    payloadInput,
    log,
    resolveAllowedIssuers,
    resolveExpectedPaymentIssuer,
    paymentHandler: paymentRuntime.paymentHandler,
    paymentRuntime,
    paymentSettings: paymentRuntime.paymentSettings,
    guardSlugDefault,
  });
  return resolveModeResult(input, paymentRuntime);
}
