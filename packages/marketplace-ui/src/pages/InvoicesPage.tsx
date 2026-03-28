import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { resolveMarketplaceText, useMarketplaceI18n } from "../i18n";
import { useMarketplace } from "../MarketplaceContext";
import { MarketplaceActivityTabs } from "../components/MarketplaceActivityTabs";
import { MarketplacePrimaryNav } from "../components/MarketplacePrimaryNav";
import { asRecord, formatDateTime, readFirstString, readString } from "../utils/readers";
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

type InvoiceRecord = Record<string, unknown>;
type InvoicePagination = { total: number; page: number; pageSize: number; totalPages: number };

export function InvoicesPage() {
  const { client, host } = useMarketplace();
  const { locale, t } = useMarketplaceI18n();
  const token = useQueryToken();
  const query = useQuery();

  const xappIdFilter = query.get("xappId") ?? "";
  const installationIdFilter = query.get("installationId") ?? "";
  const focusedInvoiceId = query.get("invoiceId") ?? "";
  const paymentSessionIdFilter = query.get("paymentSessionId") ?? "";
  const pageParam = Math.max(1, parseInt(query.get("page") ?? "1", 10) || 1);
  const [items, setItems] = useState<InvoiceRecord[]>([]);
  const [focusedInvoice, setFocusedInvoice] = useState<InvoiceRecord | null>(null);
  const [focusedHistory, setFocusedHistory] = useState<InvoiceRecord[]>([]);
  const [focusedError, setFocusedError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<InvoicePagination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [xappTitle, setXappTitle] = useState("");

  const isEmbedded = typeof window !== "undefined" && window.location.pathname.startsWith("/embed");

  async function refresh(page: number = 1) {
    if (!client.listMyInvoices) {
      setError(
        t(
          "activity.unavailable_invoices_title",
          undefined,
          "Invoices are unavailable in this host.",
        ),
      );
      setItems([]);
      setPagination(null);
      setBusy(false);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await client.listMyInvoices({
        paymentSessionId: paymentSessionIdFilter || undefined,
        xappId: xappIdFilter || undefined,
        installationId: installationIdFilter || undefined,
        page,
        pageSize: 20,
      });
      setItems(Array.isArray(res?.items) ? res.items.map((item) => asRecord(item)) : []);
      const nextPagination = asRecord(res?.pagination);
      setPagination(
        Object.keys(nextPagination).length
          ? {
              total: Number(nextPagination.total || 0),
              page: Number(nextPagination.page || page),
              pageSize: Number(nextPagination.pageSize || 20),
              totalPages: Number(nextPagination.totalPages || 1),
            }
          : null,
      );
    } catch (e) {
      setError(readFirstString(asRecord(e).message) || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh(pageParam);
    host.notifyNavigation?.({
      path: typeof window !== "undefined" ? window.location.pathname : "",
      page: "invoices",
      params: { xappId: xappIdFilter || null },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationIdFilter, pageParam, paymentSessionIdFilter, xappIdFilter]);

  useEffect(() => {
    if (!focusedInvoiceId || !client.getMyInvoiceHistory) {
      setFocusedInvoice(null);
      setFocusedHistory([]);
      setFocusedError(null);
      return;
    }
    let cancelled = false;
    setFocusedError(null);
    void (async () => {
      try {
        const res = await client.getMyInvoiceHistory!(focusedInvoiceId);
        if (cancelled) return;
        const history = asRecord(res);
        setFocusedInvoice(asRecord(history.item));
        setFocusedHistory(
          Array.isArray(history.events) ? history.events.map((event) => asRecord(event)) : [],
        );
      } catch (e) {
        if (cancelled) return;
        setFocusedInvoice(null);
        setFocusedHistory([]);
        setFocusedError(readFirstString(asRecord(e).message) || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, focusedInvoiceId]);

  useEffect(() => {
    if (!xappIdFilter) {
      setXappTitle("");
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await client.getCatalogXapp(String(xappIdFilter));
        if (!alive) return;
        const manifest = asRecord(res?.manifest);
        const xapp = asRecord(res?.xapp);
        setXappTitle(
          resolveMarketplaceText(manifest.title as any, locale) || readFirstString(xapp.name),
        );
      } catch {
        if (!alive) return;
        setXappTitle("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, locale, xappIdFilter]);

  const xappLink = xappIdFilter
    ? ({
        pathname: isEmbedded
          ? `/xapps/${encodeURIComponent(String(xappIdFilter))}`
          : `/marketplace/xapps/${encodeURIComponent(String(xappIdFilter))}`,
        search: token ? `?token=${encodeURIComponent(token)}` : "",
      } as any)
    : null;

  const clearHref = {
    pathname: isEmbedded ? "/invoices" : "/marketplace/invoices",
    search: token ? `?token=${encodeURIComponent(token)}` : "",
  };
  const listHref = {
    pathname: isEmbedded ? "/invoices" : "/marketplace/invoices",
    search: (() => {
      const qs = new URLSearchParams();
      if (token) qs.set("token", token);
      if (xappIdFilter) qs.set("xappId", xappIdFilter);
      if (installationIdFilter) qs.set("installationId", installationIdFilter);
      if (paymentSessionIdFilter) qs.set("paymentSessionId", paymentSessionIdFilter);
      const suffix = qs.toString();
      return suffix ? `?${suffix}` : "";
    })(),
  };

  const emptyState = error === "Subject required" || error === "Session token required";

  return (
    <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
      <div className="mx-breadcrumb">
        <Link to={isEmbedded ? "/" : "/marketplace"}>
          {t("common.marketplace", undefined, "Marketplace")}
        </Link>
        {xappLink && (
          <>
            <span className="mx-breadcrumb-sep">/</span>
            <Link to={xappLink}>{xappTitle || xappIdFilter}</Link>
          </>
        )}
        <span className="mx-breadcrumb-sep">/</span>
        <span>{t("activity.invoices_title", undefined, "Invoices")}</span>
      </div>

      <header className="mx-header">
        <h1 className="mx-title">{t("activity.invoices_title", undefined, "Invoices")}</h1>
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
            onClick={() => void refresh(pageParam)}
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

      <MarketplaceActivityTabs
        active="invoices"
        isEmbedded={isEmbedded}
        token={token}
        xappId={xappIdFilter || undefined}
        installationId={installationIdFilter || undefined}
      />

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
          {t("activity.showing_invoices_for_prefix", undefined, "Showing invoice records for")}{" "}
          {xappLink ? (
            <Link to={xappLink} className="mx-subtle-note-link">
              {xappTitle || xappIdFilter}
            </Link>
          ) : (
            <span className="mx-subtle-note-strong">{xappTitle || xappIdFilter}</span>
          )}
        </div>
      )}

      {focusedInvoiceId && (
        <div className="mx-record-panel">
          <div className="mx-record-panel-head">
            <div>
              <div className="mx-record-panel-kicker">
                {t("activity.invoice_detail", undefined, "Invoice Detail")}
              </div>
              <div className="mx-record-panel-id">{focusedInvoiceId}</div>
            </div>
            <Link to={listHref as any} className="mx-btn mx-btn-ghost">
              {t("activity.back_to_invoice_list", undefined, "Back to invoice list")}
            </Link>
          </div>
          {focusedError ? (
            <div className="mx-alert mx-alert-error mx-alert-panel">{focusedError}</div>
          ) : focusedInvoice ? (
            <>
              <div className="mx-record-grid">
                <div className="mx-record-field">
                  <div className="mx-record-label">{t("common.status", undefined, "Status")}</div>
                  <div className="mx-record-value">
                    <StatusBadge
                      status={readFirstString(
                        focusedInvoice.status,
                        focusedInvoice.lifecycle_status,
                      )}
                    />
                  </div>
                </div>
                <div className="mx-record-field">
                  <div className="mx-record-label">
                    {t("common.provider", undefined, "Provider")}
                  </div>
                  <div className="mx-record-value is-strong">
                    {readFirstString(focusedInvoice.provider_key, "—")}
                  </div>
                </div>
                <div className="mx-record-field">
                  <div className="mx-record-label">
                    {t("common.payment_session", undefined, "Payment Session")}
                  </div>
                  <div className="mx-record-value is-mono">
                    {readFirstString(focusedInvoice.payment_session_id, "—")}
                  </div>
                </div>
                <div className="mx-record-field">
                  <div className="mx-record-label">{t("common.created", undefined, "Created")}</div>
                  <div className="mx-record-value">
                    {formatDateTime(focusedInvoice.created_at) || "—"}
                  </div>
                </div>
                {(readString(focusedInvoice.document_url) ||
                  readString(focusedInvoice.document_download_url) ||
                  readString(focusedInvoice.external_url)) && (
                  <div className="mx-record-actions">
                    {focusedInvoice.document_url ? (
                      <a
                        href={String(focusedInvoice.document_url)}
                        className="mx-btn mx-btn-outline mx-btn-sm"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("activity.open_document", undefined, "Open Document")}
                      </a>
                    ) : null}
                    {focusedInvoice.document_download_url ? (
                      <a
                        href={String(focusedInvoice.document_download_url)}
                        className="mx-btn mx-btn-outline mx-btn-sm"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("common.download", undefined, "Download")}
                      </a>
                    ) : null}
                    {!focusedInvoice.document_download_url &&
                    !focusedInvoice.document_url &&
                    focusedInvoice.external_url ? (
                      <a
                        href={String(focusedInvoice.external_url)}
                        className="mx-btn mx-btn-outline mx-btn-sm"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("activity.open_external", undefined, "Open External")}
                      </a>
                    ) : null}
                  </div>
                )}
              </div>
              {focusedHistory.length > 0 && (
                <div className="mx-record-timeline">
                  <div className="mx-record-label">
                    {t("activity.lifecycle_history", undefined, "Lifecycle History")}
                  </div>
                  <div className="mx-detail-guard-list mx-detail-guard-list-compact">
                    {focusedHistory.map((event, index) => (
                      <div
                        key={readFirstString(event.id, index)}
                        className="mx-record-timeline-item"
                      >
                        <strong>
                          {readFirstString(
                            event.action,
                            event.type,
                            t("activity.event", undefined, "Event"),
                          )}
                        </strong>
                        {formatDateTime(event.created_at)
                          ? ` • ${formatDateTime(event.created_at)}`
                          : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mx-record-loading">
              <div className="mx-spinner" />
              <span>
                {t("activity.loading_invoice_detail", undefined, "Loading invoice details...")}
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
              <th scope="col">{t("common.invoice", undefined, "Invoice")}</th>
              <th scope="col">{t("common.status", undefined, "Status")}</th>
              <th scope="col">{t("common.provider", undefined, "Provider")}</th>
              <th scope="col">{t("common.created", undefined, "Created")}</th>
              <th scope="col">{t("common.document", undefined, "Document")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={xappIdFilter ? 5 : 6}
                  className={busy ? "mx-table-loading-cell" : "mx-table-empty-cell"}
                >
                  {busy ? (
                    <div className="mx-loading-center mx-loading-table">
                      <div className="mx-spinner" />
                      <span>
                        {t("activity.loading_invoices", undefined, "Loading invoices...")}
                      </span>
                    </div>
                  ) : (
                    t("activity.no_invoices", undefined, "No invoices found.")
                  )}
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={readFirstString(item.id, index)}>
                  {!xappIdFilter && (
                    <td data-label={t("common.xapp", undefined, "Xapp")}>
                      {readFirstString(item.xapp_name, item.xapp_id, "—")}
                    </td>
                  )}
                  <td data-label={t("common.invoice", undefined, "Invoice")}>
                    <div className="mx-cell-bold">
                      {readFirstString(
                        item.invoice_identifier,
                        item.series,
                        item.number,
                        item.id,
                        "—",
                      )}
                    </div>
                    {readString(item.payment_session_id) && (
                      <div className="mx-cell-sub">
                        {t("common.payment", undefined, "Payment")}:{" "}
                        {readString(item.payment_session_id)}
                      </div>
                    )}
                  </td>
                  <td data-label={t("common.status", undefined, "Status")}>
                    <StatusBadge status={readFirstString(item.status, item.lifecycle_status)} />
                  </td>
                  <td data-label={t("common.provider", undefined, "Provider")}>
                    {readFirstString(item.provider_key, "—")}
                  </td>
                  <td
                    className="mx-cell-date"
                    data-label={t("common.created", undefined, "Created")}
                  >
                    {formatDateTime(item.created_at) || "—"}
                  </td>
                  <td data-label={t("common.document", undefined, "Document")}>
                    <div className="mx-action-group">
                      <Link
                        to={
                          {
                            pathname: isEmbedded ? "/invoices" : "/marketplace/invoices",
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
                              if (item.id) qs.set("invoiceId", String(item.id));
                              return `?${qs.toString()}`;
                            })(),
                          } as any
                        }
                        className="mx-btn mx-btn-outline mx-btn-sm"
                      >
                        {t("common.details", undefined, "Details")}
                      </Link>
                      {item.document_download_url || item.external_url ? (
                        <a
                          href={String(item.document_download_url || item.external_url)}
                          className="mx-btn mx-btn-outline mx-btn-sm"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("common.open", undefined, "Open")}
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

      {pagination && pagination.totalPages > 1 && (
        <div className="mx-pagination">
          <button
            className="mx-btn mx-btn-outline"
            disabled={pageParam <= 1}
            onClick={() => void refresh(pageParam - 1)}
          >
            {t("common.previous", undefined, "Previous")}
          </button>
          <span className="mx-pagination-info">
            {t(
              "activity.page_of",
              { page: pagination.page, totalPages: pagination.totalPages },
              `Page ${pagination.page} of ${pagination.totalPages}`,
            )}
          </span>
          <button
            className="mx-btn mx-btn-outline"
            disabled={pageParam >= Number(pagination.totalPages || 1)}
            onClick={() => void refresh(pageParam + 1)}
          >
            {t("common.next", undefined, "Next")}
          </button>
        </div>
      )}
    </div>
  );
}
