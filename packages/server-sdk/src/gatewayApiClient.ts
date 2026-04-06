export type GatewayApiClientOptions = {
  baseUrl: string;
  apiKey?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  timeoutMs?: number;
};

export type GatewayApiClientErrorCode =
  | "GATEWAY_API_UNAUTHORIZED"
  | "GATEWAY_API_CONFLICT"
  | "GATEWAY_API_NOT_FOUND"
  | "GATEWAY_API_HTTP_ERROR"
  | "GATEWAY_API_NETWORK_ERROR"
  | "GATEWAY_API_INVALID_RESPONSE";

export class GatewayApiClientError extends Error {
  code: GatewayApiClientErrorCode;
  status?: number;
  details?: unknown;

  constructor(input: {
    code: GatewayApiClientErrorCode;
    message: string;
    status?: number;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "GatewayApiClientError";
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
  }
}

export type PaymentSessionRecord = Record<string, unknown> & {
  id?: string;
  payment_session_id?: string;
  status?: string;
  accepts?: Array<Record<string, unknown>>;
};

export type GatewaySubjectResolveInput = {
  type: string;
  identifier: {
    idType: string;
    value: string;
    hint?: string;
  };
  email?: string;
  metadata?: Record<string, unknown>;
  linkId?: string | null;
};

export type GatewaySubjectResolveResult = {
  subjectId: string;
};

export type CatalogSessionInput = {
  origin: string;
  subjectId?: string | null;
  xappId?: string | null;
  publishers?: string[] | null;
  tags?: string[] | null;
};

export type CatalogSessionResult = {
  token: string;
  embedUrl: string;
};

export type ClientInstallationPolicyResult = {
  mode: "manual" | "auto_available";
  update_mode: "manual" | "auto_update_compatible";
};

export type ClientSelfResult = {
  client: {
    id: string;
    name?: string;
    slug?: string;
    status?: string;
    installation_policy: ClientInstallationPolicyResult;
  };
};

export type XappMonetizationScopeInput = {
  xappId: string;
  /** @deprecated Use `subject_id`. */
  subjectId?: string | null;
  subject_id?: string | null;
  /** @deprecated Use `installation_id`. */
  installationId?: string | null;
  installation_id?: string | null;
  /** @deprecated Use `realm_ref`. */
  realmRef?: string | null;
  realm_ref?: string | null;
};

export type XappMonetizationTargetingInput = XappMonetizationScopeInput & {
  locale?: string | null;
  country?: string | null;
};

export type XappMonetizationCatalogResult = Record<string, unknown> & {
  items?: Array<Record<string, unknown>>;
  paywalls?: Array<Record<string, unknown>>;
};
export type XappMonetizationAccessResult = Record<string, unknown> & {
  access_projection?: Record<string, unknown> | null;
};
export type XappCurrentSubscriptionResult = Record<string, unknown> & {
  current_subscription?: Record<string, unknown> | null;
};
export type XappEntitlementsResult = Record<string, unknown> & {
  items?: Array<Record<string, unknown>>;
};
export type XappWalletAccountsResult = Record<string, unknown> & {
  items?: Array<Record<string, unknown>>;
};
export type XappWalletLedgerResult = Record<string, unknown> & {
  items?: Array<Record<string, unknown>>;
};
export type XappWalletConsumeResult = Record<string, unknown> & {
  wallet_account?: Record<string, unknown> | null;
  wallet_ledger?: Record<string, unknown> | null;
  access_projection?: Record<string, unknown> | null;
  snapshot_id?: string | null;
};
export type XappPreparedPurchaseIntentResult = Record<string, unknown> & {
  prepared_intent?: Record<string, unknown> | null;
};
export type XappPurchaseTransactionResult = Record<string, unknown> & {
  transaction?: Record<string, unknown> | null;
};
export type XappPurchaseTransactionsResult = Record<string, unknown> & {
  items?: Array<Record<string, unknown>>;
};
export type XappPurchasePaymentSessionResult = Record<string, unknown> & {
  payment_session?: Record<string, unknown> | null;
  payment_page_url?: string | null;
};
export type XappPurchasePaymentReconcileResult = Record<string, unknown> & {
  prepared_intent?: Record<string, unknown> | null;
  payment_session?: Record<string, unknown> | null;
  transaction?: Record<string, unknown> | null;
};
export type XappPurchasePaymentFinalizeResult = Record<string, unknown> & {
  prepared_intent?: Record<string, unknown> | null;
  payment_session?: Record<string, unknown> | null;
  transaction?: Record<string, unknown> | null;
  access_projection?: Record<string, unknown> | null;
};
export type XappIssueAccessResult = Record<string, unknown> & {
  prepared_intent?: Record<string, unknown> | null;
};
export type XappSubscriptionContractLifecycleResult = Record<string, unknown> & {
  subscription_contract?: Record<string, unknown> | null;
  current_subscription?: Record<string, unknown> | null;
  access_projection?: Record<string, unknown> | null;
  payment_session?: Record<string, unknown> | null;
  transaction?: Record<string, unknown> | null;
};

export type PrepareXappPurchaseIntentInput = XappMonetizationScopeInput & {
  /** @deprecated Use `offering_id`. */
  offeringId?: string;
  offering_id?: string;
  /** @deprecated Use `package_id`. */
  packageId?: string;
  package_id?: string;
  /** @deprecated Use `price_id`. */
  priceId?: string;
  price_id?: string;
  /** @deprecated Use `source_kind`. */
  sourceKind?: string | null;
  source_kind?: string | null;
  /** @deprecated Use `source_ref`. */
  sourceRef?: string | null;
  source_ref?: string | null;
  /** @deprecated Use `payment_lane`. */
  paymentLane?: string | null;
  payment_lane?: string | null;
  /** @deprecated Use `payment_session_id`. */
  paymentSessionId?: string | null;
  payment_session_id?: string | null;
  /** @deprecated Use `request_id`. */
  requestId?: string | null;
  request_id?: string | null;
  locale?: string | null;
  country?: string | null;
};

export type CreateXappPurchaseTransactionInput = {
  xappId: string;
  intentId: string;
  status: string;
  /** @deprecated Use `provider_ref`. */
  providerRef?: string | null;
  provider_ref?: string | null;
  /** @deprecated Use `evidence_ref`. */
  evidenceRef?: string | null;
  evidence_ref?: string | null;
  /** @deprecated Use `payment_session_id`. */
  paymentSessionId?: string | null;
  payment_session_id?: string | null;
  /** @deprecated Use `request_id`. */
  requestId?: string | null;
  request_id?: string | null;
  /** @deprecated Use `settlement_ref`. */
  settlementRef?: string | null;
  settlement_ref?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  /** @deprecated Use `occurred_at`. */
  occurredAt?: string | null;
  occurred_at?: string | null;
};

export type ListXappPurchaseTransactionsInput = {
  xappId: string;
  intentId: string;
};

export type ListXappWalletAccountsInput = XappMonetizationScopeInput;

export type ConsumeXappWalletCreditsInput = {
  xappId: string;
  walletAccountId: string;
  amount: string;
  /** @deprecated Use `source_ref`. */
  sourceRef?: string | null;
  source_ref?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ListXappWalletLedgerInput = XappMonetizationScopeInput & {
  /** @deprecated Use `wallet_account_id`. */
  walletAccountId?: string | null;
  wallet_account_id?: string | null;
  /** @deprecated Use `payment_session_id`. */
  paymentSessionId?: string | null;
  payment_session_id?: string | null;
  /** @deprecated Use `request_id`. */
  requestId?: string | null;
  request_id?: string | null;
  /** @deprecated Use `settlement_ref`. */
  settlementRef?: string | null;
  settlement_ref?: string | null;
};

export type CreateXappPurchasePaymentSessionInput = {
  xappId: string;
  intentId: string;
  /** @deprecated Use `payment_guard_ref`. */
  paymentGuardRef?: string | null;
  payment_guard_ref?: string | null;
  issuer?: string | null;
  scheme?: string | null;
  /** @deprecated Use `payment_scheme`. */
  paymentScheme?: string | null;
  payment_scheme?: string | null;
  /** @deprecated Use `return_url`. */
  returnUrl: string;
  return_url?: string;
  /** @deprecated Use `cancel_url`. */
  cancelUrl?: string | null;
  cancel_url?: string | null;
  /** @deprecated Use `page_url`. */
  pageUrl?: string | null;
  page_url?: string | null;
  locale?: string | null;
  /** @deprecated Use `xapps_resume`. */
  xappsResume?: string | null;
  xapps_resume?: string | null;
  /** @deprecated Use `subject_id`. */
  subjectId?: string | null;
  subject_id?: string | null;
  /** @deprecated Use `installation_id`. */
  installationId?: string | null;
  installation_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type XappSubscriptionContractInput = {
  xappId: string;
  contractId: string;
};

function normalizeOptionalStringList(value: string[] | null | undefined): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => String(item || "").trim()).filter((item) => item.length > 0);
  return items.length > 0 ? Array.from(new Set(items)) : undefined;
}

export type WidgetResultPresentation = "runtime_default" | "inline" | "publisher_managed";

export type WidgetSessionInput = {
  installationId: string;
  widgetId: string;
  origin?: string | null;
  locale?: string | null;
  xappId?: string | null;
  subjectId?: string | null;
  requestId?: string | null;
  hostReturnUrl?: string | null;
  resultPresentation?: WidgetResultPresentation | null;
  guardUi?: Record<string, unknown> | null;
};

export type WidgetSessionResult = {
  token: string;
  embedUrl: string;
  context?: Record<string, unknown>;
  widget?: Record<string, unknown>;
  tool?: Record<string, unknown> | null;
};

export type VerifyBrowserWidgetContextInput = {
  hostOrigin: string;
  bootstrapTicket?: string | null;
  installationId?: string | null;
  bindToolName?: string | null;
  toolName?: string | null;
  subjectId?: string | null;
};

export type VerifyBrowserWidgetContextResult = {
  verified: true;
  latestRequestId: string | null;
  result: Record<string, unknown>;
};

export type InstallationRecord = Record<string, unknown> & {
  id?: string;
  xapp_id?: string;
  subject_id?: string | null;
  status?: string;
};

export type ListInstallationsInput = {
  subjectId?: string | null;
};

export type ListInstallationsResult = {
  items: InstallationRecord[];
};

export type InstallXappInput = {
  xappId: string;
  subjectId?: string | null;
  termsAccepted?: boolean;
};

export type InstallXappResult = {
  installation: InstallationRecord;
};

export type UpdateInstallationInput = {
  installationId: string;
  subjectId?: string | null;
  termsAccepted?: boolean;
};

export type UpdateInstallationResult = {
  installation: InstallationRecord;
};

export type UninstallInstallationInput = {
  installationId: string;
  subjectId?: string | null;
};

export type UninstallInstallationResult = Record<string, unknown>;

export type EmbedMyXappMonetizationInput = {
  xappId: string;
  token: string;
  installationId?: string | null;
  locale?: string | null;
  country?: string | null;
  realmRef?: string | null;
  /** @deprecated Use `realmRef`. */
  realm_ref?: string | null;
};

export type EmbedMyXappMonetizationResult = Record<string, unknown>;

export type EmbedMyXappMonetizationHistoryInput = {
  xappId: string;
  token: string;
  limit?: number | null;
};

export type EmbedMyXappMonetizationHistoryResult = Record<string, unknown>;

export type EmbedMyXappPreparePurchaseIntentInput = {
  xappId: string;
  token: string;
  offeringId?: string | null;
  /** @deprecated Use `offeringId`. */
  offering_id?: string | null;
  packageId?: string | null;
  /** @deprecated Use `packageId`. */
  package_id?: string | null;
  priceId?: string | null;
  /** @deprecated Use `priceId`. */
  price_id?: string | null;
  installationId?: string | null;
  /** @deprecated Use `installationId`. */
  installation_id?: string | null;
  locale?: string | null;
  country?: string | null;
};

export type EmbedMyXappCreatePurchasePaymentSessionInput = {
  xappId: string;
  intentId: string;
  token: string;
  returnUrl?: string | null;
  /** @deprecated Use `returnUrl`. */
  return_url?: string | null;
  cancelUrl?: string | null;
  /** @deprecated Use `cancelUrl`. */
  cancel_url?: string | null;
  xappsResume?: string | null;
  /** @deprecated Use `xappsResume`. */
  xapps_resume?: string | null;
  locale?: string | null;
  installationId?: string | null;
  /** @deprecated Use `installationId`. */
  installation_id?: string | null;
  paymentGuardRef?: string | null;
  /** @deprecated Use `paymentGuardRef`. */
  payment_guard_ref?: string | null;
  issuer?: string | null;
  scheme?: string | null;
  paymentScheme?: string | null;
  /** @deprecated Use `paymentScheme`. */
  payment_scheme?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type EmbedMyXappFinalizePurchasePaymentSessionInput = {
  xappId: string;
  intentId: string;
  token: string;
};

export type RunWidgetToolRequestInput = {
  token: string;
  installationId: string;
  toolName: string;
  payload?: Record<string, unknown> | null;
};

export type CreatePaymentSessionInput = {
  /** @deprecated Use `payment_session_id`. */
  paymentSessionId?: string;
  payment_session_id?: string;
  /** @deprecated Use `page_url`. */
  pageUrl?: string;
  page_url?: string;
  /** @deprecated Use `xapp_id`. */
  xappId?: string;
  xapp_id?: string;
  /** @deprecated Use `tool_name`. */
  toolName?: string;
  tool_name?: string;
  amount: string | number;
  currency?: string;
  issuer?: string;
  scheme?: string;
  /** @deprecated Use `payment_scheme`. */
  paymentScheme?: string;
  payment_scheme?: string;
  /** @deprecated Use `return_url`. */
  returnUrl?: string;
  return_url?: string;
  /** @deprecated Use `cancel_url`. */
  cancelUrl?: string;
  cancel_url?: string;
  /** @deprecated Use `xapps_resume`. */
  xappsResume?: string;
  xapps_resume?: string;
  /** @deprecated Use `subject_id`. */
  subjectId?: string | null;
  subject_id?: string | null;
  /** @deprecated Use `installation_id`. */
  installationId?: string | null;
  installation_id?: string | null;
  /** @deprecated Use `client_id`. */
  clientId?: string | null;
  client_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreatePaymentSessionResult = {
  session: PaymentSessionRecord;
  paymentPageUrl?: string;
};

export type CompletePaymentSessionInput = {
  paymentSessionId: string;
  issuer?: string;
  status?: string;
  xappsResume?: string;
  metadata?: Record<string, unknown>;
};

export type GatewayHostedSessionInput = {
  paymentSessionId: string;
  /** @deprecated Use `return_url`. */
  returnUrl?: string;
  return_url?: string;
  /** @deprecated Use `cancel_url`. */
  cancelUrl?: string;
  cancel_url?: string;
  /** @deprecated Use `xapps_resume`. */
  xappsResume?: string;
  xapps_resume?: string;
};

export type GatewayHostedCompleteInput = {
  paymentSessionId: string;
  scheme?: string;
  /** @deprecated Use `payment_scheme`. */
  paymentScheme?: string;
  payment_scheme?: string;
  /** @deprecated Use `return_url`. */
  returnUrl?: string;
  return_url?: string;
  /** @deprecated Use `cancel_url`. */
  cancelUrl?: string;
  cancel_url?: string;
  /** @deprecated Use `xapps_resume`. */
  xappsResume?: string;
  xapps_resume?: string;
};

export type GatewayHostedClientSettleInput = {
  paymentSessionId: string;
  /** @deprecated Use `return_url`. */
  returnUrl?: string;
  return_url?: string;
  /** @deprecated Use `xapps_resume`. */
  xappsResume?: string;
  xapps_resume?: string;
  status?: "paid" | "failed" | "cancelled";
  /** @deprecated Use `client_token`. */
  clientToken?: string;
  client_token?: string;
  metadata?: Record<string, unknown>;
};

export type CompletePaymentSessionResult = {
  session?: PaymentSessionRecord;
  redirectUrl?: string;
  flow?: string;
  paymentSessionId?: string;
  clientSettleUrl?: string;
  providerReference?: string | null;
  scheme?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

function normalizeBaseUrl(input: string): string {
  const value = String(input || "").trim();
  if (!value) {
    throw new GatewayApiClientError({
      code: "GATEWAY_API_INVALID_RESPONSE",
      message: "gatewayApiClient.baseUrl is required",
    });
  }
  return value.replace(/\/+$/g, "");
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (typeof fetchImpl === "function") return fetchImpl;
  if (typeof fetch !== "function") {
    throw new GatewayApiClientError({
      code: "GATEWAY_API_NETWORK_ERROR",
      message: "Global fetch is unavailable; provide fetchImpl",
    });
  }
  return fetch;
}

function normalizeRequestTimeoutMs(input: unknown): number {
  if (input === undefined || input === null || input === "") return 30_000;
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new GatewayApiClientError({
      code: "GATEWAY_API_INVALID_RESPONSE",
      message: "gatewayApiClient.requestTimeoutMs must be a positive integer",
      details: { value: input },
    });
  }
  return Math.floor(parsed);
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildAuthHeaders(input: { apiKey?: string; token?: string }): Headers {
  const headers = new Headers();
  const token = String(input.token || "").trim();
  const apiKey = String(input.apiKey || "").trim();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (apiKey) headers.set("x-api-key", apiKey);
  return headers;
}

function mapHttpError(status: number, message: string, details?: unknown): GatewayApiClientError {
  if (status === 401 || status === 403) {
    return new GatewayApiClientError({
      code: "GATEWAY_API_UNAUTHORIZED",
      message,
      status,
      details,
    });
  }
  if (status === 409) {
    return new GatewayApiClientError({
      code: "GATEWAY_API_CONFLICT",
      message,
      status,
      details,
    });
  }
  if (status === 404) {
    return new GatewayApiClientError({
      code: "GATEWAY_API_NOT_FOUND",
      message,
      status,
      details,
    });
  }
  return new GatewayApiClientError({
    code: "GATEWAY_API_HTTP_ERROR",
    message,
    status,
    details,
  });
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[server-sdk] JSON parse fallback", {
        scope: "gatewayApiClient.parseJsonSafe",
        url: res.url || "",
        message: error instanceof Error ? error.message : String(error),
        preview: text.slice(0, 200),
      });
    }
    return text;
  }
}

