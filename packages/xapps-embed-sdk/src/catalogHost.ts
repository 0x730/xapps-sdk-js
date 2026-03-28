import {
  asRecord,
  mergeGuardResolutionPayload,
  openGuardWidgetOverlay,
  readGuardBlockedPayload,
} from "./guardTakeover";
import {
  messageFromUnknownError,
  normalizeOpenOperationalSurfaceInput,
  readInstallationSummary,
  readMessageData,
  readMessageRecord,
  readRecordArray,
  readRecordString,
} from "./bridgeUtils";
import type { OpenOperationalSurfaceInput, SessionExpiredPayload, Theme } from "./sharedTypes";

export type CatalogOptions = {
  container: HTMLElement;
  baseUrl: string;
  catalogUrl?: string;
  theme?: Theme;
  locale?: string;
  subjectId?: string;
  onEvent?: (evt: CatalogEvent) => void;
  onError?: (err: Error) => void;
  confirmDialog?: (input: {
    source: "catalog" | "widget";
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean> | boolean;
  bridgeV2?: {
    tokenRefreshPolicy?: {
      maxAttempts?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
    };
    vendorAssertionPolicy?: {
      maxAttempts?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
    };
    onTokenRefreshRequest?: (input: {
      id?: string;
      source: "catalog" | "widget";
      data?: Record<string, unknown>;
    }) =>
      | Promise<{ token: string; expires_in?: number } | null>
      | { token: string; expires_in?: number }
      | null;
    onSignRequest?: (input: {
      id?: string;
      source: "catalog" | "widget";
      data?: Record<string, unknown>;
    }) =>
      | Promise<{ ok: boolean; envelope?: Record<string, unknown>; error?: string }>
      | { ok: boolean; envelope?: Record<string, unknown>; error?: string };
    onVendorAssertionRequest?: (input: {
      id?: string;
      source: "catalog" | "widget";
      data?: Record<string, unknown>;
    }) =>
      | Promise<{ ok: boolean; vendor_assertion?: string; link_id?: string; error?: string }>
      | { ok: boolean; vendor_assertion?: string; link_id?: string; error?: string };
    onSessionExpired?: (input: {
      id?: string;
      source: "catalog" | "widget";
      data?: SessionExpiredPayload;
    }) => Promise<void> | void;
  };
  hostApi?: {
    installUrl?: string;
    uninstallUrl?: string;
    createCatalogSessionUrl?: string;
    createWidgetSessionUrl?: string;
    installationsUrl?: string;
    headers?: Record<string, string>;
    getHeaders?: () => Record<string, string> | null | undefined;
  };
  publishers?: string[];
  tags?: string[];
  embedContext?: {
    getHostReturnUrl?: () => string | null | undefined;
    getPaymentParams?:
      | (() => URLSearchParams | Record<string, unknown> | null | undefined)
      | undefined;
  };
  widgetMount?: {
    container: HTMLElement;
  };
};

export type CatalogEvent =
  | {
      type: "XAPPS_MARKETPLACE_REQUEST_INSTALL";
      data: {
        xappId: string;
        defaultWidgetId?: string | null;
        subjectId?: string | null;
        termsAccepted?: boolean;
      };
    }
  | {
      type: "XAPPS_MARKETPLACE_INSTALL_SUCCESS";
      data: { installationId: string; xappId: string; defaultWidgetId?: string | null };
    }
  | { type: "XAPPS_MARKETPLACE_INSTALL_FAILURE"; data: { xappId: string; message: string } }
  | {
      type: "XAPPS_MARKETPLACE_REQUEST_UPDATE";
      data: { installationId: string; xappId: string; termsAccepted?: boolean };
    }
  | {
      type: "XAPPS_MARKETPLACE_UPDATE_SUCCESS";
      data: { installationId: string; xappId: string };
    }
  | {
      type: "XAPPS_MARKETPLACE_UPDATE_FAILURE";
      data: { installationId: string; xappId: string; message: string };
    }
  | { type: "XAPPS_MARKETPLACE_REQUEST_UNINSTALL"; data: { installationId: string } }
  | { type: "XAPPS_MARKETPLACE_UNINSTALL_SUCCESS"; data: { installationId: string } }
  | {
      type: "XAPPS_MARKETPLACE_UNINSTALL_FAILURE";
      data: { installationId: string; message: string };
    }
  | { type: "XAPPS_MARKETPLACE_GET_INSTALLATIONS"; data?: Record<string, unknown> }
  | {
      type: "XAPPS_MARKETPLACE_INSTALLATIONS";
      data: { byXappId: Record<string, { installationId: string }> };
    }
  | { type: "XAPPS_OPEN_WIDGET"; data: { installationId: string; widgetId: string } }
  | { type: "XAPPS_OPEN_OPERATIONAL_SURFACE"; data: OpenOperationalSurfaceInput }
  | { type: "XAPPS_IFRAME_NAVIGATED"; data: { path: string; page?: string; params?: any } }
  | { type: "XAPPS_TOKEN_REFRESH_REQUEST"; id?: string; data?: Record<string, unknown> }
  | { type: "XAPPS_TOKEN_REFRESH"; id?: string; data?: Record<string, unknown> }
  | { type: "XAPPS_SIGN_REQUEST"; id?: string; data?: Record<string, unknown> }
  | {
      type: "XAPPS_SIGN_RESULT";
      id?: string;
      ok: boolean;
      envelope?: Record<string, unknown>;
      error?: string;
    }
  | { type: "XAPPS_VENDOR_ASSERTION_REQUEST"; id?: string; data?: Record<string, unknown> }
  | {
      type: "XAPPS_VENDOR_ASSERTION_RESULT";
      id?: string;
      ok: boolean;
      vendor_assertion?: string;
      link_id?: string;
      error?: string;
    }
  | { type: "XAPPS_LOCALE_CHANGED"; locale?: string | null }
  | { type: "XAPPS_SESSION_EXPIRED"; id?: string; data?: SessionExpiredPayload };

export type MarketplaceMutationCall = (
  path: string,
  payload?: Record<string, unknown>,
) => Promise<Record<string, unknown> | null | undefined>;

export type MarketplaceMutationHelperOptions = {
  getHost: () => XappsHost | null | undefined;
  getSubjectId?: () => string | null | undefined;
  callApi?: MarketplaceMutationCall;
  endpoints?: {
    install?: string;
    update?: string;
    uninstall?: string;
  };
  refreshInstallationsAfterMutation?: boolean;
  openDefaultWidgetAfterInstall?: boolean;
  onInstallSuccess?: (input: {
    event: Extract<CatalogEvent, { type: "XAPPS_MARKETPLACE_REQUEST_INSTALL" }>;
    result: Record<string, unknown> | null | undefined;
    installation: { installationId: string; xappId: string };
  }) => Promise<void> | void;
  onInstallFailure?: (input: {
    event: Extract<CatalogEvent, { type: "XAPPS_MARKETPLACE_REQUEST_INSTALL" }>;
    error: Error;
  }) => Promise<void> | void;
  onUpdateSuccess?: (input: {
    event: Extract<CatalogEvent, { type: "XAPPS_MARKETPLACE_REQUEST_UPDATE" }>;
    result: Record<string, unknown> | null | undefined;
  }) => Promise<void> | void;
  onUpdateFailure?: (input: {
    event: Extract<CatalogEvent, { type: "XAPPS_MARKETPLACE_REQUEST_UPDATE" }>;
    error: Error;
  }) => Promise<void> | void;
  onUninstallSuccess?: (input: {
    event: Extract<CatalogEvent, { type: "XAPPS_MARKETPLACE_REQUEST_UNINSTALL" }>;
    result: Record<string, unknown> | null | undefined;
  }) => Promise<void> | void;
  onUninstallFailure?: (input: {
    event: Extract<CatalogEvent, { type: "XAPPS_MARKETPLACE_REQUEST_UNINSTALL" }>;
    error: Error;
  }) => Promise<void> | void;
  onWidgetOpen?: (input: {
    event: Extract<CatalogEvent, { type: "XAPPS_OPEN_WIDGET" }>;
  }) => Promise<void> | void;
  onOperationalSurfaceOpen?: (input: {
    event: Extract<CatalogEvent, { type: "XAPPS_OPEN_OPERATIONAL_SURFACE" }>;
  }) => Promise<void> | void;
};

class HostApiError extends Error {
  status?: number;
  payload?: unknown;
}

function toErrorMessage(value: unknown, fallback: string) {
  const msg = readRecordString(asRecord(value), "message");
  if (msg) return msg;
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

async function defaultMarketplaceMutationCall(path: string, payload?: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const contentType = String(response.headers.get("content-type") || "");
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");
  if (!response.ok) {
    const fromObject =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;
    const err = new HostApiError(
      toErrorMessage(
        fromObject?.message || (typeof data === "string" ? data : ""),
        `${path} failed (${response.status})`,
      ),
    );
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  if (data && typeof data === "object" && !Array.isArray(data))
    return data as Record<string, unknown>;
  return null;
}

function readStringField(source: Record<string, unknown> | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = source && key in source ? source[key] : "";
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function resolveHostApiHeaders(
  hostApi: CatalogOptions["hostApi"] | null | undefined,
): Record<string, string> {
  const providerValue =
    typeof hostApi?.getHeaders === "function" ? hostApi.getHeaders() || undefined : undefined;
  const headers =
    providerValue && typeof providerValue === "object" && !Array.isArray(providerValue)
      ? providerValue
      : hostApi?.headers && typeof hostApi.headers === "object" && !Array.isArray(hostApi.headers)
        ? hostApi.headers
        : {};
  return { ...headers };
}

export function createMarketplaceMutationEventHandler(options: MarketplaceMutationHelperOptions) {
  const callApi = options.callApi || defaultMarketplaceMutationCall;
  const installUrl = String(options.endpoints?.install || "/api/install");
  const updateUrl = String(options.endpoints?.update || "/api/update");
  const uninstallUrl = String(options.endpoints?.uninstall || "/api/uninstall");
  const refreshAfterMutation = options.refreshInstallationsAfterMutation !== false;
  const openDefaultWidgetAfterInstall = options.openDefaultWidgetAfterInstall !== false;

  return async function handleMarketplaceEvent(evt: CatalogEvent) {
    const host = options.getHost();
    if (!host) return false;

    if (evt.type === "XAPPS_MARKETPLACE_REQUEST_INSTALL") {
      try {
        const basePayload = {
          xappId: evt.data.xappId,
          subjectId: options.getSubjectId ? options.getSubjectId() || null : null,
          termsAccepted: Boolean(evt.data.termsAccepted),
        };
        let result: Record<string, unknown> | null | undefined;
        try {
          result = await callApi(installUrl, basePayload);
        } catch (error) {
          const guardBlocked = readGuardBlockedPayload(error);
          if (guardBlocked?.actionKind === "open_guard" && guardBlocked.guardUi) {
            const resolution = await host.resolveGuardUi({
              guardUi: guardBlocked.guardUi,
              xappId: evt.data.xappId,
            });
            if (!resolution) {
              throw new Error(guardBlocked.message || "Guard flow cancelled");
            }
            result = await callApi(
              installUrl,
              mergeGuardResolutionPayload(basePayload, resolution),
            );
          } else {
            throw error;
          }
        }
        const installationSource =
          result &&
          typeof result === "object" &&
          "installation" in result &&
          result.installation &&
          typeof result.installation === "object"
            ? (result.installation as Record<string, unknown>)
            : result;
        const installationId = readStringField(installationSource, "id", "installationId");
        const xappId =
          readStringField(installationSource, "xapp_id", "xappId") || String(evt.data.xappId || "");
        if (!installationId) throw new Error("Install response missing installation id");

        host.emitToCatalog({
          type: "XAPPS_MARKETPLACE_INSTALL_SUCCESS",
          data: {
            installationId,
            xappId,
            defaultWidgetId: evt.data.defaultWidgetId || null,
          },
        });
        if (refreshAfterMutation) {
          host.emitToCatalog({ type: "XAPPS_MARKETPLACE_GET_INSTALLATIONS", data: {} });
        }
        if (openDefaultWidgetAfterInstall && evt.data.defaultWidgetId) {
          await host.openWidget({
            installationId,
            widgetId: String(evt.data.defaultWidgetId),
          });
        }
        if (options.onInstallSuccess) {
          await options.onInstallSuccess({
            event: evt,
            result,
            installation: { installationId, xappId },
          });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        host.emitToCatalog({
          type: "XAPPS_MARKETPLACE_INSTALL_FAILURE",
          data: {
            xappId: evt.data.xappId,
            message: err.message || "Install failed",
          },
        });
        if (options.onInstallFailure) await options.onInstallFailure({ event: evt, error: err });
      }
      return true;
    }

    if (evt.type === "XAPPS_MARKETPLACE_REQUEST_UPDATE") {
      try {
        const result = await callApi(updateUrl, {
          installationId: evt.data.installationId,
          subjectId: options.getSubjectId ? options.getSubjectId() || null : null,
          termsAccepted: Boolean(evt.data.termsAccepted),
        });
        host.emitToCatalog({
          type: "XAPPS_MARKETPLACE_UPDATE_SUCCESS",
          data: {
            installationId: evt.data.installationId,
            xappId: evt.data.xappId,
          },
        });
        if (refreshAfterMutation) {
          host.emitToCatalog({ type: "XAPPS_MARKETPLACE_GET_INSTALLATIONS", data: {} });
        }
        if (options.onUpdateSuccess) await options.onUpdateSuccess({ event: evt, result });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        host.emitToCatalog({
          type: "XAPPS_MARKETPLACE_UPDATE_FAILURE",
          data: {
            installationId: evt.data.installationId,
            xappId: evt.data.xappId,
            message: err.message || "Update failed",
          },
        });
        if (options.onUpdateFailure) await options.onUpdateFailure({ event: evt, error: err });
      }
      return true;
    }

    if (evt.type === "XAPPS_MARKETPLACE_REQUEST_UNINSTALL") {
      try {
        const result = await callApi(uninstallUrl, {
          installationId: evt.data.installationId,
          subjectId: options.getSubjectId ? options.getSubjectId() || null : null,
        });
        host.emitToCatalog({
          type: "XAPPS_MARKETPLACE_UNINSTALL_SUCCESS",
          data: { installationId: evt.data.installationId },
        });
        if (refreshAfterMutation) {
          host.emitToCatalog({ type: "XAPPS_MARKETPLACE_GET_INSTALLATIONS", data: {} });
        }
        if (options.onUninstallSuccess) await options.onUninstallSuccess({ event: evt, result });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        host.emitToCatalog({
          type: "XAPPS_MARKETPLACE_UNINSTALL_FAILURE",
          data: {
            installationId: evt.data.installationId,
            message: err.message || "Uninstall failed",
          },
        });
        if (options.onUninstallFailure)
          await options.onUninstallFailure({ event: evt, error: err });
      }
      return true;
    }

    if (evt.type === "XAPPS_OPEN_WIDGET") {
      if (options.onWidgetOpen) await options.onWidgetOpen({ event: evt });
      return false;
    }

    if (evt.type === "XAPPS_OPEN_OPERATIONAL_SURFACE") {
      if (options.onOperationalSurfaceOpen) {
        await options.onOperationalSurfaceOpen({ event: evt });
      }
      return false;
    }

    return false;
  };
}

type CatalogSession = { token: string; embedUrl: string };
type WidgetSession = {
  token: string;
  embedUrl: string;
  context?: {
    clientId: string;
    installationId: string;
    xappId: string;
    subjectId: string | null;
    requestId?: string | null;
    resultPresentation?: "runtime_default" | "inline" | "publisher_managed";
  } | null;
};

function asOrigin(url: string): string {
  return new URL(url).origin;
}

function ensureBaseUrl(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) throw new Error("baseUrl is required");
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function toEmbedPaymentParams(input: URLSearchParams | Record<string, unknown> | null | undefined) {
  const out = new URLSearchParams();
  if (!input) return out;
  if (input instanceof URLSearchParams) {
    for (const [k, v] of input.entries()) {
      if (!String(k).startsWith("xapps_payment_")) continue;
      out.set(String(k), String(v));
    }
    return out;
  }
  for (const [k, raw] of Object.entries(input)) {
    if (!String(k).startsWith("xapps_payment_")) continue;
    if (raw === null || raw === undefined) continue;
    const value =
      typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
        ? String(raw)
        : "";
    if (!value) continue;
    out.set(String(k), value);
  }
  return out;
}

export class XappsHost {
  private catalogIframe: HTMLIFrameElement | null = null;
  private widgetIframe: HTMLIFrameElement | null = null;
  private options: CatalogOptions;
  private catalogOrigin: string;
  private widgetContext: {
    token: string;
    baseUrl: string;
    theme?: Theme | null;
    locale?: string | null;
  } | null = null;
  private destroyed = false;
  private lastCatalogContentHeight = 0;
  private lastWidgetContentHeight = 0;
  private activeWidget: { installationId: string; widgetId: string } | null = null;

  private resolveHostReturnUrl(explicit?: string | null): string {
    const explicitValue = String(explicit || "").trim();
    if (explicitValue) return explicitValue;
    try {
      const fromContext = this.options.embedContext?.getHostReturnUrl?.();
      const normalized = String(fromContext || "").trim();
      if (normalized) return normalized;
    } catch {}
    return String(window.location.href || "").trim();
  }

  private resolveEmbedPaymentParams() {
    try {
      const raw = this.options.embedContext?.getPaymentParams?.();
      return toEmbedPaymentParams(raw);
    } catch {
      return new URLSearchParams();
    }
  }

  private withEmbedContextUrl(
    urlLike: string,
    input?: {
      hostReturnUrl?: string;
      includePaymentParams?: boolean;
      overrideHostReturnUrl?: boolean;
    },
  ) {
    const raw = String(urlLike || "").trim();
    if (!raw) return raw;
    try {
      const parsed = new URL(raw, window.location.origin);
      const hostReturnUrl = this.resolveHostReturnUrl(input?.hostReturnUrl);
      if (hostReturnUrl) {
        if (input?.overrideHostReturnUrl) {
          parsed.searchParams.set("xapps_host_return_url", hostReturnUrl);
        } else if (!parsed.searchParams.has("xapps_host_return_url")) {
          parsed.searchParams.set("xapps_host_return_url", hostReturnUrl);
        }
      }
      if (input?.includePaymentParams) {
        const paymentParams = this.resolveEmbedPaymentParams();
        for (const [k, v] of paymentParams.entries()) {
          if (!parsed.searchParams.has(k)) parsed.searchParams.set(k, v);
        }
      }
      return parsed.toString();
    } catch {
      return raw;
    }
  }

  private buildOperationalSurfaceUrl(input: OpenOperationalSurfaceInput): string | null {
    const surface = String(input?.surface || "")
      .trim()
      .toLowerCase();
    if (!["requests", "payments", "invoices", "notifications"].includes(surface)) return null;

    const rawCurrent =
      String(this.catalogIframe?.src || "").trim() || `${this.options.baseUrl}/embed/catalog`;
    const current = new URL(rawCurrent, window.location.origin);
    const matchedBase = current.pathname.match(/^(.*\/embed\/catalog)(?:\/.*)?$/);
    const catalogRoot = matchedBase ? matchedBase[1] : "/embed/catalog";

    let nextPath = `${catalogRoot}/${surface}`;
    if (surface === "requests" && typeof input.requestId === "string" && input.requestId.trim()) {
      nextPath = `${nextPath}/${encodeURIComponent(input.requestId.trim())}`;
    }

    current.pathname = nextPath;
    current.searchParams.delete("page");
    current.searchParams.delete("pageSize");

    if (typeof input.xappId === "string" && input.xappId.trim()) {
      current.searchParams.set("xappId", input.xappId.trim());
    }
    if (typeof input.installationId === "string" && input.installationId.trim()) {
      current.searchParams.set("installationId", input.installationId.trim());
    }
    if (
      typeof input.paymentSessionId === "string" &&
      input.paymentSessionId.trim() &&
      surface === "payments"
    ) {
      current.searchParams.set("paymentSessionId", input.paymentSessionId.trim());
    }
    if (typeof input.invoiceId === "string" && input.invoiceId.trim() && surface === "invoices") {
      current.searchParams.set("invoiceId", input.invoiceId.trim());
    }
    if (
      typeof input.notificationId === "string" &&
      input.notificationId.trim() &&
      surface === "notifications"
    ) {
      current.searchParams.set("notificationId", input.notificationId.trim());
    }

    return this.withEmbedContextUrl(current.toString(), {
      includePaymentParams: true,
      overrideHostReturnUrl: false,
    });
  }

  private async showDefaultConfirmDialog(input: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<boolean> {
    if (typeof document === "undefined" || !document.body) {
      return typeof window.confirm === "function" ? window.confirm(input.message) : false;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (confirmed: boolean) => {
        if (settled) return;
        settled = true;
        try {
          overlay.remove();
          document.removeEventListener("keydown", onKeyDown);
        } catch {}
        resolve(Boolean(confirmed));
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") finish(false);
      };

      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(2,6,23,0.56)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.padding = "16px";
      overlay.style.zIndex = "2147483000";

      const card = document.createElement("div");
      card.style.width = "min(560px, 92vw)";
      card.style.background = "#fff";
      card.style.border = "1px solid #e5e7eb";
      card.style.borderRadius = "14px";
      card.style.padding = "16px";
      card.style.boxShadow = "0 18px 45px rgba(15,23,42,0.22)";

      const title = document.createElement("h3");
      title.style.margin = "0 0 8px";
      title.textContent = String(input.title || "Confirmation");

      const message = document.createElement("div");
      message.style.color = "#334155";
      message.style.whiteSpace = "pre-wrap";
      message.textContent = String(input.message || "This action requires confirmation.");

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.justifyContent = "flex-end";
      actions.style.gap = "8px";
      actions.style.marginTop = "14px";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = String(input.cancelLabel || "Cancel");
      cancel.style.padding = "8px 12px";
      cancel.style.border = "1px solid #cbd5e1";
      cancel.style.borderRadius = "8px";
      cancel.style.background = "#fff";
      cancel.style.cursor = "pointer";
      cancel.addEventListener("click", () => finish(false));

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.textContent = String(input.confirmLabel || "Continue");
      confirm.style.padding = "8px 12px";
      confirm.style.border = "1px solid #0f5be0";
      confirm.style.borderRadius = "8px";
      confirm.style.background = "#126bf1";
      confirm.style.color = "#fff";
      confirm.style.cursor = "pointer";
      confirm.addEventListener("click", () => finish(true));

      actions.appendChild(cancel);
      actions.appendChild(confirm);
      card.appendChild(title);
      card.appendChild(message);
      card.appendChild(actions);
      overlay.appendChild(card);

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) finish(false);
      });
      card.addEventListener("click", (event) => event.stopPropagation());

      document.addEventListener("keydown", onKeyDown);
      document.body.appendChild(overlay);
      confirm.focus();
    });
  }

  private replyToSource(e: MessageEvent, message: Record<string, unknown>) {
    const source = e.source as Window | null;
    if (!source || typeof source.postMessage !== "function") return;
    try {
      source.postMessage(message, e.origin || "*");
    } catch (err: any) {
      this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  private async runTokenRefreshWithRetry(input: {
    id?: string;
    source: "catalog" | "widget";
    data?: Record<string, unknown>;
  }): Promise<{ token: string; expires_in?: number } | null> {
    const bridge = this.options.bridgeV2;
    if (!bridge?.onTokenRefreshRequest) return null;

    const policy = bridge.tokenRefreshPolicy ?? {};
    const maxAttempts = Math.max(1, Math.min(6, Number(policy.maxAttempts ?? 3)));
    const baseDelayMs = Math.max(0, Number(policy.baseDelayMs ?? 150));
    const maxDelayMs = Math.max(baseDelayMs, Number(policy.maxDelayMs ?? 1200));

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const refreshed = await bridge.onTokenRefreshRequest(input);
        if (refreshed && typeof refreshed.token === "string" && refreshed.token.trim().length > 0) {
          return refreshed;
        }
        lastError = new Error("Token refresh callback returned no token");
      } catch (err) {
        lastError = err;
      }

      if (attempt < maxAttempts) {
        const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
        await this.sleep(delayMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError || "Token refresh failed"));
  }

  private async runVendorAssertionWithRetry(input: {
    id?: string;
    source: "catalog" | "widget";
    data?: Record<string, unknown>;
  }): Promise<{ ok: boolean; vendor_assertion?: string; link_id?: string; error?: string }> {
    const bridge = this.options.bridgeV2;
    if (!bridge?.onVendorAssertionRequest) {
      throw new Error("Vendor assertion unavailable");
    }

    const policy = bridge.vendorAssertionPolicy ?? {};
    const maxAttempts = Math.max(1, Math.min(6, Number(policy.maxAttempts ?? 3)));
    const baseDelayMs = Math.max(0, Number(policy.baseDelayMs ?? 150));
    const maxDelayMs = Math.max(baseDelayMs, Number(policy.maxDelayMs ?? 1200));

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await bridge.onVendorAssertionRequest(input);
        if (result && typeof result === "object") {
          if (result.ok === false) return result;
          if (result.ok === true && typeof result.vendor_assertion === "string") return result;
          lastError = new Error("Vendor assertion callback returned invalid result");
        } else {
          lastError = new Error("Vendor assertion callback returned invalid result");
        }
      } catch (err) {
        lastError = err;
      }

      if (attempt < maxAttempts) {
        const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
        await this.sleep(delayMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError || "Vendor assertion request failed"));
  }

  private normalizeSessionExpiredPayload(
    source: "catalog" | "widget",
    payload: Record<string, unknown> | null | undefined,
  ): SessionExpiredPayload {
    const reasonValue = typeof payload?.reason === "string" ? payload.reason : "unknown";
    const allowedReasons = new Set<SessionExpiredPayload["reason"]>([
      "portal_session_expired",
      "publisher_session_expired",
      "publisher_session_revoked",
      "widget_session_expired",
      "token_refresh_failed",
      "portal_logout",
      "unknown",
    ]);
    const reason = allowedReasons.has(reasonValue as SessionExpiredPayload["reason"])
      ? (reasonValue as SessionExpiredPayload["reason"])
      : "unknown";

    const channelValue = typeof payload?.channel === "string" ? payload.channel : "";
    const allowedChannels = new Set<SessionExpiredPayload["channel"]>([
      "host",
      "publisher_bridge",
      "widget_session",
      "portal_session",
    ]);
    const channel = allowedChannels.has(channelValue as SessionExpiredPayload["channel"])
      ? (channelValue as SessionExpiredPayload["channel"])
      : source === "widget"
        ? "publisher_bridge"
        : "portal_session";

    const recoverable =
      typeof payload?.recoverable === "boolean"
        ? payload.recoverable
        : reason === "token_refresh_failed";

    const message = typeof payload?.message === "string" ? payload.message : undefined;
    const occurred_at =
      typeof payload?.occurred_at === "string" && payload.occurred_at.trim().length > 0
        ? payload.occurred_at
        : new Date().toISOString();

    return { reason, channel, recoverable, ...(message ? { message } : {}), occurred_at };
  }

  constructor(options: CatalogOptions) {
    this.options = { ...options, baseUrl: ensureBaseUrl(options.baseUrl) };
    this.catalogOrigin = asOrigin(this.options.baseUrl);
    this.onMessage = this.onMessage.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
  }

  private clampCatalogHeight(h: number): number {
    const minPx = 240;
    const viewportMax = Math.max(Math.floor(window.innerHeight * 0.85), 320);
    const hardMax = 2000;
    return Math.min(Math.max(h, minPx), viewportMax, hardMax);
  }

  private clampWidgetHeight(h: number): number {
    const minPx = 280;
    const viewportMax = Math.max(Math.floor(window.innerHeight * 0.9), 340);
    const hardMax = 2200;
    return Math.min(Math.max(h, minPx), viewportMax, hardMax);
  }

  private resolveInitialFrameHeight(
    container: HTMLElement | null | undefined,
    fallback: string,
  ): string {
    if (!container) return fallback;
    try {
      const rect = container.getBoundingClientRect();
      if (Number.isFinite(rect.height) && rect.height >= 240) {
        return "100%";
      }
    } catch {}
    return fallback;
  }

  private onWindowResize() {
    if (this.catalogIframe && this.lastCatalogContentHeight > 0) {
      this.catalogIframe.style.height = `${this.clampCatalogHeight(this.lastCatalogContentHeight)}px`;
    }
    if (this.widgetIframe && this.lastWidgetContentHeight > 0) {
      this.widgetIframe.style.height = `${this.clampWidgetHeight(this.lastWidgetContentHeight)}px`;
    }
  }

  async mountCatalog(filters?: { publishers?: string[]; tags?: string[] }): Promise<void> {
    return this.mountInternal(undefined, filters);
  }

  async mountXapp(xappId: string): Promise<void> {
    if (!xappId) throw new Error("xappId is required");
    return this.mountInternal(xappId);
  }

  private async mountInternal(
    xappId?: string,
    filters?: { publishers?: string[]; tags?: string[] },
  ): Promise<void> {
    const { container, baseUrl } = this.options;
    if (!container) throw new Error("container is required");
    if (this.destroyed) throw new Error("Host is destroyed");

    const session = await this.createCatalogSession({
      origin: window.location.origin,
      subjectId: this.options.subjectId,
      xappId,
      publishers: filters?.publishers || this.options.publishers,
      tags: filters?.tags || this.options.tags,
    });

    if (this.catalogIframe) {
      try {
        container.removeChild(this.catalogIframe);
      } catch {}
      this.catalogIframe = null;
    }

    const iframe = document.createElement("iframe");
    let catalogEmbedUrl = this.options.catalogUrl || session.embedUrl;

    if (this.options.catalogUrl) {
      const url = new URL(
        catalogEmbedUrl,
        baseUrl.startsWith("http") ? baseUrl : window.location.origin,
      );
      if (session.token && !url.searchParams.has("token")) {
        url.searchParams.set("token", session.token);
      }
      if (xappId && !url.pathname.includes(`/xapps/${xappId}`)) {
        const basePath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
        url.pathname = `${basePath}/xapps/${encodeURIComponent(xappId)}`;
      }
      catalogEmbedUrl = url.toString();
    }

    catalogEmbedUrl = this.withEmbedContextUrl(catalogEmbedUrl, {
      includePaymentParams: true,
      overrideHostReturnUrl: false,
    });

    iframe.src = catalogEmbedUrl.startsWith("http") ? catalogEmbedUrl : baseUrl + catalogEmbedUrl;
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.height = this.resolveInitialFrameHeight(container, "62vh");
    iframe.allow =
      "clipboard-read; clipboard-write; publickey-credentials-get *; publickey-credentials-create *";

    container.appendChild(iframe);
    this.catalogIframe = iframe;

    window.addEventListener("message", this.onMessage);
    window.addEventListener("resize", this.onWindowResize);

    iframe.addEventListener("load", () => {
      try {
        iframe.contentWindow?.postMessage({ type: "XAPPS_WIDGET_READY" }, this.catalogOrigin);
      } catch {}
    });
  }

  async openWidget(input: {
    installationId: string;
    widgetId: string;
    hostReturnUrl?: string;
  }): Promise<void> {
    if (!this.options.widgetMount?.container) return;
    const { baseUrl } = this.options;
    const hostReturnUrl = this.resolveHostReturnUrl(input.hostReturnUrl);
    let session: WidgetSession;
    try {
      session = await this.createWidgetSession({
        installationId: input.installationId,
        widgetId: input.widgetId,
        origin: window.location.origin,
        hostReturnUrl,
      });
    } catch (error) {
      const guardBlocked = readGuardBlockedPayload(error);
      if (guardBlocked?.actionKind === "open_guard" && guardBlocked.guardUi) {
        const resolution = await this.resolveGuardUi({
          installationId: input.installationId,
          widgetId: input.widgetId,
          guardUi: guardBlocked.guardUi,
          hostReturnUrl,
        });
        if (!resolution) {
          throw new Error(guardBlocked.message || "Guard flow cancelled");
        }
        session = await this.createWidgetSession({
          installationId: input.installationId,
          widgetId: input.widgetId,
          origin: window.location.origin,
          hostReturnUrl,
          payload: resolution,
        });
      } else {
        throw error;
      }
    }

    this.widgetContext = {
      token: session.token,
      baseUrl,
      theme: this.options.theme || null,
      locale: this.options.locale || null,
    };
    this.activeWidget = { installationId: input.installationId, widgetId: input.widgetId };

    const iframe = document.createElement("iframe");
    const src = session.embedUrl.startsWith("http") ? session.embedUrl : baseUrl + session.embedUrl;
    iframe.src = this.withEmbedContextUrl(src, {
      hostReturnUrl,
      includePaymentParams: true,
      overrideHostReturnUrl: true,
    });
    const mount = this.options.widgetMount.container;
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.height = this.resolveInitialFrameHeight(mount, "64vh");
    iframe.allow =
      "clipboard-read; clipboard-write; publickey-credentials-get *; publickey-credentials-create *";

    mount.innerHTML = "";
    mount.appendChild(iframe);
    this.widgetIframe = iframe;
  }

  openOperationalSurface(input: OpenOperationalSurfaceInput): void {
    const nextUrl = this.buildOperationalSurfaceUrl(input);
    if (!nextUrl || !this.catalogIframe) return;
    this.catalogIframe.src = nextUrl;
  }

  async resolveGuardUi(input: {
    guardUi: Record<string, unknown>;
    installationId?: string;
    widgetId?: string;
    xappId?: string;
    hostReturnUrl?: string;
  }): Promise<Record<string, unknown> | null> {
    const hostReturnUrl = this.resolveHostReturnUrl(input.hostReturnUrl);
    const session = await this.createWidgetSession({
      installationId: input.installationId,
      widgetId: input.widgetId,
      xappId: input.xappId,
      origin: window.location.origin,
      hostReturnUrl,
      guardUi: input.guardUi,
    });
    const src = session.embedUrl.startsWith("http")
      ? session.embedUrl
      : this.options.baseUrl + session.embedUrl;
    return await openGuardWidgetOverlay({
      embedUrl: this.withEmbedContextUrl(src, {
        hostReturnUrl,
        includePaymentParams: true,
        overrideHostReturnUrl: true,
      }),
      theme:
        this.options.theme && typeof this.options.theme === "object"
          ? (this.options.theme as Record<string, unknown>)
          : null,
    });
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener("message", this.onMessage);
    window.removeEventListener("resize", this.onWindowResize);
    if (this.catalogIframe?.parentElement) {
      try {
        this.catalogIframe.parentElement.removeChild(this.catalogIframe);
      } catch {}
    }
    this.catalogIframe = null;
    this.widgetIframe = null;
    this.widgetContext = null;
  }

  emitToCatalog(evt: Extract<CatalogEvent, { type: string }>): void {
    if (!this.catalogIframe?.contentWindow) return;
    try {
      this.catalogIframe.contentWindow.postMessage(evt, this.catalogOrigin);
    } catch (e: any) {
      this.options.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  emitSessionExpired(
    data: SessionExpiredPayload,
    input?: { target?: "catalog" | "widget" | "both" },
  ): void {
    const target = input?.target || "both";
    const payload = {
      type: "XAPPS_SESSION_EXPIRED" as const,
      data: {
        ...data,
        occurred_at: data.occurred_at || new Date().toISOString(),
      },
    };
    if ((target === "catalog" || target === "both") && this.catalogIframe?.contentWindow) {
      try {
        this.catalogIframe.contentWindow.postMessage(payload, this.catalogOrigin);
      } catch (e: any) {
        this.options.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    }
    if ((target === "widget" || target === "both") && this.widgetIframe?.contentWindow) {
      try {
        this.widgetIframe.contentWindow.postMessage(payload, this.catalogOrigin);
      } catch (e: any) {
        this.options.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    }
  }

  setLocale(locale: string | null | undefined): void {
    const normalized = typeof locale === "string" && locale.trim() ? locale.trim() : undefined;
    this.options.locale = normalized;
    if (this.widgetContext) {
      this.widgetContext.locale = normalized || null;
    }
  }

  emitLocaleChanged(
    locale: string | null | undefined,
    input?: { target?: "catalog" | "widget" | "both" },
  ): void {
    this.setLocale(locale);
    const target = input?.target || "both";
    const payload = {
      type: "XAPPS_LOCALE_CHANGED" as const,
      locale: this.options.locale || null,
    };
    if ((target === "catalog" || target === "both") && this.catalogIframe?.contentWindow) {
      try {
        this.catalogIframe.contentWindow.postMessage(payload, this.catalogOrigin);
      } catch (e: any) {
        this.options.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    }
    if ((target === "widget" || target === "both") && this.widgetIframe?.contentWindow) {
      try {
        this.widgetIframe.contentWindow.postMessage(payload, this.catalogOrigin);
      } catch (e: any) {
        this.options.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    }
  }

  private async createCatalogSession(input: {
    origin: string;
    subjectId?: string;
    xappId?: string;
    publishers?: string[];
    tags?: string[];
  }): Promise<CatalogSession> {
    const url = this.options.hostApi?.createCatalogSessionUrl;
    if (!url) {
      throw new Error("Host API 'createCatalogSessionUrl' is not configured");
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...resolveHostApiHeaders(this.options.hostApi),
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create catalog session (${res.status})`);
    }
    return res.json();
  }

  private async createWidgetSession(input: {
    installationId?: string;
    widgetId?: string;
    xappId?: string;
    origin: string;
    hostReturnUrl?: string;
    resultPresentation?: "runtime_default" | "inline" | "publisher_managed";
    guardUi?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  }): Promise<WidgetSession> {
    const url = this.options.hostApi?.createWidgetSessionUrl;
    if (!url) throw new Error("Host API 'createWidgetSessionUrl' is not configured");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...resolveHostApiHeaders(this.options.hostApi),
      },
      body: JSON.stringify({
        ...(input.installationId ? { installationId: input.installationId } : {}),
        ...(input.widgetId ? { widgetId: input.widgetId } : {}),
        ...(input.xappId ? { xappId: input.xappId } : {}),
        origin: input.origin,
        ...(input.hostReturnUrl ? { hostReturnUrl: input.hostReturnUrl } : {}),
        ...(input.resultPresentation ? { resultPresentation: input.resultPresentation } : {}),
        ...(input.guardUi ? { guardUi: input.guardUi } : {}),
        ...(input.payload ? input.payload : {}),
        subjectId: this.options.subjectId,
      }),
    });
    if (!res.ok) {
      const errPayload = await res.json().catch(() => ({}));
      const err = new HostApiError(
        toErrorMessage(errPayload, `Failed to create widget session (${res.status})`),
      );
      err.status = res.status;
      err.payload = errPayload;
      throw err;
    }
    return res.json();
  }

  private async onMessage(e: MessageEvent) {
    const msg = readMessageRecord(e.data);
    if (Object.keys(msg).length === 0) return;
    const type = readRecordString(msg, "type");
    const id = readRecordString(msg, "id") || undefined;

    const fromCatalog =
      e.origin === this.catalogOrigin &&
      Boolean(this.catalogIframe?.contentWindow) &&
      e.source === this.catalogIframe?.contentWindow;

    if (type === "XAPPS_IFRAME_RESIZE") {
      const h = Number(readMessageData(msg).height ?? 0);
      if (!Number.isFinite(h) || h <= 0) return;
      if (fromCatalog && this.catalogIframe) {
        this.lastCatalogContentHeight = h;
        this.catalogIframe.style.height = `${this.clampCatalogHeight(h)}px`;
        return;
      }
      if (
        Boolean(this.widgetIframe?.contentWindow) &&
        e.source === this.widgetIframe?.contentWindow &&
        this.widgetIframe
      ) {
        this.lastWidgetContentHeight = h;
        this.widgetIframe.style.height = `${this.clampWidgetHeight(h)}px`;
        return;
      }
    }

    if (type === "XAPPS_WIDGET_CONTEXT_REQUEST" && fromCatalog) {
      const t = this.options.theme || {};
      this.catalogIframe?.contentWindow?.postMessage(
        {
          type: "XAPPS_WIDGET_CONTEXT",
          theme: t,
          locale: this.options.locale || null,
          subjectId: this.options.subjectId || null,
        },
        this.catalogOrigin,
      );
      return;
    }

    if (type === "XAPPS_MARKETPLACE_GET_INSTALLATIONS" && fromCatalog) {
      try {
        const url = this.options.hostApi?.installationsUrl;
        if (!url) throw new Error("Host API 'installationsUrl' is not configured");

        const subjectId = this.options.subjectId;
        const urlWithSubject =
          subjectId && String(subjectId).trim()
            ? `${url}${url.includes("?") ? "&" : "?"}subjectId=${encodeURIComponent(String(subjectId))}`
            : url;

        const resp = await fetch(urlWithSubject, {
          method: "GET",
          headers: resolveHostApiHeaders(this.options.hostApi),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(data?.message || `Failed to list installations (${resp.status})`);
        const items = readRecordArray(data, "items").length
          ? readRecordArray(data, "items")
          : readRecordArray(data, "installations");
        const byXappId: Record<string, { installationId: string }> = {};
        for (const it of items) {
          const summary = readInstallationSummary(it);
          if (!summary || (summary.status && summary.status !== "installed")) continue;
          byXappId[summary.xappId] = { installationId: summary.id };
        }
        this.catalogIframe?.contentWindow?.postMessage(
          { type: "XAPPS_MARKETPLACE_INSTALLATIONS", data: { byXappId } },
          this.catalogOrigin,
        );
      } catch (err: any) {
        try {
          this.catalogIframe?.contentWindow?.postMessage(
            { type: "XAPPS_MARKETPLACE_INSTALLATIONS", data: { byXappId: {} } },
            this.catalogOrigin,
          );
        } catch {}
        this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    const fromWidget =
      Boolean(this.widgetIframe?.contentWindow) && e.source === this.widgetIframe?.contentWindow;
    if (
      fromWidget &&
      (type === "XAPPS_WIDGET_READY" || type === "XAPPS_WIDGET_CONTEXT_REQUEST") &&
      this.widgetIframe?.contentWindow &&
      this.widgetContext
    ) {
      try {
        this.widgetIframe.contentWindow.postMessage(
          {
            type: "XAPPS_WIDGET_CONTEXT",
            token: this.widgetContext.token,
            baseUrl: this.widgetContext.baseUrl,
            theme: this.widgetContext.theme || null,
            locale: this.widgetContext.locale || null,
          },
          this.catalogOrigin,
        );
      } catch (err: any) {
        this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    if (fromWidget && type === "XAPPS_UI_GET_CONTEXT" && this.widgetIframe?.contentWindow) {
      try {
        const payload = {
          installationId: this.activeWidget?.installationId || "",
          widgetId: this.activeWidget?.widgetId || "",
          devMode: false,
        };
        this.widgetIframe.contentWindow.postMessage(
          { type: "XAPPS_UI_GET_CONTEXT_RESULT", id, payload },
          this.catalogOrigin,
        );
      } catch {}
      return;
    }

    if (
      fromWidget &&
      (type === "XAPPS_REQUEST_GET" || type === "XAPPS_REQUEST_RESPONSE") &&
      this.widgetIframe?.contentWindow &&
      this.widgetContext
    ) {
      const data = readMessageData(msg);
      const requestId = readRecordString(data, "requestId");
      if (!requestId) return;
      const url =
        type === "XAPPS_REQUEST_GET"
          ? `${this.widgetContext.baseUrl}/v1/requests/${encodeURIComponent(requestId)}`
          : `${this.widgetContext.baseUrl}/v1/requests/${encodeURIComponent(requestId)}/response`;
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${this.widgetContext.token}` },
        });
        const data = await res.json().catch(() => ({}));
        const dataRecord = asRecord(data);
        this.widgetIframe.contentWindow.postMessage(
          {
            type:
              type === "XAPPS_REQUEST_GET"
                ? "XAPPS_REQUEST_GET_RESULT"
                : "XAPPS_REQUEST_RESPONSE_RESULT",
            id,
            ok: res.ok,
            ...(res.ok
              ? { data }
              : {
                  error: {
                    message: readRecordString(dataRecord, "message") || `HTTP ${res.status}`,
                  },
                }),
          },
          this.catalogOrigin,
        );
      } catch (err: any) {
        this.widgetIframe.contentWindow.postMessage(
          {
            type:
              type === "XAPPS_REQUEST_GET"
                ? "XAPPS_REQUEST_GET_RESULT"
                : "XAPPS_REQUEST_RESPONSE_RESULT",
            id,
            ok: false,
            error: { message: err?.message || String(err) },
          },
          this.catalogOrigin,
        );
      }
      return;
    }

    if (
      type === "XAPPS_MARKETPLACE_REQUEST_INSTALL" ||
      type === "XAPPS_MARKETPLACE_INSTALL_SUCCESS" ||
      type === "XAPPS_MARKETPLACE_INSTALL_FAILURE" ||
      type === "XAPPS_MARKETPLACE_REQUEST_UPDATE" ||
      type === "XAPPS_MARKETPLACE_REQUEST_UNINSTALL" ||
      type === "XAPPS_IFRAME_NAVIGATED" ||
      type === "XAPPS_OPEN_WIDGET" ||
      type === "XAPPS_OPEN_OPERATIONAL_SURFACE"
    ) {
      if (!fromCatalog && !fromWidget) return;
      this.options.onEvent?.(msg as CatalogEvent);

      if (type === "XAPPS_MARKETPLACE_INSTALL_SUCCESS") {
        const payload = readMessageData(msg);
        const installationId = readRecordString(payload, "installationId");
        const defaultWidgetId = readRecordString(payload, "defaultWidgetId");
        if (installationId && defaultWidgetId && this.options.widgetMount?.container) {
          void this.openWidget({ installationId, widgetId: defaultWidgetId });
        }
      }
      if (type === "XAPPS_OPEN_WIDGET") {
        const payload = readMessageData(msg);
        const installationId = readRecordString(payload, "installationId");
        const widgetId = readRecordString(payload, "widgetId");
        if (installationId && widgetId) {
          void this.openWidget({ installationId, widgetId });
        }
      }
      if (type === "XAPPS_OPEN_OPERATIONAL_SURFACE") {
        const data = normalizeOpenOperationalSurfaceInput(readMessageData(msg));
        if (data) this.openOperationalSurface(data);
      }
      return;
    }

    if (type === "XAPPS_UI_CONFIRM_REQUEST") {
      if (!fromCatalog && !fromWidget) return;
      const source: "catalog" | "widget" = fromWidget ? "widget" : "catalog";
      const data = readMessageData(msg);
      const title = readRecordString(data, "title") || "Confirmation";
      const message =
        readRecordString(data, "message") || "This action requires confirmation. Continue?";
      const confirmLabel = readRecordString(data, "confirmLabel") || "Continue";
      const cancelLabel = readRecordString(data, "cancelLabel") || "Cancel";
      try {
        let confirmed = false;
        if (typeof this.options.confirmDialog === "function") {
          confirmed = Boolean(
            await this.options.confirmDialog({
              source,
              title,
              message,
              confirmLabel,
              cancelLabel,
            }),
          );
        } else {
          confirmed = await this.showDefaultConfirmDialog({
            title,
            message,
            confirmLabel,
            cancelLabel,
          });
        }
        this.replyToSource(e, {
          type: "XAPPS_UI_CONFIRM_RESULT",
          id,
          ok: true,
          data: { confirmed },
        });
      } catch (err: any) {
        this.replyToSource(e, {
          type: "XAPPS_UI_CONFIRM_RESULT",
          id,
          ok: false,
          error: { message: err?.message || String(err) },
        });
      }
      return;
    }

    if (
      type === "XAPPS_TOKEN_REFRESH_REQUEST" ||
      type === "XAPPS_TOKEN_REFRESH" ||
      type === "XAPPS_SIGN_REQUEST" ||
      type === "XAPPS_VENDOR_ASSERTION_REQUEST"
    ) {
      if (!fromCatalog && !fromWidget) return;

      const source: "catalog" | "widget" = fromWidget ? "widget" : "catalog";
      const payload = readMessageData(msg) as SessionExpiredPayload;
      const bridge = this.options.bridgeV2;

      try {
        if (
          (type === "XAPPS_TOKEN_REFRESH_REQUEST" || type === "XAPPS_TOKEN_REFRESH") &&
          bridge?.onTokenRefreshRequest
        ) {
          const refreshed = await this.runTokenRefreshWithRetry({ id, source, data: payload });
          if (refreshed && typeof refreshed.token === "string") {
            this.replyToSource(e, {
              type: "XAPPS_TOKEN_REFRESH",
              id,
              data: {
                token: refreshed.token,
                ...(typeof refreshed.expires_in === "number"
                  ? { expires_in: refreshed.expires_in }
                  : {}),
              },
            });
            return;
          }
          this.replyToSource(e, {
            type: "XAPPS_ERROR",
            id,
            ok: false,
            error: { message: "Token refresh unavailable" },
          });
          return;
        }

        if (type === "XAPPS_SIGN_REQUEST" && bridge?.onSignRequest) {
          const result = await bridge.onSignRequest({ id, source, data: payload });
          this.replyToSource(e, {
            type: "XAPPS_SIGN_RESULT",
            id,
            ok: Boolean(result?.ok),
            ...(result?.envelope ? { envelope: result.envelope } : {}),
            ...(result?.error ? { error: result.error } : {}),
          });
          return;
        }

        if (type === "XAPPS_VENDOR_ASSERTION_REQUEST" && bridge?.onVendorAssertionRequest) {
          const result = await this.runVendorAssertionWithRetry({ id, source, data: payload });
          this.replyToSource(e, {
            type: "XAPPS_VENDOR_ASSERTION_RESULT",
            id,
            ok: Boolean(result?.ok),
            ...(result?.vendor_assertion ? { vendor_assertion: result.vendor_assertion } : {}),
            ...(result?.link_id ? { link_id: result.link_id } : {}),
            ...(result?.error ? { error: result.error } : {}),
          });
          return;
        }
      } catch (err: any) {
        if (type === "XAPPS_TOKEN_REFRESH_REQUEST" || type === "XAPPS_TOKEN_REFRESH") {
          const reason = this.normalizeSessionExpiredPayload(source, {
            reason: "token_refresh_failed",
            channel: "host",
            recoverable: false,
            message: messageFromUnknownError(err, "Token refresh failed"),
          });
          this.emitSessionExpired(reason, { target: "both" });
        }
        this.replyToSource(e, {
          type: "XAPPS_ERROR",
          id,
          ok: false,
          error: { message: messageFromUnknownError(err, "Bridge request failed") },
        });
        return;
      }

      this.options.onEvent?.(msg as CatalogEvent);
      return;
    }

    if (type === "XAPPS_SESSION_EXPIRED") {
      if (!fromCatalog && !fromWidget) return;
      const source: "catalog" | "widget" = fromWidget ? "widget" : "catalog";
      const payload = readMessageData(msg);
      const normalized = this.normalizeSessionExpiredPayload(source, payload);
      this.emitSessionExpired(normalized, {
        target: source === "widget" ? "catalog" : "widget",
      });
      const bridge = this.options.bridgeV2;
      if (bridge?.onSessionExpired) {
        try {
          void bridge.onSessionExpired({ id, source, data: normalized });
        } catch {}
      }
      this.options.onEvent?.({
        type: "XAPPS_SESSION_EXPIRED",
        ...(id ? { id } : {}),
        data: normalized,
      });
      return;
    }

    if (type === "XAPPS_LOCALE_CHANGED") {
      if (!fromCatalog && !fromWidget) return;
      const source: "catalog" | "widget" = fromWidget ? "widget" : "catalog";
      const payload = readMessageData(msg);
      this.emitLocaleChanged(readRecordString(payload, "locale"), {
        target: source === "widget" ? "catalog" : "widget",
      });
      this.options.onEvent?.(msg as CatalogEvent);
      return;
    }

    if ((fromCatalog || fromWidget) && typeof type === "string" && type.startsWith("XAPPS_")) {
      this.options.onEvent?.(msg as CatalogEvent);
    }
  }
}

export function createHost(options: CatalogOptions) {
  return new XappsHost(options);
}
