import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMarketplace } from "../MarketplaceContext";
import { MarketplaceActivityTabs } from "../components/MarketplaceActivityTabs";
import { MarketplacePrimaryNav } from "../components/MarketplacePrimaryNav";
import { asRecord, formatDateTime, readFirstString, readString } from "../utils/readers";
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
  const url = readString(action.url);
  if (kind === "upgrade_subscription") return `Upgrade subscription${url ? ` (${url})` : ""}`;
  if (kind === "complete_payment") return `Complete payment${url ? ` (${url})` : ""}`;
  if (kind === "step_up_auth") return `Complete step-up authentication${url ? ` (${url})` : ""}`;
  if (kind === "confirm_action") {
    const msg = readString(action.message);
    return msg ? `Confirm action (${msg})` : "Confirm action";
  }
  return kind ? `Action: ${kind}` : "";
}

export function RequestsPage() {
  const { client, host, env } = useMarketplace();
  const token = useQueryToken();
  const query = useQuery();

  const xappIdFilter = query.get("xappId") ?? "";
  const pageParam = Math.max(1, parseInt(query.get("page") ?? "1", 10) || 1);

  const [items, setItems] = useState<unknown[]>([]);
  const [pagination, setPagination] = useState<RequestListPagination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [xappTitle, setXappTitle] = useState<string>("");

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
      return;
    }

    let alive = true;
    void (async () => {
      try {
        const res = await client.getCatalogXapp(String(xappIdFilter));
        const detail = asRecord(res);
        const name = readFirstString(asRecord(detail.xapp).name, asRecord(detail.manifest).title);
        if (!alive) return;
        setXappTitle(name);
      } catch {
        if (!alive) return;
        setXappTitle("");
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xappIdFilter]);

  const isEmbedded = window.location.pathname.startsWith("/embed");

  const xappLink = xappIdFilter
    ? ({
        pathname: isEmbedded
          ? `/xapps/${encodeURIComponent(String(xappIdFilter))}`
          : `/marketplace/xapps/${encodeURIComponent(String(xappIdFilter))}`,
        search: token ? `?token=${encodeURIComponent(token)}` : "",
      } as any)
    : null;

  const backToContext =
    xappIdFilter && xappLink
      ? xappLink
      : {
          pathname: isEmbedded ? "" : "/marketplace",
          search: token ? `?token=${encodeURIComponent(token)}` : "",
        };

  const emptyState = error === "Subject required" || error === "Session token required";

  const clearHref = {
    pathname: isEmbedded ? "/requests" : "/marketplace/requests",
    search: token ? `?token=${encodeURIComponent(token)}` : "",
  };

  function StatusBadge({ status }: { status: string }) {
    const s = String(status || "");
    const className =
      s === "COMPLETED"
        ? "mx-badge-success"
        : s === "FAILED"
          ? "mx-badge-danger"
          : "mx-badge-warning";
    return <span className={`mx-badge ${className}`}>{s || "—"}</span>;
  }

  if (env?.requestsEnabled === false) {
    return (
      <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
        <div className="mx-table-container mx-unavailable">
          <h2 className="mx-title mx-unavailable-title">Requests are unavailable</h2>
          <p className="mx-unavailable-desc">
            This public catalog does not support viewing personal requests.
          </p>
          <Link to={backToContext as any} className="mx-btn mx-btn-primary">
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
      <div className="mx-breadcrumb">
        {!env?.singleXappMode && <Link to={isEmbedded ? "/" : "/marketplace"}>Marketplace</Link>}
        {env?.singleXappMode && !isEmbedded && (
          <Link to={isEmbedded ? "/" : "/marketplace"}>Marketplace</Link>
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
        <span>Requests</span>
      </div>

      <header className="mx-header">
        <h1 className="mx-title">Requests</h1>
        <div className="mx-header-actions">
          <MarketplacePrimaryNav
            active="activity"
            isEmbedded={isEmbedded}
            tokenSearch={token ? `?token=${encodeURIComponent(token)}` : ""}
          />
          {xappIdFilter && (
            <Link to={clearHref as any} className="mx-btn mx-btn-ghost">
              Clear Filter
            </Link>
          )}
          <button
            className={`mx-btn-icon ${busy ? "is-spinning" : ""}`}
            onClick={() => void refresh()}
            disabled={busy}
            title="Refresh"
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
        active="requests"
        isEmbedded={isEmbedded}
        token={token}
        xappId={xappIdFilter || undefined}
      />

      {emptyState ? (
        <div className="mx-table-container mx-alert mx-alert-info">
          <div className="mx-alert-subject-title">Subject required</div>
          <div className="mx-alert-subject-desc">
            This host session is not associated with a user. Ask your host to create a catalog
            session with a <code>subjectId</code>.
          </div>
        </div>
      ) : error ? (
        <div className="mx-table-container mx-alert mx-alert-error">{error}</div>
      ) : null}

      {xappIdFilter && (
        <div className="mx-subtle-note">
          Showing requests for{" "}
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
              <th scope="col">ID</th>
              <th scope="col">Tool</th>
              <th scope="col">Version</th>
              <th scope="col">Status</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  data-label="State"
                  className={busy ? "mx-table-loading-cell" : "mx-table-empty-cell"}
                >
                  {busy ? (
                    <div className="mx-loading-center mx-loading-table">
                      <div className="mx-spinner" />
                      <span>Loading requests...</span>
                    </div>
                  ) : (
                    "No requests yet."
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
                const hasGuardInfo =
                  Boolean(guardSlug) || Boolean(guardReason) || Boolean(guardActionHint);

                return (
                  <tr key={readFirstString(request.id)}>
                    <td className="mx-cell-id" data-label="ID">
                      <Link to={href as any}>{readFirstString(request.id).slice(0, 8)}...</Link>
                    </td>
                    <td data-label="Tool">
                      <div className="mx-cell-bold">
                        {readFirstString(request.tool_name) || "—"}
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
                        </div>
                      )}
                    </td>
                    <td className="mx-cell-muted" data-label="Version">
                      {readString(request.xapp_version)
                        ? `v${readString(request.xapp_version)}`
                        : "—"}
                    </td>
                    <td data-label="Status">
                      <StatusBadge status={readString(request.status)} />
                    </td>
                    <td className="mx-cell-date" data-label="Created">
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
            Previous
          </Link>
          <span className="mx-pagination-info">
            Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
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
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
