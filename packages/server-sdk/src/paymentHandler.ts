import { randomUUID } from "node:crypto";
import {
  buildSignedPaymentReturnRedirectUrl,
  parsePaymentReturnEvidence,
  verifyPaymentReturnEvidence,
  resolveSecretFromRef,
  resolveSecretFromRefAsync,
  type SecretRefResolverOptions,
  type XappsPaymentReturnContract,
  type XappsPaymentReturnEvidence,
} from "./index.js";
import type { PaymentSessionRecord, CompletePaymentSessionInput } from "./gatewayApiClient.js";

// ── Session Shape ────────────────────────────────────────────────────

export type PaymentSession = {
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
  status: "pending" | "completed" | "authorized";
  created_at_ms: number;
  expires_at_ms: number;
  receipt_id?: string | null;
  completed_redirect_url?: string | null;
  completed_at_ms?: number | null;
  authorized_at_ms?: number | null;
  authority_lane_hint?: string;
  signing_lane_hint?: string;
  resolver_source_hint?: string;
};

// ── Session Store Interface ──────────────────────────────────────────

export interface PaymentSessionStore {
  get(id: string): PaymentSession | null | Promise<PaymentSession | null>;
  set(id: string, session: PaymentSession): void | Promise<void>;
  delete(id: string): void | Promise<void>;
  prune?(): void | Promise<void>;
}

// ── Settlement Callback ──────────────────────────────────────────────

export type SettlementResult = {
  status: "paid" | "authorized" | (string & {});
  receipt_id?: string;
};

export type OnSettlementCallback = (
  session: PaymentSession,
) => SettlementResult | Promise<SettlementResult>;

// ── Framework-Agnostic Request/Response ──────────────────────────────

export type HandlerRequest = {
  query: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
};

export type HandlerResponse = {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
};

// ── Gateway Client Type ──────────────────────────────────────────────

/** Minimal gateway client shape used by the handler (subset of createGatewayApiClient return). */
export type PaymentHandlerGatewayClient = {
  getPaymentSession(paymentSessionId: string): Promise<{ session: PaymentSessionRecord }>;
  completePaymentSession(input: CompletePaymentSessionInput): Promise<unknown>;
};

// ── Handler Configuration ────────────────────────────────────────────

export type PaymentHandlerConfig = {
  /** HMAC secret for signing payment return evidence. */
  secret?: string;

  /**
   * Secret reference (e.g. "env:MY_SECRET_VAR") resolved via resolveSecretFromRef.
   * If both `secret` and `secretRef` are provided, `secret` takes precedence.
   */
  secretRef?: string;
  /**
   * Optional resolver options for async secret_ref resolution (used by createPaymentHandlerAsync).
   */
  secretRefResolverOptions?: SecretRefResolverOptions;

  /**
   * XPO-Core issuer lane identifier (for example: "tenant", "publisher",
   * "gateway", "tenant_delegated", "publisher_delegated").
   */
  issuer: string;

  /** Return URL allowlist (comma/newline-separated string or array). Empty = loopback-only. */
  returnUrlAllowlist?: string | string[];

  /** Session store implementation. Defaults to InMemoryPaymentSessionStore (dev only). */
  store?: PaymentSessionStore;

  /** Session TTL in seconds. Default: 1800 (30 minutes). Minimum: 60. */
  sessionTtlSeconds?: number;

  /**
   * Settlement callback invoked during /complete.
   * Lets tenant/publisher perform their own provider logic (e.g. Stripe charge).
   * If omitted, handler auto-settles with status "paid" and a generated receipt_id.
   */
  onSettlement?: OnSettlementCallback;

  /**
   * Gateway API client instance (from createGatewayApiClient).
   * If provided, GET /session and /complete may mirror canonical session state
   * from gateway into local store when local state is absent.
   * If omitted, handler stays local owner-managed.
   */
  gatewayClient?: PaymentHandlerGatewayClient;

  /**
   * Optional callback to notify gateway of completion (fire-and-forget).
   * If gatewayClient is provided and this is omitted, handler automatically
   * calls gatewayClient.completePaymentSession().
   */
  onGatewayNotify?: (session: PaymentSession, redirectUrl: string) => void | Promise<void>;

  /**
   * If true (default), throws on construction when NODE_ENV=production
   * and store is InMemoryPaymentSessionStore.
   */
  requirePersistentStoreInProduction?: boolean;
};

