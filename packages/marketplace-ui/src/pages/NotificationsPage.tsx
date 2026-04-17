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

function StatusBadge({ status, unread }: { status: string; unread: boolean }) {
  const { t } = useMarketplaceI18n();
  if (unread) {
    return (
      <span className="mx-badge mx-badge-warning">{t("status.unread", undefined, "Unread")}</span>
    );
  }
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  const className = normalized === "COMPLETED" ? "mx-badge-success" : "mx-badge-danger";
  return (
    <span className={`mx-badge ${className}`}>
      {normalized || t("status.read", undefined, "Read")}
    </span>
  );
}

type NotificationRecord = Record<string, unknown>;

export function NotificationsPage() {
  const { client, host } = useMarketplace();
  const { locale, t } = useMarketplaceI18n();
  const token = useQueryToken();
  const loc = useLocation();
  const query = useQuery();

  const xappIdFilter = query.get("xappId") ?? "";
  const installationIdFilter = query.get("installationId") ?? "";
  const focusedNotificationId = query.get("notificationId") ?? "";
  const isEmbedded = typeof window !== "undefined" && window.location.pathname.startsWith("/embed");
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [focusedNotification, setFocusedNotification] = useState<NotificationRecord | null>(null);
  const [focusedError, setFocusedError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
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
    if (!client.listMyNotifications) {
      setError(
        t(
          "activity.unavailable_notifications_title",
          undefined,
          "Notifications are unavailable in this host.",
        ),
      );
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

  const clearHref = buildMarketplaceHref(loc.pathname, "notifications", { token });
  const listHref = buildMarketplaceHref(loc.pathname, "notifications", {
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
        <span>{t("activity.notifications_title", undefined, "Notifications")}</span>
      </div>

      <header className="mx-header">
        <div>
          <h1 className="mx-title">
            {t("activity.notifications_title", undefined, "Notifications")}
          </h1>
          {unreadCount > 0 ? (
            <div className="mx-subtle-note mx-subtle-note-compact">
              {t(
                "activity.unread_count",
                {
                  count: unreadCount,
                  suffix: unreadCount === 1 ? "" : "s",
                  suffix2: unreadCount === 1 ? "" : "e",
                },
                `${unreadCount} unread item${unreadCount === 1 ? "" : "s"}`,
              )}
            </div>
          ) : null}
        </div>
        <div className="mx-header-actions">
          <MarketplacePrimaryNav
            active="activity"
            isEmbedded={isEmbedded}
            tokenSearch={token ? `?token=${encodeURIComponent(token)}` : ""}
          />
          {client.markAllMyNotificationsRead && unreadCount > 0 && (
            <button className="mx-btn mx-btn-outline" onClick={() => void markAllRead()}>
              {t("activity.mark_all_read", undefined, "Mark all read")}
            </button>
          )}
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
          active="notifications"
          openWidgetId={xappDefaultWidgetId}
          openWidgetName={xappDefaultWidgetName}
          openToolName={xappDefaultToolName}
          openAppStrategy={xappOpenAppStrategy}
          onOpenApp={handleWorkspaceOpenApp}
        />
      ) : (
        <MarketplaceActivityTabs
          active="notifications"
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
          {t(
            "activity.showing_notifications_for_prefix",
            undefined,
            "Showing notification activity for",
          )}{" "}
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
              <div className="mx-record-panel-kicker">
                {t("activity.notification_detail", undefined, "Notification Detail")}
              </div>
              <div className="mx-record-panel-id">{focusedNotificationId}</div>
            </div>
            <Link to={listHref as any} className="mx-btn mx-btn-ghost">
              {t("activity.back_to_notification_list", undefined, "Back to notification list")}
            </Link>
          </div>
          {focusedError ? (
            <div className="mx-alert mx-alert-error mx-alert-panel">{focusedError}</div>
          ) : focusedNotification ? (
            <div className="mx-record-grid">
              <div className="mx-record-field">
                <div className="mx-record-label">{t("common.status", undefined, "Status")}</div>
                <div className="mx-record-value">
                  <StatusBadge
                    status={readString(focusedNotification.status)}
                    unread={Boolean(focusedNotification.unread)}
                  />
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">{t("common.trigger", undefined, "Trigger")}</div>
                <div className="mx-record-value is-strong">
                  {readFirstString(focusedNotification.trigger, "—")}
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">{t("common.channel", undefined, "Channel")}</div>
                <div className="mx-record-value is-strong">
                  {readFirstString(focusedNotification.channel, "—")}
                </div>
              </div>
              <div className="mx-record-field">
                <div className="mx-record-label">{t("common.received", undefined, "Received")}</div>
                <div className="mx-record-value">
                  {formatDateTime(focusedNotification.created_at) || "—"}
                </div>
              </div>
              <div className="mx-record-field is-span-full">
                <div className="mx-record-label">{t("common.message", undefined, "Message")}</div>
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
                      {t("common.request", undefined, "Request")}:{" "}
                      {readString(focusedNotification.request_id)}
                    </span>
                  ) : null}
                  {readString(focusedNotification.payment_session_id) ? (
                    <span className="mx-badge mx-badge-outline">
                      {t("common.payment", undefined, "Payment")}:{" "}
                      {readString(focusedNotification.payment_session_id)}
                    </span>
                  ) : null}
                  {readString(focusedNotification.reason) ? (
                    <span className="mx-badge mx-badge-outline">
                      {t("common.reason", undefined, "Reason")}:{" "}
                      {readString(focusedNotification.reason)}
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
                    {t("activity.mark_read", undefined, "Mark read")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-record-loading">
              <div className="mx-spinner" />
              <span>
                {t(
                  "activity.loading_notification_detail",
                  undefined,
                  "Loading notification details...",
                )}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mx-table-container">
        <table className="mx-table" data-responsive="cards">
          <thead>
            <tr>
              <th scope="col">{t("common.status", undefined, "Status")}</th>
              <th scope="col">{t("common.trigger", undefined, "Trigger")}</th>
              <th scope="col">{t("common.channel", undefined, "Channel")}</th>
              <th scope="col">{t("common.message", undefined, "Message")}</th>
              <th scope="col">{t("common.received", undefined, "Received")}</th>
              <th scope="col">{t("common.action", undefined, "Action")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className={busy ? "mx-table-loading-cell" : "mx-table-empty-cell"}>
                  {busy ? (
                    <div className="mx-loading-center mx-loading-table">
                      <div className="mx-spinner" />
                      <span>
                        {t("activity.loading_notifications", undefined, "Loading notifications...")}
                      </span>
                    </div>
                  ) : (
                    t("activity.no_notifications", undefined, "No notification activity found.")
                  )}
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={readFirstString(item.id, index)}>
                  <td data-label={t("common.status", undefined, "Status")}>
                    <StatusBadge status={readString(item.status)} unread={Boolean(item.unread)} />
                  </td>
                  <td data-label={t("common.trigger", undefined, "Trigger")}>
                    {readFirstString(item.trigger, "—")}
                  </td>
                  <td data-label={t("common.channel", undefined, "Channel")}>
                    {readFirstString(item.channel, "—")}
                  </td>
                  <td data-label={t("common.message", undefined, "Message")}>
                    {readFirstString(item.message, "—")}
                  </td>
                  <td
                    className="mx-cell-date"
                    data-label={t("common.received", undefined, "Received")}
                  >
                    {formatDateTime(item.created_at) || "—"}
                  </td>
                  <td data-label={t("common.action", undefined, "Action")}>
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
                        {t("common.details", undefined, "Details")}
                      </Link>
                      {Boolean(item.unread) && client.markMyNotificationRead ? (
                        <button
                          className="mx-btn mx-btn-outline mx-btn-sm"
                          onClick={() => void markRead(readString(item.id))}
                        >
                          {t("activity.mark_read", undefined, "Mark read")}
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
