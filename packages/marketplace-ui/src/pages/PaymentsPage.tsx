import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { resolveMarketplaceText, useMarketplaceI18n } from "../i18n";
import { useMarketplace } from "../MarketplaceContext";
import { MarketplaceActivityTabs } from "../components/MarketplaceActivityTabs";
import { MarketplacePrimaryNav } from "../components/MarketplacePrimaryNav";
import { XappWorkspaceNav } from "../components/XappWorkspaceNav";
import { buildMarketplaceHref } from "../utils/marketplaceRouting";
import { asRecord, formatDateTime, readFirstString, readString } from "../utils/readers";
import { readDefaultWidgetMeta } from "../utils/xappWorkspace";
import "../marketplace.css";

function useQueryToken(): string {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  return qs.get("token") ?? "";
}

function useQuery(): URLSearchParams {
  const loc = useLocation();
  return useMemo(() => new URLSearchParams(loc.search), [loc.search]);
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useMarketplaceI18n();
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  const className =
    normalized === "COMPLETED"
      ? "mx-badge-success"
      : normalized === "FAILED"
        ? "mx-badge-danger"
        : "mx-badge-warning";
  return (
    <span className={`mx-badge ${className}`}>
      {normalized || t("status.read", undefined, "Read")}
    </span>
  );
}

type PaymentSessionRecord = Record<string, unknown>;