function appendOptionalSubjectId(pathname: string, subjectId?: string | null): string {
  const resolved = String(subjectId || "").trim();
  if (!resolved) return pathname;
  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}subjectId=${encodeURIComponent(resolved)}`;
}

function appendOptionalQuery(pathname: string, key: string, value?: string | null): string {
  const resolved = String(value || "").trim();
  if (!resolved) return pathname;
  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}${encodeURIComponent(key)}=${encodeURIComponent(resolved)}`;
}

function normalizeObjectPayload(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function requireXappId(value: string): string {
  const xappId = String(value || "").trim();
  if (!xappId) {
    throw new GatewayApiClientError({
      code: "GATEWAY_API_INVALID_RESPONSE",
      message: "xappId is required",
    });
  }
  return xappId;
}

function requireIntentId(value: string): string {
  const intentId = String(value || "").trim();
  if (!intentId) {
    throw new GatewayApiClientError({
      code: "GATEWAY_API_INVALID_RESPONSE",
      message: "intentId is required",
    });
  }
  return intentId;
}

function appendQueryParams(pathname: string, params: Record<string, unknown>): string {
  let nextPath = pathname;
  for (const [key, value] of Object.entries(params)) {
    const queryValue =
      value === null || value === undefined ? undefined : String(value).trim() || undefined;
    nextPath = appendOptionalQuery(nextPath, key, queryValue);
  }
  return nextPath;
}

function buildXappMonetizationScopePath(
  pathname: string,
  input: Omit<XappMonetizationScopeInput, "xappId">,
): string {
  let nextPath = pathname;
  nextPath = appendOptionalQuery(nextPath, "subject_id", input.subjectId ?? input.subject_id);
  nextPath = appendOptionalQuery(
    nextPath,
    "installation_id",
    input.installationId ?? input.installation_id,
  );
  nextPath = appendOptionalQuery(nextPath, "realm_ref", input.realmRef ?? input.realm_ref);
  return nextPath;
}

function buildXappMonetizationTargetingPath(
  pathname: string,
  input: Omit<XappMonetizationTargetingInput, "xappId">,
): string {
  let nextPath = buildXappMonetizationScopePath(pathname, input);
  nextPath = appendOptionalQuery(nextPath, "locale", input.locale);
  nextPath = appendOptionalQuery(nextPath, "country", input.country);
  return nextPath;
}

function buildXappWalletLedgerPath(
  pathname: string,
  input: Omit<ListXappWalletLedgerInput, "xappId">,
): string {
  let nextPath = buildXappMonetizationScopePath(pathname, input);
  nextPath = appendOptionalQuery(
    nextPath,
    "wallet_account_id",
    input.walletAccountId ?? input.wallet_account_id,
  );
  nextPath = appendOptionalQuery(
    nextPath,
    "payment_session_id",
    input.paymentSessionId ?? input.payment_session_id,
  );
  nextPath = appendOptionalQuery(nextPath, "request_id", input.requestId ?? input.request_id);
  nextPath = appendOptionalQuery(
    nextPath,
    "settlement_ref",
    input.settlementRef ?? input.settlement_ref,
  );
  return nextPath;
}

function extractResultObject<T = Record<string, unknown>>(payload: unknown): T {
  if (!payload || typeof payload !== "object") {
    throw new GatewayApiClientError({
      code: "GATEWAY_API_INVALID_RESPONSE",
      message: "Gateway API returned malformed response",
      details: payload,
    });
  }
  const root = payload as any;
  if (root.result && typeof root.result === "object") return root.result as T;
  return root as T;
}

function parseCompleteLikeResult(result: any): CompletePaymentSessionResult {
  return {
    session:
      result.session && typeof result.session === "object"
        ? (result.session as PaymentSessionRecord)
        : undefined,
    redirectUrl:
      typeof result.redirect_url === "string"
        ? result.redirect_url
        : typeof result.redirectUrl === "string"
          ? result.redirectUrl
          : undefined,
    flow:
      typeof result.flow === "string"
        ? result.flow
        : typeof result.provider_flow === "string"
          ? result.provider_flow
          : undefined,
    paymentSessionId:
      typeof result.payment_session_id === "string"
        ? result.payment_session_id
        : typeof result.paymentSessionId === "string"
          ? result.paymentSessionId
          : undefined,
    clientSettleUrl:
      typeof result.client_settle_url === "string"
        ? result.client_settle_url
        : typeof result.clientSettleUrl === "string"
          ? result.clientSettleUrl
          : undefined,
    providerReference:
      typeof result.provider_reference === "string"
        ? result.provider_reference
        : typeof result.providerReference === "string"
          ? result.providerReference
          : null,
    scheme:
      result.scheme && typeof result.scheme === "object" && !Array.isArray(result.scheme)
        ? (result.scheme as Record<string, unknown>)
        : null,
    metadata:
      result.metadata && typeof result.metadata === "object" && !Array.isArray(result.metadata)
        ? (result.metadata as Record<string, unknown>)
        : null,
  };
}

/**
 * Creates a typed HTTP client for gateway payment-session and hosted-payment APIs.
 *
 * Prefer canonical `snake_case` request fields when providing payloads; camelCase aliases remain
 * accepted only as compatibility helpers.
 */
export function createGatewayApiClient(options: GatewayApiClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = resolveFetch(options.fetchImpl);
  const authHeaders = buildAuthHeaders({ apiKey: options.apiKey, token: options.token });
  const requestTimeoutMs = normalizeRequestTimeoutMs(options.requestTimeoutMs ?? options.timeoutMs);

  async function requestJson(
    method: "GET" | "POST" | "DELETE",
    pathname: string,
    body?: unknown,
    extraHeaders?: HeadersInit,
  ): Promise<unknown> {
    try {
      const headers = new Headers(authHeaders);
      if (extraHeaders) {
        new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
      }
      if (method !== "GET") headers.set("content-type", "application/json");
      const res = await fetchWithTimeout(
        fetchImpl,
        `${baseUrl}${pathname}`,
        {
          method,
          headers,
          ...(body !== undefined ? { body: JSON.stringify(body ?? {}) } : {}),
        },
        requestTimeoutMs,
      );
      const payload = await parseJsonSafe(res);
      if (!res.ok) {
        const msg =
          typeof payload === "object" && payload && typeof (payload as any).message === "string"
            ? String((payload as any).message)
            : `Gateway API request failed (${res.status})`;
        throw mapHttpError(res.status, msg, payload);
      }
      return payload;
    } catch (err: any) {
      if (err instanceof GatewayApiClientError) throw err;
      throw new GatewayApiClientError({
        code: "GATEWAY_API_NETWORK_ERROR",
        message:
          err?.name === "AbortError"
            ? `Gateway API request timed out after ${requestTimeoutMs}ms`
            : `Gateway API request failed: ${err?.message || String(err)}`,
        details: err,
      });
    }
  }

  return {
    async createPaymentSession(
      input: CreatePaymentSessionInput,
    ): Promise<CreatePaymentSessionResult> {
      const payload = await requestJson("POST", "/v1/payment-sessions", {
        payment_session_id: input.paymentSessionId ?? input.payment_session_id,
        page_url: input.pageUrl ?? input.page_url,
        xapp_id: input.xappId ?? input.xapp_id,
        tool_name: input.toolName ?? input.tool_name,
        amount: input.amount,
        currency: input.currency,
        issuer: input.issuer,
        scheme: input.scheme,
        payment_scheme: input.paymentScheme ?? input.payment_scheme,
        return_url: input.returnUrl ?? input.return_url,
        cancel_url: input.cancelUrl ?? input.cancel_url,
        xapps_resume: input.xappsResume ?? input.xapps_resume,
        subject_id: input.subjectId ?? input.subject_id,
        installation_id: input.installationId ?? input.installation_id,
        client_id: input.clientId ?? input.client_id,
        metadata: input.metadata,
      });
      const result = extractResultObject<any>(payload);
      const session =
        (result.session && typeof result.session === "object" ? result.session : result) ?? null;
      if (!session || typeof session !== "object") {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "Gateway createPaymentSession returned malformed response",
          details: payload,
        });
      }
      return {
        session,
        paymentPageUrl:
          typeof result.payment_page_url === "string"
            ? result.payment_page_url
            : typeof result.paymentPageUrl === "string"
              ? result.paymentPageUrl
              : undefined,
      };
    },

    async getPaymentSession(paymentSessionId: string): Promise<{ session: PaymentSessionRecord }> {
      const id = String(paymentSessionId || "").trim();
      if (!id) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "paymentSessionId is required",
        });
      }
      const payload = await requestJson("GET", `/v1/payment-sessions/${encodeURIComponent(id)}`);
      const result = extractResultObject<any>(payload);
      const session =
        (result.session && typeof result.session === "object" ? result.session : result) ?? null;
      if (!session || typeof session !== "object") {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "Gateway getPaymentSession returned malformed response",
          details: payload,
        });
      }
      return { session };
    },

    async completePaymentSession(
      input: CompletePaymentSessionInput,
    ): Promise<CompletePaymentSessionResult> {
      const id = String(input.paymentSessionId || "").trim();
      if (!id) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "paymentSessionId is required",
        });
      }
      const payload = await requestJson(
        "POST",
        `/v1/payment-sessions/${encodeURIComponent(id)}/complete`,
        {
          issuer: input.issuer,
          status: input.status,
          xapps_resume: input.xappsResume,
          metadata: input.metadata,
        },
      );
      const result = extractResultObject<any>(payload);
      return parseCompleteLikeResult(result);
    },

    async getGatewayPaymentSession(
      input: GatewayHostedSessionInput,
    ): Promise<{ session: PaymentSessionRecord }> {
      const id = String(input.paymentSessionId || "").trim();
      if (!id) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "paymentSessionId is required",
        });
      }
      const query = new URLSearchParams();
      query.set("payment_session_id", id);
      const returnUrl = String(input.returnUrl ?? input.return_url ?? "").trim();
      const cancelUrl = String(input.cancelUrl ?? input.cancel_url ?? "").trim();
      const xappsResume = String(input.xappsResume ?? input.xapps_resume ?? "").trim();
      if (returnUrl) query.set("return_url", returnUrl);
      if (cancelUrl) query.set("cancel_url", cancelUrl);
      if (xappsResume) query.set("xapps_resume", xappsResume);
      const payload = await requestJson("GET", `/v1/gateway-payment/session?${query.toString()}`);
      const result = extractResultObject<any>(payload);
      if (!result || typeof result !== "object") {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "Gateway getGatewayPaymentSession returned malformed response",
          details: payload,
        });
      }
      return { session: result as PaymentSessionRecord };
    },

    async completeGatewayPayment(
      input: GatewayHostedCompleteInput,
    ): Promise<CompletePaymentSessionResult> {
      const id = String(input.paymentSessionId || "").trim();
      if (!id) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "paymentSessionId is required",
        });
      }
      const payload = await requestJson("POST", "/v1/gateway-payment/complete", {
        payment_session_id: id,
        scheme: input.scheme,
        payment_scheme: input.paymentScheme ?? input.payment_scheme,
        return_url: input.returnUrl ?? input.return_url,
        cancel_url: input.cancelUrl ?? input.cancel_url,
        xapps_resume: input.xappsResume ?? input.xapps_resume,
      });
      return parseCompleteLikeResult(extractResultObject<any>(payload));
    },

    async clientSettleGatewayPayment(
      input: GatewayHostedClientSettleInput,
    ): Promise<CompletePaymentSessionResult> {
      const id = String(input.paymentSessionId || "").trim();
      if (!id) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "paymentSessionId is required",
        });
      }
      const payload = await requestJson("POST", "/v1/gateway-payment/client-settle", {
        payment_session_id: id,
        return_url: input.returnUrl ?? input.return_url,
        xapps_resume: input.xappsResume ?? input.xapps_resume,
        status: input.status,
        client_token: input.clientToken ?? input.client_token,
        metadata: input.metadata,
      });
      return parseCompleteLikeResult(extractResultObject<any>(payload));
    },

    async resolveSubject(input: GatewaySubjectResolveInput): Promise<GatewaySubjectResolveResult> {
      const payload = await requestJson("POST", "/v1/subjects/resolve", {
        type: input.type,
        identifier: {
          idType: input.identifier.idType,
          value: input.identifier.value,
          ...(input.identifier.hint ? { hint: input.identifier.hint } : {}),
        },
        ...(typeof input.email === "string" && input.email.trim() ? { email: input.email } : {}),
        ...(input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
          ? { metadata: input.metadata }
          : {}),
        ...(typeof input.linkId === "string" && input.linkId.trim()
          ? { linkId: input.linkId.trim() }
          : {}),
      });
      const result = extractResultObject<any>(payload);
      const subjectId = String(result.subjectId || "").trim();
      if (!subjectId) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "Gateway resolveSubject returned malformed response",
          details: payload,
        });
      }
      return { subjectId };
    },

    async createCatalogSession(input: CatalogSessionInput): Promise<CatalogSessionResult> {
      const publishers = normalizeOptionalStringList(input.publishers);
      const tags = normalizeOptionalStringList(input.tags);
      const payload = await requestJson("POST", "/v1/catalog-sessions", {
        origin: input.origin,
        ...(input.subjectId ? { subjectId: input.subjectId } : {}),
        ...(input.xappId ? { xappId: input.xappId } : {}),
        ...(publishers ? { publishers } : {}),
        ...(tags ? { tags } : {}),
      });
      const result = extractResultObject<any>(payload);
      const token = String(result.token || "").trim();
      const embedUrl = String(result.embedUrl || "").trim();
      if (!token || !embedUrl) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "Gateway createCatalogSession returned malformed response",
          details: payload,
        });
      }
      return { token, embedUrl };
    },

    async getClientSelf(): Promise<ClientSelfResult> {
      const payload = await requestJson("GET", "/v1/client-self");
      const result = extractResultObject<any>(payload);
      const client =
        result.client && typeof result.client === "object" && !Array.isArray(result.client)
          ? (result.client as Record<string, unknown>)
          : null;
      const clientId = String(client?.id || "").trim();
      if (!client || !clientId) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "Gateway getClientSelf returned malformed response",
          details: payload,
        });
      }
      const policy =
        client.installation_policy &&
        typeof client.installation_policy === "object" &&
        !Array.isArray(client.installation_policy)
          ? (client.installation_policy as Record<string, unknown>)
          : null;
      return {
        client: {
          id: clientId,
          ...(typeof client.name === "string" ? { name: client.name } : {}),
          ...(typeof client.slug === "string" ? { slug: client.slug } : {}),
          ...(typeof client.status === "string" ? { status: client.status } : {}),
          installation_policy: {
            mode: policy?.mode === "auto_available" ? "auto_available" : "manual",
            update_mode:
              policy?.update_mode === "auto_update_compatible"
                ? "auto_update_compatible"
                : "manual",
          },
        },
      };
    },

    async createWidgetSession(input: WidgetSessionInput): Promise<WidgetSessionResult> {
      const payload = await requestJson(
        "POST",
        "/v1/widget-sessions",
        {
          installationId: input.installationId,
          widgetId: input.widgetId,
          ...(input.locale ? { locale: input.locale } : {}),
          ...(input.xappId ? { xappId: input.xappId } : {}),
          ...(input.subjectId ? { subjectId: input.subjectId } : {}),
          ...(input.requestId ? { requestId: input.requestId } : {}),
          ...(input.hostReturnUrl ? { hostReturnUrl: input.hostReturnUrl } : {}),
          ...(input.resultPresentation ? { resultPresentation: input.resultPresentation } : {}),
          ...(input.guardUi && typeof input.guardUi === "object" ? { guardUi: input.guardUi } : {}),
        },
        input.origin ? { Origin: input.origin } : undefined,
      );
      const result = extractResultObject<any>(payload);
      const token = String(result.token || "").trim();
      const embedUrl = String(result.embedUrl || "").trim();
      if (!token || !embedUrl) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "Gateway createWidgetSession returned malformed response",
          details: payload,
        });
      }
      return {
        token,
        embedUrl,
        context:
          result.context && typeof result.context === "object" && !Array.isArray(result.context)
            ? (result.context as Record<string, unknown>)
            : undefined,
        widget:
          result.widget && typeof result.widget === "object" && !Array.isArray(result.widget)
            ? (result.widget as Record<string, unknown>)
            : undefined,
        tool:
          result.tool && typeof result.tool === "object" && !Array.isArray(result.tool)
            ? (result.tool as Record<string, unknown>)
            : result.tool === null
              ? null
              : undefined,
      };
    },

    async runWidgetToolRequest(input: RunWidgetToolRequestInput): Promise<Record<string, unknown>> {
      const token = String(input.token || "").trim();
      const installationId = String(input.installationId || "").trim();
      const toolName = String(input.toolName || "").trim();
      if (!token || !installationId || !toolName) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "token, installationId, and toolName are required",
        });
      }
      const createdPayload = await requestJson(
        "POST",
        "/v1/requests",
        {
          installationId,
          toolName,
          payload:
            input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
              ? input.payload
              : {},
        },
        { Authorization: `Bearer ${token}` },
      );
      const created = extractResultObject<Record<string, unknown>>(createdPayload);
      const requestRecord =
        created.request && typeof created.request === "object" && !Array.isArray(created.request)
          ? (created.request as Record<string, unknown>)
          : created;
      const requestId = String(requestRecord.id || "").trim();
      if (!requestId) return created;

      const startedAt = Date.now();
      while (Date.now() - startedAt < 15_000) {
        const detailPayload = await requestJson(
          "GET",
          `/v1/requests/${encodeURIComponent(requestId)}`,
          undefined,
          { Authorization: `Bearer ${token}` },
        );
        const detail = extractResultObject<Record<string, unknown>>(detailPayload);
        const detailRequest =
          detail.request && typeof detail.request === "object" && !Array.isArray(detail.request)
            ? (detail.request as Record<string, unknown>)
            : detail;
        const status = String(detailRequest.status || "")
          .trim()
          .toUpperCase();
        if (status === "COMPLETED") {
          const responsePayload = await requestJson(
            "GET",
            `/v1/requests/${encodeURIComponent(requestId)}/response`,
            undefined,
            { Authorization: `Bearer ${token}` },
          );
          const response = extractResultObject<Record<string, unknown>>(responsePayload);
          if (
            response.response &&
            typeof response.response === "object" &&
            !Array.isArray(response.response)
          ) {
            const responseRecord = response.response as Record<string, unknown>;
            return responseRecord.result &&
              typeof responseRecord.result === "object" &&
              !Array.isArray(responseRecord.result)
              ? (responseRecord.result as Record<string, unknown>)
              : responseRecord;
          }
          return response;
        }
        if (status === "FAILED") {
          throw new GatewayApiClientError({
            code: "GATEWAY_API_HTTP_ERROR",
            message: "Widget tool request failed",
            details: detail,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      throw new GatewayApiClientError({
        code: "GATEWAY_API_NETWORK_ERROR",
        message: "Widget tool request timed out",
      });
    },

    async verifyBrowserWidgetContext(
      input: VerifyBrowserWidgetContextInput,
    ): Promise<VerifyBrowserWidgetContextResult> {
      const hostOrigin = String(input.hostOrigin || "").trim();
      const bootstrapTicket = String(input.bootstrapTicket || "").trim();
      if (!hostOrigin) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "hostOrigin is required",
        });
      }
      let pathname = "/v1/requests/latest";
      pathname = appendOptionalQuery(pathname, "installationId", input.installationId);
      pathname = appendOptionalQuery(pathname, "toolName", input.bindToolName ?? input.toolName);
      pathname = appendOptionalSubjectId(pathname, input.subjectId);
      const payload = await requestJson("GET", pathname, undefined, {
        Origin: hostOrigin,
        ...(bootstrapTicket ? { Authorization: `Bearer ${bootstrapTicket}` } : {}),
      });
      const result = extractResultObject<Record<string, unknown>>(payload);
      const latestRequestId =
        typeof result.requestId === "string"
          ? result.requestId
          : typeof result.id === "string"
            ? result.id
            : null;
      return {
        verified: true,
        latestRequestId,
        result,
      };
    },

    async listInstallations(input: ListInstallationsInput = {}): Promise<ListInstallationsResult> {
      const payload = await requestJson(
        "GET",
        appendOptionalSubjectId("/v1/installations", input.subjectId),
      );
      const result = extractResultObject<any>(payload);
      const items = Array.isArray(result.items)
        ? (result.items as InstallationRecord[])
        : Array.isArray(result)
          ? (result as InstallationRecord[])
          : [];
      return { items };
    },

    async installXapp(input: InstallXappInput): Promise<InstallXappResult> {
      const payload = await requestJson(
        "POST",
        appendOptionalSubjectId("/v1/installations", input.subjectId),
        {
          xappId: input.xappId,
          ...(typeof input.termsAccepted === "boolean"
            ? { termsAccepted: input.termsAccepted }
            : {}),
        },
      );
      const result = extractResultObject<any>(payload);
      const installation =
        result.installation && typeof result.installation === "object"
          ? (result.installation as InstallationRecord)
          : null;
      if (!installation) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "Gateway installXapp returned malformed response",
          details: payload,
        });
      }
      return { installation };
    },

    async updateInstallation(input: UpdateInstallationInput): Promise<UpdateInstallationResult> {
      const installationId = String(input.installationId || "").trim();
      if (!installationId) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "installationId is required",
        });
      }
      const payload = await requestJson(
        "POST",
        appendOptionalSubjectId(
          `/v1/installations/${encodeURIComponent(installationId)}/update`,
          input.subjectId,
        ),
        {
          ...(typeof input.termsAccepted === "boolean"
            ? { termsAccepted: input.termsAccepted }
            : {}),
        },
      );
      const result = extractResultObject<any>(payload);
      const installation =
        result.installation && typeof result.installation === "object"
          ? (result.installation as InstallationRecord)
          : null;
      if (!installation) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "Gateway updateInstallation returned malformed response",
          details: payload,
        });
      }
      return { installation };
    },

    async uninstallInstallation(
      input: UninstallInstallationInput,
    ): Promise<UninstallInstallationResult> {
      const installationId = String(input.installationId || "").trim();
      if (!installationId) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "installationId is required",
        });
      }
      const payload = await requestJson(
        "DELETE",
        appendOptionalSubjectId(
          `/v1/installations/${encodeURIComponent(installationId)}`,
          input.subjectId,
        ),
      );
      const result = extractResultObject<any>(payload);
      return result && typeof result === "object" ? (result as Record<string, unknown>) : {};
    },

    async getEmbedMyXappMonetization(
      input: EmbedMyXappMonetizationInput,
    ): Promise<EmbedMyXappMonetizationResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const token = String(input.token || "").trim();
      if (!token) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "token is required",
        });
      }
      const payload = await requestJson(
        "GET",
        appendQueryParams(`/embed/my-xapps/${encodeURIComponent(resolvedXappId)}/monetization`, {
          token,
          installationId: input.installationId,
          locale: input.locale,
          country: input.country,
          realmRef: input.realmRef ?? input.realm_ref,
        }),
      );
      return extractResultObject<EmbedMyXappMonetizationResult>(payload);
    },

    async getEmbedMyXappMonetizationHistory(
      input: EmbedMyXappMonetizationHistoryInput,
    ): Promise<EmbedMyXappMonetizationHistoryResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const token = String(input.token || "").trim();
      if (!token) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "token is required",
        });
      }
      const payload = await requestJson(
        "GET",
        appendQueryParams(
          `/embed/my-xapps/${encodeURIComponent(resolvedXappId)}/monetization/history`,
          {
            token,
            limit: input.limit,
          },
        ),
      );
      return extractResultObject<EmbedMyXappMonetizationHistoryResult>(payload);
    },

    async prepareEmbedMyXappPurchaseIntent(
      input: EmbedMyXappPreparePurchaseIntentInput,
    ): Promise<XappPreparedPurchaseIntentResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const token = String(input.token || "").trim();
      if (!token) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "token is required",
        });
      }
      const payload = await requestJson(
        "POST",
        appendQueryParams(
          `/embed/my-xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/prepare`,
          { token },
        ),
        {
          offering_id: input.offeringId ?? input.offering_id,
          package_id: input.packageId ?? input.package_id,
          price_id: input.priceId ?? input.price_id,
          installation_id: input.installationId ?? input.installation_id,
          locale: input.locale ?? undefined,
          country: input.country ?? undefined,
        },
      );
      return extractResultObject<XappPreparedPurchaseIntentResult>(payload);
    },

    async createEmbedMyXappPurchasePaymentSession(
      input: EmbedMyXappCreatePurchasePaymentSessionInput,
    ): Promise<XappPurchasePaymentSessionResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const resolvedIntentId = requireIntentId(input.intentId);
      const token = String(input.token || "").trim();
      if (!token) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "token is required",
        });
      }
      const payload = await requestJson(
        "POST",
        appendQueryParams(
          `/embed/my-xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/${encodeURIComponent(resolvedIntentId)}/payment-session`,
          { token },
        ),
        {
          payment_guard_ref: input.paymentGuardRef ?? input.payment_guard_ref,
          issuer: input.issuer ?? undefined,
          scheme: input.scheme ?? undefined,
          payment_scheme: input.paymentScheme ?? input.payment_scheme,
          return_url: input.returnUrl ?? input.return_url,
          cancel_url: input.cancelUrl ?? input.cancel_url,
          xapps_resume: input.xappsResume ?? input.xapps_resume,
          locale: input.locale ?? undefined,
          installation_id: input.installationId ?? input.installation_id,
          metadata: normalizeObjectPayload(input.metadata),
        },
      );
      return extractResultObject<XappPurchasePaymentSessionResult>(payload);
    },

    async finalizeEmbedMyXappPurchasePaymentSession(
      input: EmbedMyXappFinalizePurchasePaymentSessionInput,
    ): Promise<XappPurchasePaymentFinalizeResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const resolvedIntentId = requireIntentId(input.intentId);
      const token = String(input.token || "").trim();
      if (!token) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "token is required",
        });
      }
      const payload = await requestJson(
        "POST",
        appendQueryParams(
          `/embed/my-xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/${encodeURIComponent(resolvedIntentId)}/payment-session/finalize`,
          { token },
        ),
        {},
      );
      return extractResultObject<XappPurchasePaymentFinalizeResult>(payload);
    },

    async getXappMonetizationCatalog(
      input: string | XappMonetizationTargetingInput,
    ): Promise<XappMonetizationCatalogResult> {
      const resolvedInput =
        typeof input === "string" ? ({ xappId: input } as XappMonetizationTargetingInput) : input;
      const resolvedXappId = requireXappId(resolvedInput.xappId);
      const payload = await requestJson(
        "GET",
        buildXappMonetizationTargetingPath(
          `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization`,
          resolvedInput,
        ),
      );
      return extractResultObject<XappMonetizationCatalogResult>(payload);
    },

    async getXappMonetizationAccess(
      input: XappMonetizationScopeInput,
    ): Promise<XappMonetizationAccessResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const payload = await requestJson(
        "GET",
        buildXappMonetizationScopePath(
          `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/access`,
          input,
        ),
      );
      return extractResultObject<XappMonetizationAccessResult>(payload);
    },

    async getXappCurrentSubscription(
      input: XappMonetizationScopeInput,
    ): Promise<XappCurrentSubscriptionResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const payload = await requestJson(
        "GET",
        buildXappMonetizationScopePath(
          `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/current-subscription`,
          input,
        ),
      );
      return extractResultObject<XappCurrentSubscriptionResult>(payload);
    },

    async listXappEntitlements(input: XappMonetizationScopeInput): Promise<XappEntitlementsResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const payload = await requestJson(
        "GET",
        buildXappMonetizationScopePath(
          `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/entitlements`,
          input,
        ),
      );
      return extractResultObject<XappEntitlementsResult>(payload);
    },

    async listXappWalletAccounts(
      input: ListXappWalletAccountsInput,
    ): Promise<XappWalletAccountsResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const payload = await requestJson(
        "GET",
        buildXappMonetizationScopePath(
          `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/wallet-accounts`,
          input,
        ),
      );
      return extractResultObject<XappWalletAccountsResult>(payload);
    },

    async listXappWalletLedger(input: ListXappWalletLedgerInput): Promise<XappWalletLedgerResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const payload = await requestJson(
        "GET",
        buildXappWalletLedgerPath(
          `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/wallet-ledger`,
          input,
        ),
      );
      return extractResultObject<XappWalletLedgerResult>(payload);
    },

    async consumeXappWalletCredits(
      input: ConsumeXappWalletCreditsInput,
    ): Promise<XappWalletConsumeResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const walletAccountId = String(input.walletAccountId || "").trim();
      if (!walletAccountId) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "walletAccountId is required",
        });
      }
      const amount = String(input.amount || "").trim();
      if (!amount) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "amount is required",
        });
      }
      const payload = await requestJson(
        "POST",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/wallet-accounts/${encodeURIComponent(walletAccountId)}/consume`,
        {
          amount,
          source_ref: input.sourceRef ?? input.source_ref,
          metadata: normalizeObjectPayload(input.metadata),
        },
      );
      return extractResultObject<XappWalletConsumeResult>(payload);
    },

    async prepareXappPurchaseIntent(
      input: PrepareXappPurchaseIntentInput,
    ): Promise<XappPreparedPurchaseIntentResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const payload = await requestJson(
        "POST",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/prepare`,
        {
          offering_id: input.offeringId ?? input.offering_id,
          package_id: input.packageId ?? input.package_id,
          price_id: input.priceId ?? input.price_id,
          subject_id: input.subjectId ?? input.subject_id,
          installation_id: input.installationId ?? input.installation_id,
          realm_ref: input.realmRef ?? input.realm_ref,
          locale: input.locale ?? undefined,
          country: input.country ?? undefined,
          source_kind: input.sourceKind ?? input.source_kind,
          source_ref: input.sourceRef ?? input.source_ref,
          payment_lane: input.paymentLane ?? input.payment_lane,
          payment_session_id: input.paymentSessionId ?? input.payment_session_id,
          request_id: input.requestId ?? input.request_id,
        },
      );
      return extractResultObject<XappPreparedPurchaseIntentResult>(payload);
    },

    async getXappPurchaseIntent(input: {
      xappId: string;
      intentId: string;
    }): Promise<XappPreparedPurchaseIntentResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const resolvedIntentId = requireIntentId(input.intentId);
      const payload = await requestJson(
        "GET",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/${encodeURIComponent(resolvedIntentId)}`,
      );
      return extractResultObject<XappPreparedPurchaseIntentResult>(payload);
    },

    async createXappPurchaseTransaction(
      input: CreateXappPurchaseTransactionInput,
    ): Promise<XappPurchaseTransactionResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const resolvedIntentId = requireIntentId(input.intentId);
      const payload = await requestJson(
        "POST",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/${encodeURIComponent(resolvedIntentId)}/transactions`,
        {
          status: input.status,
          provider_ref: input.providerRef ?? input.provider_ref,
          evidence_ref: input.evidenceRef ?? input.evidence_ref,
          payment_session_id: input.paymentSessionId ?? input.payment_session_id,
          request_id: input.requestId ?? input.request_id,
          settlement_ref: input.settlementRef ?? input.settlement_ref,
          amount: input.amount ?? undefined,
          currency: input.currency ?? undefined,
          occurred_at: input.occurredAt ?? input.occurred_at,
        },
      );
      return extractResultObject<XappPurchaseTransactionResult>(payload);
    },

    async listXappPurchaseTransactions(
      input: ListXappPurchaseTransactionsInput,
    ): Promise<XappPurchaseTransactionsResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const resolvedIntentId = requireIntentId(input.intentId);
      const payload = await requestJson(
        "GET",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/${encodeURIComponent(resolvedIntentId)}/transactions`,
      );
      return extractResultObject<XappPurchaseTransactionsResult>(payload);
    },

    async createXappPurchasePaymentSession(
      input: CreateXappPurchasePaymentSessionInput,
    ): Promise<XappPurchasePaymentSessionResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const resolvedIntentId = requireIntentId(input.intentId);
      const payload = await requestJson(
        "POST",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/${encodeURIComponent(resolvedIntentId)}/payment-session`,
        {
          payment_guard_ref: input.paymentGuardRef ?? input.payment_guard_ref,
          issuer: input.issuer ?? undefined,
          scheme: input.scheme ?? undefined,
          payment_scheme: input.paymentScheme ?? input.payment_scheme,
          return_url: input.returnUrl ?? input.return_url,
          cancel_url: input.cancelUrl ?? input.cancel_url,
          xapps_resume: input.xappsResume ?? input.xapps_resume,
          page_url: input.pageUrl ?? input.page_url,
          locale: input.locale ?? undefined,
          subject_id: input.subjectId ?? input.subject_id,
          installation_id: input.installationId ?? input.installation_id,
          metadata: normalizeObjectPayload(input.metadata),
        },
      );
      return extractResultObject<XappPurchasePaymentSessionResult>(payload);
    },

    async reconcileXappPurchasePaymentSession(input: {
      xappId: string;
      intentId: string;
    }): Promise<XappPurchasePaymentReconcileResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const resolvedIntentId = requireIntentId(input.intentId);
      const payload = await requestJson(
        "POST",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/${encodeURIComponent(resolvedIntentId)}/payment-session/reconcile`,
        {},
      );
      return extractResultObject<XappPurchasePaymentReconcileResult>(payload);
    },

    async finalizeXappPurchasePaymentSession(input: {
      xappId: string;
      intentId: string;
    }): Promise<XappPurchasePaymentFinalizeResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const resolvedIntentId = requireIntentId(input.intentId);
      const payload = await requestJson(
        "POST",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/${encodeURIComponent(resolvedIntentId)}/payment-session/finalize`,
        {},
      );
      return extractResultObject<XappPurchasePaymentFinalizeResult>(payload);
    },

    async issueXappPurchaseAccess(input: {
      xappId: string;
      intentId: string;
    }): Promise<XappIssueAccessResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const resolvedIntentId = requireIntentId(input.intentId);
      const payload = await requestJson(
        "POST",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/purchase-intents/${encodeURIComponent(resolvedIntentId)}/issue-access`,
        {},
      );
      return extractResultObject<XappIssueAccessResult>(payload);
    },

    async reconcileXappSubscriptionContractPaymentSession(
      input: XappSubscriptionContractInput & {
        paymentSessionId: string;
        /** @deprecated Use `payment_session_id`. */
        payment_session_id?: string;
      },
    ): Promise<XappSubscriptionContractLifecycleResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const contractId = String(input.contractId || "").trim();
      if (!contractId) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "contractId is required",
        });
      }
      const paymentSessionId = String(
        input.paymentSessionId ?? input.payment_session_id ?? "",
      ).trim();
      if (!paymentSessionId) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "paymentSessionId is required",
        });
      }
      const payload = await requestJson(
        "POST",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/subscription-contracts/${encodeURIComponent(contractId)}/reconcile-payment-session`,
        { payment_session_id: paymentSessionId },
      );
      return extractResultObject<XappSubscriptionContractLifecycleResult>(payload);
    },

    async cancelXappSubscriptionContract(
      input: XappSubscriptionContractInput,
    ): Promise<XappSubscriptionContractLifecycleResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const contractId = String(input.contractId || "").trim();
      if (!contractId) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "contractId is required",
        });
      }
      const payload = await requestJson(
        "POST",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/subscription-contracts/${encodeURIComponent(contractId)}/cancel`,
        {},
      );
      return extractResultObject<XappSubscriptionContractLifecycleResult>(payload);
    },

    async refreshXappSubscriptionContractState(
      input: XappSubscriptionContractInput,
    ): Promise<XappSubscriptionContractLifecycleResult> {
      const resolvedXappId = requireXappId(input.xappId);
      const contractId = String(input.contractId || "").trim();
      if (!contractId) {
        throw new GatewayApiClientError({
          code: "GATEWAY_API_INVALID_RESPONSE",
          message: "contractId is required",
        });
      }
      const payload = await requestJson(
        "POST",
        `/v1/xapps/${encodeURIComponent(resolvedXappId)}/monetization/subscription-contracts/${encodeURIComponent(contractId)}/refresh-state`,
        {},
      );
      return extractResultObject<XappSubscriptionContractLifecycleResult>(payload);
    },
  };
}
