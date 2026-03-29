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
  };
}
