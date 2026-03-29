import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { TranslationParams } from "@xapps-platform/platform-i18n";
import { resolveMarketplaceText, useMarketplaceI18n } from "../i18n";
import { useMarketplace } from "../MarketplaceContext";
import type { CatalogXappDetail } from "../types";
import { buildTokenSearch, readHostReturnUrl } from "../utils/embedSearch";
import { asRecord, normalizeExpandStage, readFirstString, readString } from "../utils/readers";
import {
  buildOperationalSurfaceHref,
  discoverOperationalSurfaceData,
  getOperationalSurfaceLabel,
  getVisibleOperationalSurfaces,
  resolveOperationalSurfacePlacement,
  type OperationalSurfaceKey,
} from "../utils/operationalSurfaces";
import "../marketplace.css";

type ExpandStage = "inline" | "focus" | "fullscreen";

type NestedPendingExpand = {
  sourceWindow: Window | null;
  timeoutId: number;
  cleanupId: number | null;
  settled: boolean;
  onLateResult: ((value: Record<string, unknown>) => void) | null;
  resolve: (value: Record<string, unknown> | null) => void;
};

type SessionExpiredUi = {
  title: string;
  message: string;
};

function useQueryToken(): string {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  return qs.get("token") ?? "";
}

function readPaymentEvidenceParams(search: string): URLSearchParams {
  const out = new URLSearchParams();
  const qs = new URLSearchParams(String(search || ""));
  for (const [k, v] of qs.entries()) {
    if (k.startsWith("xapps_payment_")) out.set(k, v);
  }
  if (Array.from(out.keys()).length > 0) return out;
  const hostReturnUrl = readHostReturnUrl(search);
  if (!hostReturnUrl) return out;
  try {
    const host = new URL(hostReturnUrl);
    for (const [k, v] of host.searchParams.entries()) {
      if (k.startsWith("xapps_payment_")) out.set(k, v);
    }
  } catch {
    // ignore malformed host return URL
  }
  return out;
}

function toSessionExpiredUi(
  input: unknown,
  t: (key: string, params?: TranslationParams, fallback?: string) => string,
): SessionExpiredUi {
  const data = asRecord(input);
  const reason = readString(data.reason).toLowerCase();
  const message = readFirstString(data.message);

  if (reason === "logout") {
    return {
      title: t("widget.session_ended_title", undefined, "Session ended"),
      message:
        message ||
        t(
          "widget.session_ended_message",
          undefined,
          "Your session ended. Go back and open the widget again.",
        ),
    };
  }

  if (reason === "token_refresh_failed") {
    return {
      title: t("widget.session_expired_title", undefined, "Widget session expired"),
      message:
        message ||
        t(
          "widget.session_expired_refresh_failed",
          undefined,
          "This widget session expired and could not be renewed. Open it again to continue.",
        ),
    };
  }

  return {
    title: t("widget.session_expired_title", undefined, "Widget session expired"),
    message:
      message ||
      t(
        "widget.session_expired_default",
        undefined,
        "This widget session ended. Go back and open it again to continue.",
      ),
  };
}

