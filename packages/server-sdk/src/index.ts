import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import type {
  CreatePaymentSessionInput,
  CreatePaymentSessionResult,
  PaymentSessionRecord,
} from "./gatewayApiClient.js";
export * from "./publisherApiClient.js";
export * from "./gatewayApiClient.js";
export * from "./embedHostProxy.js";
export * from "@xapps-platform/xapp-manifest";

export type XappsSigningAlgorithm = "hmac-sha256" | "hmac-sha512" | "ed25519";

export type VerifyXappsSignatureInput = {
  method: string;
  pathWithQuery: string;
  body: string;
  timestamp: string;
  signature: string;
  secret: string | Buffer;
  algorithm?: XappsSigningAlgorithm;
  source?: "dispatch" | "event_delivery";
  requireSourceInSignature?: boolean;
  allowLegacyWithoutSource?: boolean;
  maxSkewSeconds?: number;
  nowSeconds?: number;
};

export type VerifyXappsSignatureResult =
  | { ok: true; mode: "strict" | "legacy" }
  | {
      ok: false;
      reason: "invalid_timestamp" | "timestamp_skew" | "missing_source" | "bad_signature";
    };

export type XappsPaymentReturnContract = "xapps_payment_orchestration_v1";

export type XappsPaymentReturnEvidence = {
  contract: XappsPaymentReturnContract;
  payment_session_id: string;
  status: string;
  receipt_id: string;
  amount: string;
  currency: string;
  ts: string;
  issuer: string;
  xapp_id: string;
  tool_name: string;
  subject_id?: string;
  installation_id?: string;
  client_id?: string;
  authority_lane?: string;
  signing_lane?: string;
  resolver_source?: string;
  sig: string;
};

export type VerifyPaymentReturnEvidenceInput = {
  evidence: XappsPaymentReturnEvidence;
  secret: string | Buffer;
  maxAgeSeconds?: number;
  nowMs?: number;
  expected?: {
    issuer?: string;
    issuers?: string[];
    xapp_id?: string;
    tool_name?: string;
    subject_id?: string | null;
    installation_id?: string | null;
    client_id?: string | null;
    amount?: string | number | null;
    currency?: string | null;
    require_paid_status?: boolean;
  };
};

export type BuildSignedPaymentReturnRedirectInput = {
  returnUrl: string;
  evidence: Omit<XappsPaymentReturnEvidence, "sig">;
  secret: string | Buffer;
  resumeToken?: string | null;
};

export type VerifyPaymentReturnEvidenceResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "payment_evidence_malformed"
        | "payment_evidence_contract_unsupported"
        | "payment_not_settled"
        | "payment_evidence_timestamp_invalid"
        | "payment_evidence_expired"
        | "payment_signature_invalid"
        | "payment_issuer_not_allowed"
        | "payment_context_mismatch"
        | "payment_amount_mismatch"
        | "payment_currency_mismatch";
      details?: Record<string, unknown>;
    };

export type DispatchRequestPayload = {
  requestId: string;
  toolName: string;
  payload: Record<string, unknown>;
  chainContext?: Record<string, unknown>;
  subjectId?: string | null;
  userEmail?: string | null;
  async?: boolean;
  callbackToken?: string | null;
  subjectActionPayload?: string | null;
  subjectProof?: unknown;
};

export type CallbackClientEventInput = {
  type: string;
  message?: string;
  data?: unknown;
};

export type CallbackClientCompleteInput = {
  status: string;
  result?: unknown;
  message?: string;
};

export type CallbackClientOptions = {
  baseUrl: string;
  callbackToken: string;
  fetchImpl?: typeof fetch;
  retry?: CallbackRetryPolicy;
  idempotencyKeyFactory?: (input: IdempotencyKeyFactoryInput) => string;
};

export type CallbackRetryPolicy = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOnStatus?: number[];
};

export type IdempotencyKeyFactoryInput = {
  operation: "event" | "complete";
  requestId: string;
  payload: Record<string, unknown>;
};

export type SubjectProofVerifierResult =
  | { ok: true; reason?: string; [key: string]: unknown }
  | { ok: false; reason: string; [key: string]: unknown };

export type VerifySubjectProofEnvelopeInput = {
  subjectActionPayload: string;
  subjectProof: unknown;
  verifier: unknown;
};

export type VerifyJwsSubjectProofInput = {
  subjectActionPayload: string;
  jws: string;
  expectedKid: string;
  ed25519PublicKey: string;
};

export type VerifyWebauthnSubjectProofInput = {
  subjectActionPayload: string;
  kid: string;
  webauthn: unknown;
  rpId: string;
  expectedOrigins: string[];
  credentialId: string;
  publicKeyCose: string;
  counter?: number;
  requireUserVerification?: boolean;
};

export type SubjectProofVerifierModule = {
  verifySubjectProofEnvelope: (
    input: VerifySubjectProofEnvelopeInput,
  ) => Promise<SubjectProofVerifierResult> | SubjectProofVerifierResult;
  verifyJwsSubjectProof: (
    input: VerifyJwsSubjectProofInput,
  ) => Promise<SubjectProofVerifierResult> | SubjectProofVerifierResult;
  verifyWebauthnSubjectProof: (
    input: VerifyWebauthnSubjectProofInput,
  ) => Promise<SubjectProofVerifierResult> | SubjectProofVerifierResult;
};

export type SubjectProofVerificationOptions = {
  verifierModule?: SubjectProofVerifierModule;
};

export type GatewaySessionAccept = Record<string, unknown> & {
  scheme: string;
  label: string;
};

