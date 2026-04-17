import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { resolveMarketplaceText, useMarketplaceI18n } from "../i18n";
import { useMarketplace } from "../MarketplaceContext";
import { MarketplaceActivityTabs } from "../components/MarketplaceActivityTabs";
import { MarketplacePrimaryNav } from "../components/MarketplacePrimaryNav";
import { XappWorkspaceNav } from "../components/XappWorkspaceNav";
import { shouldHideMarketplaceVersions } from "../utils/installationPolicy";
import { buildMarketplaceHref } from "../utils/marketplaceRouting";
import { asRecord, formatDateTime, readFirstString, readString } from "../utils/readers";
import { describeGuardCurrentAccess } from "../utils/guardMonetization";
import { readDefaultWidgetMeta } from "../utils/xappWorkspace";
import "../marketplace.css";

type RequestListPagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function useQueryToken(): string {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  return qs.get("token") ?? "";
}

function useQuery(): URLSearchParams {
  const loc = useLocation();
  return useMemo(() => new URLSearchParams(loc.search), [loc.search]);
}

function renderGuardActionHint(summary: Record<string, unknown>): string {
  const action = asRecord(summary.action);
  const kind = readString(action.kind);
  if (kind === "upgrade_subscription") return "Upgrade subscription";
  if (kind === "complete_payment") return "Complete payment";
  if (kind === "step_up_auth") return "Complete step-up authentication";
  if (kind === "confirm_action") {
    const msg = readString(action.message);
    return msg ? `Confirm action (${msg})` : "Confirm action";
  }
  return kind ? `Action: ${kind}` : "";
}

