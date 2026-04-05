export type HostedPaymentClientOptions = {
  baseUrl?: string;
  sessionEndpoint?: string;
  completeEndpoint?: string;
  clientSettleEndpoint?: string;
  fetchImpl?: typeof fetch;
};

export type HostedPaymentAcceptEntry = {
  scheme: string;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type HostedPaymentLocalizedText = string | { en?: string; ro?: string };

export type HostedPaymentUiContract = {
  brand?: {
    name?: HostedPaymentLocalizedText | null;
    logo_url?: string | null;
    accent?: string | null;
    mode?: string | null;
  } | null;
  copy?: {
    title?: HostedPaymentLocalizedText | null;
    subtitle?: HostedPaymentLocalizedText | null;
  } | null;
  schemes?: Array<{
    scheme: string;
    title?: HostedPaymentLocalizedText | null;
    subtitle?: HostedPaymentLocalizedText | null;
    badge?: HostedPaymentLocalizedText | null;
    cta_label?: HostedPaymentLocalizedText | null;
    help_text?: HostedPaymentLocalizedText | null;
    accent?: string | null;
    mode?: string | null;
  }> | null;
};

export type HostedPaymentBillingSummary = {
  lane: "pay_by_request" | "xms";
  kind: string;
  title?: string | null;
  description?: string | null;
  service_name?: string | null;
  product_name?: string | null;
  xapp_id?: string | null;
  xapp_slug?: string | null;
  tool_name?: string | null;
  offering_slug?: string | null;
  offering_name?: string | null;
  package_slug?: string | null;
  package_name?: string | null;
  package_kind?: string | null;
  product_slug?: string | null;
  product_family?: string | null;
  price_slug?: string | null;
  price_label?: string | null;
  payment_guard_ref?: string | null;
};

export type HostedPaymentSession = {
  payment_session_id: string;
  xapp_id?: string;
  tool_name?: string;
  amount?: string;
  currency?: string;
  return_url?: string | null;
  cancel_url?: string | null;
  accepts?: HostedPaymentAcceptEntry[];
  ui?: HostedPaymentUiContract | null;
  billing_summary?: HostedPaymentBillingSummary | null;
  invoice_summary?: {
    id: string;
    invoice_identifier?: string | null;
    status?: string | null;
    series?: string | null;
    number?: string | null;
    document_ready?: boolean;
    document_url?: string | null;
    document_download_url?: string | null;
  } | null;
  [key: string]: unknown;
};

export type HostedPaymentCompleteResult = {
  status?: "paid" | "failed" | "cancelled" | "pending";
  flow?: string;
  redirect_url?: string;
  client_settle_url?: string;
  provider_reference?: string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type HostedPaymentClientSettleResult = {
  redirect_url?: string;
  [key: string]: unknown;
};

export type HostedPaymentSessionQuery = {
  paymentSessionId: string;
  returnUrl?: string;
  cancelUrl?: string;
  xappsResume?: string;
};

export type HostedPaymentCompleteInput = {
  paymentSessionId: string;
  returnUrl?: string;
  cancelUrl?: string;
  xappsResume?: string;
  paymentScheme?: string;
};

export type HostedPaymentClientSettleInput = {
  paymentSessionId: string;
  status?: "paid" | "failed" | "cancelled" | "pending";
  returnUrl?: string;
  xappsResume?: string;
  clientToken?: string;
  clientSettleUrl?: string;
};

type ApiPayload<T> = {
  result?: T;
  message?: string;
};

class HostedPaymentClientError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "HostedPaymentClientError";
    this.statusCode = statusCode;
  }
}

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function withBase(baseUrl: string, endpoint: string): string {
  const cleanEndpoint = `/${String(endpoint || "").replace(/^\/+/, "")}`;
  const cleanBase = trim(baseUrl).replace(/\/+$/, "");
  if (!cleanBase) return cleanEndpoint;
  return `${cleanBase}${cleanEndpoint}`;
}

function resolveRequestUrl(baseUrl: string, endpointOrUrl: string): string {
  const value = trim(endpointOrUrl);
  if (!value) return withBase(baseUrl, endpointOrUrl);
  if (/^https?:\/\//i.test(value)) return value;
  return withBase(baseUrl, value);
}

async function parsePayload<T>(response: Response): Promise<ApiPayload<T>> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return {};
  try {
    const payload = JSON.parse(text);
    return payload && typeof payload === "object" ? (payload as ApiPayload<T>) : {};
  } catch (error) {
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[payment-hosted-client] JSON parse fallback", {
        scope: "parsePayload",
        url: response.url || "",
        message: error instanceof Error ? error.message : String(error),
        preview: text.slice(0, 200),
      });
    }
    return {};
  }
}

function requiredFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) return fetchImpl;
  if (typeof fetch !== "function") {
    throw new Error("fetch is not available; pass fetchImpl explicitly");
  }
  // In browsers, calling an unbound native fetch can throw "Illegal invocation".
  return fetch.bind(globalThis);
}

async function requestJson<T>(input: {
  fetchImpl: typeof fetch;
  method: "GET" | "POST";
  url: string;
  body?: Record<string, unknown>;
}): Promise<T> {
  const response = await input.fetchImpl(input.url, {
    method: input.method,
    credentials: "same-origin",
    headers: input.method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const payload = await parsePayload<T>(response);
  if (!response.ok || !payload.result) {
    const message = trim(payload.message) || `request failed (${response.status})`;
    throw new HostedPaymentClientError(message, response.status);
  }
  return payload.result;
}

export function createHostedPaymentClient(options: HostedPaymentClientOptions = {}) {
  const sessionEndpoint = trim(options.sessionEndpoint) || "/v1/gateway-payment/session";
  const completeEndpoint = trim(options.completeEndpoint) || "/v1/gateway-payment/complete";
  const clientSettleEndpoint =
    trim(options.clientSettleEndpoint) || "/v1/gateway-payment/client-settle";
  const fetchImpl = requiredFetch(options.fetchImpl);
  const baseUrl = trim(options.baseUrl);

  return {
    async getSession(input: HostedPaymentSessionQuery): Promise<HostedPaymentSession> {
      const paymentSessionId = trim(input.paymentSessionId);
      if (!paymentSessionId) {
        throw new Error("paymentSessionId is required");
      }
      const query = new URLSearchParams({ payment_session_id: paymentSessionId });
      const returnUrl = trim(input.returnUrl);
      const cancelUrl = trim(input.cancelUrl);
      const xappsResume = trim(input.xappsResume);
      if (returnUrl) query.set("return_url", returnUrl);
      if (cancelUrl) query.set("cancel_url", cancelUrl);
      if (xappsResume) query.set("xapps_resume", xappsResume);

      const url = `${withBase(baseUrl, sessionEndpoint)}?${query.toString()}`;
      return requestJson<HostedPaymentSession>({ fetchImpl, method: "GET", url });
    },

    async completeSession(input: HostedPaymentCompleteInput): Promise<HostedPaymentCompleteResult> {
      const paymentSessionId = trim(input.paymentSessionId);
      if (!paymentSessionId) {
        throw new Error("paymentSessionId is required");
      }
      const paymentScheme = trim(input.paymentScheme);
      return requestJson<HostedPaymentCompleteResult>({
        fetchImpl,
        method: "POST",
        url: withBase(baseUrl, completeEndpoint),
        body: {
          payment_session_id: paymentSessionId,
          ...(paymentScheme ? { scheme: paymentScheme } : {}),
          ...(trim(input.returnUrl) ? { return_url: trim(input.returnUrl) } : {}),
          ...(trim(input.cancelUrl) ? { cancel_url: trim(input.cancelUrl) } : {}),
          ...(trim(input.xappsResume) ? { xapps_resume: trim(input.xappsResume) } : {}),
        },
      });
    },

    async clientSettle(
      input: HostedPaymentClientSettleInput,
    ): Promise<HostedPaymentClientSettleResult> {
      const paymentSessionId = trim(input.paymentSessionId);
      if (!paymentSessionId) {
        throw new Error("paymentSessionId is required");
      }
      const status = trim(input.status || "paid").toLowerCase();
      const normalizedStatus =
        status === "failed" || status === "cancelled" || status === "pending" ? status : "paid";
      return requestJson<HostedPaymentClientSettleResult>({
        fetchImpl,
        method: "POST",
        url: resolveRequestUrl(baseUrl, trim(input.clientSettleUrl) || clientSettleEndpoint),
        body: {
          payment_session_id: paymentSessionId,
          status: normalizedStatus,
          ...(trim(input.returnUrl) ? { return_url: trim(input.returnUrl) } : {}),
          ...(trim(input.xappsResume) ? { xapps_resume: trim(input.xappsResume) } : {}),
          ...(trim(input.clientToken) ? { client_token: trim(input.clientToken) } : {}),
        },
      });
    },
  };
}

export { HostedPaymentClientError };