export type ManagedGatewaySessionMetadataInput = {
  source: string;
  guardConfig?: Record<string, unknown> | null;
  guardSlug?: string | null;
  guard_slug?: string | null;
  paymentScheme?: unknown;
  payment_scheme?: unknown;
  paymentReturnSigning?: Record<string, unknown> | null;
  payment_return_signing?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type ManagedGatewayPaymentSessionInput = Omit<CreatePaymentSessionInput, "metadata"> & {
  source: string;
  guardConfig?: Record<string, unknown> | null;
  guardSlug?: string | null;
  guard_slug?: string | null;
  paymentIssuer?: string | null;
  paymentScheme?: unknown;
  payment_scheme?: unknown;
  paymentReturnSigning?: Record<string, unknown> | null;
  payment_return_signing?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type HostedGatewaySessionUpsertInput = {
  payment_session_id: string;
  xapp_id: string;
  tool_name: string;
  amount: string;
  currency: string;
  issuer: string;
  subject_id?: string;
  installation_id?: string;
  client_id?: string;
  return_url: string;
  cancel_url?: string;
  xapps_resume?: string;
};

export type HostedGatewaySessionDeps = {
  createPaymentSession: (
    input: CreatePaymentSessionInput,
  ) => Promise<CreatePaymentSessionResult> | CreatePaymentSessionResult;
  upsertSession: (input: HostedGatewaySessionUpsertInput) => Promise<unknown> | unknown;
};

export type HostedGatewayPaymentUrlInput = {
  deps: HostedGatewaySessionDeps;
  payload?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  guard?: Record<string, unknown> | null;
  guardConfig?: Record<string, unknown> | null;
  amount: string | number;
  currency: string;
  defaultPaymentUrl: string;
  fallbackIssuer: string;
  storedIssuer: string;
  defaultSecret?: string | null;
  defaultSecretRef?: string | null;
  allowDefaultSecretFallback?: boolean;
};

export type HostedGatewayPaymentUrlResult = {
  paymentUrl: string;
  paymentSessionId: string;
  gatewaySession: PaymentSessionRecord | null;
};

export type PaymentGuardAction = {
  kind: "complete_payment";
  url: string;
  label: string;
  title: string;
  target?: string;
};

export type XappsServerSdkErrorCode =
  | "INVALID_ARGUMENT"
  | "FETCH_UNAVAILABLE"
  | "CALLBACK_NETWORK_ERROR"
  | "CALLBACK_HTTP_ERROR"
  | "CALLBACK_RETRY_EXHAUSTED"
  | "VERIFIER_UNAVAILABLE"
  | "VERIFIER_INVALID_RESULT";

export class XappsServerSdkError extends Error {
  code: XappsServerSdkErrorCode;
  status?: number;
  retryable: boolean;
  cause?: unknown;

  constructor(input: {
    code: XappsServerSdkErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "XappsServerSdkError";
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable === true;
    this.cause = input.cause;
  }
}

function toBuffer(secret: string | Buffer): Buffer {
  if (Buffer.isBuffer(secret)) return secret;
  return Buffer.from(secret, "utf8");
}

function fail(
  code: XappsServerSdkErrorCode,
  message: string,
  options?: { status?: number; retryable?: boolean; cause?: unknown },
): never {
  throw new XappsServerSdkError({
    code,
    message,
    status: options?.status,
    retryable: options?.retryable,
    cause: options?.cause,
  });
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function readLowerString(value: unknown): string {
  return readString(value).toLowerCase();
}

function readBoolish(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const normalized = readLowerString(value);
  return ["1", "true", "yes", "on"].includes(normalized);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readAnyString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = readString(value);
    if (normalized) return normalized;
  }
  return "";
}

function isPlaceholderToken(value: unknown): boolean {
  const raw = readString(value);
  return /^__[^_].*__$/.test(raw);
}

function parseResumeToken(token: unknown): Record<string, unknown> {
  const raw = readString(token);
  if (!raw) return {};
  try {
    return asObject(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
  } catch {
    return {};
  }
}

export function humanizePaymentSchemeLabel(scheme: unknown): string {
  const normalized = readLowerString(scheme);
  if (!normalized) return "";
  if (normalized === "mock_manual") return "Mock Hosted Redirect";
  if (normalized === "mock_immediate") return "Mock Immediate";
  if (normalized === "mock_client_collect") return "Mock Client Collect";
  if (normalized === "mock_decline") return "Mock Decline";
  if (normalized === "stripe") return "Stripe";
  if (normalized === "paypal") return "PayPal";
  if (normalized === "netopia") return "Netopia";
  return normalized
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildGatewaySessionAccepts(
  guardConfig: Record<string, unknown> | null | undefined,
  paymentScheme: unknown,
): GatewaySessionAccept[] {
  const primaryScheme = readLowerString(paymentScheme);
  const configured = Array.isArray(guardConfig?.accepts) ? guardConfig.accepts : [];
  const out: GatewaySessionAccept[] = [];
  const seen = new Set<string>();

  const pushAccept = (entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
    const base = asObject(entry);
    const scheme = readLowerString(base.scheme || base.payment_scheme || base.paymentScheme);
    if (!scheme || seen.has(scheme)) return;
    seen.add(scheme);
    out.push({
      ...base,
      scheme,
      label: readString(base.label || base.title) || humanizePaymentSchemeLabel(scheme),
    });
  };

  if (primaryScheme) {
    pushAccept({ scheme: primaryScheme });
  }
  for (const candidate of configured) {
    if (typeof candidate === "string") {
      pushAccept({ scheme: candidate });
      continue;
    }
    pushAccept(candidate);
  }
  return out;
}

export function readGatewaySessionUi(
  guardConfig: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return asObject(guardConfig?.hosted_ui ?? guardConfig?.payment_ui ?? guardConfig?.paymentUi);
}

function normalizeManagedGatewayPaymentType(
  guardConfig: Record<string, unknown> | null | undefined,
): "pay_by_request" | "one_time_unlock" | "subscription" | "credit_based" {
  const cfg = guardConfig ?? {};
  const raw = readString((cfg as any).payment_type ?? (cfg as any).paymentType).toLowerCase();
  if (raw === "pay_by_request" || raw === "pay_per_request" || raw === "per_request") {
    return "pay_by_request";
  }
  if (
    raw === "one_time_unlock" ||
    raw === "one_time" ||
    raw === "per_use" ||
    raw === "per_result"
  ) {
    return "one_time_unlock";
  }
  if (raw === "subscription") return "subscription";
  if (raw === "credit_based" || raw === "credits") return "credit_based";

  const legacy = readString(
    (cfg as any).pricing_model ?? (cfg as any).pricingModel ?? (cfg as any).mode,
  ).toLowerCase();
  if (legacy === "pay_per_request" || legacy === "per_request") return "pay_by_request";
  if (legacy === "subscription") return "subscription";
  if (legacy === "credit_based" || legacy === "credits") return "credit_based";
  return "one_time_unlock";
}

function readManagedGatewayRetryWindowSec(
  guardConfig: Record<string, unknown> | null | undefined,
): number {
  const cfg = guardConfig ?? {};
  return Math.max(
    15,
    Number(
      (cfg as any).payment_return_retry_window_s ?? (cfg as any).paymentReturnRetryWindowS ?? 120,
    ) || 120,
  );
}

export function buildManagedGatewaySessionMetadata(
  input: ManagedGatewaySessionMetadataInput,
): Record<string, unknown> {
  const metadata = asObject(input.metadata);
  const source = readString(input.source);
  const guardSlug = readString(input.guardSlug ?? input.guard_slug);
  const paymentScheme = readString(input.paymentScheme ?? input.payment_scheme);
  const paymentType = normalizeManagedGatewayPaymentType(input.guardConfig);
  const accepts = buildGatewaySessionAccepts(input.guardConfig, paymentScheme);
  const paymentUi = readGatewaySessionUi(input.guardConfig);
  const paymentReturnSigning = asObject(input.paymentReturnSigning ?? input.payment_return_signing);
  const usageCreditScope =
    guardSlug && paymentType === "pay_by_request"
      ? {
          guard_slug: guardSlug,
          trigger: "before:tool_run",
          payment_type: "pay_by_request",
          retry_window_sec: readManagedGatewayRetryWindowSec(input.guardConfig),
        }
      : null;

  return {
    ...metadata,
    ...(source ? { source } : {}),
    ...(guardSlug ? { guard_slug: guardSlug } : {}),
    ...(accepts.length > 0 ? { accepts } : {}),
    ...(Object.keys(paymentUi).length > 0 ? { payment_ui: paymentUi } : {}),
    ...(Object.keys(paymentReturnSigning).length > 0
      ? { payment_return_signing: paymentReturnSigning }
      : {}),
    ...(usageCreditScope ? { usage_credit_scope: usageCreditScope } : {}),
  };
}

export function buildManagedGatewayPaymentSessionInput(
  input: ManagedGatewayPaymentSessionInput,
): CreatePaymentSessionInput {
  const pageUrl = readString(input.pageUrl ?? input.page_url);
  const xappId = readString(input.xappId ?? input.xapp_id);
  const toolName = readString(input.toolName ?? input.tool_name);
  const currency = readString(input.currency);
  const issuer = readString(input.paymentIssuer ?? input.issuer);
  const paymentScheme = readString(input.paymentScheme ?? input.payment_scheme);
  const returnUrl = readString(input.returnUrl ?? input.return_url);
  const cancelUrl = readString(input.cancelUrl ?? input.cancel_url);
  const xappsResume = readString(input.xappsResume ?? input.xapps_resume);
  const subjectId = readString(input.subjectId ?? input.subject_id);
  const installationId = readString(input.installationId ?? input.installation_id);
  const clientId = readString(input.clientId ?? input.client_id);
  const paymentSessionId = readString(input.paymentSessionId ?? input.payment_session_id);

  return {
    ...(paymentSessionId ? { paymentSessionId } : {}),
    ...(pageUrl ? { pageUrl } : {}),
    ...(xappId ? { xappId } : {}),
    ...(toolName ? { toolName } : {}),
    amount: input.amount,
    ...(currency ? { currency } : {}),
    ...(issuer ? { issuer } : {}),
    ...(paymentScheme ? { paymentScheme } : {}),
    ...(returnUrl ? { returnUrl } : {}),
    ...(cancelUrl ? { cancelUrl } : {}),
    ...(xappsResume ? { xappsResume } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...(installationId ? { installationId } : {}),
    ...(clientId ? { clientId } : {}),
    metadata: buildManagedGatewaySessionMetadata({
      source: input.source,
      guardConfig: input.guardConfig,
      guardSlug: input.guardSlug ?? input.guard_slug,
      paymentScheme,
      paymentReturnSigning: input.paymentReturnSigning ?? input.payment_return_signing,
      metadata: input.metadata,
    }),
  };
}

function resolveConfiguredAllowedIssuers(
  guardConfig: Record<string, unknown> | null | undefined,
): string[] {
  const configured = Array.isArray(guardConfig?.payment_allowed_issuers)
    ? guardConfig.payment_allowed_issuers
    : Array.isArray(guardConfig?.paymentAllowedIssuers)
      ? guardConfig.paymentAllowedIssuers
      : [];
  return Array.from(
    new Set(
      configured
        .map((value) =>
          String(value || "")
            .trim()
            .toLowerCase(),
        )
        .filter((value) =>
          ["gateway", "tenant", "publisher", "tenant_delegated", "publisher_delegated"].includes(
            value,
          ),
        ),
    ),
  );
}

function resolveHostedGatewayPaymentReturnSigning(input: {
  guardConfig: Record<string, unknown> | null | undefined;
  paymentIssuer: string;
  clientId: string;
  defaultSecret?: string | null;
  defaultSecretRef?: string | null;
  allowDefaultSecretFallback?: boolean;
}): Record<string, unknown> | null {
  const guardConfig = asObject(input.guardConfig);
  const issuer = readLowerString(input.paymentIssuer);
  if (!issuer) return null;

  const refsRaw = asObject(guardConfig.payment_return_hmac_secret_refs);
  const secretsRaw = asObject(guardConfig.payment_return_hmac_secrets);
  const delegatedRefsByIssuer = asObject(guardConfig.payment_return_hmac_delegated_secret_refs);
  const delegatedSecretsByIssuer = asObject(guardConfig.payment_return_hmac_delegated_secrets);

  const delegatedLane = issuer === "tenant_delegated" || issuer === "publisher_delegated";
  const scopedClientId = readString(input.clientId);
  let ref = "";
  let secret = "";

  if (delegatedLane) {
    const delegatedRefs = asObject(delegatedRefsByIssuer[issuer]);
    const delegatedSecrets = asObject(delegatedSecretsByIssuer[issuer]);
    const manifestRefRaw = readAnyString(scopedClientId ? delegatedRefs[scopedClientId] : "");
    const manifestSecretRaw = readAnyString(scopedClientId ? delegatedSecrets[scopedClientId] : "");
    const envRef = isPlaceholderToken(input.defaultSecretRef)
      ? ""
      : readAnyString(input.defaultSecretRef);
    const envSecret = isPlaceholderToken(input.defaultSecret)
      ? ""
      : readAnyString(input.defaultSecret);
    ref = isPlaceholderToken(manifestRefRaw) ? "" : manifestRefRaw;
    secret = isPlaceholderToken(manifestSecretRaw) ? "" : manifestSecretRaw;
    ref = ref || envRef;
    secret = secret || envSecret;
  } else {
    const manifestRefRaw = readAnyString(refsRaw?.[issuer] || "");
    const manifestSecretRaw = readAnyString(secretsRaw?.[issuer] || "");
    ref = isPlaceholderToken(manifestRefRaw) ? "" : manifestRefRaw;
    secret = isPlaceholderToken(manifestSecretRaw) ? "" : manifestSecretRaw;
  }

  if (ref || secret) {
    if (delegatedLane && secret) {
      return {
        issuer,
        signing_lane: issuer,
        resolver_source: "session_metadata_delegated",
        secret,
      };
    }
    return {
      issuer,
      signing_lane: issuer,
      resolver_source: delegatedLane
        ? ref
          ? "session_metadata_secret_ref_delegated"
          : "session_metadata_delegated"
        : ref
          ? "guard_config_secret_ref"
          : "guard_config_secret",
      ...(ref ? { secret_ref: ref } : {}),
      ...(secret ? { secret } : {}),
    };
  }

  if (input.allowDefaultSecretFallback && issuer === "tenant" && !delegatedLane) {
    const defaultRef = readString(input.defaultSecretRef);
    const defaultSecret = readString(input.defaultSecret);
    if (defaultRef || defaultSecret) {
      return {
        issuer: "tenant",
        signing_lane: "tenant",
        resolver_source: defaultRef ? "default_secret_ref" : "default_secret",
        ...(defaultRef ? { secret_ref: defaultRef } : {}),
        ...(defaultSecret ? { secret: defaultSecret } : {}),
      };
    }
  }

  return null;
}

export async function buildHostedGatewayPaymentUrlFromGuardContext(
  input: HostedGatewayPaymentUrlInput,
): Promise<HostedGatewayPaymentUrlResult> {
  const deps = input.deps;
  const payloadObj = asObject(input.payload);
  const contextObj = asObject(input.context);
  const guard = asObject(input.guard);
  const guardConfig = asObject(input.guardConfig);
  const base = readString(
    guardConfig.payment_url ?? guardConfig.paymentUrl ?? input.defaultPaymentUrl,
  );
  const url = new URL(base);
  const guardSlug = readString(guard.slug) || "payment-policy";
  const xappsResume = readAnyString(
    payloadObj.xapps_resume,
    payloadObj.xappsResume,
    contextObj.xapps_resume,
    contextObj.xappsResume,
  );
  const resumeObj = parseResumeToken(xappsResume);
  const toolName = readAnyString(
    contextObj.toolName,
    contextObj.tool_name,
    payloadObj.toolName,
    payloadObj.tool_name,
    resumeObj.toolName,
    resumeObj.tool_name,
  );
  const xappId = readAnyString(
    contextObj.xappId,
    contextObj.xapp_id,
    payloadObj.xappId,
    payloadObj.xapp_id,
    resumeObj.xappId,
    resumeObj.xapp_id,
  );
  const subjectId = readAnyString(
    contextObj.subjectId,
    contextObj.subject_id,
    payloadObj.subjectId,
    payloadObj.subject_id,
    resumeObj.subjectId,
    resumeObj.subject_id,
  );
  const installationId = readAnyString(
    contextObj.installationId,
    contextObj.installation_id,
    payloadObj.installationId,
    payloadObj.installation_id,
    resumeObj.installationId,
    resumeObj.installation_id,
  );
  const clientId = readAnyString(
    contextObj.clientId,
    contextObj.client_id,
    payloadObj.clientId,
    payloadObj.client_id,
    resumeObj.clientId,
    resumeObj.client_id,
  );
  const returnUrl = readAnyString(
    payloadObj.return_url,
    payloadObj.returnUrl,
    contextObj.return_url,
    contextObj.returnUrl,
    contextObj.host_return_url,
    contextObj.hostReturnUrl,
    payloadObj.host_return_url,
    payloadObj.hostReturnUrl,
    resumeObj.return_url,
    resumeObj.host_return_url,
  );
  const cancelUrl = readAnyString(
    payloadObj.cancel_url,
    payloadObj.cancelUrl,
    contextObj.cancel_url,
    contextObj.cancelUrl,
    returnUrl,
  );
  const paymentScheme = readAnyString(
    payloadObj.payment_scheme,
    payloadObj.scheme,
    guardConfig.payment_scheme,
    guardConfig.paymentScheme,
  );
  const configuredAllowedIssuers = resolveConfiguredAllowedIssuers(guardConfig);
  const paymentIssuer = configuredAllowedIssuers[0] || readLowerString(input.fallbackIssuer);
  const paymentReturnSigning = resolveHostedGatewayPaymentReturnSigning({
    guardConfig,
    paymentIssuer,
    clientId,
    defaultSecret: input.defaultSecret,
    defaultSecretRef: input.defaultSecretRef,
    allowDefaultSecretFallback: input.allowDefaultSecretFallback,
  });

  let effectiveReturnUrl = returnUrl;
  if (!effectiveReturnUrl) {
    try {
      effectiveReturnUrl = `${new URL(base).origin}/tenant-payment.html`;
    } catch {
      effectiveReturnUrl = "";
    }
  }

  const created = await deps.createPaymentSession(
    buildManagedGatewayPaymentSessionInput({
      source: "guard-backend",
      guardSlug,
      guardConfig,
      pageUrl: base,
      xappId,
      toolName,
      amount: String(input.amount),
      currency: String(input.currency),
      paymentScheme,
      paymentIssuer,
      returnUrl: effectiveReturnUrl,
      cancelUrl,
      xappsResume,
      subjectId,
      installationId,
      clientId,
      ...(paymentReturnSigning ? { paymentReturnSigning } : {}),
    }),
  );

  if (created.paymentPageUrl) {
    return {
      paymentUrl: String(created.paymentPageUrl),
      paymentSessionId: String(created.session?.payment_session_id || ""),
      gatewaySession:
        created.session && typeof created.session === "object" ? created.session : null,
    };
  }

  const gwSession = created.session;
  if (gwSession && gwSession.payment_session_id) {
    await deps.upsertSession({
      payment_session_id: String(gwSession.payment_session_id),
      xapp_id: xappId,
      tool_name: toolName,
      amount: String(input.amount),
      currency: String(input.currency),
      issuer: readLowerString(input.storedIssuer) || paymentIssuer || "tenant",
      ...(subjectId ? { subject_id: subjectId } : {}),
      ...(installationId ? { installation_id: installationId } : {}),
      ...(clientId ? { client_id: clientId } : {}),
      return_url: returnUrl,
      ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
      ...(xappsResume ? { xapps_resume: xappsResume } : {}),
    });
    url.searchParams.set("guard_slug", guardSlug);
    url.searchParams.set("payment_session_id", String(gwSession.payment_session_id));
    return {
      paymentUrl: url.toString(),
      paymentSessionId: String(gwSession.payment_session_id),
      gatewaySession: gwSession,
    };
  }

  throw new Error("gateway payment session create returned invalid session");
}

export function extractHostedPaymentSessionId(paymentUrl: string): string | null {
  try {
    return new URL(paymentUrl).searchParams.get("payment_session_id");
  } catch {
    return null;
  }
}

export function hasUpstreamPaymentVerified(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(asObject(value)).length > 0;
  return readBoolish(value);
}

export function resolveMergedPaymentGuardContext(
  payloadInput: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const payload = asObject(payloadInput);
  const context = asObject(payload.context);
  const xappsResume = readAnyString(
    payload.xapps_resume,
    payload.xappsResume,
    context.xapps_resume,
    context.xappsResume,
  );
  const resume = parseResumeToken(xappsResume);

  const xappId = readAnyString(
    context.xappId,
    context.xapp_id,
    payload.xappId,
    payload.xapp_id,
    resume.xappId,
    resume.xapp_id,
  );
  const toolName = readAnyString(
    context.toolName,
    context.tool_name,
    payload.toolName,
    payload.tool_name,
    resume.toolName,
    resume.tool_name,
  );
  const installationId = readAnyString(
    context.installationId,
    context.installation_id,
    payload.installationId,
    payload.installation_id,
    resume.installationId,
    resume.installation_id,
  );
  const clientId = readAnyString(
    context.clientId,
    context.client_id,
    payload.clientId,
    payload.client_id,
    resume.clientId,
    resume.client_id,
  );
  const subjectId = readAnyString(
    context.subjectId,
    context.subject_id,
    payload.subjectId,
    payload.subject_id,
    resume.subjectId,
    resume.subject_id,
  );
  const returnUrl = readAnyString(
    payload.return_url,
    payload.returnUrl,
    context.return_url,
    context.returnUrl,
    context.host_return_url,
    context.hostReturnUrl,
    payload.host_return_url,
    payload.hostReturnUrl,
    resume.return_url,
    resume.host_return_url,
  );
  const cancelUrl = readAnyString(
    payload.cancel_url,
    payload.cancelUrl,
    context.cancel_url,
    context.cancelUrl,
  );

  return {
    ...context,
    ...(xappId ? { xappId, xapp_id: xappId } : {}),
    ...(toolName ? { toolName, tool_name: toolName } : {}),
    ...(installationId ? { installationId, installation_id: installationId } : {}),
    ...(clientId ? { clientId, client_id: clientId } : {}),
    ...(subjectId ? { subjectId, subject_id: subjectId } : {}),
    ...(returnUrl ? { returnUrl, return_url: returnUrl } : {}),
    ...(cancelUrl ? { cancelUrl, cancel_url: cancelUrl } : {}),
    ...(xappsResume ? { xappsResume, xapps_resume: xappsResume } : {}),
  };
}

export function resolvePaymentGuardPriceAmount(
  guardConfig: Record<string, unknown> | null | undefined,
  context: Record<string, unknown> | null | undefined,
): unknown {
  const cfg = asObject(guardConfig);
  const ctx = asObject(context);
  const pricing = asObject(cfg.pricing);
  const toolName = readAnyString(ctx.toolName, ctx.tool_name);
  const xappId = readAnyString(ctx.xappId, ctx.xapp_id);
  const toolOverrides = asObject(pricing.tool_overrides);
  const xappPrices = asObject(pricing.xapp_prices);

  for (const [key, value] of Object.entries(toolOverrides)) {
    if (!toolName) continue;
    if (String(key || "").endsWith(`:${toolName}`) || String(key || "") === toolName) {
      return value;
    }
  }
  if (xappId && Object.prototype.hasOwnProperty.call(xappPrices, xappId)) return xappPrices[xappId];
  return pricing.default_amount ?? 3;
}

export function buildPaymentGuardAction(action: Record<string, unknown>): PaymentGuardAction {
  return {
    kind: "complete_payment",
    url: String(action.url || ""),
    label: readAnyString(action.label, "Open Payment"),
    title: readAnyString(action.title, "Complete Payment"),
    ...(readString(action.target) ? { target: readString(action.target) } : {}),
  };
}

export function normalizePaymentAllowedIssuers(
  guardConfig: Record<string, unknown> | null | undefined,
  fallbackIssuer: string,
): string[] {
  const configured = Array.isArray(guardConfig?.payment_allowed_issuers)
    ? guardConfig.payment_allowed_issuers
    : Array.isArray(guardConfig?.paymentAllowedIssuers)
      ? guardConfig.paymentAllowedIssuers
      : [];
  const normalized = Array.from(
    new Set(
      configured
        .map((value) =>
          String(value || "")
            .trim()
            .toLowerCase(),
        )
        .filter((value) =>
          ["gateway", "tenant", "publisher", "tenant_delegated", "publisher_delegated"].includes(
            value,
          ),
        ),
    ),
  );
  return normalized.length > 0 ? normalized : [readLowerString(fallbackIssuer)];
}

export function buildCanonicalString(input: {
  method: string;
  pathWithQuery: string;
  timestamp: string;
  bodySha256Hex: string;
}): string {
  return [
    String(input.method || "").toUpperCase(),
    String(input.pathWithQuery || ""),
    String(input.timestamp || ""),
    String(input.bodySha256Hex || ""),
  ].join("\n");
}

function decodeFlexibleBytes(input: string): Uint8Array | null {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return new Uint8Array(Buffer.from(trimmed, "hex"));
  }
  try {
    return new Uint8Array(Buffer.from(trimmed, "base64url"));
  } catch {
    return null;
  }
}

function parseEd25519PublicKey(secret: Buffer): Uint8Array {
  const raw = secret.toString("utf8").trim();
  const material = raw.startsWith("ed25519:pk:") ? raw.slice("ed25519:pk:".length) : raw;
  const decoded = decodeFlexibleBytes(material);
  if (!decoded || decoded.length !== 32) {
    throw new Error("ed25519 verification requires a 32-byte public key");
  }
  return decoded;
}

function signByAlgorithm(
  canonical: string,
  secret: Buffer,
  algorithm: XappsSigningAlgorithm,
): string {
  if (algorithm === "hmac-sha512") {
    return createHmac("sha512", secret).update(canonical).digest("base64url");
  }
  if (algorithm === "ed25519") {
    throw new Error("ed25519 signing is not supported in server-sdk verifier helper");
  }
  return createHmac("sha256", secret).update(canonical).digest("base64url");
}

function verifyByAlgorithm(
  canonical: string,
  signature: string,
  secret: Buffer,
  algorithm: XappsSigningAlgorithm,
): boolean {
  if (algorithm === "ed25519") {
    const publicKey = parseEd25519PublicKey(secret);
    const sigBytes = new Uint8Array(Buffer.from(signature, "base64url"));
    return ed25519.verify(sigBytes, new TextEncoder().encode(canonical), publicKey);
  }
  const expected = signByAlgorithm(canonical, secret, algorithm);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeEqualString(a: string, b: string): boolean {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function readStringFieldFromQueryLike(
  input: URLSearchParams | Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    if (input instanceof URLSearchParams) {
      const value = input.get(key);
      const normalized = value == null ? "" : String(value).trim();
      if (normalized) return normalized;
      continue;
    }
    const raw = (input as Record<string, unknown>)[key];
    if (Array.isArray(raw)) {
      const first = raw[0];
      const normalized = first == null ? "" : String(first).trim();
      if (normalized) return normalized;
      continue;
    }
    const normalized = raw == null ? "" : String(raw).trim();
    if (normalized) return normalized;
  }
  return "";
}

const CANONICAL_PAYMENT_AMOUNT_RE = /^\d+\.\d{2}$/;
const DECIMAL_PAYMENT_AMOUNT_RE = /^\d+(?:\.\d+)?$/;

function canonicalizePaymentAmount(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (CANONICAL_PAYMENT_AMOUNT_RE.test(raw)) return raw;
  if (!DECIMAL_PAYMENT_AMOUNT_RE.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed.toFixed(2);
}

export function parsePaymentReturnEvidence(
  input: URLSearchParams | Record<string, unknown>,
): XappsPaymentReturnEvidence | null {
  if (!input || typeof input !== "object") return null;

  const contract = readStringFieldFromQueryLike(input, [
    "xapps_payment_contract",
    "contract",
  ]).toLowerCase();
  const paymentSessionId = readStringFieldFromQueryLike(input, [
    "xapps_payment_session_id",
    "payment_session_id",
  ]);
  const status = readStringFieldFromQueryLike(input, [
    "xapps_payment_status",
    "status",
  ]).toLowerCase();
  const receiptId = readStringFieldFromQueryLike(input, ["xapps_payment_receipt_id", "receipt_id"]);
  const amountRaw = readStringFieldFromQueryLike(input, ["xapps_payment_amount", "amount"]);
  const amount = canonicalizePaymentAmount(amountRaw);
  const currency = readStringFieldFromQueryLike(input, [
    "xapps_payment_currency",
    "currency",
  ]).toUpperCase();
  const ts = readStringFieldFromQueryLike(input, ["xapps_payment_ts", "ts"]);
  const issuer = readStringFieldFromQueryLike(input, [
    "xapps_payment_issuer",
    "issuer",
  ]).toLowerCase();
  const xappId = readStringFieldFromQueryLike(input, ["xapp_id"]);
  const toolName = readStringFieldFromQueryLike(input, ["tool_name"]);
  const sig = readStringFieldFromQueryLike(input, ["xapps_payment_sig", "sig"]);
  const subjectId = readStringFieldFromQueryLike(input, ["xapps_payment_subject_id", "subject_id"]);
  const installationId = readStringFieldFromQueryLike(input, [
    "xapps_payment_installation_id",
    "installation_id",
  ]);
  const clientId = readStringFieldFromQueryLike(input, ["xapps_payment_client_id", "client_id"]);
  const authorityLane = readStringFieldFromQueryLike(input, [
    "xapps_payment_authority_lane",
    "authority_lane",
  ]);
  const signingLane = readStringFieldFromQueryLike(input, [
    "xapps_payment_signing_lane",
    "signing_lane",
  ]);
  const resolverSource = readStringFieldFromQueryLike(input, [
    "xapps_payment_resolver_source",
    "resolver_source",
  ]);

  if (
    !contract ||
    !paymentSessionId ||
    !status ||
    !receiptId ||
    !amount ||
    !currency ||
    !ts ||
    !issuer ||
    !sig ||
    !xappId ||
    !toolName
  ) {
    return null;
  }

  if (contract !== "xapps_payment_orchestration_v1") return null;

  return {
    contract: "xapps_payment_orchestration_v1",
    payment_session_id: paymentSessionId,
    status,
    receipt_id: receiptId,
    amount,
    currency,
    ts,
    issuer,
    xapp_id: xappId,
    tool_name: toolName,
    ...(subjectId ? { subject_id: subjectId } : {}),
    ...(installationId ? { installation_id: installationId } : {}),
    ...(clientId ? { client_id: clientId } : {}),
    ...(authorityLane ? { authority_lane: authorityLane } : {}),
    ...(signingLane ? { signing_lane: signingLane } : {}),
    ...(resolverSource ? { resolver_source: resolverSource } : {}),
    sig,
  };
}

export * from "./paymentHandler.js";

// ── Secret Resolution ────────────────────────────────────────────────

/** Maximum file size (bytes) for file: scheme secrets — prevents accidental reads of large files. */
const SECRET_FILE_MAX_BYTES = 8192;

export type SecretRefResolverOptions = {
  resolvePlatformSecretRef?: (input: {
    ref: string;
    name: string;
    scope?: string | null;
    scopeId?: string | null;
  }) => Promise<string | Buffer | null> | string | Buffer | null;
};

export type PaymentProviderCredentialRefs = Record<string, string>;

export type PaymentProviderCredentialRefNode = PaymentProviderCredentialRefs & {
  bundle_ref?: string;
};

export type PaymentProviderCredentialRefsByProvider = Record<
  string,
  PaymentProviderCredentialRefNode
>;

export type PaymentProviderCredentialsBundle = {
  refs?: PaymentProviderCredentialRefs;
  bundle_ref?: string;
  providers?: Record<
    string,
    {
      refs?: PaymentProviderCredentialRefs;
      values?: PaymentProviderCredentialRefs;
      bundle_ref?: string;
    }
  >;
};

function toCanonicalCredentialRefs(
  input?: Record<string, string | null | undefined> | null,
): PaymentProviderCredentialRefs | undefined {
  if (!input || typeof input !== "object") return undefined;
  const out: PaymentProviderCredentialRefs = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = String(rawKey || "").trim();
    const value = String(rawValue ?? "").trim();
    if (!key || !value) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readCanonicalBundleRef(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const raw = input as Record<string, unknown>;
  const value = String(
    raw.bundle_ref ?? raw.bundleRef ?? raw.secret_bundle_ref ?? raw.secretBundleRef ?? "",
  ).trim();
  return value || undefined;
}

function toCanonicalProviderCredentialRefNode(
  input?: Record<string, unknown> | null,
): PaymentProviderCredentialRefNode | undefined {
  if (!input || typeof input !== "object") return undefined;
  const bundleRef = readCanonicalBundleRef(input);
  const candidateRefs: Record<string, string | null | undefined> = {};
  const nestedRefs = [input.refs, input.secret_refs];
  for (const nested of nestedRefs) {
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    for (const [rawKey, rawValue] of Object.entries(nested)) {
      const key = String(rawKey || "").trim();
      if (!key) continue;
      candidateRefs[key] = String(rawValue ?? "");
    }
  }
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = String(rawKey || "").trim();
    if (
      !key ||
      key === "bundle_ref" ||
      key === "bundleRef" ||
      key === "secret_bundle_ref" ||
      key === "secretBundleRef" ||
      key === "refs" ||
      key === "secret_refs" ||
      key === "values" ||
      key === "credentials" ||
      key === "providers"
    ) {
      continue;
    }
    candidateRefs[key] = String(rawValue ?? "");
  }
  const refs = toCanonicalCredentialRefs(candidateRefs);
  if (!bundleRef && !refs) return undefined;
  return {
    ...(refs || {}),
    ...(bundleRef ? { bundle_ref: bundleRef } : {}),
  };
}

export function buildPaymentProviderCredentialRefsByProvider(
  input?: Record<string, Record<string, unknown> | null | undefined> | null,
): PaymentProviderCredentialRefsByProvider {
  const out: PaymentProviderCredentialRefsByProvider = {};
  if (!input || typeof input !== "object") return out;
  for (const [rawProvider, refs] of Object.entries(input)) {
    const provider = String(rawProvider || "")
      .trim()
      .toLowerCase();
    if (!provider) continue;
    const normalized = toCanonicalProviderCredentialRefNode(refs ?? undefined);
    if (!normalized) continue;
    out[provider] = normalized;
  }
  return out;
}

export function buildPaymentProviderCredentialsBundle(input?: {
  refs?: Record<string, string | null | undefined> | null;
  bundle_ref?: string | null;
  providers?: Record<string, Record<string, unknown> | null | undefined> | null;
}): PaymentProviderCredentialsBundle {
  const refs = toCanonicalCredentialRefs(input?.refs ?? undefined);
  const byProvider = buildPaymentProviderCredentialRefsByProvider(input?.providers ?? undefined);
  const providers: PaymentProviderCredentialsBundle["providers"] = {};
  for (const [provider, providerNode] of Object.entries(byProvider)) {
    const { bundle_ref, ...providerRefs } = providerNode;
    providers[provider] = {
      ...(Object.keys(providerRefs).length > 0 ? { refs: providerRefs } : {}),
      ...(bundle_ref ? { bundle_ref } : {}),
    };
  }
  const out: PaymentProviderCredentialsBundle = {};
  if (refs) out.refs = refs;
  if (String(input?.bundle_ref ?? "").trim()) out.bundle_ref = String(input?.bundle_ref).trim();
  if (Object.keys(providers).length > 0) out.providers = providers;
  return out;
}

function parsePlatformSecretRef(
  ref: string,
): { name: string; scope?: string | null; scopeId?: string | null } | null {
  const trimmed = String(ref || "").trim();
  if (!trimmed.toLowerCase().startsWith("platform://")) return null;
  const withoutScheme = trimmed.slice("platform://".length);
  const [nameRaw, queryRaw] = withoutScheme.split("?", 2);
  const name = String(nameRaw || "").trim();
  if (!name) return null;
  let scope: string | null = null;
  let scopeId: string | null = null;
  if (queryRaw) {
    const params = new URLSearchParams(queryRaw);
    const scopeParam = String(params.get("scope") || "").trim();
    const scopeIdParam = String(params.get("scope_id") || "").trim();
    if (scopeParam) scope = scopeParam;
    if (scopeIdParam) scopeId = scopeIdParam;
  }
  return { name, ...(scope ? { scope } : {}), ...(scopeId ? { scopeId } : {}) };
}

/**
 * Resolve a secret reference string.
 *
 * Supported schemes:
 * - `env:VAR_NAME`  — reads from process.env (most common)
 * - `file:/path`    — reads from filesystem, trimmed (Kubernetes secrets, Docker secrets)
 *
 * The gateway additionally supports `vault://` and `awssm://`.
 *
 * Security guarantees:
 * - Secrets are never logged, cached, or stored beyond the return value
 * - file: paths are validated (absolute, no traversal, size-limited)
 * - Errors never include the secret value
 */
export function resolveSecretFromRef(ref: string): string {
  const trimmed = ref.trim();

  // env: scheme
  if (trimmed.startsWith("env:")) {
    const envName = trimmed.slice(4).trim();
    if (!envName) throw new Error("Secret ref env: requires a variable name");
    const val = process.env[envName];
    if (!val) throw new Error(`Secret ref env:${envName} not found in environment`);
    return val;
  }

  // vault://, awssm:// and platform:// schemes require async/provider resolution.
  // The sync resolveSecretFromRef cannot handle them — direct callers to the async variant.
  if (
    trimmed.startsWith("vault://") ||
    trimmed.startsWith("awssm://") ||
    trimmed.startsWith("platform://")
  ) {
    const scheme = trimmed.startsWith("vault://")
      ? "vault://"
      : trimmed.startsWith("awssm://")
        ? "awssm://"
        : "platform://";
    throw new Error(
      `Secret ref ${scheme} requires async resolution. Use resolveSecretFromRefAsync() instead of resolveSecretFromRef().`,
    );
  }

  // file: scheme (for Kubernetes mounted secrets, Docker secrets, etc.)
  if (trimmed.startsWith("file:")) {
    const filePath = trimmed.slice(5).trim();
    if (!filePath) throw new Error("Secret ref file: requires a file path");

    // Security: require absolute path, reject directory traversal
    const path = require("node:path");
    const fs = require("node:fs");
    const resolved = path.resolve(filePath);
    if (resolved !== path.normalize(filePath)) {
      throw new Error("Secret ref file: path must be absolute and normalized (no .. traversal)");
    }

    let stat: any;
    try {
      stat = fs.statSync(resolved);
    } catch (err: any) {
      throw new Error(`Secret ref file: cannot read ${resolved} (${err?.code || "unknown"})`);
    }
    if (!stat.isFile()) {
      throw new Error(`Secret ref file: path is not a regular file`);
    }
    if (stat.size > SECRET_FILE_MAX_BYTES) {
      throw new Error(`Secret ref file: file exceeds ${SECRET_FILE_MAX_BYTES} byte limit`);
    }

    const content = fs.readFileSync(resolved, "utf8").trim();
    if (!content) throw new Error(`Secret ref file: file is empty after trimming`);
    return content;
  }

  throw new Error(
    `Unsupported secret ref scheme in SDK: ${trimmed}. Supported: env:, file:, vault://, awssm://, platform://.`,
  );
}

/**
 * Convenience: resolve a secret from either a direct value or a ref.
 * Use this anywhere you accept `{ secret?, secretRef? }` config.
 *
 * Precedence: secret > secretRef > throws.
 */
export function resolveSecret(input: {
  secret?: string | null;
  secretRef?: string | null;
  context?: string;
}): string {
  const direct = String(input.secret ?? "").trim();
  if (direct) return direct;

  const ref = String(input.secretRef ?? "").trim();
  if (ref) return resolveSecretFromRef(ref);

  const ctx = input.context ? ` (${input.context})` : "";
  throw new Error(`No secret or secretRef provided${ctx}`);
}

/**
 * Resolve a secret ref asynchronously. Supports all schemes including
 * vault:// (HashiCorp Vault KV v2), awssm:// (AWS Secrets Manager), and
 * platform:// (via provided resolver callback).
 *
 * For env: and file: schemes, this delegates to the sync resolveSecretFromRef.
 *
 * vault:// requires VAULT_ADDR and VAULT_TOKEN env vars.
 * awssm:// requires AWS_REGION and valid AWS credentials in the default provider chain.
 */
export async function resolveSecretFromRefAsync(
  ref: string,
  options?: SecretRefResolverOptions,
): Promise<string> {
  const trimmed = ref.trim();

  // vault:// scheme
  if (trimmed.startsWith("vault://")) {
    const vaultAddr = String(process.env.VAULT_ADDR || "").trim();
    const vaultToken = String(process.env.VAULT_TOKEN || "").trim();
    const vaultNamespace = String(process.env.VAULT_NAMESPACE || "").trim();
    if (!vaultAddr || !vaultToken) {
      throw new Error(
        "Secret ref vault:// requires VAULT_ADDR and VAULT_TOKEN environment variables",
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error(`Secret ref vault:// has invalid URI`);
    }
    const mount = String(parsed.hostname || "").trim();
    const vaultPath = parsed.pathname.replace(/^\/+/, "").trim();
    const field = String(parsed.hash || "")
      .replace(/^#/, "")
      .trim();
    if (!mount || !vaultPath) {
      throw new Error(`Secret ref vault:// must include mount and path`);
    }

    const encodedVaultPath = vaultPath
      .split("/")
      .map((segment: string) => encodeURIComponent(segment))
      .join("/");
    const url = new URL(`/v1/${encodeURIComponent(mount)}/data/${encodedVaultPath}`, vaultAddr);
    const headers: Record<string, string> = { "X-Vault-Token": vaultToken };
    if (vaultNamespace) headers["X-Vault-Namespace"] = vaultNamespace;

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error(`Secret ref vault:// secret not found`);
      throw new Error(`Secret ref vault:// request failed (HTTP ${response.status})`);
    }
    const body = (await response.json()) as any;
    const data = body?.data?.data;
    if (!data || typeof data !== "object") {
      throw new Error(`Secret ref vault:// response missing data payload`);
    }

    const candidateField = field || "value";
    const selected =
      data[candidateField] ??
      data.secret ??
      (Object.keys(data).length === 1 ? data[Object.keys(data)[0]] : undefined);
    if (selected === null || selected === undefined || String(selected).trim() === "") {
      throw new Error(`Secret ref vault:// resolved to empty value`);
    }
    return String(selected);
  }

  // awssm:// scheme
  if (trimmed.startsWith("awssm://")) {
    const region = String(process.env.AWS_REGION || "").trim();
    if (!region) {
      throw new Error("Secret ref awssm:// requires AWS_REGION environment variable");
    }
    const withoutScheme = trimmed.slice("awssm://".length);
    const [secretIdRaw, fieldRaw] = withoutScheme.split("#", 2);
    const secretId = String(secretIdRaw || "")
      .trim()
      .replace(/^\/+/, "");
    const field = fieldRaw ? String(fieldRaw).trim() : null;
    if (!secretId) {
      throw new Error(`Secret ref awssm:// must include a secret ID: ${trimmed}`);
    }

    const endpoint = `https://secretsmanager.${region}.amazonaws.com`;
    const body = JSON.stringify({ SecretId: secretId });

    // Use native fetch with SigV4 — requires @aws-sdk/credential-provider-node at runtime.
    // If not available, provide a clear error message.
    let signedHeaders: Record<string, string>;
    try {
      const { defaultProvider } = await import("@aws-sdk/credential-provider-node");
      const { SignatureV4 } = await import("@smithy/signature-v4");
      const { Hash } = await import("@smithy/hash-node");
      const { HttpRequest } = await import("@smithy/protocol-http");

      class Sha256 extends Hash {
        constructor(secret?: Uint8Array) {
          super("sha256", secret);
        }
      }
      const credentials = defaultProvider();
      const signer = new SignatureV4({
        credentials,
        region,
        service: "secretsmanager",
        sha256: Sha256 as any,
      });
      const request = new HttpRequest({
        protocol: "https:",
        method: "POST",
        hostname: `secretsmanager.${region}.amazonaws.com`,
        path: "/",
        headers: {
          host: `secretsmanager.${region}.amazonaws.com`,
          "content-type": "application/x-amz-json-1.1",
          "x-amz-target": "secretsmanager.GetSecretValue",
        },
        body,
      });
      const signed = (await signer.sign(request)) as any;
      signedHeaders = signed.headers;
    } catch (err: any) {
      throw new Error(
        `Secret ref awssm:// requires @aws-sdk/credential-provider-node and @smithy packages. Install them or use env:/file: scheme instead. (${err?.message || "import failed"})`,
      );
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: signedHeaders,
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const payload = (await response.json()) as any;
    if (!response.ok) {
      throw new Error(`Secret ref awssm:// request failed (HTTP ${response.status})`);
    }

    const secretString = typeof payload?.SecretString === "string" ? payload.SecretString : null;
    if (!secretString) {
      throw new Error(`Secret ref awssm:// resolved to empty value`);
    }

    if (field) {
      let parsed: any;
      try {
        parsed = JSON.parse(secretString);
      } catch {
        parsed = null;
      }
      const selected = parsed?.[field];
      if (selected === null || selected === undefined || String(selected).trim() === "") {
        throw new Error(`Secret ref awssm:// field "${field}" not found or empty`);
      }
      return String(selected);
    }

    return secretString;
  }

  // platform:// scheme
  if (trimmed.startsWith("platform://")) {
    const parsed = parsePlatformSecretRef(trimmed);
    if (!parsed) {
      throw new Error(`Secret ref platform:// has invalid URI`);
    }
    const resolver = options?.resolvePlatformSecretRef;
    if (!resolver) {
      throw new Error(
        "Secret ref platform:// requires resolvePlatformSecretRef option in resolveSecretFromRefAsync().",
      );
    }
    const resolved = await resolver({
      ref: trimmed,
      name: parsed.name,
      scope: parsed.scope ?? null,
      scopeId: parsed.scopeId ?? null,
    });
    const value = Buffer.isBuffer(resolved)
      ? resolved.toString("utf8")
      : String(resolved ?? "").trim();
    if (!value) {
      throw new Error(`Secret ref platform:// resolved to empty value`);
    }
    return value;
  }

  // For env: and file: schemes, delegate to sync resolver
  return resolveSecretFromRef(ref);
}

/**
 * Async convenience: resolve a secret from either a direct value or a ref.
 * Supports all schemes including vault:// and awssm://.
 */
export async function resolveSecretAsync(input: {
  secret?: string | null;
  secretRef?: string | null;
  context?: string;
  resolverOptions?: SecretRefResolverOptions;
}): Promise<string> {
  const direct = String(input.secret ?? "").trim();
  if (direct) return direct;

  const ref = String(input.secretRef ?? "").trim();
  if (ref) return resolveSecretFromRefAsync(ref, input.resolverOptions);

  const ctx = input.context ? ` (${input.context})` : "";
  throw new Error(`No secret or secretRef provided${ctx}`);
}

export function parsePaymentReturnEvidenceFromSearch(
  search: string,
): XappsPaymentReturnEvidence | null {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  return parsePaymentReturnEvidence(params);
}

export function buildPaymentReturnCanonicalString(input: {
  contract: XappsPaymentReturnContract;
  payment_session_id: string;
  status: string;
  receipt_id: string;
  amount: string;
  currency: string;
  ts: string;
  issuer: string;
  xapp_id: string;
  tool_name: string;
  subject_id?: string | null;
  installation_id?: string | null;
  client_id?: string | null;
  authority_lane?: string | null;
  signing_lane?: string | null;
  resolver_source?: string | null;
}): string {
  const canonicalAmount = canonicalizePaymentAmount(input.amount);
  if (!canonicalAmount) {
    throw new Error("payment amount must be canonical decimal string with 2 fraction digits");
  }
  const base = [
    `contract=${input.contract}`,
    `payment_session_id=${input.payment_session_id}`,
    `status=${input.status}`,
    `receipt_id=${input.receipt_id}`,
    `amount=${canonicalAmount}`,
    `currency=${input.currency}`,
    `ts=${input.ts}`,
    `issuer=${input.issuer}`,
    `xapp_id=${input.xapp_id}`,
    `tool_name=${input.tool_name}`,
    `subject_id=${String(input.subject_id || "")}`,
    `installation_id=${String(input.installation_id || "")}`,
    `client_id=${String(input.client_id || "")}`,
  ];
  const authorityLane = String(input.authority_lane || "").trim();
  const signingLane = String(input.signing_lane || "").trim();
  const resolverSource = String(input.resolver_source || "").trim();
  if (authorityLane || signingLane || resolverSource) {
    base.push(
      `authority_lane=${authorityLane}`,
      `signing_lane=${signingLane}`,
      `resolver_source=${resolverSource}`,
    );
  }
  return base.join("\n");
}

export function signPaymentReturnEvidence(input: {
  evidence: Omit<XappsPaymentReturnEvidence, "sig">;
  secret: string | Buffer;
}): string {
  const canonical = buildPaymentReturnCanonicalString(input.evidence);
  return createHmac("sha256", toBuffer(input.secret)).update(canonical).digest("base64url");
}

export function buildPaymentReturnQueryParams(input: {
  evidence: XappsPaymentReturnEvidence;
  resumeToken?: string | null;
}): URLSearchParams {
  const evidence = input.evidence;
  const canonicalAmount = canonicalizePaymentAmount(evidence.amount);
  if (!canonicalAmount) {
    throw new Error("payment amount must be canonical decimal string with 2 fraction digits");
  }
  const params = new URLSearchParams();
  params.set("xapps_payment_contract", evidence.contract);
  params.set("xapps_payment_session_id", evidence.payment_session_id);
  params.set("xapps_payment_status", evidence.status);
  params.set("xapps_payment_receipt_id", evidence.receipt_id);
  params.set("xapps_payment_amount", canonicalAmount);
  params.set("xapps_payment_currency", evidence.currency);
  params.set("xapps_payment_ts", evidence.ts);
  params.set("xapps_payment_issuer", evidence.issuer);
  if (evidence.subject_id) params.set("xapps_payment_subject_id", evidence.subject_id);
  if (evidence.installation_id)
    params.set("xapps_payment_installation_id", evidence.installation_id);
  if (evidence.client_id) params.set("xapps_payment_client_id", evidence.client_id);
  if (evidence.authority_lane) params.set("xapps_payment_authority_lane", evidence.authority_lane);
  if (evidence.signing_lane) params.set("xapps_payment_signing_lane", evidence.signing_lane);
  if (evidence.resolver_source)
    params.set("xapps_payment_resolver_source", evidence.resolver_source);
  params.set("xapps_payment_sig", evidence.sig);

  // Keep context fields available in return URL to simplify downstream verification.
  params.set("xapp_id", evidence.xapp_id);
  params.set("tool_name", evidence.tool_name);

  const resumeToken = String(input.resumeToken || "").trim();
  if (resumeToken) params.set("xapps_resume", resumeToken);
  return params;
}

export function buildSignedPaymentReturnRedirectUrl(
  input: BuildSignedPaymentReturnRedirectInput,
): string {
  const returnUrl = String(input.returnUrl || "").trim();
  if (!returnUrl) {
    throw new Error("returnUrl is required");
  }
  const signedEvidence: XappsPaymentReturnEvidence = {
    ...input.evidence,
    sig: signPaymentReturnEvidence({
      evidence: input.evidence,
      secret: input.secret,
    }),
  };
  const params = buildPaymentReturnQueryParams({
    evidence: signedEvidence,
    resumeToken: input.resumeToken,
  });
  const redirectUrl = new URL(returnUrl);
  for (const [k, v] of params.entries()) {
    redirectUrl.searchParams.set(k, v);
  }
  return redirectUrl.toString();
}

/**
 * Verifies signed payment-return evidence against timestamp, signature, and optional context
 * expectations before a host/backend trusts the returned payment state.
 */
export function verifyPaymentReturnEvidence(
  input: VerifyPaymentReturnEvidenceInput,
): VerifyPaymentReturnEvidenceResult {
  const evidence = input.evidence;
  if (!evidence || typeof evidence !== "object") {
    return { ok: false, reason: "payment_evidence_malformed" };
  }
  if (
    String(evidence.contract || "")
      .trim()
      .toLowerCase() !== "xapps_payment_orchestration_v1"
  ) {
    return {
      ok: false,
      reason: "payment_evidence_contract_unsupported",
      details: { contract: evidence.contract || null },
    };
  }

  const status = String(evidence.status || "")
    .trim()
    .toLowerCase();
  const requirePaidStatus = input.expected?.require_paid_status !== false;
  if (requirePaidStatus && status !== "paid") {
    return {
      ok: false,
      reason: "payment_not_settled",
      details: { status: evidence.status || null },
    };
  }

  const ts = String(evidence.ts || "").trim();
  const tsMs = Date.parse(ts);
  if (!Number.isFinite(tsMs) || Number.isNaN(tsMs)) {
    return {
      ok: false,
      reason: "payment_evidence_timestamp_invalid",
      details: { ts },
    };
  }
  const maxAgeSeconds = Math.max(30, Number(input.maxAgeSeconds ?? 900) || 900);
  const nowMs = Number(input.nowMs ?? Date.now());
  if (Math.abs(nowMs - tsMs) > maxAgeSeconds * 1000) {
    return {
      ok: false,
      reason: "payment_evidence_expired",
      details: { ts, max_age_s: maxAgeSeconds },
    };
  }

  const configuredIssuers = Array.from(
    new Set(
      [
        ...(Array.isArray(input.expected?.issuers) ? input.expected!.issuers : []),
        ...(input.expected?.issuer ? [input.expected.issuer] : []),
      ]
        .map((value) =>
          String(value || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  );
  const allowedIssuers =
    configuredIssuers.length > 0
      ? configuredIssuers
      : ["gateway", "tenant", "publisher", "tenant_delegated", "publisher_delegated"];
  const issuer = String(evidence.issuer || "")
    .trim()
    .toLowerCase();
  if (!allowedIssuers.includes(issuer)) {
    return {
      ok: false,
      reason: "payment_issuer_not_allowed",
      details: { issuer, allowed_issuers: allowedIssuers },
    };
  }

  const expectedContextPairs: Array<[string, string | null | undefined, string | undefined]> = [
    ["xapp_id", input.expected?.xapp_id ?? null, evidence.xapp_id],
    ["tool_name", input.expected?.tool_name ?? null, evidence.tool_name],
    ["subject_id", input.expected?.subject_id ?? null, evidence.subject_id],
    ["installation_id", input.expected?.installation_id ?? null, evidence.installation_id],
    ["client_id", input.expected?.client_id ?? null, evidence.client_id],
  ];
  for (const [field, expectedRaw, actualRaw] of expectedContextPairs) {
    if (expectedRaw == null || String(expectedRaw).trim() === "") continue;
    if (String(expectedRaw).trim() !== String(actualRaw || "").trim()) {
      return {
        ok: false,
        reason: "payment_context_mismatch",
        details: {
          field,
          expected: String(expectedRaw).trim(),
          actual: String(actualRaw || "").trim() || null,
        },
      };
    }
  }

  const actualAmountCanonical = canonicalizePaymentAmount(evidence.amount);
  if (!actualAmountCanonical) {
    return {
      ok: false,
      reason: "payment_evidence_malformed",
      details: { field: "amount", amount: evidence.amount ?? null },
    };
  }
  if (input.expected && input.expected.amount != null) {
    const expectedAmountCanonical = canonicalizePaymentAmount(input.expected.amount);
    if (!expectedAmountCanonical || expectedAmountCanonical !== actualAmountCanonical) {
      return {
        ok: false,
        reason: "payment_amount_mismatch",
        details: {
          expected_amount: expectedAmountCanonical ?? String(input.expected.amount),
          actual_amount: actualAmountCanonical,
        },
      };
    }
  }

  if (input.expected && input.expected.currency != null) {
    const expectedCurrency = String(input.expected.currency || "")
      .trim()
      .toUpperCase();
    const actualCurrency = String(evidence.currency || "")
      .trim()
      .toUpperCase();
    if (expectedCurrency && expectedCurrency !== actualCurrency) {
      return {
        ok: false,
        reason: "payment_currency_mismatch",
        details: { expected_currency: expectedCurrency, actual_currency: actualCurrency || null },
      };
    }
  }

  const canonical = buildPaymentReturnCanonicalString({
    contract: "xapps_payment_orchestration_v1",
    payment_session_id: evidence.payment_session_id,
    status,
    receipt_id: evidence.receipt_id,
    amount: actualAmountCanonical,
    currency: String(evidence.currency || "")
      .trim()
      .toUpperCase(),
    ts: evidence.ts,
    issuer,
    xapp_id: evidence.xapp_id,
    tool_name: evidence.tool_name,
    subject_id: evidence.subject_id || "",
    installation_id: evidence.installation_id || "",
    client_id: evidence.client_id || "",
    authority_lane: evidence.authority_lane || "",
    signing_lane: evidence.signing_lane || "",
    resolver_source: evidence.resolver_source || "",
  });
  const computedSig = createHmac("sha256", toBuffer(input.secret))
    .update(canonical)
    .digest("base64url");
  if (!safeEqualString(String(evidence.sig || ""), computedSig)) {
    return {
      ok: false,
      reason: "payment_signature_invalid",
      details: { issuer, contract: evidence.contract },
    };
  }

  return { ok: true };
}

export function verifyXappsSignature(input: VerifyXappsSignatureInput): VerifyXappsSignatureResult {
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxSkewSeconds = input.maxSkewSeconds ?? 300;
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  if (Math.abs(nowSeconds - ts) > maxSkewSeconds) {
    return { ok: false, reason: "timestamp_skew" };
  }

  const requireSource = input.requireSourceInSignature === true;
  if (requireSource && !input.source) {
    return { ok: false, reason: "missing_source" };
  }

  const algorithm = input.algorithm ?? "hmac-sha256";
  const secret = toBuffer(input.secret);
  const canonical = buildCanonicalString({
    method: input.method,
    pathWithQuery: input.pathWithQuery,
    timestamp: input.timestamp,
    bodySha256Hex: sha256Hex(input.body),
  });

  const withSource = requireSource && input.source ? `${canonical}\n${input.source}` : canonical;
  if (verifyByAlgorithm(withSource, input.signature, secret, algorithm)) {
    return { ok: true, mode: "strict" };
  }

  if (input.allowLegacyWithoutSource === false) {
    return { ok: false, reason: "bad_signature" };
  }

  if (
    withSource !== canonical &&
    verifyByAlgorithm(canonical, input.signature, secret, algorithm)
  ) {
    return { ok: true, mode: "legacy" };
  }

  return { ok: false, reason: "bad_signature" };
}

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function isSubjectProofResult(value: unknown): value is SubjectProofVerifierResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ok = (value as any).ok;
  if (ok === true) return true;
  return ok === false && typeof (value as any).reason === "string";
}

/**
 * Validates and normalizes the canonical dispatch payload delivered to tenant/publisher executors.
 */
export function parseDispatchRequest(input: unknown): DispatchRequestPayload {
  assertRecord(input, "Dispatch payload must be an object");
  const requestId = String(input.requestId ?? "").trim();
  const toolName = String(input.toolName ?? "").trim();
  const payload = input.payload;

  if (!requestId) {
    throw new Error("Dispatch payload missing requestId");
  }
  if (!toolName) {
    throw new Error("Dispatch payload missing toolName");
  }
  assertRecord(payload, "Dispatch payload.payload must be an object");

  return {
    requestId,
    toolName,
    payload,
    chainContext:
      input.chainContext &&
      typeof input.chainContext === "object" &&
      !Array.isArray(input.chainContext)
        ? (input.chainContext as Record<string, unknown>)
        : undefined,
    subjectId: input.subjectId == null ? null : String(input.subjectId),
    userEmail: input.userEmail == null ? null : String(input.userEmail),
    async: input.async === true,
    callbackToken: input.callbackToken == null ? null : String(input.callbackToken),
    subjectActionPayload:
      input.subjectActionPayload == null ? null : String(input.subjectActionPayload),
    subjectProof: input.subjectProof,
  };
}

function resolveFetch(impl?: typeof fetch): typeof fetch {
  const candidate = impl ?? (globalThis as any).fetch;
  if (typeof candidate !== "function") {
    fail("FETCH_UNAVAILABLE", "fetch implementation is required");
  }
  return candidate as typeof fetch;
}

let cachedSubjectProofVerifierModule: SubjectProofVerifierModule | null = null;

async function resolveSubjectProofVerifierModule(
  options?: SubjectProofVerificationOptions,
): Promise<SubjectProofVerifierModule> {
  if (options?.verifierModule) {
    return options.verifierModule;
  }
  if (cachedSubjectProofVerifierModule) {
    return cachedSubjectProofVerifierModule;
  }
  let mod: unknown;
  const moduleNames = ["@xapps-platform/publisher-verifier", "@xapps/publisher-verifier"];
  let lastError: unknown;
  for (const moduleName of moduleNames) {
    try {
      mod = await import(moduleName);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!mod) {
    fail(
      "VERIFIER_UNAVAILABLE",
      "Subject proof verifier module is unavailable. Install/provide @xapps-platform/publisher-verifier.",
      { cause: lastError },
    );
  }
  if (
    !mod ||
    typeof mod !== "object" ||
    typeof (mod as any).verifySubjectProofEnvelope !== "function" ||
    typeof (mod as any).verifyJwsSubjectProof !== "function" ||
    typeof (mod as any).verifyWebauthnSubjectProof !== "function"
  ) {
    fail("VERIFIER_UNAVAILABLE", "Invalid subject proof verifier module");
  }
  cachedSubjectProofVerifierModule = mod as SubjectProofVerifierModule;
  return cachedSubjectProofVerifierModule;
}

export async function verifySubjectProofEnvelope(
  input: VerifySubjectProofEnvelopeInput,
  options?: SubjectProofVerificationOptions,
): Promise<SubjectProofVerifierResult> {
  const verifier = await resolveSubjectProofVerifierModule(options);
  const result = await verifier.verifySubjectProofEnvelope(input);
  if (!isSubjectProofResult(result)) {
    fail("VERIFIER_INVALID_RESULT", "verifySubjectProofEnvelope returned an invalid result shape");
  }
  return result;
}

export async function verifyJwsSubjectProof(
  input: VerifyJwsSubjectProofInput,
  options?: SubjectProofVerificationOptions,
): Promise<SubjectProofVerifierResult> {
  const verifier = await resolveSubjectProofVerifierModule(options);
  const result = await verifier.verifyJwsSubjectProof(input);
  if (!isSubjectProofResult(result)) {
    fail("VERIFIER_INVALID_RESULT", "verifyJwsSubjectProof returned an invalid result shape");
  }
  return result;
}

export async function verifyWebauthnSubjectProof(
  input: VerifyWebauthnSubjectProofInput,
  options?: SubjectProofVerificationOptions,
): Promise<SubjectProofVerifierResult> {
  const verifier = await resolveSubjectProofVerifierModule(options);
  const result = await verifier.verifyWebauthnSubjectProof(input);
  if (!isSubjectProofResult(result)) {
    fail("VERIFIER_INVALID_RESULT", "verifyWebauthnSubjectProof returned an invalid result shape");
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function normalizeRetryPolicy(input?: CallbackRetryPolicy): Required<CallbackRetryPolicy> {
  const maxAttempts = Math.max(1, Math.min(6, Number(input?.maxAttempts ?? 1)));
  const baseDelayMs = Math.max(0, Number(input?.baseDelayMs ?? 150));
  const maxDelayMs = Math.max(baseDelayMs, Number(input?.maxDelayMs ?? 1200));
  const retryOnStatus =
    Array.isArray(input?.retryOnStatus) && input?.retryOnStatus.length
      ? input.retryOnStatus.filter(
          (value) => Number.isInteger(value) && value >= 100 && value <= 599,
        )
      : [408, 425, 429, 500, 502, 503, 504];
  return { maxAttempts, baseDelayMs, maxDelayMs, retryOnStatus };
}

function assertNonEmpty(value: unknown, name: string): string {
  const next = String(value ?? "").trim();
  if (!next) {
    fail("INVALID_ARGUMENT", `${name} is required`);
  }
  return next;
}

function normalizeBaseUrl(value: unknown): string {
  const raw = assertNonEmpty(value, "baseUrl");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch (err) {
    fail("INVALID_ARGUMENT", "baseUrl must be a valid URL", { cause: err });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail("INVALID_ARGUMENT", "baseUrl must use http or https");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function postJsonOnce(
  fetchImpl: typeof fetch,
  baseUrl: string,
  callbackToken: string,
  path: string,
  body: unknown,
  idempotencyKey?: string,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${callbackToken}`,
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    });
  } catch (err) {
    fail("CALLBACK_NETWORK_ERROR", "Callback network request failed", {
      retryable: true,
      cause: err,
    });
  }

  const contentType = String(response.headers.get("content-type") || "");
  const parsed = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof parsed === "object" && parsed && "message" in parsed
        ? String((parsed as any).message)
        : `${response.status}`;
    fail("CALLBACK_HTTP_ERROR", `Callback request failed (${response.status}): ${message}`, {
      status: response.status,
    });
  }

  return { status: response.status, body: parsed };
}

function isRetryableStatus(status: number, policy: Required<CallbackRetryPolicy>): boolean {
  return policy.retryOnStatus.includes(status);
}

function toRetryableCallbackError(
  err: unknown,
  policy: Required<CallbackRetryPolicy>,
): { error: XappsServerSdkError; retryable: boolean } {
  if (err instanceof XappsServerSdkError) {
    if (err.code === "CALLBACK_HTTP_ERROR" && typeof err.status === "number") {
      return { error: err, retryable: isRetryableStatus(err.status, policy) };
    }
    return { error: err, retryable: err.retryable };
  }
  return {
    error: new XappsServerSdkError({
      code: "CALLBACK_NETWORK_ERROR",
      message: "Callback request failed",
      retryable: true,
      cause: err,
    }),
    retryable: true,
  };
}

async function postJson(
  fetchImpl: typeof fetch,
  baseUrl: string,
  callbackToken: string,
  path: string,
  body: unknown,
  idempotencyKey: string | undefined,
  retryPolicy: Required<CallbackRetryPolicy>,
): Promise<{ status: number; body: unknown }> {
  let lastError: XappsServerSdkError | null = null;
  for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt += 1) {
    try {
      return await postJsonOnce(fetchImpl, baseUrl, callbackToken, path, body, idempotencyKey);
    } catch (err) {
      const mapped = toRetryableCallbackError(err, retryPolicy);
      lastError = mapped.error;
      if (!mapped.retryable || attempt >= retryPolicy.maxAttempts) {
        break;
      }
      const delayMs = Math.min(
        retryPolicy.maxDelayMs,
        retryPolicy.baseDelayMs * 2 ** (attempt - 1),
      );
      await sleep(delayMs);
    }
  }
  fail("CALLBACK_RETRY_EXHAUSTED", "Callback request failed after retries", {
    retryable: false,
    cause: lastError,
    status: lastError?.status,
  });
}

/**
 * Creates a callback client for sending request events/completions back to the gateway with
 * optional retry and idempotency policies.
 */
export function createCallbackClient(options: CallbackClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const callbackToken = assertNonEmpty(options.callbackToken, "callbackToken");
  const fetchImpl = resolveFetch(options.fetchImpl);
  const defaultRetry = normalizeRetryPolicy(options.retry);
  const idempotencyKeyFactory =
    typeof options.idempotencyKeyFactory === "function" ? options.idempotencyKeyFactory : null;

  return {
    async sendEvent(
      requestId: string,
      input: CallbackClientEventInput,
      opts?: { idempotencyKey?: string; retry?: CallbackRetryPolicy },
    ) {
      const id = assertNonEmpty(requestId, "sendEvent.requestId");
      const eventType = assertNonEmpty(input?.type, "sendEvent.input.type");
      const payload = {
        type: eventType,
        message: input?.message,
        data: input?.data,
      };
      const resolvedIdempotencyKey =
        String(opts?.idempotencyKey || "").trim() ||
        idempotencyKeyFactory?.({ operation: "event", requestId: id, payload });
      return postJson(
        fetchImpl,
        baseUrl,
        callbackToken,
        `/v1/requests/${encodeURIComponent(id)}/events`,
        payload,
        resolvedIdempotencyKey,
        normalizeRetryPolicy(opts?.retry ?? defaultRetry),
      );
    },

    async complete(
      requestId: string,
      input: CallbackClientCompleteInput,
      opts?: { idempotencyKey?: string; retry?: CallbackRetryPolicy },
    ) {
      const id = assertNonEmpty(requestId, "complete.requestId");
      const status = assertNonEmpty(input?.status, "complete.input.status");
      const payload = {
        status,
        result: input?.result,
        message: input?.message,
      };
      const resolvedIdempotencyKey =
        String(opts?.idempotencyKey || "").trim() ||
        idempotencyKeyFactory?.({ operation: "complete", requestId: id, payload });
      return postJson(
        fetchImpl,
        baseUrl,
        callbackToken,
        `/v1/requests/${encodeURIComponent(id)}/complete`,
        payload,
        resolvedIdempotencyKey,
        normalizeRetryPolicy(opts?.retry ?? defaultRetry),
      );
    },
  };
}