export function PaymentsPage() {
  const { client, host } = useMarketplace();
  const { locale, t } = useMarketplaceI18n();
  const token = useQueryToken();
  const loc = useLocation();
  const query = useQuery();

  const xappIdFilter = query.get("xappId") ?? "";
  const installationIdFilter = query.get("installationId") ?? "";
  const focusedPaymentSessionId = query.get("paymentSessionId") ?? "";
  const isEmbedded = typeof window !== "undefined" && window.location.pathname.startsWith("/embed");
  const [items, setItems] = useState<PaymentSessionRecord[]>([]);
  const [focusedSession, setFocusedSession] = useState<PaymentSessionRecord | null>(null);
  const [focusedError, setFocusedError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [xappTitle, setXappTitle] = useState("");
  const [xappDefaultWidgetId, setXappDefaultWidgetId] = useState("");
  const [xappDefaultWidgetName, setXappDefaultWidgetName] = useState("");
  const [xappDefaultToolName, setXappDefaultToolName] = useState("");
  const [xappOpenAppStrategy, setXappOpenAppStrategy] = useState<"direct_widget" | "choose_widget">(
    "direct_widget",
  );
  const xappInstallationId =
    installationIdFilter || host.getInstallationsByXappId?.()?.[xappIdFilter]?.installationId || "";
  const handleWorkspaceOpenApp =
    !isEmbedded &&
    xappOpenAppStrategy === "direct_widget" &&
    xappInstallationId &&
    xappDefaultWidgetId
      ? () => {
          host.openWidget({
            installationId: xappInstallationId,
            widgetId: xappDefaultWidgetId,
            xappId: xappIdFilter,
            xappTitle: xappTitle || xappIdFilter,
            widgetName: xappDefaultWidgetName,
            toolName: xappDefaultToolName || undefined,
          });
        }
      : undefined;
  async function refresh() {
    if (!client.listMyPaymentSessions) {
      setError(
        t(
          "activity.unavailable_payments_title",
          undefined,
          "Payments are unavailable in this host.",
        ),
      );
      setItems([]);
      setBusy(false);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await client.listMyPaymentSessions({
        paymentSessionId: focusedPaymentSessionId || undefined,
        xappId: xappIdFilter || undefined,
        installationId: installationIdFilter || undefined,
        limit: 50,
      });
      setItems(Array.isArray(res?.items) ? res.items.map((item) => asRecord(item)) : []);
    } catch (e) {
      setError(readFirstString(asRecord(e).message) || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    host.notifyNavigation?.({
      path: typeof window !== "undefined" ? window.location.pathname : "",
      page: "payments",
      params: { xappId: xappIdFilter || null },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedPaymentSessionId, installationIdFilter, xappIdFilter]);

  useEffect(() => {
    if (!focusedPaymentSessionId || !client.getMyPaymentSession) {
      setFocusedSession(null);
      setFocusedError(null);
      return;
    }
    let cancelled = false;
    setFocusedError(null);
    void (async () => {
      try {
        const res = await client.getMyPaymentSession!(focusedPaymentSessionId);
        if (cancelled) return;
        const session = asRecord(asRecord(res).session);
        setFocusedSession(Object.keys(session).length > 0 ? session : null);
      } catch (e) {
        if (cancelled) return;
        setFocusedSession(null);
        setFocusedError(readFirstString(asRecord(e).message) || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, focusedPaymentSessionId]);

  useEffect(() => {
    if (!xappIdFilter) {
      setXappTitle("");
      setXappDefaultWidgetId("");
      setXappDefaultWidgetName("");
      setXappDefaultToolName("");
      setXappOpenAppStrategy("direct_widget");
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await client.getCatalogXapp(String(xappIdFilter));
        if (!alive) return;
        const manifest = asRecord(res?.manifest);
        const xapp = asRecord(res?.xapp);
        const widgetMeta = readDefaultWidgetMeta(
          res,
          locale,
          t("common.widget", undefined, "Widget"),
        );
        setXappTitle(
          resolveMarketplaceText(manifest.title as any, locale) || readFirstString(xapp.name),
        );
        setXappDefaultWidgetId(widgetMeta?.widgetId || "");
        setXappDefaultWidgetName(widgetMeta?.widgetName || "");
        setXappDefaultToolName(widgetMeta?.toolName || "");
        setXappOpenAppStrategy(
          widgetMeta && widgetMeta.widgetCount > 1 ? "choose_widget" : "direct_widget",
        );
      } catch {
        if (!alive) return;
        setXappTitle("");
        setXappDefaultWidgetId("");
        setXappDefaultWidgetName("");
        setXappDefaultToolName("");
        setXappOpenAppStrategy("direct_widget");
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, locale, xappIdFilter]);

  const xappLink = xappIdFilter
    ? (buildMarketplaceHref(loc.pathname, `xapps/${encodeURIComponent(String(xappIdFilter))}`, {
        token,
      }) as any)
    : null;

  const clearHref = buildMarketplaceHref(loc.pathname, "payments", { token });
  const listHref = buildMarketplaceHref(loc.pathname, "payments", {
    token,
    xappId: xappIdFilter,
    installationId: installationIdFilter,
  });

  const emptyState = error === "Subject required" || error === "Session token required";

  return (
    <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
      <div className="mx-breadcrumb">
        <Link to={buildMarketplaceHref(loc.pathname, "", { token }) as any}>
          {t("common.marketplace", undefined, "Marketplace")}
        </Link>
        {xappLink && (
          <>
            <span className="mx-breadcrumb-sep">/</span>
            <Link to={xappLink}>{xappTitle || xappIdFilter}</Link>
          </>
        )}
        <span className="mx-breadcrumb-sep">/</span>
        <span>{t("activity.payments_title", undefined, "Payments")}</span>
      </div>

      <header className="mx-header">
        <h1 className="mx-title">{t("activity.payments_title", undefined, "Payments")}</h1>
        <div className="mx-header-actions">
          <MarketplacePrimaryNav
            active="activity"
            isEmbedded={isEmbedded}
            tokenSearch={token ? `?token=${encodeURIComponent(token)}` : ""}
          />
          {xappIdFilter && (
            <Link to={clearHref as any} className="mx-btn mx-btn-ghost">
              {t("common.clear_filter", undefined, "Clear Filter")}
            </Link>
          )}
          <button
            className={`mx-btn-icon ${busy ? "is-spinning" : ""}`}
            onClick={() => void refresh()}
            disabled={busy}
            title={t("common.refresh", undefined, "Refresh")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </header>

      {xappIdFilter ? (
        <XappWorkspaceNav
          xappId={xappIdFilter}
          xappTitle={xappTitle || xappIdFilter}
          isEmbedded={isEmbedded}
          token={token}
          installationId={xappInstallationId || undefined}
          active="billing"
          billingActive="payments"
          openWidgetId={xappDefaultWidgetId}
          openWidgetName={xappDefaultWidgetName}
          openToolName={xappDefaultToolName}
          openAppStrategy={xappOpenAppStrategy}
          onOpenApp={handleWorkspaceOpenApp}
        />
      ) : (
        <MarketplaceActivityTabs
          active="payments"
          isEmbedded={isEmbedded}
          token={token}
          xappId={xappIdFilter || undefined}
          installationId={installationIdFilter || undefined}
        />
      )}

      {emptyState ? (
        <div className="mx-table-container mx-alert mx-alert-info">
          <div className="mx-alert-subject-title">
            {t("activity.subject_required_title", undefined, "Subject required")}
          </div>
          <div className="mx-alert-subject-desc">
            {t(
              "activity.subject_required_desc",
              undefined,
              "This host session is not associated with a user. Ask your host to create a catalog session with a subjectId.",
            )}{" "}
            <code>subjectId</code>.
          </div>
        </div>
      ) : error ? (
        <div className="mx-table-container mx-alert mx-alert-error">{error}</div>
      ) : null}

      {xappIdFilter && (
        <div className="mx-subtle-note">
          {t("activity.showing_payments_for_prefix", undefined, "Showing payment activity for")}{" "}
          {xappLink ? (
            <Link to={xappLink} className="mx-subtle-note-link">
              {xappTitle || xappIdFilter}
            </Link>
          ) : (
            <span className="mx-subtle-note-strong">{xappTitle || xappIdFilter}</span>
          )}
        </div>
      )}

      {focusedPaymentSessionId && (
        <div className="mx-record-panel">
          <div className="mx-record-panel-head">
            <div>
              <div className="mx-record-panel-kicker">
                {t("activity.payment_detail", undefined, "Payment Detail")}
              </div>
              <div className="mx-record-panel-id">{focusedPaymentSessionId}</div>
            </div>
            <Link to={listHref as any} className="mx-btn mx-btn-ghost">
              {t("activity.back_to_payment_list", undefined, "Back to payment list")}
            </Link>
          </div>
          {focusedError ? (
            <div className="mx-alert mx-alert-error mx-alert-panel">{focusedError}</div>
          ) : focusedSession ? (
            <div className="mx-record-grid">
              <div className="mx-record-field">
                <div className="mx-record-label">{t("common.status", undefined, "Status")}</div>
                <div className="mx-record-value">
                  <StatusBadge status={readString(focusedSession.status)} />
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">{t("common.amount", undefined, "Amount")}</div>
                <div className="mx-record-value is-strong">
                  {readFirstString(focusedSession.amount, "—")}{" "}
                  {readString(focusedSession.currency)}
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">{t("common.tool", undefined, "Tool")}</div>
                <div className="mx-record-value is-strong">
                  {readFirstString(focusedSession.tool_name, "—")}
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">{t("common.provider", undefined, "Provider")}</div>
                <div className="mx-record-value is-strong">
                  {readFirstString(focusedSession.provider_key, focusedSession.issuer, "—")}
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">{t("common.request", undefined, "Request")}</div>
                <div className="mx-record-value is-mono">
                  {readFirstString(focusedSession.request_id, "—")}
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">{t("common.created", undefined, "Created")}</div>
                <div className="mx-record-value">
                  {formatDateTime(focusedSession.created_at) || "—"}
                </div>
              </div>
              {Array.isArray(focusedSession.invoices) && focusedSession.invoices.length > 0 && (
                <div className="mx-record-field is-span-full">
                  <div className="mx-record-label">
                    {t("activity.invoices_title", undefined, "Invoices")}
                  </div>
                  <div className="mx-record-pill-row">
                    {focusedSession.invoices.map((invoice, index) => {
                      const invoiceRecord = asRecord(invoice);
                      return (
                        <span
                          key={readFirstString(invoiceRecord.id, index)}
                          className="mx-badge mx-badge-outline"
                        >
                          {readFirstString(
                            invoiceRecord.invoice_identifier,
                            invoiceRecord.id,
                            t("common.invoice", undefined, "Invoice"),
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-record-loading">
              <div className="mx-spinner" />
              <span>
                {t("activity.loading_payment_detail", undefined, "Loading payment details...")}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mx-table-container">
        <table className="mx-table" data-responsive="cards">
          <thead>
            <tr>
              {!xappIdFilter && <th scope="col">{t("common.xapp", undefined, "Xapp")}</th>}
              <th scope="col">{t("common.session", undefined, "Session")}</th>
              <th scope="col">{t("common.tool", undefined, "Tool")}</th>
              <th scope="col">{t("common.amount", undefined, "Amount")}</th>
              <th scope="col">{t("common.status", undefined, "Status")}</th>
              <th scope="col">{t("common.created", undefined, "Created")}</th>
              <th scope="col">{t("common.action", undefined, "Action")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={xappIdFilter ? 6 : 7}
                  className={busy ? "mx-table-loading-cell" : "mx-table-empty-cell"}
                >
                  {busy ? (
                    <div className="mx-loading-center mx-loading-table">
                      <div className="mx-spinner" />
                      <span>
                        {t("activity.loading_payments", undefined, "Loading payments...")}
                      </span>
                    </div>
                  ) : (
                    t("activity.no_payments", undefined, "No payment activity found.")
                  )}
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={readFirstString(item.payment_session_id, item.id, index)}>
                  {!xappIdFilter && (
                    <td data-label={t("common.xapp", undefined, "Xapp")}>
                      {readFirstString(item.xapp_name, item.xapp_id, "—")}
                    </td>
                  )}
                  <td
                    className="mx-cell-mono"
                    data-label={t("common.session", undefined, "Session")}
                  >
                    {readFirstString(item.payment_session_id, "—")}
                  </td>
                  <td data-label={t("common.tool", undefined, "Tool")}>
                    {readFirstString(item.tool_name, "—")}
                  </td>
                  <td className="mx-cell-bold" data-label={t("common.amount", undefined, "Amount")}>
                    {readString(item.amount)} {readString(item.currency)}
                  </td>
                  <td data-label={t("common.status", undefined, "Status")}>
                    <StatusBadge status={readString(item.status)} />
                  </td>
                  <td
                    className="mx-cell-date"
                    data-label={t("common.created", undefined, "Created")}
                  >
                    {formatDateTime(item.created_at) || "—"}
                  </td>
                  <td data-label={t("common.action", undefined, "Action")}>
                    <div className="mx-action-group">
                      <Link
                        to={
                          {
                            pathname: isEmbedded ? "/payments" : "/marketplace/payments",
                            search: (() => {
                              const qs = new URLSearchParams();
                              if (token) qs.set("token", token);
                              if (xappIdFilter || item.xapp_id)
                                qs.set("xappId", xappIdFilter || String(item.xapp_id));
                              if (installationIdFilter || item.installation_id) {
                                qs.set(
                                  "installationId",
                                  installationIdFilter || String(item.installation_id),
                                );
                              }
                              if (item.payment_session_id)
                                qs.set("paymentSessionId", String(item.payment_session_id));
                              return `?${qs.toString()}`;
                            })(),
                          } as any
                        }
                        className="mx-btn mx-btn-outline mx-btn-sm"
                      >
                        {t("common.details", undefined, "Details")}
                      </Link>
                      {item.resume_url ? (
                        <a
                          href={String(item.resume_url)}
                          className="mx-btn mx-btn-outline mx-btn-sm"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("activity.resume_payment", undefined, "Resume")}
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