export function WidgetView() {
  const { client, host, env } = useMarketplace();
  const { t, locale } = useMarketplaceI18n();
  const { installationId, widgetId } = useParams();
  const token = useQueryToken();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const nestedExpandSeqRef = useRef(0);
  const nestedExpandPendingRef = useRef<Map<string, NestedPendingExpand>>(new Map());
  const [xappTitle, setXappTitle] = useState<string>("");
  const [xappId, setXappId] = useState<string>("");
  const [xappDetail, setXappDetail] = useState<CatalogXappDetail | null>(null);
  const [discoveredOperationalSurfaces, setDiscoveredOperationalSurfaces] = useState<
    OperationalSurfaceKey[]
  >([]);
  const [widgetToken, setWidgetToken] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState<SessionExpiredUi | null>(null);
  const [hostNestedExpandStage, setHostNestedExpandStage] = useState<ExpandStage>("inline");

  const loc = useLocation();
  const isEmbedded = window.location.pathname.startsWith("/embed");
  const tokenSearch = buildTokenSearch(token, loc.search);
  const navigate = useNavigate();

  const marketplaceTo = {
    pathname: isEmbedded ? "/" : "/marketplace",
    search: tokenSearch,
  };

  const xappTo = xappId
    ? {
        pathname: isEmbedded
          ? `/xapps/${encodeURIComponent(xappId)}`
          : `/marketplace/xapps/${encodeURIComponent(xappId)}`,
        search: tokenSearch,
      }
    : null;
  const visibleOperationalSurfaces = getVisibleOperationalSurfaces({
    detail: xappDetail,
    client,
    env,
    isEmbedded,
  });
  const linkedOperationalSurfaces = Array.from(
    new Set([...visibleOperationalSurfaces, ...discoveredOperationalSurfaces]),
  );

  const onBackToPortal = () => {
    host.notifyNavigation?.({
      path: "/",
      page: "portal-home",
    });
  };

  useEffect(() => {
    if (!installationId) return;
    let alive = true;
    void (async () => {
      try {
        const installs = host.getInstallationsByXappId();
        const inst = Object.values(installs || {}).find(
          (i) => i && String(i.installationId) === String(installationId),
        );
        if (inst && inst.xappId) {
          if (!alive) return;
          setXappId(inst.xappId);
          const res = await client.getCatalogXapp(inst.xappId, {
            installationId: String(installationId || "").trim() || null,
          });
          if (!alive) return;
          setXappDetail(res);
          const detail = asRecord(res);
          setXappTitle(
            resolveMarketplaceText(asRecord(detail.manifest).title as any, locale) ||
              readFirstString(asRecord(detail.xapp).name) ||
              "App",
          );
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [installationId, client, host, locale]);

  useEffect(() => {
    if (!xappId) {
      setDiscoveredOperationalSurfaces([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const discovered = await discoverOperationalSurfaceData({
        client,
        xappId,
        installationId,
      });
      if (!cancelled) {
        setDiscoveredOperationalSurfaces(discovered);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, installationId, xappId]);

  useEffect(() => {
    if (!installationId || !widgetId || !host.notifyNavigation) return;
    host.notifyNavigation({
      path: window.location.pathname,
      page: "widget-view",
      params: { installationId, widgetId },
    });
  }, [installationId, widgetId, host]);

  useEffect(() => {
    if (!installationId || !widgetId) return;
    let alive = true;
    void (async () => {
      try {
        const { token: wToken } = await client.getWidgetToken(installationId, widgetId);
        if (!alive) return;
        setSessionExpired(null);
        setWidgetToken(wToken);
      } catch (e) {
        if (!alive) return;
        setError(readFirstString(asRecord(e).message) || String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [installationId, widgetId, client]);

  async function remintWidgetSession() {
    if (!installationId || !widgetId) {
      throw new Error("Missing installationId/widgetId for widget refresh");
    }
    const refreshed = await client.getWidgetToken(installationId, widgetId);
    const nextToken = String(refreshed?.token || "").trim();
    if (!nextToken) {
      throw new Error("Widget refresh did not return a token");
    }
    setSessionExpired(null);
    setWidgetToken(nextToken);
    return {
      token: nextToken,
      expires_in:
        Number.isFinite(Number(refreshed?.expires_in)) && Number(refreshed?.expires_in) > 0
          ? Number(refreshed?.expires_in)
          : undefined,
    };
  }

  useEffect(() => {
    return () => {
      for (const [, pending] of nestedExpandPendingRef.current) {
        window.clearTimeout(pending.timeoutId);
        if (pending.cleanupId) window.clearTimeout(pending.cleanupId);
        pending.resolve(null);
      }
      nestedExpandPendingRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    const rootEl = shell?.parentElement ?? null;
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const expanded = env?.embedMode && hostNestedExpandStage !== "inline";

    if (!expanded) return;

    const prev = {
      htmlStyle: htmlEl.getAttribute("style"),
      bodyStyle: bodyEl.getAttribute("style"),
      rootStyle: rootEl?.getAttribute("style") ?? null,
    };

    htmlEl.style.height = "100%";
    bodyEl.style.height = "100%";
    bodyEl.style.overflow = "hidden";
    bodyEl.style.margin = "0";
    if (rootEl) {
      rootEl.style.height = "100%";
      rootEl.style.display = "flex";
      rootEl.style.flexDirection = "column";
      rootEl.style.minHeight = "0";
    }

    return () => {
      if (prev.htmlStyle == null) htmlEl.removeAttribute("style");
      else htmlEl.setAttribute("style", prev.htmlStyle);
      if (prev.bodyStyle == null) bodyEl.removeAttribute("style");
      else bodyEl.setAttribute("style", prev.bodyStyle);
      if (rootEl) {
        if (prev.rootStyle == null) rootEl.removeAttribute("style");
        else rootEl.setAttribute("style", prev.rootStyle);
      }
    };
  }, [env?.embedMode, hostNestedExpandStage]);

  useEffect(() => {
    if (!env?.embedMode) return;
    const handler = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const msg = asRecord(e.data);
      const msgType = readString(msg.type);
      if (msgType !== "XAPPS_UI_EXPAND_RESULT") return;
      const data = asRecord(msg.data);
      const hostManaged = data.hostManaged === true;
      const expanded = data.expanded === true;
      const stage = normalizeExpandStage(data.stage, expanded);
      setHostNestedExpandStage(hostManaged && expanded ? stage : "inline");
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [env?.embedMode]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = asRecord(e.data);
      const msgType = readString(msg.type);
      if (!msgType.startsWith("XAPPS_")) return;
      const sourceIsParent = e.source === window.parent;
      const sourceIsSameOrigin = e.origin === window.location.origin;
      if (!sourceIsParent && !sourceIsSameOrigin) return;

      if (msgType === "XAPPS_UI_NESTED_EXPAND_RESULT" && sourceIsParent) {
        const data = asRecord(msg.data);
        const requestId = readString(data.requestId);
        if (!requestId) return;
        const pending = nestedExpandPendingRef.current.get(requestId);
        if (!pending) return;
        window.clearTimeout(pending.timeoutId);
        if (pending.cleanupId) window.clearTimeout(pending.cleanupId);
        if (pending.settled) {
          nestedExpandPendingRef.current.delete(requestId);
          pending.onLateResult?.(msg);
          return;
        }
        pending.settled = true;
        nestedExpandPendingRef.current.delete(requestId);
        pending.resolve(msg);
        return;
      }

      try {
        iframeRef.current?.contentWindow?.postMessage(msg, "*");
      } catch {}
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (!widgetToken) return;

    const postExpandResultToWidget = (
      target: Window | null,
      result:
        | { ok: true; data: Record<string, unknown> }
        | { ok: false; error: { message: string; code?: string } },
    ) => {
      if (!target || typeof target.postMessage !== "function") return;
      try {
        target.postMessage(
          {
            type: "XAPPS_UI_EXPAND_RESULT",
            ...result,
          },
          "*",
        );
      } catch {}
    };

    const requestNestedHostExpand = async (
      sourceWindow: Window | null,
      input: Record<string, unknown>,
      onLateResult: ((value: Record<string, unknown>) => void) | null = null,
    ): Promise<Record<string, unknown> | null> => {
      if (!env?.embedMode || window.parent === window) return null;
      const requestId = `mx-nested-expand-${Date.now()}-${++nestedExpandSeqRef.current}`;
      const payload = {
        requestId,
        source: "marketplace-widget-host",
        installationId: installationId ? String(installationId) : "",
        widgetId: widgetId ? String(widgetId) : "",
        expanded: Boolean(input.expanded),
        stage: normalizeExpandStage(input.stage, Boolean(input.expanded)),
        mode: input.mode === "expand" || input.mode === "collapse" ? String(input.mode) : undefined,
        path: window.location.pathname,
      };

      const response = await new Promise<Record<string, unknown> | null>((resolve) => {
        const pending: NestedPendingExpand = {
          sourceWindow,
          timeoutId: 0,
          cleanupId: null,
          settled: false,
          onLateResult,
          resolve,
        };
        pending.timeoutId = window.setTimeout(() => {
          pending.settled = true;
          pending.cleanupId = window.setTimeout(() => {
            nestedExpandPendingRef.current.delete(requestId);
          }, 4000);
          resolve(null);
        }, 1200);
        nestedExpandPendingRef.current.set(requestId, pending);
        try {
          window.parent.postMessage(
            {
              type: "XAPPS_UI_NESTED_EXPAND_REQUEST",
              data: payload,
            },
            "*",
          );
        } catch {
          window.clearTimeout(pending.timeoutId);
          if (pending.cleanupId) window.clearTimeout(pending.cleanupId);
          nestedExpandPendingRef.current.delete(requestId);
          resolve(null);
        }
      });

      return response;
    };

    const handler = (e: MessageEvent) => {
      const msg = asRecord(e.data);
      const msgType = readString(msg.type);
      if (!msgType.startsWith("XAPPS_")) return;

      // Security check: only allow same-origin if it's from the catalog itself
      // or from the widget iframe (which we can't easily check origin of here
      // without extra plumbing, but we trust the type prefix).

      // Handle UI actions from the widget by forwarding them to the real host.
      // In embedMode, window.parent is the Host integration that frames the catalog.
      if (
        msgType === "XAPPS_UI_EXPAND_REQUEST" &&
        env?.embedMode &&
        e.source === iframeRef.current?.contentWindow
      ) {
        const data = asRecord(msg.data);
        void (async () => {
          const requestedExpanded = data.expanded === true;
          const requestedStage = normalizeExpandStage(data.stage, requestedExpanded);
          const applyNestedExpandResult = (nestedResp: Record<string, unknown> | null): boolean => {
            if (
              !nestedResp ||
              nestedResp.type !== "XAPPS_UI_NESTED_EXPAND_RESULT" ||
              nestedResp.ok !== true ||
              !nestedResp.data ||
              typeof nestedResp.data !== "object"
            ) {
              return false;
            }
            const nestedData = nestedResp.data as Record<string, unknown>;
            const hostManaged = nestedData.hostManaged === true;
            const expanded = nestedData.expanded === true;
            const stage = normalizeExpandStage(nestedData.stage, expanded);
            setHostNestedExpandStage(hostManaged && expanded ? stage : "inline");
            postExpandResultToWidget(e.source as Window | null, {
              ok: true,
              data: {
                hostManaged,
                expanded: hostManaged && expanded,
                stage: hostManaged ? stage : "inline",
                ...(nestedData.nativeFullscreen === true ? { nativeFullscreen: true } : {}),
              },
            });
            return true;
          };
          // Optimistic UI reduction so the marketplace shell yields immediately while the
          // outer host processes nested expansion. We reconcile on ack or fallback.
          setHostNestedExpandStage(requestedExpanded ? requestedStage : "inline");
          const nestedResp = await requestNestedHostExpand(
            e.source as Window | null,
            data,
            (lateResp) => {
              if (applyNestedExpandResult(lateResp)) return;
              setHostNestedExpandStage("inline");
            },
          );
          if (applyNestedExpandResult(nestedResp)) {
            return;
          }

          setHostNestedExpandStage("inline");
        })();
        return;
      }

      if (msgType === "XAPPS_UI_CONFIRM_REQUEST") {
        if (!env?.embedMode) {
          const data = asRecord(msg.data);
          const requestId = msg.id;
          const prompt = String(
            data.message ||
              t(
                "widget.confirm_continue_prompt",
                undefined,
                "This action requires confirmation. Continue?",
              ),
          );
          const confirmed = typeof window.confirm === "function" ? window.confirm(prompt) : false;
          try {
            (e.source as Window | null)?.postMessage(
              {
                type: "XAPPS_UI_CONFIRM_RESULT",
                id: requestId,
                ok: true,
                data: { confirmed },
              },
              "*",
            );
          } catch {}
          return;
        }
        if (e.source === window) return;
        try {
          window.parent.postMessage(msg, "*");
        } catch {}
        return;
      }

      if (
        msgType === "XAPPS_TOKEN_REFRESH_REQUEST" &&
        e.source === iframeRef.current?.contentWindow
      ) {
        void (async () => {
          try {
            const refreshed = await remintWidgetSession();
            try {
              (e.source as Window | null)?.postMessage(
                {
                  type: "XAPPS_TOKEN_REFRESH",
                  id: readString(msg.id) || undefined,
                  data: {
                    token: refreshed.token,
                    ...(typeof refreshed.expires_in === "number"
                      ? { expires_in: refreshed.expires_in }
                      : {}),
                  },
                },
                "*",
              );
            } catch {}
          } catch (refreshError) {
            const sessionExpiredUi = toSessionExpiredUi(
              {
                reason: "token_refresh_failed",
                message:
                  readFirstString(asRecord(refreshError).message) ||
                  "Widget session refresh failed",
              },
              t,
            );
            setSessionExpired(sessionExpiredUi);
            setWidgetToken("");
            try {
              (e.source as Window | null)?.postMessage(
                {
                  type: "XAPPS_SESSION_EXPIRED",
                  id: readString(msg.id) || undefined,
                  data: {
                    reason: "token_refresh_failed",
                    channel: "host",
                    recoverable: false,
                    message: sessionExpiredUi.message,
                  },
                },
                "*",
              );
            } catch {}
          }
        })();
        return;
      }

      if (
        (msgType === "XAPPS_WIDGET_CONTEXT_REQUEST" || msgType === "XAPPS_WIDGET_READY") &&
        e.source === iframeRef.current?.contentWindow
      ) {
        try {
          (e.source as Window | null)?.postMessage(
            {
              type: "XAPPS_WIDGET_CONTEXT",
              locale: env?.locale || null,
            },
            "*",
          );
        } catch {}
        return;
      }

      if (msgType === "XAPPS_SESSION_EXPIRED") {
        setSessionExpired(toSessionExpiredUi(msg.data, t));
        setWidgetToken("");
        return;
      }

      if (msgType === "XAPPS_OPEN_WIDGET") {
        if (e.source === window) return;

        const data = asRecord(msg.data);
        const targetInstId = readFirstString(data.installationId, installationId);
        const targetWidgetId = readFirstString(data.widgetId);

        if (targetWidgetId && env?.embedMode) {
          navigate({
            pathname: isEmbedded
              ? `/widget/${encodeURIComponent(targetInstId)}/${encodeURIComponent(targetWidgetId)}`
              : `/marketplace/widget/${encodeURIComponent(targetInstId)}/${encodeURIComponent(targetWidgetId)}`,
            search: tokenSearch,
          });
          return;
        }

        // If not in embed mode or no target widget, forward to host
        try {
          window.parent.postMessage(msg, "*");
        } catch {}
        return;
      }

      if (msgType === "XAPPS_OPEN_OPERATIONAL_SURFACE") {
        if (e.source === window) return;

        const data = asRecord(msg.data);
        const surface = readString(data.surface).toLowerCase();
        const placement =
          data.placement === "in_router" ||
          data.placement === "side_panel" ||
          data.placement === "full_page"
            ? data.placement
            : resolveOperationalSurfacePlacement({
                env,
                surface: surface as OperationalSurfaceKey,
                isEmbedded,
              });

        if (
          env?.embedMode &&
          xappId &&
          ["requests", "payments", "invoices", "notifications"].includes(surface) &&
          placement === "in_router"
        ) {
          navigate(
            buildOperationalSurfaceHref({
              surface: surface as OperationalSurfaceKey,
              xappId,
              installationId: String(data.installationId || installationId || ""),
              requestId: String(data.requestId || ""),
              paymentSessionId: String(data.paymentSessionId || ""),
              invoiceId: String(data.invoiceId || ""),
              notificationId: String(data.notificationId || ""),
              token: token || undefined,
              isEmbedded,
            }),
          );
          return;
        }

        try {
          window.parent.postMessage(msg, "*");
        } catch {}
        return;
      }

      // Forward all other XAPPS_* messages to host integration.
      // If it came from our own window (proxied from host), don't send it back to parent.
      if (e.source === window) return;
      try {
        window.parent.postMessage(msg, "*");
      } catch {}
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [
    widgetToken,
    installationId,
    widgetId,
    env?.embedMode,
    navigate,
    isEmbedded,
    tokenSearch,
    token,
    xappId,
    t,
  ]);

  useEffect(() => {
    if (!widgetToken || !env?.locale) return;
    try {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "XAPPS_LOCALE_CHANGED",
          locale: env.locale,
        },
        "*",
      );
    } catch {}
  }, [env?.locale, widgetToken]);

  const widgetUrl = (() => {
    if (!widgetToken) return "";
    const params = new URLSearchParams({ token: widgetToken });
    const hostReturnUrl = readHostReturnUrl(loc.search);
    if (hostReturnUrl) params.set("xapps_host_return_url", hostReturnUrl);
    const paymentParams = readPaymentEvidenceParams(loc.search);
    for (const [k, v] of paymentParams.entries()) {
      params.set(k, v);
    }
    return `/embed/widgets/${widgetId}?${params.toString()}`;
  })();

  if (error) {
    return (
      <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
        <div className="mx-breadcrumb">
          <button className="mx-breadcrumb-link-btn" onClick={onBackToPortal}>
            {t("common.portal", undefined, "Portal")}
          </button>
          {!env?.singleXappMode && (
            <>
              <span className="mx-breadcrumb-sep">/</span>
              <Link to={marketplaceTo as any}>
                {t("common.marketplace", undefined, "Marketplace")}
              </Link>
            </>
          )}
          <span className="mx-breadcrumb-sep">/</span>
          <span>{t("common.error", undefined, "Error")}</span>
        </div>
        <div className="mx-widget-error">
          <div className="mx-widget-error-title">
            {t("widget.unable_to_load", undefined, "Unable to load widget")}
          </div>
          <div className="mx-widget-error-desc">{error}</div>
          <div className="mx-widget-error-actions">
            <Link to={marketplaceTo as any} className="mx-btn mx-btn-outline">
              {t("common.back_to_marketplace", undefined, "Back to Marketplace")}
            </Link>
            {xappTo && (
              <Link to={xappTo as any} className="mx-btn mx-btn-ghost">
                {t("common.view_app_details", undefined, "View app details")}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
        <div className="mx-breadcrumb">
          <button className="mx-breadcrumb-link-btn" onClick={onBackToPortal}>
            {t("common.portal", undefined, "Portal")}
          </button>
          {!env?.singleXappMode && (
            <>
              <span className="mx-breadcrumb-sep">/</span>
              <Link to={marketplaceTo as any}>
                {t("common.marketplace", undefined, "Marketplace")}
              </Link>
            </>
          )}
          <span className="mx-breadcrumb-sep">/</span>
          <span>{t("common.session", undefined, "Session")}</span>
        </div>
        <div className="mx-widget-error">
          <div className="mx-widget-error-title">{sessionExpired.title}</div>
          <div className="mx-widget-error-desc">{sessionExpired.message}</div>
          <div className="mx-widget-error-actions">
            <Link to={marketplaceTo as any} className="mx-btn mx-btn-outline">
              {t("common.back_to_marketplace", undefined, "Back to Marketplace")}
            </Link>
            <button className="mx-btn mx-btn-ghost" onClick={onBackToPortal}>
              {t("common.back_to_portal", undefined, "Back to Portal")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!widgetToken) {
    return (
      <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
        <div className="mx-breadcrumb">
          <button className="mx-breadcrumb-link-btn" onClick={onBackToPortal}>
            {t("common.portal", undefined, "Portal")}
          </button>
          {!env?.singleXappMode && (
            <>
              <span className="mx-breadcrumb-sep">/</span>
              <Link to={marketplaceTo as any}>
                {t("common.marketplace", undefined, "Marketplace")}
              </Link>
            </>
          )}
          <span className="mx-breadcrumb-sep">/</span>
          <span>{xappTitle || t("common.widget", undefined, "Widget")}</span>
        </div>
        <div className="mx-widget-loading">
          <div className="mx-spinner mx-spinner-lg" />
          <div className="mx-widget-loading-title">
            {t(
              "widget.preparing",
              {
                title: xappTitle || t("common.widget", undefined, "Widget"),
              },
              "Preparing {title}...",
            )}
          </div>
          <div className="mx-widget-loading-sub">
            {t(
              "widget.secure_session_setup",
              undefined,
              "Setting up a secure session for this app.",
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className={`mx-catalog-container mx-widget-view-shell ${isEmbedded ? "is-embedded" : ""} ${
        env?.embedMode && hostNestedExpandStage !== "inline" ? "is-host-expanded" : ""
      }`}
      data-expand-stage={env?.embedMode ? hostNestedExpandStage : "inline"}
    >
      {env?.embedMode && hostNestedExpandStage === "inline" && (
        <div className="mx-breadcrumb mx-breadcrumb-top">
          <button className="mx-breadcrumb-link-btn" onClick={onBackToPortal}>
            {t("common.portal", undefined, "Portal")}
          </button>
          {!env?.singleXappMode && (
            <>
              <span className="mx-breadcrumb-sep">/</span>
              <Link to={marketplaceTo as any}>
                {t("common.marketplace", undefined, "Marketplace")}
              </Link>
            </>
          )}
          {xappTo && (
            <>
              <span className="mx-breadcrumb-sep">/</span>
              <Link to={xappTo as any}>{xappTitle || t("common.app", undefined, "App")}</Link>
            </>
          )}
          <span className="mx-breadcrumb-sep">/</span>
          <span>{t("common.widget", undefined, "Widget")}</span>
        </div>
      )}
      {!env?.embedMode && hostNestedExpandStage === "inline" && (
        <div className="mx-breadcrumb">
          <Link to={marketplaceTo as any}>{t("common.marketplace", undefined, "Marketplace")}</Link>
          {xappTo && (
            <>
              <span className="mx-breadcrumb-sep">/</span>
              <Link to={xappTo as any}>{xappTitle || t("common.app", undefined, "App")}</Link>
            </>
          )}
          <span className="mx-breadcrumb-sep">/</span>
          <span>{t("common.widget", undefined, "Widget")}</span>
        </div>
      )}

      {!isEmbedded && xappId && linkedOperationalSurfaces.length > 0 && (
        <div className="mx-widget-surface-nav">
          {linkedOperationalSurfaces.map((surface: OperationalSurfaceKey) => (
            <Link
              key={surface}
              to={buildOperationalSurfaceHref({
                surface,
                xappId,
                token,
                isEmbedded,
              })}
              className="mx-btn mx-btn-ghost mx-btn-sm"
            >
              {getOperationalSurfaceLabel(surface)}
            </Link>
          ))}
        </div>
      )}

      <div
        className="mx-widget-view-content"
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        <iframe
          ref={iframeRef}
          src={widgetUrl}
          allow="publickey-credentials-get; publickey-credentials-create"
          style={{
            width: "100%",
            height: "100%",
            minHeight: hostNestedExpandStage === "inline" ? "600px" : "0",
            border: "none",
            borderRadius: "var(--mx-radius)",
            background: "var(--mx-bg-card)",
          }}
          title="Widget"
        />
      </div>
    </div>
  );
}