// ── Evidence Verification Types ──────────────────────────────────────

export type VerifyEvidenceInput = {
  /** The guard payload containing payment evidence fields. */
  payload: Record<string, unknown>;

  /** Max age in seconds for evidence timestamp (default: 900). */
  maxAgeSeconds?: number;

  /** Optional expected field overrides (fall back to session values). */
  expected?: {
    issuer?: string;
    issuers?: string[];
    amount?: string | number;
    currency?: string;
    xapp_id?: string;
    tool_name?: string;
    subject_id?: string;
    installation_id?: string;
    client_id?: string;
  };
};

export type VerifyEvidenceResult =
  | {
      ok: true;
      evidence: XappsPaymentReturnEvidence;
      session: PaymentSession;
    }
  | {
      ok: false;
      reason: string;
      details?: Record<string, unknown>;
    };

// ── Handler Return Type ──────────────────────────────────────────────

export type PaymentHandler = {
  /** Handle GET /session?payment_session_id=X */
  handleGetSession(req: HandlerRequest): Promise<HandlerResponse>;

  /** Handle POST /complete { payment_session_id, ... } */
  handleComplete(req: HandlerRequest): Promise<HandlerResponse>;

  /**
   * Verify payment return evidence from a guard payload.
   *
   * Performs the full verification workflow:
   * 1. Parse evidence from payload
   * 2. Fetch session (local store, then gateway mirror path when configured)
   * 3. Check session status (completed, not already authorized)
   * 4. Verify HMAC signature against expected fields
   * 5. Mark session as authorized
   */
  handleVerifyEvidence(input: VerifyEvidenceInput): Promise<VerifyEvidenceResult>;

  /** Direct session lookup for custom flows. */
  getSession(id: string): Promise<PaymentSession | null>;

  /** Create or update a session in the store. */
  upsertSession(
    input: Partial<PaymentSession> & { payment_session_id: string },
  ): Promise<PaymentSession>;

  /** Check if a return URL is allowed by the configured allowlist. */
  isAllowedReturnUrl(url: string): boolean;
};

// ── InMemoryPaymentSessionStore ──────────────────────────────────────

export class InMemoryPaymentSessionStore implements PaymentSessionStore {
  private sessions = new Map<string, PaymentSession>();
  private ttlMs: number;

  constructor(ttlMs: number = 1_800_000) {
    this.ttlMs = ttlMs;
  }

  get(id: string): PaymentSession | null {
    this.prune();
    const s = this.sessions.get(id);
    if (!s) return null;
    if (s.expires_at_ms <= Date.now()) {
      this.sessions.delete(id);
      return null;
    }
    return s;
  }

