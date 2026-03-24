import { asRecord } from "./guardTakeover";
import {
  isAbortError,
  messageFromUnknownError,
  readErrorCode,
  readNestedRecordString,
  readRecordString,
} from "./bridgeUtils";
import type { SessionExpiredPayload } from "./sharedTypes";

type HostApiClientError = Error & {
  status?: number;
  code?: string;
  data?: unknown;
  path?: string;
  retryable?: boolean;
};

export type HostApiClient = (
  path: string,
  payload?: Record<string, unknown>,
  init?: RequestInit,
) => Promise<any>;

export type HostApiClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
  credentials?: RequestCredentials;
  fetchImpl?: typeof fetch;
};

function hostApiErrorMessage(path: string, status: number, data: unknown) {
  const record = asRecord(data);
  if (Object.keys(record).length > 0) {
    const msg = readRecordString(record, "message");
    if (msg) return msg;
    const errMsg = readNestedRecordString(record, "error", "message");
    if (errMsg) return errMsg;
  }
  if (typeof data === "string" && data.trim()) return data.trim();
  return `${path} failed (${status})`;
}

export function createHostApiClient(options?: HostApiClientOptions): HostApiClient {
  const fetchImpl =
    options?.fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined);
  const timeoutMs = Number(options?.timeoutMs || 0) || 0;
  return async (path, payload, init) => {
    if (!fetchImpl) throw new Error("fetch is not available");
    const absolutePath =
      options?.baseUrl && !/^[a-z][a-z0-9+.-]*:\/\//i.test(String(path || ""))
        ? new URL(String(path || ""), options.baseUrl).toString()
        : String(path || "");
    const controller = new AbortController();
    const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const hasBody =
      payload !== undefined &&
      payload !== null &&
      !(payload instanceof FormData) &&
      !(init && Object.prototype.hasOwnProperty.call(init, "body"));
    try {
      const response = await fetchImpl(absolutePath, {
        method: (init && init.method) || "POST",
        credentials: options?.credentials,
        ...init,
        signal: init?.signal || controller.signal,
        headers: {
          ...(options?.defaultHeaders || {}),
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
          ...((init && init.headers) || {}),
        },
        body:
          init && Object.prototype.hasOwnProperty.call(init, "body")
            ? init.body
            : hasBody
              ? JSON.stringify(payload || {})
              : payload instanceof FormData
                ? payload
                : undefined,
      });
      const contentType = String(response.headers.get("content-type") || "");
      const data = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : await response.text().catch(() => "");
      if (!response.ok) {
        const err = new Error(
          hostApiErrorMessage(String(path || absolutePath), response.status, data),
        ) as HostApiClientError;
        err.status = response.status;
        err.path = String(path || absolutePath);
        err.data = data;
        err.retryable = response.status >= 500 || response.status === 429;
        const code = readErrorCode(data);
        if (code) err.code = code;
        throw err;
      }
      return data;
    } catch (error) {
      if (isAbortError(error)) {
        const err = new Error(`Request timed out (${timeoutMs}ms)`) as HostApiClientError;
        err.path = String(path || absolutePath);
        err.retryable = true;
        throw err;
      }
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };
}

export type BridgeV2ApiHandlersOptions = {
  callApi: (path: string, payload?: Record<string, unknown>) => Promise<any>;
  getWidgetContext?: () => {
    installationId?: string | null;
    widgetId?: string | null;
  };
  getSubjectId?: () => string | null | undefined;
  getPortalToken?: () => string | null | undefined;
  getHostOrigin?: () => string;
  getHostReturnUrl?: () => string;
  clearSession?: (input: { reason?: string }) => Promise<void> | void;
  endpoints?: {
    tokenRefresh?: string;
    sign?: string;
    vendorAssertion?: string;
  };
};

