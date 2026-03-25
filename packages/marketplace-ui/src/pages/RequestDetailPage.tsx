import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMarketplace } from "../MarketplaceContext";
import { SchemaOutputView } from "../components/SchemaOutputView";
import {
  resolvePaymentLockStateFromGuardSummary,
  type PaymentReconcileState,
} from "../utils/paymentLock";
import { buildTokenSearch, readHostReturnUrl } from "../utils/embedSearch";
import {
  asRecord,
  formatDateTime,
  parseDateValue,
  readFirstString,
  readString,
} from "../utils/readers";
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

export function RequestDetailPage() {
  const { client, host, env } = useMarketplace();
  const { id } = useParams();
  const token = useQueryToken();
  const query = useQuery();
  const loc = useLocation();
  const navigate = useNavigate();
  const xappIdFilter = query.get("xappId") ?? "";

  const tokenSearch = buildTokenSearch(token, loc.search);

  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [reconcileState, setReconcileState] = useState<PaymentReconcileState>("none");
  const dataRecord = asRecord(data);
  const requestRecord = asRecord(dataRecord.request);
  const toolRecord = asRecord(dataRecord.tool);
  const status = readFirstString(requestRecord.status) || undefined;
  const isTerminal = status === "COMPLETED" || status === "FAILED";
  const effectiveXappId = readFirstString(requestRecord.xapp_id, xappIdFilter);
  const effectiveXappTitle = readFirstString(requestRecord.xapp_name);
  const xappCrumbLabel = effectiveXappTitle || effectiveXappId;
  const isEmbedded = typeof window !== "undefined" && window.location.pathname.startsWith("/embed");

  const marketplaceTo = {
    pathname: isEmbedded ? "/" : "/marketplace",
    search: tokenSearch,
  };

  const xappTo = effectiveXappId
    ? ({
        pathname: isEmbedded
          ? `/xapps/${encodeURIComponent(effectiveXappId)}`
          : `/marketplace/xapps/${encodeURIComponent(effectiveXappId)}`,
        search: tokenSearch,
      } as any)
    : null;

  const backToRequests = {
    pathname: isEmbedded ? "/requests" : "/marketplace/requests",
    search: `?${new URLSearchParams({
      ...(xappIdFilter ? { xappId: xappIdFilter } : {}),
      ...(token ? { token } : {}),
      ...(readHostReturnUrl(loc.search)
        ? { xapps_host_return_url: readHostReturnUrl(loc.search) }
        : {}),
    }).toString()}`,
  };

  async function refreshOnce() {
    if (!id) return;
    setError(null);
    setBusy(true);
    try {
      const res = await client.getMyRequest(String(id));
      setData(res);
      if (
        !resolvePaymentLockStateFromGuardSummary(
          asRecord(asRecord(res).request).guard_summary ?? null,
        ).isLocked
      ) {
        setReconcileState("confirmed_paid");
      }
    } catch (e) {
      setError(readFirstString(asRecord(e).message) || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function reconcilePaymentFinality() {
    if (!id || reconcileBusy || !client.reconcileMyRequestPayment) return;
    setReconcileError(null);
    setReconcileState("confirming_payment");
    setReconcileBusy(true);
    try {
      const res = await client.reconcileMyRequestPayment({
        requestId: String(id),
        paymentSessionId: requestPaymentLock.paymentSessionId,
      });
      setReconcileState(res?.finality_state || "none");
      const redirectUrl = String(res?.redirect_url || "").trim();
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      await refreshOnce();
    } catch (e) {
      setReconcileError(readFirstString(asRecord(e).message) || String(e));
      setReconcileState("failed");
    } finally {
      setReconcileBusy(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    host.notifyNavigation?.({
      path: typeof window !== "undefined" ? window.location.pathname : "",
      page: "request-detail",
      params: { id },
    });

    void refreshOnce();

    timer = setInterval(async () => {
      try {
        const res = await client.getMyRequest(String(id));
        if (!alive) return;
        setData(res);
        const s = asRecord(asRecord(res).request).status;
        if (s === "COMPLETED" || s === "FAILED") {
          if (timer) clearInterval(timer);
        }
      } catch {
        // ignore background polling errors
      }
    }, 1500);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const emptyState = error === "Subject required" || error === "Session token required";

  const title = readFirstString(toolRecord.title, requestRecord.tool_name) || "Request Details";
  const artifacts = Array.isArray(dataRecord.artifacts) ? dataRecord.artifacts : [];

  function attachArtifactLinks(value: unknown, arts: unknown[]): unknown {
    if (typeof value === "string") {
      const match = arts.map(asRecord).find((a) => readString(a.filename) === value);
      if (readString(match?.url)) {
        return {
          filename: readFirstString(match?.filename, value),
          url: readString(match?.url),
          mimeType: readString(match?.mime_type) || undefined,
        };
      }
    }
    if (Array.isArray(value)) {
      return value.map((item) => attachArtifactLinks(item, arts));
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    const record = asRecord(value);
    const filename = readString(record.filename) || null;
    if (filename && !readString(record.url)) {
      const match = arts.map(asRecord).find((a) => readString(a.filename) === filename);
      if (readString(match?.url)) {
        return {
          ...record,
          url: readString(match?.url),
          mimeType: record.mimeType ?? match?.mime_type,
        };
      }
    }
    const next: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      next[key] = attachArtifactLinks(val, arts);
    }
    return next;
  }

  if (env?.requestsEnabled === false) {
    const backToX = {
      pathname: isEmbedded ? "/" : "/marketplace",
      search: token ? `?token=${encodeURIComponent(token)}` : "",
    };
    return (
      <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
        <div className="mx-table-container mx-unavailable">
          <h2 className="mx-title mx-unavailable-title">Requests are unavailable</h2>
          <p className="mx-unavailable-desc">
            This public catalog does not support viewing personal requests.
          </p>
          <Link to={backToX as any} className="mx-btn mx-btn-primary">
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  const responsePayload = useMemo(
    () => attachArtifactLinks(dataRecord.response ?? null, artifacts),
    [dataRecord, artifacts],
  );

  const outputSchema = useMemo(() => {
    const schema = toolRecord.output_schema;
    return schema && typeof schema === "object" ? asRecord(schema) : null;
  }, [toolRecord]);
  const requestPaymentLock = useMemo(
    () =>
      resolvePaymentLockStateFromGuardSummary(requestRecord.guard_summary ?? null, {
        reconcileState,
      }),
    [requestRecord.guard_summary, reconcileState],
  );

  function getEventPayload(ev: unknown): unknown | null {
    const eventRecord = asRecord(ev);
    if (!Object.keys(eventRecord).length) return null;
    const keys = ["data", "payload", "details", "detail", "meta", "extra", "context"];
    for (const k of keys) {
      const v = eventRecord[k];
      if (v !== undefined) return v;
    }
    const err = asRecord(eventRecord.error);
    if (Object.keys(err).length) {
      if (err.details) return err.details;
      if (err.data) return err.data;
      if (err.meta) return err.meta;
    }
    return null;
  }

  function extractGuardSummary(payload: unknown): {
    trigger: string;
    outcome: string;
    guardSlug: string;
    reason: string;
    actionKind: string;
    actionUrl: string;
    actionMessage: string;
  } | null {
    const p = asRecord(payload);
    const guard = asRecord(p.guard);
    const topAction = asRecord(p.action);
    const guardAction = asRecord(guard.action);
    const action = Object.keys(topAction).length > 0 ? topAction : guardAction;

    const trigger =
      readString(p.trigger) || readString(p.guardTrigger) || readString(p.guard_trigger);
    const outcome =
      readString(p.outcome) || readString(p.guardOutcome) || readString(p.guard_outcome);
    const guardSlug = readString(guard.slug) || readString(p.guardSlug) || readString(p.guard_slug);
    const reason =
      readString(guard.reason) ||
      readString(p.reason) ||
      readString(p.guardReason) ||
      readString(p.guard_reason);
    const actionKind = readString(action.kind);
    const actionUrl = readString(action.url);
    const actionMessage = readString(action.message);

    if (!trigger && !outcome && !guardSlug && !reason && !actionKind) return null;
    return { trigger, outcome, guardSlug, reason, actionKind, actionUrl, actionMessage };
  }

  function renderGuardActionLabel(summary: ReturnType<typeof extractGuardSummary>): string {
    if (!summary) return "";
    if (summary.actionKind === "upgrade_subscription") {
      return `Upgrade subscription${summary.actionUrl ? ` (${summary.actionUrl})` : ""}`;
    }
    if (summary.actionKind === "complete_payment") {
      return `Complete payment${summary.actionUrl ? ` (${summary.actionUrl})` : ""}`;
    }
    if (summary.actionKind === "step_up_auth") {
      return `Complete step-up authentication${summary.actionUrl ? ` (${summary.actionUrl})` : ""}`;
    }
    if (summary.actionKind === "confirm_action") {
      return summary.actionMessage ? `Confirm action (${summary.actionMessage})` : "Confirm action";
    }
    return summary.actionKind ? `Action: ${summary.actionKind}` : "";
  }

  function relativeTime(dateValue: unknown): string {
    try {
      const parsed = parseDateValue(dateValue);
      if (!parsed) return "";
      const now = Date.now();
      const then = parsed.getTime();
      if (Number.isNaN(then)) return "";
      const diff = now - then;
      if (diff < 0) return "just now";
      const seconds = Math.floor(diff / 1000);
      if (seconds < 10) return "just now";
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return "";
    }
  }

  const [expandedPayloads, setExpandedPayloads] = useState<Record<number, boolean>>({});
  const [timelineOpen, setTimelineOpen] = useState(false);

  function togglePayload(idx: number) {
    setExpandedPayloads((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  function renderEventPayload(ev: unknown, idx: number) {
    const raw = getEventPayload(ev);
    if (raw == null) return null;
    const enriched = attachArtifactLinks(raw, artifacts);
    const isOpen = expandedPayloads[idx] ?? false;
    return (
      <>
        <button
          className={`mx-event-payload-toggle ${isOpen ? "is-open" : ""}`}
          onClick={() => togglePayload(idx)}
          type="button"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {isOpen ? "Hide details" : "Show details"}
        </button>
        {isOpen && (
          <div className="mx-event-payload-body">
            <SchemaOutputView schema={null} value={enriched} />
          </div>
        )}
      </>
    );
  }

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

  return (
    <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
      <div className="mx-breadcrumb">
        {!env?.singleXappMode && <Link to={marketplaceTo as any}>Marketplace</Link>}
        {env?.singleXappMode && !env?.embedMode && (
          <Link to={marketplaceTo as any}>Marketplace</Link>
        )}
        {xappTo && (
          <>
            {(!env?.singleXappMode || (env?.singleXappMode && !env?.embedMode)) && (
              <span className="mx-breadcrumb-sep">/</span>
            )}
            <Link to={xappTo}>{xappCrumbLabel}</Link>
          </>
        )}
        <span className="mx-breadcrumb-sep">/</span>
        <Link to={backToRequests as any}>Requests</Link>
        <span className="mx-breadcrumb-sep">/</span>
        <span className="mx-cell-mono">{id?.slice(0, 8)}</span>
      </div>

      <header className="mx-header">
        <h1 className="mx-title">Request Details</h1>
        <div className="mx-header-actions">
          <button
            className={`mx-btn-icon ${busy ? "is-spinning" : ""}`}
            onClick={() => void refreshOnce()}
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

      {busy && !data ? (
        <div className="mx-request-detail-skeleton">
          <div className="mx-request-detail-skeleton-section">
            <div className="mx-skeleton-line mx-skeleton-line-title" />
            <div className="mx-skeleton-line mx-skeleton-line-sm" />
            <div className="mx-skeleton-meta-grid">
              <div className="mx-skeleton-line mx-skeleton-line-full" />
              <div className="mx-skeleton-line mx-skeleton-line-full" />
              <div className="mx-skeleton-line mx-skeleton-line-full" />
            </div>
          </div>
          <div className="mx-request-detail-skeleton-section">
            <div className="mx-skeleton-line mx-skeleton-line-title" />
            <div className="mx-skeleton-line mx-skeleton-line-full" />
            <div className="mx-skeleton-line mx-skeleton-line-short" />
          </div>
        </div>
      ) : (
        <div className="mx-detail-grid">
          <div className="mx-detail-main">
            <section className="mx-table-container mx-request-section">
              <div className="mx-request-section-head">
                <div>
                  <h2 className="mx-title mx-request-section-title">{title}</h2>
                  <div className="mx-request-meta-row">
                    <span>{readString(requestRecord.xapp_name)}</span>
                    {readString(requestRecord.xapp_version) && (
                      <>
                        <span>·</span>
                        <span>v{readString(requestRecord.xapp_version)}</span>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={status ?? ""} />
              </div>

              <div className="mx-request-meta-grid">
                <div className="mx-meta-item">
                  <span className="mx-meta-label">Request ID</span>
                  <code className="mx-request-code">{id}</code>
                </div>
                <div className="mx-meta-item">
                  <span className="mx-meta-label">Tool</span>
                  <span className="mx-meta-value">
                    {readFirstString(requestRecord.tool_name) || "—"}
                  </span>
                </div>
                <div className="mx-meta-item">
                  <span className="mx-meta-label">Created</span>
                  <span className="mx-meta-value">
                    {formatDateTime(requestRecord.created_at) || "—"}
                  </span>
                </div>
                {readString(requestRecord.completed_at) && (
                  <div className="mx-meta-item">
                    <span className="mx-meta-label">Completed</span>
                    <span className="mx-meta-value">
                      {formatDateTime(requestRecord.completed_at) || "—"}
                    </span>
                  </div>
                )}
              </div>
            </section>

            <section className="mx-table-container mx-request-section">
              <h3 className="mx-section-title mx-section-title-md">Response</h3>
              {requestPaymentLock.isLocked && requestPaymentLock.actionUrl ? (
                <div className="mx-payment-lock-banner">
                  <div className="mx-payment-lock-title">Payment Required</div>
                  <div className="mx-payment-lock-message">{requestPaymentLock.message}</div>
                  <div className="mx-payment-lock-actions">
                    <button
                      className="mx-btn mx-btn-primary"
                      onClick={() => {
                        window.location.href = requestPaymentLock.actionUrl;
                      }}
                    >
                      {requestPaymentLock.ctaLabel || "Complete Payment"}
                    </button>
                    {client.reconcileMyRequestPayment && requestPaymentLock.paymentSessionId ? (
                      <button
                        className="mx-btn mx-btn-secondary"
                        onClick={() => void reconcilePaymentFinality()}
                        disabled={
                          reconcileBusy || requestPaymentLock.reconcileState === "confirmed_paid"
                        }
                      >
                        {reconcileBusy ? "Confirming..." : "Confirm Payment"}
                      </button>
                    ) : null}
                    <button className="mx-btn mx-btn-secondary" onClick={() => void refreshOnce()}>
                      Refresh Status
                    </button>
                  </div>
                  {reconcileError ? (
                    <div className="mx-payment-lock-error">{reconcileError}</div>
                  ) : null}
                </div>
              ) : null}
              {!isTerminal ? (
                <div className="mx-waiting-state">Waiting for response…</div>
              ) : (
                <SchemaOutputView schema={outputSchema} value={responsePayload} />
              )}
            </section>

            {Array.isArray(dataRecord.events) &&
              dataRecord.events.length > 0 &&
              (() => {
                const evts = dataRecord.events;
                const classifyEvent = (ev: unknown) => {
                  const t = readString(asRecord(ev).type).toLowerCase();
                  if (t.includes("fail") || t.includes("error") || t.includes("exception"))
                    return "error";
                  if (t.includes("warn") || t.includes("retry")) return "warn";
                  if (t.includes("complet") || t.includes("success") || t.includes("done"))
                    return "success";
                  return "default";
                };
                const errorCount = evts.filter((e) => classifyEvent(e) === "error").length;
                const successCount = evts.filter((e) => classifyEvent(e) === "success").length;
                const firstTs = parseDateValue(asRecord(evts[0]).created_at);
                const lastTs = parseDateValue(asRecord(evts[evts.length - 1]).created_at);
                let durationLabel = "";
                if (firstTs && lastTs) {
                  const ms = Math.abs(lastTs.getTime() - firstTs.getTime());
                  if (ms < 1000) durationLabel = `${ms}ms`;
                  else if (ms < 60_000) durationLabel = `${(ms / 1000).toFixed(1)}s`;
                  else durationLabel = `${(ms / 60_000).toFixed(1)}m`;
                }
                return (
                  <section className="mx-table-container mx-request-section">
                    <button
                      type="button"
                      className="mx-timeline-toggle"
                      onClick={() => setTimelineOpen((v) => !v)}
                      aria-expanded={timelineOpen}
                    >
                      <svg
                        className={`mx-timeline-chevron ${timelineOpen ? "is-open" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <div className="mx-timeline-toggle-content">
                        <div className="mx-timeline-toggle-top">
                          <h3 className="mx-section-title mx-section-title-md mx-section-title-tight">
                            Execution Timeline
                          </h3>
                          <span className="mx-timeline-count">
                            {evts.length} event{evts.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {!timelineOpen && (
                          <div className="mx-timeline-summary">
                            <div className="mx-timeline-dots">
                              {evts.map((ev, i: number) => (
                                <span
                                  key={i}
                                  className={`mx-timeline-mini-dot mx-timeline-mini-dot-${classifyEvent(ev)}`}
                                />
                              ))}
                            </div>
                            <div className="mx-timeline-summary-stats">
                              {errorCount > 0 && (
                                <span className="mx-timeline-stat mx-timeline-stat-error">
                                  {errorCount} err
                                </span>
                              )}
                              {durationLabel && (
                                <span className="mx-timeline-stat mx-timeline-stat-duration">
                                  {durationLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                    {timelineOpen && (
                      <ol className="mx-timeline">
                        {dataRecord.events.map((ev, idx: number) => {
                          const eventRecord = asRecord(ev);
                          const typeText = readFirstString(eventRecord.type) || "event";
                          const lower = typeText.toLowerCase();
                          const isErr =
                            lower.includes("fail") ||
                            lower.includes("error") ||
                            lower.includes("exception");
                          const isWarn = lower.includes("warn") || lower.includes("retry");
                          const isComplete =
                            lower.includes("complet") ||
                            lower.includes("success") ||
                            lower.includes("done");

                          const dotClass = isErr
                            ? "mx-timeline-dot-error"
                            : isWarn
                              ? "mx-timeline-dot-warn"
                              : isComplete
                                ? "mx-timeline-dot-success"
                                : "mx-timeline-dot-default";

                          const progress =
                            typeof eventRecord.progress === "number" ? eventRecord.progress : null;
                          const guardSummary =
                            extractGuardSummary(ev) ??
                            extractGuardSummary(getEventPayload(ev)) ??
                            extractGuardSummary(eventRecord.payload);
                          const guardActionLabel = renderGuardActionLabel(guardSummary);

                          return (
                            <li
                              key={readFirstString(eventRecord.id) || String(idx)}
                              className="mx-timeline-item"
                            >
                              <div className={`mx-timeline-dot ${dotClass}`}>
                                {isErr ? (
                                  <svg
                                    className="mx-timeline-dot-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                  >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                ) : isComplete ? (
                                  <svg
                                    className="mx-timeline-dot-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : isWarn ? (
                                  <svg
                                    className="mx-timeline-dot-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                  >
                                    <line x1="12" y1="8" x2="12" y2="13" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                  </svg>
                                ) : null}
                              </div>
                              <div
                                className={`mx-event-card ${isErr ? "mx-event-card-error" : isWarn ? "mx-event-card-warn" : ""}`}
                              >
                                <div className="mx-event-head">
                                  <div
                                    className={`mx-event-type ${isErr ? "mx-event-type-error" : isWarn ? "mx-event-type-warn" : ""}`}
                                  >
                                    {typeText}
                                    {readString(eventRecord.code) && (
                                      <span className="mx-event-code">
                                        {readString(eventRecord.code)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mx-event-time">
                                    <div className="mx-event-date">
                                      {formatDateTime(eventRecord.created_at)}
                                    </div>
                                    {parseDateValue(eventRecord.created_at) && (
                                      <div className="mx-event-relative">
                                        {relativeTime(eventRecord.created_at)}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {readString(eventRecord.message) && (
                                  <div className="mx-event-message">
                                    {readString(eventRecord.message)}
                                  </div>
                                )}

                                {guardSummary && (
                                  <div className="mx-event-guard">
                                    <div className="mx-event-guard-badges">
                                      {guardSummary.guardSlug && (
                                        <span className="mx-badge">
                                          guard: {guardSummary.guardSlug}
                                        </span>
                                      )}
                                      {guardSummary.trigger && (
                                        <span className="mx-badge mx-badge-warning">
                                          trigger: {guardSummary.trigger}
                                        </span>
                                      )}
                                      {guardSummary.outcome && (
                                        <span className="mx-badge mx-badge-success">
                                          outcome: {guardSummary.outcome}
                                        </span>
                                      )}
                                    </div>
                                    {(guardSummary.reason || guardActionLabel) && (
                                      <div className="mx-event-guard-detail">
                                        {guardSummary.reason ? `reason=${guardSummary.reason}` : ""}
                                        {guardSummary.reason && guardActionLabel ? " · " : ""}
                                        {guardActionLabel}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {progress != null && (
                                  <div className="mx-event-progress-track">
                                    <div
                                      className={`mx-event-progress-bar ${isErr ? "mx-event-progress-error" : "mx-event-progress-default"}`}
                                      style={{
                                        width: `${Math.max(0, Math.min(100, progress <= 1 ? progress * 100 : progress))}%`,
                                      }}
                                    />
                                  </div>
                                )}

                                {renderEventPayload(ev, idx)}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </section>
                );
              })()}
          </div>

          <aside className="mx-detail-sidebar">
            {artifacts.length > 0 && (
              <div className="mx-sidebar-card">
                <h3 className="mx-section-title mx-detail-sidebar-title">Artifacts</h3>
                <div className="mx-sidebar-stack">
                  {artifacts.map((a) => {
                    const artifact = asRecord(a);
                    return (
                      <a
                        key={readFirstString(artifact.id, artifact.url, artifact.filename)}
                        href={readFirstString(artifact.url) || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="mx-btn mx-btn-outline mx-sidebar-artifact-link"
                      >
                        {readFirstString(artifact.filename) || "Download Artifact"}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {readString(requestRecord.installation_id) &&
              Array.isArray(dataRecord.widgets) &&
              dataRecord.widgets.length > 0 && (
                <div className="mx-sidebar-card">
                  <h3 className="mx-section-title mx-detail-sidebar-title">Related Widgets</h3>
                  <div className="mx-sidebar-stack">
                    {(Array.isArray(dataRecord.widgets) ? dataRecord.widgets : []).map((w) => {
                      const widget = asRecord(w);
                      return (
                        <button
                          key={readFirstString(widget.id)}
                          className="mx-btn mx-btn-primary mx-btn-sidebar"
                          onClick={() => {
                            const installationId = readFirstString(requestRecord.installation_id);
                            const widgetId = readFirstString(widget.id);
                            const widgetName =
                              readFirstString(widget.title, widget.widget_name) || "Widget";
                            if (!installationId || !widgetId) return;

                            if (env?.embedMode) {
                              navigate({
                                pathname: isEmbedded
                                  ? `/widget/${encodeURIComponent(installationId)}/${encodeURIComponent(widgetId)}`
                                  : `/marketplace/widget/${encodeURIComponent(installationId)}/${encodeURIComponent(widgetId)}`,
                                search: tokenSearch,
                              });
                              return;
                            }

                            host.openWidget({
                              installationId,
                              widgetId,
                              xappId: readString(requestRecord.xapp_id),
                              xappTitle: readString(requestRecord.xapp_name),
                              widgetName,
                              toolName: readString(requestRecord.tool_name),
                            });
                          }}
                        >
                          Open {readFirstString(widget.title, widget.widget_name) || "Widget"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            <div className="mx-sidebar-card">
              <h3 className="mx-section-title mx-detail-sidebar-title">Help</h3>
              <p className="mx-sidebar-help-text">
                Need help with this request? Contact your administrator with the Request ID above.
              </p>
              <Link to={backToRequests as any} className="mx-btn mx-btn-outline mx-btn-sidebar">
                Back to Requests
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
