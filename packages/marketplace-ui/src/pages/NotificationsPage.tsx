import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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

function StatusBadge({ status, unread }: { status: string; unread: boolean }) {
  if (unread) return <span className="mx-badge mx-badge-warning">Unread</span>;
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  const className = normalized === "COMPLETED" ? "mx-badge-success" : "mx-badge-danger";
  return <span className={`mx-badge ${className}`}>{normalized || "Read"}</span>;
}

type NotificationRecord = Record<string, unknown>;

export function NotificationsPage() {
  const { client, host } = useMarketplace();
  const token = useQueryToken();
  const query = useQuery();

  const xappIdFilter = query.get("xappId") ?? "";
  const installationIdFilter = query.get("installationId") ?? "";
  const focusedNotificationId = query.get("notificationId") ?? "";
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [focusedNotification, setFocusedNotification] = useState<NotificationRecord | null>(null);
  const [focusedError, setFocusedError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [xappTitle, setXappTitle] = useState("");

  const isEmbedded = typeof window !== "undefined" && window.location.pathname.startsWith("/embed");

  async function refresh() {
    if (!client.listMyNotifications) {
      setError("Notifications are unavailable in this host.");
      setItems([]);
      setUnreadCount(0);
      setBusy(false);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await client.listMyNotifications({
        notificationId: focusedNotificationId || undefined,
        xappId: xappIdFilter || undefined,
        installationId: installationIdFilter || undefined,
        limit: 50,
      });
      setItems(Array.isArray(res?.items) ? res.items.map((item) => asRecord(item)) : []);
      setUnreadCount(Number(res?.unread_count || 0));
    } catch (e) {
      setError(readFirstString(asRecord(e).message) || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function markRead(notificationId: string) {
    if (!client.markMyNotificationRead) return;
    try {
      const res = await client.markMyNotificationRead(notificationId);
      setItems((current) =>
        current.map((item) =>
          readString(item.id) === notificationId
            ? {
                ...item,
                unread: false,
                read_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      setFocusedNotification((current) =>
        current && readString(current.id) === notificationId
          ? {
              ...current,
              unread: false,
              read_at: new Date().toISOString(),
            }
          : current,
      );
      setUnreadCount(Number(res?.unread_count || 0));
    } catch (e) {
      setError(readFirstString(asRecord(e).message) || String(e));
    }
  }

  async function markAllRead() {
    if (!client.markAllMyNotificationsRead) return;
    try {
      const res = await client.markAllMyNotificationsRead();
      setItems((current) =>
        current.map((item) => ({
          ...item,
          unread: false,
          read_at: readString(item.read_at) || new Date().toISOString(),
        })),
      );
      setFocusedNotification((current) =>
        current
          ? {
              ...current,
              unread: false,
              read_at: readString(current.read_at) || new Date().toISOString(),
            }
          : current,
      );
      setUnreadCount(Number(res?.unread_count || 0));
    } catch (e) {
      setError(readFirstString(asRecord(e).message) || String(e));
    }
  }

  useEffect(() => {
    void refresh();
    host.notifyNavigation?.({
      path: typeof window !== "undefined" ? window.location.pathname : "",
      page: "notifications",
      params: { xappId: xappIdFilter || null },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedNotificationId, installationIdFilter, xappIdFilter]);

  useEffect(() => {
    if (!focusedNotificationId) {
      setFocusedNotification(null);
      setFocusedError(null);
      return;
    }
    let cancelled = false;
    setFocusedError(null);
    void (async () => {
      try {
        const res = await client.listMyNotifications?.({
          notificationId: focusedNotificationId,
          xappId: xappIdFilter || undefined,
          installationId: installationIdFilter || undefined,
          limit: 1,
        });
        if (cancelled) return;
        const item = Array.isArray(res?.items) ? asRecord(res.items[0]) : null;
        setFocusedNotification(item);
      } catch (e) {
        if (cancelled) return;
        setFocusedNotification(null);
        setFocusedError(readFirstString(asRecord(e).message) || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, focusedNotificationId, installationIdFilter, xappIdFilter]);

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
        setXappTitle(readFirstString(manifest.title, xapp.name));
      } catch {
        if (!alive) return;
        setXappTitle("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, xappIdFilter]);

  const xappLink = xappIdFilter
    ? ({
        pathname: isEmbedded
          ? `/xapps/${encodeURIComponent(String(xappIdFilter))}`
          : `/marketplace/xapps/${encodeURIComponent(String(xappIdFilter))}`,
        search: token ? `?token=${encodeURIComponent(token)}` : "",
      } as any)
    : null;

  const clearHref = {
    pathname: isEmbedded ? "/notifications" : "/marketplace/notifications",
    search: token ? `?token=${encodeURIComponent(token)}` : "",
  };
  const listHref = {
    pathname: isEmbedded ? "/notifications" : "/marketplace/notifications",
    search: (() => {
      const qs = new URLSearchParams();
      if (token) qs.set("token", token);
      if (xappIdFilter) qs.set("xappId", xappIdFilter);
      if (installationIdFilter) qs.set("installationId", installationIdFilter);
      const suffix = qs.toString();
      return suffix ? `?${suffix}` : "";
    })(),
  };

  const emptyState = error === "Subject required" || error === "Session token required";

  return (
    <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
      <div className="mx-breadcrumb">
        <Link to={isEmbedded ? "/" : "/marketplace"}>Marketplace</Link>
        {xappLink && (
          <>
            <span className="mx-breadcrumb-sep">/</span>
            <Link to={xappLink}>{xappTitle || xappIdFilter}</Link>
          </>
        )}
        <span className="mx-breadcrumb-sep">/</span>
        <span>Notifications</span>
      </div>

      <header className="mx-header">
        <div>
          <h1 className="mx-title">Notifications</h1>
          <div className="mx-subtle-note mx-subtle-note-compact">
            {unreadCount} unread item{unreadCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="mx-header-actions">
          <MarketplacePrimaryNav
            active="activity"
            isEmbedded={isEmbedded}
            tokenSearch={token ? `?token=${encodeURIComponent(token)}` : ""}
          />
          {client.markAllMyNotificationsRead && unreadCount > 0 && (
            <button className="mx-btn mx-btn-outline" onClick={() => void markAllRead()}>
              Mark all read
            </button>
          )}
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
        active="notifications"
        isEmbedded={isEmbedded}
        token={token}
        xappId={xappIdFilter || undefined}
        installationId={installationIdFilter || undefined}
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
          Showing notification activity for{" "}
          {xappLink ? (
            <Link to={xappLink} className="mx-subtle-note-link">
              {xappTitle || xappIdFilter}
            </Link>
          ) : (
            <span className="mx-subtle-note-strong">{xappTitle || xappIdFilter}</span>
          )}
        </div>
      )}

      {focusedNotificationId && (
        <div className="mx-record-panel">
          <div className="mx-record-panel-head">
            <div>
              <div className="mx-record-panel-kicker">Notification Detail</div>
              <div className="mx-record-panel-id">{focusedNotificationId}</div>
            </div>
            <Link to={listHref as any} className="mx-btn mx-btn-ghost">
              Back to notification list
            </Link>
          </div>
          {focusedError ? (
            <div className="mx-alert mx-alert-error mx-alert-panel">{focusedError}</div>
          ) : focusedNotification ? (
            <div className="mx-record-grid">
              <div className="mx-record-field">
                <div className="mx-record-label">Status</div>
                <div className="mx-record-value">
                  <StatusBadge
                    status={readString(focusedNotification.status)}
                    unread={Boolean(focusedNotification.unread)}
                  />
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">Trigger</div>
                <div className="mx-record-value is-strong">
                  {readFirstString(focusedNotification.trigger, "—")}
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">Channel</div>
                <div className="mx-record-value is-strong">
                  {readFirstString(focusedNotification.channel, "—")}
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">Received</div>
                <div className="mx-record-value">
                  {formatDateTime(focusedNotification.created_at) || "—"}
                </div>
              </div>
              <div className="mx-record-field is-span-full">
                <div className="mx-record-label">Message</div>
                <div className="mx-record-value">
                  {readFirstString(focusedNotification.message, "—")}
                </div>
              </div>
              {(readString(focusedNotification.request_id) ||
                readString(focusedNotification.payment_session_id) ||
                readString(focusedNotification.reason)) && (
                <div className="mx-record-pill-row">
                  {readString(focusedNotification.request_id) ? (
                    <span className="mx-badge mx-badge-outline">
                      Request: {readString(focusedNotification.request_id)}
                    </span>
                  ) : null}
                  {readString(focusedNotification.payment_session_id) ? (
                    <span className="mx-badge mx-badge-outline">
                      Payment: {readString(focusedNotification.payment_session_id)}
                    </span>
                  ) : null}
                  {readString(focusedNotification.reason) ? (
                    <span className="mx-badge mx-badge-outline">
                      Reason: {readString(focusedNotification.reason)}
                    </span>
                  ) : null}
                </div>
              )}
              {Boolean(focusedNotification.unread) && client.markMyNotificationRead ? (
                <div className="mx-record-actions">
                  <button
                    className="mx-btn mx-btn-outline mx-btn-sm"
                    onClick={() => void markRead(readString(focusedNotification.id))}
                  >
                    Mark read
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-record-loading">
              <div className="mx-spinner" />
              <span>Loading notification details...</span>
            </div>
          )}
        </div>
      )}

      <div className="mx-table-container">
        <table className="mx-table" data-responsive="cards">
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col">Trigger</th>
              <th scope="col">Channel</th>
              <th scope="col">Message</th>
              <th scope="col">Received</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className={busy ? "mx-table-loading-cell" : "mx-table-empty-cell"}>
                  {busy ? (
                    <div className="mx-loading-center mx-loading-table">
                      <div className="mx-spinner" />
                      <span>Loading notifications...</span>
                    </div>
                  ) : (
                    "No notification activity found."
                  )}
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={readFirstString(item.id, index)}>
                  <td data-label="Status">
                    <StatusBadge status={readString(item.status)} unread={Boolean(item.unread)} />
                  </td>
                  <td data-label="Trigger">{readFirstString(item.trigger, "—")}</td>
                  <td data-label="Channel">{readFirstString(item.channel, "—")}</td>
                  <td data-label="Message">{readFirstString(item.message, "—")}</td>
                  <td className="mx-cell-date" data-label="Received">
                    {formatDateTime(item.created_at) || "—"}
                  </td>
                  <td data-label="Action">
                    <div className="mx-action-group">
                      <Link
                        to={
                          {
                            pathname: isEmbedded ? "/notifications" : "/marketplace/notifications",
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
                              if (item.id) qs.set("notificationId", String(item.id));
                              return `?${qs.toString()}`;
                            })(),
                          } as any
                        }
                        className="mx-btn mx-btn-outline mx-btn-sm"
                      >
                        Details
                      </Link>
                      {Boolean(item.unread) && client.markMyNotificationRead ? (
                        <button
                          className="mx-btn mx-btn-outline mx-btn-sm"
                          onClick={() => void markRead(readString(item.id))}
                        >
                          Mark read
                        </button>
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