export function RequestsPage() {
  const { client, host, env } = useMarketplace();
  const { locale, t } = useMarketplaceI18n();
  const token = useQueryToken();
  const loc = useLocation();
  const query = useQuery();

  const xappIdFilter = query.get("xappId") ?? "";
  const pageParam = Math.max(1, parseInt(query.get("page") ?? "1", 10) || 1);
  const isEmbedded = window.location.pathname.startsWith("/embed");

  const [items, setItems] = useState<unknown[]>([]);
  const [pagination, setPagination] = useState<RequestListPagination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [xappTitle, setXappTitle] = useState<string>("");
  const [xappDefaultWidgetId, setXappDefaultWidgetId] = useState("");
  const [xappDefaultWidgetName, setXappDefaultWidgetName] = useState("");
  const [xappDefaultToolName, setXappDefaultToolName] = useState("");
  const [xappOpenAppStrategy, setXappOpenAppStrategy] = useState<"direct_widget" | "choose_widget">(
    "direct_widget",
  );
  const hideVersions = shouldHideMarketplaceVersions({
    installationPolicy: env?.installationPolicy ?? host.installationPolicy ?? null,
    installationPolicyResolved: env?.installationPolicyResolved,
    subjectId: host.subjectId,
  });
  const xappInstallationId =
    host.getInstallationsByXappId?.()?.[xappIdFilter]?.installationId || "";
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

  async function refresh(page: number = 1) {
    setError(null);
    setBusy(true);
    try {
      const res = await client.listMyRequests({
        xappId: xappIdFilter || undefined,
        page,
        pageSize: 20,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setPagination(
        res.pagination
          ? {
              total: Number(res.pagination.total || 0),
              page: Number(res.pagination.page || 1),
              pageSize: Number(res.pagination.pageSize || 20),
              totalPages: Number(res.pagination.totalPages || 1),
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
      path: window.location.pathname,
      page: "requests",
      params: { xappId: xappIdFilter },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xappIdFilter, pageParam]);

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
        const detail = asRecord(res);
        const name =
          resolveMarketplaceText(asRecord(detail.manifest).title as any, locale) ||
          readFirstString(asRecord(detail.xapp).name);
        const widgetMeta = readDefaultWidgetMeta(
          detail,
          locale,
          t("common.widget", undefined, "Widget"),
        );
        if (!alive) return;
        setXappTitle(name);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, xappIdFilter]);

  const xappLink = xappIdFilter
    ? (buildMarketplaceHref(loc.pathname, `xapps/${encodeURIComponent(String(xappIdFilter))}`, {
        token,
      }) as any)
    : null;

  const backToContext =
    xappIdFilter && xappLink ? xappLink : buildMarketplaceHref(loc.pathname, "", { token });

  const emptyState = error === "Subject required" || error === "Session token required";

  const clearHref = buildMarketplaceHref(loc.pathname, "requests", { token });

  function StatusBadge({ status }: { status: string }) {
    const s = String(status || "");
    const normalized = s.trim().toUpperCase();
    const className =
      s === "COMPLETED"
        ? "mx-badge-success"
        : s === "FAILED"
          ? "mx-badge-danger"
          : "mx-badge-warning";
    const label =
      normalized === "PAYMENT_PENDING"
        ? t("activity.payment_pending", undefined, "Payment Pending")
        : s || "—";
    return <span className={`mx-badge ${className}`}>{label}</span>;
  }

  if (env?.requestsEnabled === false) {
    return (
      <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
        <div className="mx-table-container mx-unavailable">
          <h2 className="mx-title mx-unavailable-title">
            {t("activity.unavailable_requests_title", undefined, "Requests are unavailable")}
          </h2>
          <p className="mx-unavailable-desc">
            {t(
              "activity.unavailable_requests_desc",
              undefined,
              "This public catalog does not support viewing personal requests.",
            )}
          </p>
          <Link to={backToContext as any} className="mx-btn mx-btn-primary">
            ← {t("common.back", undefined, "Back")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
      <div className="mx-breadcrumb">
        {!env?.singleXappMode && (
          <Link to={buildMarketplaceHref(loc.pathname, "", { token }) as any}>
            {t("common.marketplace", undefined, "Marketplace")}
          </Link>
        )}
        {env?.singleXappMode && !isEmbedded && (
          <Link to={buildMarketplaceHref(loc.pathname, "", { token }) as any}>
            {t("common.marketplace", undefined, "Marketplace")}
          </Link>
        )}
        {xappIdFilter && xappLink && (
          <>
            {(!env?.singleXappMode || (env?.singleXappMode && !isEmbedded)) && (
              <span className="mx-breadcrumb-sep">/</span>
            )}
            <Link to={xappLink as any}>{xappTitle || xappIdFilter}</Link>
          </>
        )}
        <span className="mx-breadcrumb-sep">/</span>
        <span>{t("activity.requests_title", undefined, "Requests")}</span>
      </div>

      <header className="mx-header">
        <h1 className="mx-title">{t("activity.requests_title", undefined, "Requests")}</h1>
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
          active="requests"
          openWidgetId={xappDefaultWidgetId}
          openWidgetName={xappDefaultWidgetName}
          openToolName={xappDefaultToolName}
          openAppStrategy={xappOpenAppStrategy}
          onOpenApp={handleWorkspaceOpenApp}
        />
      ) : (
        <MarketplaceActivityTabs
          active="requests"
          isEmbedded={isEmbedded}
          token={token}
          xappId={xappIdFilter || undefined}
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
          {t("activity.showing_requests_for_prefix", undefined, "Showing requests for")}{" "}
          {xappLink ? (
            <Link to={xappLink} className="mx-subtle-note-link">
              {xappTitle || String(xappIdFilter)}
            </Link>
          ) : (
            <span className="mx-subtle-note-strong">{xappTitle || String(xappIdFilter)}</span>
          )}
        </div>
      )}

      <div className="mx-table-container">
        <table className="mx-table" data-responsive="cards">
          <thead>
            <tr>
              <th scope="col">{t("common.id", undefined, "ID")}</th>
              <th scope="col">{t("common.tool", undefined, "Tool")}</th>
              {!hideVersions && <th scope="col">{t("common.version", undefined, "Version")}</th>}
              <th scope="col">{t("common.status", undefined, "Status")}</th>
              <th scope="col">{t("common.created", undefined, "Created")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  data-label={t("common.status", undefined, "Status")}
                  className={busy ? "mx-table-loading-cell" : "mx-table-empty-cell"}
                >
                  {busy ? (
                    <div className="mx-loading-center mx-loading-table">
                      <div className="mx-spinner" />
                      <span>
                        {t("activity.loading_requests", undefined, "Loading requests...")}
                      </span>
                    </div>
                  ) : (
                    t("activity.no_requests", undefined, "No requests yet.")
                  )}
                </td>
              </tr>
            ) : (
              items.map((r) => {
                const request = asRecord(r);
                const manifest = asRecord(request.manifest);
                const href = {
                  pathname: `./${encodeURIComponent(readFirstString(request.id))}`,
                  search: `?${new URLSearchParams({
                    ...(xappIdFilter ? { xappId: xappIdFilter } : {}),
                    ...(token ? { token } : {}),
                  }).toString()}`,
                };

                const tags: string[] = Array.isArray(manifest.tags)
                  ? manifest.tags
                      .filter((t) => typeof t === "string" && t.trim())
                      .map((t) => String(t).trim())
                  : [];
                const guardSummary = asRecord(request.guard_summary);
                const guardSlug =
                  readString(guardSummary.slug) || readString(guardSummary.guardSlug);
                const guardReason = readString(guardSummary.reason);
                const guardOutcome = readString(guardSummary.outcome);
                const guardActionHint = renderGuardActionHint(guardSummary);
                const guardAccessHint = describeGuardCurrentAccess(guardSummary, {
                  available: t("common.available", undefined, "Available"),
                  unavailable: t("xapp.subscription_coverage_inactive", undefined, "Not covered"),
                });
                const hasGuardInfo =
                  Boolean(guardSlug) ||
                  Boolean(guardReason) ||
                  Boolean(guardActionHint) ||
                  Boolean(guardAccessHint);

                return (
                  <tr key={readFirstString(request.id)}>
                    <td className="mx-cell-id" data-label={t("common.id", undefined, "ID")}>
                      <Link to={href as any}>{readFirstString(request.id).slice(0, 8)}...</Link>
                    </td>
                    <td data-label={t("common.tool", undefined, "Tool")}>
                      <div className="mx-cell-bold">
                        {resolveMarketplaceText(request.tool_title as any, locale) ||
                          readFirstString(request.tool_name) ||
                          "—"}
                      </div>
                      {tags.length > 0 && (
                        <div className="mx-card-tags mx-card-tags-inline">
                          {tags.slice(0, 3).map((t) => (
                            <span key={t} className="mx-tag mx-tag-compact">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {hasGuardInfo && (
                        <div className="mx-guard-summary">
                          <div>
                            {guardSlug ? `guard=${guardSlug}` : ""}
                            {guardSlug && guardOutcome ? " · " : ""}
                            {guardOutcome ? `outcome=${guardOutcome}` : ""}
                            {(guardSlug || guardOutcome) && guardReason ? " · " : ""}
                            {guardReason ? `reason=${guardReason}` : ""}
                          </div>
                          {guardActionHint && <div>{guardActionHint}</div>}
                          {guardAccessHint && (
                            <div>
                              {t(
                                "activity.current_access_detail",
                                { value: guardAccessHint },
                                "Current access: {value}",
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    {!hideVersions && (
                      <td
                        className="mx-cell-muted"
                        data-label={t("common.version", undefined, "Version")}
                      >
                        {readString(request.xapp_version)
                          ? `v${readString(request.xapp_version)}`
                          : "—"}
                      </td>
                    )}
                    <td data-label={t("common.status", undefined, "Status")}>
                      <StatusBadge status={readString(request.status)} />
                    </td>
                    <td
                      className="mx-cell-date"
                      data-label={t("common.created", undefined, "Created")}
                    >
                      {formatDateTime(request.created_at) || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mx-pagination">
          <Link
            to={
              {
                pathname: ".",
                search: `?${new URLSearchParams({
                  ...(xappIdFilter ? { xappId: xappIdFilter } : {}),
                  ...(token ? { token } : {}),
                  page: String(Math.max(1, pageParam - 1)),
                }).toString()}`,
              } as any
            }
            className={`mx-btn mx-btn-outline ${pageParam <= 1 || busy ? "is-disabled" : ""}`}
          >
            {t("common.previous", undefined, "Previous")}
          </Link>
          <span className="mx-pagination-info">
            {t(
              "activity.page_of",
              { page: pagination.page, totalPages: pagination.totalPages },
              `Page ${pagination.page} of ${pagination.totalPages}`,
            )}
          </span>
          <Link
            to={
              {
                pathname: ".",
                search: `?${new URLSearchParams({
                  ...(xappIdFilter ? { xappId: xappIdFilter } : {}),
                  ...(token ? { token } : {}),
                  page: String(Math.min(pagination.totalPages, pageParam + 1)),
                }).toString()}`,
              } as any
            }
            className={`mx-btn mx-btn-outline ${pageParam >= pagination.totalPages || busy ? "is-disabled" : ""}`}
          >
            {t("common.next", undefined, "Next")}
          </Link>
        </div>
      )}
    </div>
  );
}