  set(id: string, session: PaymentSession): void {
    this.sessions.set(id, session);
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  prune(): void {
    const now = Date.now();
    for (const [id, s] of this.sessions.entries()) {
      if (!s || typeof s !== "object") {
        this.sessions.delete(id);
        continue;
      }
      if ((s.expires_at_ms ?? 0) <= now) {
        this.sessions.delete(id);
        continue;
      }
      if (s.status === "authorized" && (s.authorized_at_ms ?? 0) + 60_000 <= now) {
        this.sessions.delete(id);
      }
    }
  }
}

// ── Standalone Utility Exports ───────────────────────────────────────

/**
 * Decode a base64url-encoded JSON resume token.
 * Returns the parsed object, or null if input is invalid.
 */
export function parseResumeToken(input: string | null | undefined): Record<string, unknown> | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  try {
    const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Encode a JSON payload as a base64url resume token.
 */
export function buildResumeToken(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/**
 * Check if a URL is allowed by a given allowlist.
 * If the allowlist is empty, only loopback hosts (localhost, 127.0.0.1, ::1)
 * are allowed. Protocol must be http or https.
 */
export function isAllowedReturnUrl(input: string, allowlist: string[]): boolean {
  const raw = String(input ?? "").trim();
  if (!raw) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (allowlist.length > 0) {
    const href = parsed.toString();
    const origin = parsed.origin;
    return allowlist.some((entry) => {
      if (origin === entry) return true;
      if (!href.startsWith(entry)) return false;
      // Prevent path-prefix confusion: entry "https://x.com/cb" must not match "https://x.com/cbevil"
      const rest = href.slice(entry.length);
      return rest === "" || rest[0] === "/" || rest[0] === "?" || rest[0] === "#";
    });
  }
  const h = parsed.hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

// ── Internal Helpers ─────────────────────────────────────────────────

function parseAllowlist(input: string | string[] | undefined): string[] {
  if (Array.isArray(input)) return input.map((e) => e.trim().replace(/\/+$/, "")).filter(Boolean);
  return String(input ?? "")
    .split(/[,\n]/)
    .map((e) => e.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function readStringField(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!obj) return "";
  for (const key of keys) {
    const raw = obj[key];
    const normalized = raw == null ? "" : String(raw).trim();
    if (normalized) return normalized;
  }
  return "";
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function mirrorGatewaySession(
  gw: Record<string, unknown>,
  issuer: string,
  overrides: Record<string, unknown> = {},
): Partial<PaymentSession> & { payment_session_id: string } {
  const metadataRaw =
    (gw.metadata_jsonb && typeof gw.metadata_jsonb === "object" && !Array.isArray(gw.metadata_jsonb)
      ? (gw.metadata_jsonb as Record<string, unknown>)
      : null) ||
    (gw.metadata && typeof gw.metadata === "object" && !Array.isArray(gw.metadata)
      ? (gw.metadata as Record<string, unknown>)
      : null);
  const signingRaw =
    metadataRaw &&
    metadataRaw.payment_return_signing &&
    typeof metadataRaw.payment_return_signing === "object" &&
    !Array.isArray(metadataRaw.payment_return_signing)
      ? (metadataRaw.payment_return_signing as Record<string, unknown>)
      : null;
  const policyRaw =
    (gw.payment_return_policy_jsonb &&
    typeof gw.payment_return_policy_jsonb === "object" &&
    !Array.isArray(gw.payment_return_policy_jsonb)
      ? (gw.payment_return_policy_jsonb as Record<string, unknown>)
      : null) ||
    (gw.payment_return_policy &&
    typeof gw.payment_return_policy === "object" &&
    !Array.isArray(gw.payment_return_policy)
      ? (gw.payment_return_policy as Record<string, unknown>)
      : null);
  const authorityLaneHint = String(
    policyRaw?.issuer ??
      signingRaw?.authority_lane ??
      signingRaw?.issuer ??
      gw.issuer ??
      issuer ??
      "",
  )
    .trim()
    .toLowerCase();
  const signingLaneHint = String(
    (policyRaw?.signing_lane ?? signingRaw?.signing_lane ?? authorityLaneHint) || "",
  )
    .trim()
    .toLowerCase();
  const resolverSourceHint = String(
    policyRaw?.resolver_source ?? signingRaw?.resolver_source ?? "",
  ).trim();
  const expiresRaw = String(gw.expires_at ?? "");
  const expiresAtMs = expiresRaw ? Date.parse(expiresRaw) : NaN;
  return {
    payment_session_id: String(gw.payment_session_id ?? "").trim(),
    xapp_id: String(overrides.xapp_id ?? gw.xapp_id ?? "").trim(),
    tool_name: String(overrides.tool_name ?? gw.tool_name ?? "").trim(),
    amount: String(overrides.amount ?? gw.amount ?? "").trim(),
    currency: String(overrides.currency ?? gw.currency ?? "USD")
      .trim()
      .toUpperCase(),
    issuer: String(overrides.issuer ?? gw.issuer ?? issuer)
      .trim()
      .toLowerCase(),
    subject_id: String(overrides.subject_id ?? gw.subject_id ?? "").trim() || undefined,
    installation_id:
      String(overrides.installation_id ?? gw.installation_id ?? "").trim() || undefined,
    client_id:
      String(overrides.client_id ?? gw.client_context_id ?? gw.client_id ?? "").trim() || undefined,
    return_url: String(overrides.return_url ?? gw.return_url ?? "").trim(),
    cancel_url: String(overrides.cancel_url ?? gw.cancel_url ?? "").trim() || undefined,
    xapps_resume: String(overrides.xapps_resume ?? gw.xapps_resume ?? "").trim() || undefined,
    status: (String(gw.status ?? "pending").trim() as PaymentSession["status"]) || "pending",
    ...(authorityLaneHint ? { authority_lane_hint: authorityLaneHint } : {}),
    ...(signingLaneHint ? { signing_lane_hint: signingLaneHint } : {}),
    ...(resolverSourceHint ? { resolver_source_hint: resolverSourceHint } : {}),
    ...(Number.isFinite(expiresAtMs) ? { expires_at_ms: expiresAtMs } : {}),
  };
}

// ── Factory ──────────────────────────────────────────────────────────

export function createPaymentHandler(config: PaymentHandlerConfig): PaymentHandler {
  let secret = String(config.secret ?? "").trim();
  if (!secret && config.secretRef) {
    secret = resolveSecretFromRef(config.secretRef);
  }
  if (!secret) {
    throw new Error("PaymentHandler: secret or secretRef is required");
  }
  return createPaymentHandlerWithSecret(config, secret);
}

export async function createPaymentHandlerAsync(
  config: PaymentHandlerConfig,
): Promise<PaymentHandler> {
  let secret = String(config.secret ?? "").trim();
  if (!secret && config.secretRef) {
    secret = await resolveSecretFromRefAsync(config.secretRef, config.secretRefResolverOptions);
  }
  if (!secret) {
    throw new Error("PaymentHandler: secret or secretRef is required");
  }
  return createPaymentHandlerWithSecret(config, secret);
}

function createPaymentHandlerWithSecret(
  config: PaymentHandlerConfig,
  secret: string,
): PaymentHandler {
  const issuer = String(config.issuer ?? "tenant")
    .trim()
    .toLowerCase();
  const allowlist = parseAllowlist(config.returnUrlAllowlist);
  const sessionTtlMs = Math.max(60, config.sessionTtlSeconds ?? 1800) * 1000;
  const gateway = config.gatewayClient ?? null;
  const onSettlement = config.onSettlement ?? null;
  const requirePersistent = config.requirePersistentStoreInProduction !== false;

  const store: PaymentSessionStore = config.store ?? new InMemoryPaymentSessionStore(sessionTtlMs);

  if (
    requirePersistent &&
    store instanceof InMemoryPaymentSessionStore &&
    typeof process !== "undefined" &&
    process.env?.NODE_ENV === "production"
  ) {
    throw new Error(
      "PaymentHandler: InMemoryPaymentSessionStore is not suitable for production. " +
        "Provide a persistent store (Redis, database) via config.store.",
    );
  }

  // ── Internal helpers ───────────────────────────────────────────────

  function checkReturnUrl(url: string): boolean {
    return isAllowedReturnUrl(url, allowlist);
  }

  async function getSessionById(id: string): Promise<PaymentSession | null> {
    if (store.prune) await store.prune();
    return (await store.get(id)) ?? null;
  }

  async function upsertSessionImpl(
    input: Partial<PaymentSession> & { payment_session_id: string },
  ): Promise<PaymentSession> {
    const id = input.payment_session_id;
    const existing = await store.get(id);
    const nowMs = Date.now();

    if (existing) {
      const merged: PaymentSession = { ...existing, ...input };
      await store.set(id, merged);
      return merged;
    }

    const created: PaymentSession = {
      payment_session_id: id,
      xapp_id: String(input.xapp_id ?? "").trim(),
      tool_name: String(input.tool_name ?? "").trim(),
      amount: String(input.amount ?? "").trim(),
      currency: String(input.currency ?? "USD")
        .trim()
        .toUpperCase(),
      issuer: String(input.issuer ?? issuer)
        .trim()
        .toLowerCase(),
      ...(input.subject_id ? { subject_id: input.subject_id } : {}),
      ...(input.installation_id ? { installation_id: input.installation_id } : {}),
      ...(input.client_id ? { client_id: input.client_id } : {}),
      return_url: String(input.return_url ?? "").trim(),
      cancel_url: input.cancel_url,
      xapps_resume: input.xapps_resume,
      status: input.status ?? "pending",
      created_at_ms: input.created_at_ms ?? nowMs,
      expires_at_ms: input.expires_at_ms ?? nowMs + sessionTtlMs,
      receipt_id: input.receipt_id ?? null,
      completed_redirect_url: input.completed_redirect_url ?? null,
      completed_at_ms: input.completed_at_ms ?? null,
      authorized_at_ms: input.authorized_at_ms ?? null,
    };
    await store.set(id, created);
    return created;
  }

  // ── Route Handlers ─────────────────────────────────────────────────

  async function handleGetSession(req: HandlerRequest): Promise<HandlerResponse> {
    const query = req.query ?? {};
    const paymentSessionId = readStringField(query, ["payment_session_id", "paymentSessionId"]);
    const queryReturnUrl = readStringField(query, ["return_url", "returnUrl"]);
    const queryCancelUrl = readStringField(query, ["cancel_url", "cancelUrl"]);
    const queryResume = readStringField(query, ["xapps_resume", "xappsResume"]);

    if (!paymentSessionId) {
      return {
        status: 400,
        body: { message: "payment_session_id is required" },
      };
    }

    let session: PaymentSession | null = null;

    // Try local store first
    session = await getSessionById(paymentSessionId);

    // Fall back to gateway if configured
    if (!session && gateway) {
      try {
        const { session: gw } = await gateway.getPaymentSession(paymentSessionId);
        if (gw) {
          const overrides: Record<string, unknown> = {};
          if (queryReturnUrl && checkReturnUrl(queryReturnUrl))
            overrides.return_url = queryReturnUrl;
          if (queryCancelUrl) overrides.cancel_url = queryCancelUrl;
          if (queryResume) overrides.xapps_resume = queryResume;
          session = await upsertSessionImpl(
            mirrorGatewaySession(gw as Record<string, unknown>, issuer, overrides),
          );
        }
      } catch {
        return {
          status: 502,
          body: { message: "gateway payment session fetch failed" },
        };
      }
    }

    if (!session) {
      return {
        status: 404,
        body: { message: "payment session not found or expired" },
      };
    }

    // Apply query overrides to local session
    let dirty = false;
    if (queryReturnUrl && checkReturnUrl(queryReturnUrl)) {
      session.return_url = queryReturnUrl;
      dirty = true;
    }
    if (queryCancelUrl) {
      session.cancel_url = queryCancelUrl;
      dirty = true;
    }
    if (queryResume) {
      session.xapps_resume = queryResume;
      dirty = true;
    }
    if (dirty) await store.set(session.payment_session_id, session);

    return {
      status: 200,
      body: {
        status: "success",
        result: {
          payment_session_id: session.payment_session_id,
          xapp_id: session.xapp_id,
          tool_name: session.tool_name,
          amount: session.amount,
          currency: session.currency,
          issuer: session.issuer,
          subject_id: session.subject_id || null,
          installation_id: session.installation_id || null,
          client_id: session.client_id || null,
          return_url: session.return_url,
          cancel_url: session.cancel_url || session.return_url || null,
          expires_at: new Date(session.expires_at_ms).toISOString(),
          status: session.status,
        },
      },
    };
  }

  async function handleComplete(req: HandlerRequest): Promise<HandlerResponse> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const paymentSessionId = readStringField(body, ["payment_session_id", "paymentSessionId"]);
      const bodyResume = readStringField(body, ["xapps_resume", "xappsResume"]);
      const bodyReturnUrl = readStringField(body, ["return_url", "returnUrl"]);
      const bodyCancelUrl = readStringField(body, ["cancel_url", "cancelUrl"]);
      if (!paymentSessionId) {
        return {
          status: 400,
          body: { message: "payment_session_id is required" },
        };
      }

      let session = await getSessionById(paymentSessionId);

      // Fall back to gateway fetch
      if (!session && gateway) {
        try {
          const { session: gw } = await gateway.getPaymentSession(paymentSessionId);
          if (gw) {
            session = await upsertSessionImpl(
              mirrorGatewaySession(gw as Record<string, unknown>, issuer),
            );
          }
        } catch {
          return {
            status: 502,
            body: { message: "gateway payment session fetch failed" },
          };
        }
      }

      if (!session) {
        return {
          status: 404,
          body: { message: "payment session not found or expired" },
        };
      }
      if (session.status === "authorized") {
        return {
          status: 409,
          body: { message: "payment session already used" },
        };
      }
      if (session.status === "completed" && session.completed_redirect_url) {
        return {
          status: 200,
          body: {
            status: "success",
            result: { redirect_url: session.completed_redirect_url },
          },
        };
      }

      // Resolve return URL from body, resume token, or session
      const xappsResume = bodyResume || session.xapps_resume || "";

      if (bodyReturnUrl && checkReturnUrl(bodyReturnUrl)) {
        session.return_url = bodyReturnUrl;
      }
      if (bodyCancelUrl) {
        session.cancel_url = bodyCancelUrl;
      }
      if (bodyResume) {
        session.xapps_resume = bodyResume;
      }

      const parsedResume = parseResumeToken(xappsResume);
      const resumeReturnUrl = readStringField(parsedResume, ["return_url", "host_return_url"]);
      const effectiveReturnUrl = resumeReturnUrl || session.return_url;

      if (!effectiveReturnUrl) {
        return {
          status: 400,
          body: { message: "payment session missing return_url" },
        };
      }
      if (!checkReturnUrl(effectiveReturnUrl)) {
        return {
          status: 400,
          body: {
            message: "return_url is not allowed by the configured allowlist",
          },
        };
      }

      // Settlement callback (pluggable provider logic)
      let settlementStatus = "paid";
      let receiptId = randomId("rcpt");
      if (onSettlement) {
        const result = await onSettlement(session);
        settlementStatus = result.status || "paid";
        receiptId = result.receipt_id || receiptId;
      }

      const ts = new Date().toISOString();
      const authorityLane =
        String(session.authority_lane_hint || session.issuer || issuer || "")
          .trim()
          .toLowerCase() || undefined;
      const signingLane =
        String(session.signing_lane_hint || session.issuer || issuer || "")
          .trim()
          .toLowerCase() || undefined;
      const resolverSource = String(session.resolver_source_hint || "").trim() || undefined;
      const redirectUrl = buildSignedPaymentReturnRedirectUrl({
        returnUrl: effectiveReturnUrl,
        evidence: {
          contract: "xapps_payment_orchestration_v1" as XappsPaymentReturnContract,
          payment_session_id: paymentSessionId,
          status: settlementStatus,
          receipt_id: receiptId,
          amount: session.amount,
          currency: session.currency,
          ts,
          issuer: session.issuer,
          xapp_id: session.xapp_id,
          tool_name: session.tool_name,
          ...(session.subject_id ? { subject_id: session.subject_id } : {}),
          ...(session.installation_id ? { installation_id: session.installation_id } : {}),
          ...(session.client_id ? { client_id: session.client_id } : {}),
          ...(authorityLane ? { authority_lane: authorityLane } : {}),
          ...(signingLane ? { signing_lane: signingLane } : {}),
          ...(resolverSource ? { resolver_source: resolverSource } : {}),
        },
        secret,
        ...(xappsResume ? { resumeToken: xappsResume } : {}),
      });

      // Update session state
      session.status = "completed";
      session.receipt_id = receiptId;
      session.completed_redirect_url = redirectUrl;
      session.completed_at_ms = Date.now();
      await store.set(session.payment_session_id, session);

      // Async gateway notification (fire-and-forget)
      if (config.onGatewayNotify) {
        Promise.resolve(config.onGatewayNotify(session, redirectUrl)).catch(() => {});
      } else if (gateway) {
        gateway
          .completePaymentSession({
            paymentSessionId,
            ...(xappsResume ? { xappsResume } : {}),
          })
          .catch(() => {});
      }

      return {
        status: 200,
        body: {
          status: "success",
          result: { redirect_url: redirectUrl },
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "payment complete failed";
      return {
        status: 500,
        body: { message },
      };
    }
  }

  // ── Evidence Verification ─────────────────────────────────────────

  async function handleVerifyEvidence(input: VerifyEvidenceInput): Promise<VerifyEvidenceResult> {
    const evidence = parsePaymentReturnEvidence(input.payload);
    if (!evidence) {
      return { ok: false, reason: "payment_evidence_not_found" };
    }

    const paymentSessionId = evidence.payment_session_id;
    if (!paymentSessionId) {
      return { ok: false, reason: "payment_evidence_missing_session_id" };
    }

    // Fetch session: local store, then gateway mirror path when configured.
    let session = await getSessionById(paymentSessionId);
    if (!session && gateway) {
      try {
        const { session: gw } = await gateway.getPaymentSession(paymentSessionId);
        if (gw) {
          session = await upsertSessionImpl(
            mirrorGatewaySession(gw as Record<string, unknown>, issuer),
          );
        }
      } catch {
        // Gateway unavailable — fall through to "not found"
      }
    }

    if (!session) {
      return {
        ok: false,
        reason: "payment_session_unknown_or_expired",
      };
    }
    if (session.authorized_at_ms) {
      return {
        ok: false,
        reason: "payment_session_already_used",
      };
    }
    if (session.status !== "completed") {
      return {
        ok: false,
        reason: "payment_session_not_completed",
        details: { status: session.status },
      };
    }

    // Build expected values: explicit overrides → session fields
    const exp = input.expected ?? {};
    const evidenceForVerify = {
      ...evidence,
      authority_lane:
        String((evidence as any).authority_lane || "").trim() ||
        String(session.authority_lane_hint || session.issuer || issuer || "")
          .trim()
          .toLowerCase(),
      signing_lane:
        String((evidence as any).signing_lane || "").trim() ||
        String(session.signing_lane_hint || session.issuer || issuer || "")
          .trim()
          .toLowerCase(),
      resolver_source:
        String((evidence as any).resolver_source || "").trim() ||
        String(session.resolver_source_hint || "").trim(),
    };
    const verification = verifyPaymentReturnEvidence({
      evidence: evidenceForVerify,
      secret,
      maxAgeSeconds: input.maxAgeSeconds ?? 900,
      expected: {
        issuer: exp.issuer ?? session.issuer ?? issuer,
        issuers: Array.isArray(exp.issuers) ? exp.issuers : undefined,
        amount: exp.amount ?? session.amount,
        currency: exp.currency ?? session.currency,
        xapp_id: exp.xapp_id ?? (session.xapp_id || undefined),
        tool_name: exp.tool_name ?? (session.tool_name || undefined),
        subject_id: exp.subject_id ?? (session.subject_id || undefined),
        installation_id: exp.installation_id ?? (session.installation_id || undefined),
        client_id: exp.client_id ?? (session.client_id || undefined),
      },
    });

    if (!verification.ok) {
      return {
        ok: false,
        reason: verification.reason,
        details: "details" in verification ? verification.details : undefined,
      };
    }

    // Mark session as authorized
    session.authorized_at_ms = Date.now();
    session.status = "authorized";
    await store.set(session.payment_session_id, session);

    return { ok: true, evidence, session };
  }

  return {
    handleGetSession,
    handleComplete,
    handleVerifyEvidence,
    getSession: getSessionById,
    upsertSession: upsertSessionImpl,
    isAllowedReturnUrl: checkReturnUrl,
  };
}