export function createBridgeV2ApiHandlers(input: BridgeV2ApiHandlersOptions): {
  onTokenRefreshRequest: (input: {
    id?: string;
    source: "catalog" | "widget";
    data?: Record<string, unknown>;
  }) => Promise<{ token: string; expires_in?: number } | null>;
  onSignRequest: (input: {
    id?: string;
    source: "catalog" | "widget";
    data?: Record<string, unknown>;
  }) => Promise<{ ok: boolean; envelope?: Record<string, unknown>; error?: string }>;
  onVendorAssertionRequest: (input: {
    id?: string;
    source: "catalog" | "widget";
    data?: Record<string, unknown>;
  }) => Promise<{ ok: boolean; vendor_assertion?: string; link_id?: string; error?: string }>;
  onSessionExpired: (input: { data?: SessionExpiredPayload }) => Promise<void>;
} {
  const tokenRefreshEndpoint = String(input.endpoints?.tokenRefresh || "/api/bridge/token-refresh");
  const signEndpoint = String(input.endpoints?.sign || "/api/bridge/sign");
  const vendorAssertionEndpoint = String(
    input.endpoints?.vendorAssertion || "/api/bridge/vendor-assertion",
  );

  return {
    onTokenRefreshRequest: async ({ data }) => {
      const payload = asRecord(data);
      const widgetContext = input.getWidgetContext ? input.getWidgetContext() : {};
      const installationId =
        readRecordString(payload, "installationId") ||
        String(widgetContext.installationId || "").trim();
      const widgetId =
        readRecordString(payload, "widgetId") || String(widgetContext.widgetId || "").trim();
      if (!installationId || !widgetId) {
        throw new Error("Missing installationId/widgetId for token refresh");
      }
      const hostOrigin = input.getHostOrigin
        ? input.getHostOrigin()
        : typeof window !== "undefined" && window.location
          ? window.location.origin
          : "";
      const hostReturnUrl = input.getHostReturnUrl
        ? input.getHostReturnUrl()
        : typeof window !== "undefined" && window.location
          ? window.location.href
          : "";
      const out = await input.callApi(tokenRefreshEndpoint, {
        ...payload,
        installationId,
        widgetId,
        origin: hostOrigin,
        subjectId: input.getSubjectId ? input.getSubjectId() || undefined : undefined,
        hostReturnUrl,
      });
      const token = String(out && out.token ? out.token : "").trim();
      if (!token) throw new Error("token refresh response missing token");
      const expiresIn = Number(out && out.expires_in ? out.expires_in : 0) || undefined;
      return expiresIn ? { token, expires_in: expiresIn } : { token };
    },
    onSignRequest: async ({ data }) => {
      try {
        const payload = data && typeof data === "object" && !Array.isArray(data) ? data : {};
        const out = await input.callApi(signEndpoint, {
          ...payload,
          subjectId: input.getSubjectId ? input.getSubjectId() || undefined : undefined,
        });
        return {
          ok: Boolean(out && out.ok),
          envelope: out ? out.envelope : undefined,
          error: out ? out.error : undefined,
        };
      } catch (err) {
        return { ok: false, error: messageFromUnknownError(err, "sign request failed") };
      }
    },
    onVendorAssertionRequest: async ({ data }) => {
      try {
        const payload = data && typeof data === "object" && !Array.isArray(data) ? data : {};
        const out = await input.callApi(vendorAssertionEndpoint, {
          ...payload,
          portalToken:
            readRecordString(asRecord(payload), "portalToken") || input.getPortalToken?.() || "",
        });
        return {
          ok: true,
          vendor_assertion: out?.vendor_assertion || out?.vendorAssertion,
          link_id: out?.link_id || out?.linkId,
        };
      } catch (err) {
        return {
          ok: false,
          error: messageFromUnknownError(err, "vendor assertion request failed"),
        };
      }
    },
    onSessionExpired: async ({ data }) => {
      if (input.clearSession) {
        const reason = readRecordString(asRecord(data), "reason");
        await input.clearSession({ reason });
      }
    },
  };
}
