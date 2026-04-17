import { summarizeXappMonetizationSnapshot } from "@xapps-platform/browser-host/xms";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMarketplace } from "../MarketplaceContext";
import { resolveMarketplaceText, useMarketplaceI18n } from "../i18n";
import { MarketplaceActivityTabs } from "../components/MarketplaceActivityTabs";
import { MarketplacePrimaryNav } from "../components/MarketplacePrimaryNav";
import { XappWorkspaceNav } from "../components/XappWorkspaceNav";
import type { CatalogXappDetail, InstallationInfo } from "../types";
import { buildMarketplaceHref } from "../utils/marketplaceRouting";
import { asRecord, readFirstString, readString } from "../utils/readers";
import { readDefaultWidgetMeta } from "../utils/xappWorkspace";
import "../marketplace.css";

type MonetizationCard = {
  xappId: string;
  installationId?: string;
  title: string;
  subtitle: string;
  detailHref: { pathname: string; search: string };
  plansHref: { pathname: string; search: string };
  historyHref: { pathname: string; search: string };
  accessLabel: string;
  tierLabel: string;
  sourceLabel: string;
  subscriptionStatus: string;
  subscriptionCoverage: string;
  renewsAt: string;
  virtualCurrencyLabel: string;
  balanceTitle: string;
  creditsRemaining: string;
  balanceState: string;
  hasSubscription: boolean;
  hasNamedCurrency: boolean;
  hasBalance: boolean;
};

function formatVirtualCurrencyLabel(input: unknown, options?: { includeCode?: boolean }): string {
  const record = asRecord(input);
  const code = readString(record.code);
  const name = readString(record.name);
  if (name && code && options?.includeCode) return `${name} (${code})`;
  return name || code || "";
}

function formatVirtualCurrencyAmount(value: unknown, virtualCurrency: unknown): string {
  const amount = readString(value);
  if (!amount) return "";
  const currencyLabel = formatVirtualCurrencyLabel(virtualCurrency);
  return currencyLabel ? `${amount} ${currencyLabel}` : amount;
}

function useQueryToken(): string {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  return qs.get("token") ?? "";
}

function useQuery(): URLSearchParams {
  const loc = useLocation();
  return useMemo(() => new URLSearchParams(loc.search), [loc.search]);
}

function isMonetizationCandidate(detail: CatalogXappDetail | null | undefined): boolean {
  const record = asRecord(detail);
  const operational = asRecord(record.operational_surfaces);
  if (asRecord(operational.monetization).enabled === true) return true;
  const manifest = asRecord(record.manifest);
  if (manifest.monetization && typeof manifest.monetization === "object") return true;
  return (
    Array.isArray(manifest.payment_guard_definitions) &&
    manifest.payment_guard_definitions.length > 0
  );
}

function buildXappRoute(input: {
  xappId: string;
  token: string;
  isEmbedded: boolean;
  installationId?: string;
}): { pathname: string; search: string } {
  const params = new URLSearchParams();
  if (input.token) params.set("token", input.token);
  if (input.installationId) params.set("installationId", input.installationId);
  const suffix = params.toString();
  return {
    pathname: input.isEmbedded
      ? `/xapps/${encodeURIComponent(input.xappId)}`
      : `/marketplace/xapps/${encodeURIComponent(input.xappId)}`,
    search: suffix ? `?${suffix}` : "",
  };
}

function buildPlansRoute(input: {
  xappId: string;
  token: string;
  isEmbedded: boolean;
  installationId?: string;
  view?: "plans" | "history";
}): { pathname: string; search: string } {
  const params = new URLSearchParams();
  if (input.token) params.set("token", input.token);
  if (input.installationId) params.set("installationId", input.installationId);
  if (input.view === "history") params.set("view", "history");
  const suffix = params.toString();
  return {
    pathname: input.isEmbedded
      ? `/xapps/${encodeURIComponent(input.xappId)}/plans`
      : `/marketplace/xapps/${encodeURIComponent(input.xappId)}/plans`,
    search: suffix ? `?${suffix}` : "",
  };
}

export function MonetizationPage() {
  const { client, host, env } = useMarketplace();
  const { locale, t } = useMarketplaceI18n();
  const token = useQueryToken();
  const loc = useLocation();
  const query = useQuery();
  const xappIdFilter = query.get("xappId") ?? "";
  const installationIdFilter = query.get("installationId") ?? "";
  const showPast = query.get("showPast") === "1";
  const isEmbedded = typeof window !== "undefined" && window.location.pathname.startsWith("/embed");
  const xappInstallationId =
    installationIdFilter || host.getInstallationsByXappId?.()?.[xappIdFilter]?.installationId || "";
  const subjectResolutionPending = env?.subjectResolved === false;
  const [items, setItems] = useState<MonetizationCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [xappTitle, setXappTitle] = useState("");
  const [xappDefaultWidgetId, setXappDefaultWidgetId] = useState("");
  const [xappDefaultWidgetName, setXappDefaultWidgetName] = useState("");
  const [xappDefaultToolName, setXappDefaultToolName] = useState("");
  const [xappOpenAppStrategy, setXappOpenAppStrategy] = useState<"direct_widget" | "choose_widget">(
    "direct_widget",
  );
  const visibilityRefreshRef = useRef<number>(0);
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

  const overview = useMemo(
    () => ({
      apps: items.length,
      subscriptions: items.filter((item) => item.hasSubscription).length,
      namedCurrencies: items.filter((item) => item.hasNamedCurrency).length,
      balances: items.filter((item) => item.hasBalance).length,
    }),
    [items],
  );

  const refresh = useCallback(async () => {
    if (!client.getMyXappMonetization) {
      setError(
        t(
          "activity.unavailable_monetization_title",
          undefined,
          "Plans and balances are unavailable in this host.",
        ),
      );
      setItems([]);
      setBusy(false);
      return;
    }
    if (!host.subjectId && subjectResolutionPending) {
      setError(null);
      setItems([]);
      setBusy(true);
      return;
    }

    if (!host.subjectId) {
      setError("Subject required");
      setItems([]);
      setBusy(false);
      return;
    }

    const installations = host.getInstallationsByXappId();
    const entries: InstallationInfo[] = Object.values(installations || {});
    const overviewResponse =
      !xappIdFilter && typeof client.listMyMonetizedXapps === "function"
        ? await client.listMyMonetizedXapps({
            currentOnly: !showPast,
          })
        : null;
    const overviewItems = Array.isArray(asRecord(asRecord(overviewResponse).overview).items)
      ? (asRecord(asRecord(overviewResponse).overview).items as Array<Record<string, unknown>>)
      : [];
    const candidates = xappIdFilter
      ? [
          {
            xappId: xappIdFilter,
            installationId:
              installationIdFilter ||
              entries.find((item) => item.xappId === xappIdFilter)?.installationId ||
              undefined,
          },
        ]
      : overviewItems.length > 0
        ? overviewItems.map((item) => {
            const xappId = readString(item.xapp_id);
            return {
              xappId,
              installationId:
                entries.find((entry) => entry.xappId === xappId)?.installationId || undefined,
            };
          })
        : entries.map((item) => ({
            xappId: item.xappId,
            installationId: item.installationId,
          }));
    const deduped = Array.from(
      new Map(candidates.map((item) => [item.xappId, item])).values(),
    ).filter((item) => Boolean(item.xappId));

    setError(null);
    setBusy(true);
    try {
      const next = await Promise.all(
        deduped.map(async (item): Promise<MonetizationCard | null> => {
          const [detail, state] = await Promise.all([
            client.getCatalogXapp(item.xappId, {
              installationId: item.installationId || null,
            }),
            client.getMyXappMonetization!(item.xappId, {
              installationId: item.installationId || null,
              locale,
            }),
          ]);
          if (!xappIdFilter && !isMonetizationCandidate(detail)) return null;
          const summary = summarizeXappMonetizationSnapshot(state);
          const detailRecord = asRecord(detail);
          const accessProjection = asRecord(asRecord(state).access_projection);
          const virtualCurrencyLabel = formatVirtualCurrencyLabel(
            accessProjection.virtual_currency,
            {
              includeCode: true,
            },
          );
          const creditsRemainingLabel =
            formatVirtualCurrencyAmount(
              accessProjection.credits_remaining,
              accessProjection.virtual_currency,
            ) ||
            summary.wallet.creditsRemaining ||
            "0";
          const hasLiveBalance = Boolean(readString(accessProjection.credits_remaining));
          const hasNamedCurrency = Boolean(virtualCurrencyLabel);
          const title =
            resolveMarketplaceText(asRecord(detailRecord.manifest).title as any, locale) ||
            readFirstString(asRecord(detailRecord.xapp).name) ||
            item.xappId;
          const subtitle =
            resolveMarketplaceText(asRecord(detailRecord.manifest).summary as any, locale) ||
            resolveMarketplaceText(asRecord(detailRecord.manifest).description as any, locale) ||
            t(
              "activity.monetization_card_subtitle",
              undefined,
              "Access, plans, and balances for this app.",
            );
          return {
            xappId: item.xappId,
            installationId: item.installationId,
            title,
            subtitle,
            detailHref: buildXappRoute({
              xappId: item.xappId,
              token,
              isEmbedded,
              installationId: item.installationId,
            }),
            plansHref: buildPlansRoute({
              xappId: item.xappId,
              token,
              isEmbedded,
              installationId: item.installationId,
            }),
            historyHref: buildPlansRoute({
              xappId: item.xappId,
              token,
              isEmbedded,
              installationId: item.installationId,
              view: "history",
            }),
            accessLabel:
              summary.accessCoverage.coverageLabel ||
              t("activity.monetization_unknown", undefined, "Unknown"),
            tierLabel:
              summary.accessCoverage.tierLabel ||
              t("activity.monetization_none", undefined, "None"),
            sourceLabel:
              summary.accessCoverage.sourceRefLabel ||
              t("activity.monetization_no_source", undefined, "No source"),
            subscriptionStatus:
              summary.currentSubscription.statusLabel ||
              t("activity.monetization_no_subscription", undefined, "No subscription"),
            subscriptionCoverage:
              summary.currentSubscription.present && summary.currentSubscription.coverageLabel
                ? summary.currentSubscription.coverageLabel
                : t(
                    "activity.monetization_no_recurring_coverage",
                    undefined,
                    "No recurring coverage",
                  ),
            renewsAt:
              summary.currentSubscription.renewsAt ||
              t("activity.monetization_not_scheduled", undefined, "Not scheduled"),
            virtualCurrencyLabel,
            balanceTitle: hasNamedCurrency
              ? t("activity.monetization_credits_label", undefined, "Balance")
              : t("xapp.credit_balance_label", undefined, "Credits"),
            creditsRemaining: creditsRemainingLabel,
            balanceState:
              summary.wallet.balanceStateLabel ||
              t("activity.monetization_balance_unknown", undefined, "unknown"),
            hasSubscription: summary.currentSubscription.present,
            hasNamedCurrency,
            hasBalance: Boolean(hasLiveBalance || creditsRemainingLabel),
          };
        }),
      );
      setItems(next.filter((item): item is MonetizationCard => Boolean(item)));
    } catch (e) {
      setError(readFirstString(asRecord(e).message) || String(e));
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, [
    client,
    host,
    installationIdFilter,
    isEmbedded,
    locale,
    showPast,
    subjectResolutionPending,
    t,
    token,
    xappIdFilter,
  ]);

  useEffect(() => {
    void refresh();
    host.notifyNavigation?.({
      path: typeof window !== "undefined" ? window.location.pathname : "",
      page: "monetization",
      params: {
        xappId: xappIdFilter || null,
        installationId: installationIdFilter || null,
      },
    });
  }, [host, installationIdFilter, refresh, xappIdFilter]);

  useEffect(() => {
    function handleVisibilityRefresh() {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - visibilityRefreshRef.current < 1500) return;
      visibilityRefreshRef.current = now;
      void refresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [refresh]);

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
        const res = await client.getCatalogXapp(String(xappIdFilter), {
          installationId: installationIdFilter || null,
        });
        if (!alive) return;
        const detail = asRecord(res);
        const manifest = asRecord(detail.manifest);
        const xapp = asRecord(detail.xapp);
        const widgetMeta = readDefaultWidgetMeta(
          detail,
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
  }, [client, installationIdFilter, locale, xappIdFilter]);

  const clearHref = buildMarketplaceHref(loc.pathname, "monetization", { token });
  const togglePastHref = !xappIdFilter
    ? buildMarketplaceHref(loc.pathname, "monetization", {
        token,
        showPast: !showPast ? "1" : undefined,
      })
    : null;

  const xappLink = xappIdFilter
    ? (buildMarketplaceHref(loc.pathname, `xapps/${encodeURIComponent(String(xappIdFilter))}`, {
        token,
        installationId: installationIdFilter,
      }) as any)
    : null;

  return (
    <div className={`mx-catalog-container mx-monetization-page ${isEmbedded ? "is-embedded" : ""}`}>
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
        <span>{t("activity.monetization_title", undefined, "Monetization")}</span>
      </div>

      <header className="mx-header">
        <h1 className="mx-title">{t("activity.monetization_title", undefined, "Monetization")}</h1>
        <div className="mx-header-actions">
          <MarketplacePrimaryNav
            active="activity"
            isEmbedded={isEmbedded}
            tokenSearch={token ? `?token=${encodeURIComponent(token)}` : ""}
          />
          {togglePastHref && (
            <Link to={togglePastHref as any} className="mx-btn mx-btn-ghost">
              {showPast
                ? t("activity.monetization_show_current_only", undefined, "Show current only")
                : t("activity.monetization_show_past", undefined, "Show past apps")}
            </Link>
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
          active="billing"
          billingActive="monetization"
          openWidgetId={xappDefaultWidgetId}
          openWidgetName={xappDefaultWidgetName}
          openToolName={xappDefaultToolName}
          openAppStrategy={xappOpenAppStrategy}
          onOpenApp={handleWorkspaceOpenApp}
        />
      ) : (
        <MarketplaceActivityTabs
          active="monetization"
          isEmbedded={isEmbedded}
          token={token}
          xappId={xappIdFilter || undefined}
          installationId={installationIdFilter || undefined}
        />
      )}

      {error === "Subject required" || error === "Session token required" ? (
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

      {xappIdFilter ? (
        <div className="mx-table-container mx-subtle-note-card">
          <div className="mx-subtle-note mx-subtle-note-compact">
            {t(
              "activity.showing_monetization_for_prefix",
              undefined,
              "Showing plans and balances for",
            )}{" "}
            <span className="mx-subtle-note-strong">{xappIdFilter}</span>
          </div>
        </div>
      ) : (
        <div className="mx-table-container mx-subtle-note-card">
          <div className="mx-subtle-note mx-subtle-note-compact">
            {showPast
              ? t(
                  "activity.monetization_overview_hint_with_past",
                  undefined,
                  "Review current and past plans, subscriptions, and balances across this subject's apps.",
                )
              : t(
                  "activity.monetization_overview_hint",
                  undefined,
                  "Review current plans, subscriptions, and balances across this subject's apps.",
                )}
          </div>
        </div>
      )}

      <section className="mx-table-container mx-monetization-summary-card">
        <div className="mx-monetization-card-body">
          <div className="mx-record-panel-head">
            <div>
              <div className="mx-record-panel-kicker">
                {t("activity.monetization_title", undefined, "Monetization")}
              </div>
              <div className="mx-record-panel-id">
                {t("activity.monetization_summary_title", undefined, "Plans and balances")}
              </div>
              <div className="mx-record-panel-subtitle">
                {t(
                  "activity.monetization_summary_subtitle",
                  undefined,
                  "Review active plans, subscriptions, and balances before opening app details or history.",
                )}
              </div>
            </div>
          </div>
          <div className="mx-record-grid">
            <div className="mx-record-field">
              <div className="mx-record-label">
                {t("activity.monetization_summary_apps", undefined, "Apps")}
              </div>
              <div className="mx-record-value is-strong">{overview.apps}</div>
            </div>
            <div className="mx-record-field">
              <div className="mx-record-label">
                {t("activity.monetization_summary_subscriptions", undefined, "Subscriptions")}
              </div>
              <div className="mx-record-value is-strong">{overview.subscriptions}</div>
            </div>
            <div className="mx-record-field">
              <div className="mx-record-label">
                {t("activity.monetization_summary_balances", undefined, "Balances")}
              </div>
              <div className="mx-record-value is-strong">{overview.balances}</div>
            </div>
            <div className="mx-record-field">
              <div className="mx-record-label">
                {t("activity.monetization_summary_currencies", undefined, "Named currencies")}
              </div>
              <div className="mx-record-value is-strong">{overview.namedCurrencies}</div>
            </div>
          </div>
        </div>
      </section>

      {busy ? (
        <div className="mx-table-container">
          <div className="mx-loading-center mx-loading-table">
            {t(
              "activity.loading_monetization",
              undefined,
              "Loading plans, balances, and recent activity...",
            )}
          </div>
        </div>
      ) : null}

      {!busy && !error && items.length === 0 ? (
        <div className="mx-table-container">
          <div className="mx-empty-catalog">
            <div className="mx-empty-catalog-icon">◎</div>
            <div className="mx-empty-catalog-title">
              {showPast
                ? t(
                    "activity.no_monetization_history",
                    undefined,
                    "No plan or balance history was found for this subject.",
                  )
                : t(
                    "activity.no_monetization_current",
                    undefined,
                    "No current plans or balances were found for this subject.",
                  )}
            </div>
            <div className="mx-empty-catalog-desc">
              {showPast
                ? t(
                    "activity.monetization_overview_hint_with_past",
                    undefined,
                    "Review current and past plans, subscriptions, and balances across this subject's apps.",
                  )
                : t(
                    "activity.monetization_overview_hint",
                    undefined,
                    "Review current plans, subscriptions, and balances across this subject's apps.",
                  )}
            </div>
          </div>
        </div>
      ) : null}

      {!busy && items.length > 0 ? (
        <div className="mx-record-panel-stack">
          {items.map((item) => (
            <section key={item.xappId} className="mx-table-container mx-monetization-activity-card">
              <div className="mx-monetization-card-body">
                <div className="mx-record-panel-head">
                  <div>
                    <div className="mx-record-panel-kicker">
                      {t("activity.monetization", undefined, "Monetization")}
                    </div>
                    <div className="mx-record-panel-id">{item.title}</div>
                    <div className="mx-record-panel-subtitle">{item.subtitle}</div>
                    <div className="mx-monetization-card-badges">
                      <span className="mx-badge mx-badge-warning">{item.accessLabel}</span>
                      <span
                        className={`mx-badge ${
                          item.hasSubscription ? "mx-badge-success" : "mx-badge-warning"
                        }`}
                      >
                        {item.subscriptionStatus}
                      </span>
                      <span className="mx-tag">
                        {item.virtualCurrencyLabel ||
                          t("xapp.credit_balance_label", undefined, "Credits")}
                      </span>
                    </div>
                  </div>
                  <div className="mx-record-actions mx-record-actions-monetization">
                    <div className="mx-action-group">
                      <Link to={item.plansHref as any} className="mx-btn mx-btn-primary">
                        {t("activity.monetization_open_plans", undefined, "View plans")}
                      </Link>
                      <Link to={item.historyHref as any} className="mx-btn mx-btn-secondary">
                        {t("activity.monetization_open_history", undefined, "View history")}
                      </Link>
                    </div>
                    <div className="mx-action-group">
                      <Link to={item.detailHref as any} className="mx-btn mx-btn-ghost">
                        {t("common.view_app_details", undefined, "View app details")}
                      </Link>
                      {!xappIdFilter ? (
                        <Link
                          to={
                            {
                              pathname: isEmbedded ? "/monetization" : "/marketplace/monetization",
                              search: (() => {
                                const qs = new URLSearchParams();
                                if (token) qs.set("token", token);
                                qs.set("xappId", item.xappId);
                                if (item.installationId)
                                  qs.set("installationId", item.installationId);
                                const suffix = qs.toString();
                                return suffix ? `?${suffix}` : "";
                              })(),
                            } as any
                          }
                          className="mx-btn mx-btn-ghost"
                        >
                          {t("activity.monetization_focus_xapp", undefined, "Only this app")}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mx-record-grid mx-monetization-card-primary-grid">
                  <div className="mx-record-field">
                    <div className="mx-record-label">
                      {t("activity.monetization_access_label", undefined, "Access")}
                    </div>
                    <div className="mx-record-value is-strong">{item.accessLabel}</div>
                  </div>
                  <div className="mx-record-field">
                    <div className="mx-record-label">
                      {t("activity.monetization_plan_label", undefined, "Plan")}
                    </div>
                    <div className="mx-record-value is-strong">{item.tierLabel}</div>
                  </div>
                  <div className="mx-record-field">
                    <div className="mx-record-label">
                      {t("activity.monetization_subscription_label", undefined, "Subscription")}
                    </div>
                    <div className="mx-record-value">{item.subscriptionStatus}</div>
                  </div>
                  <div className="mx-record-field">
                    <div className="mx-record-label">{item.balanceTitle}</div>
                    <div className="mx-record-value is-strong">{item.creditsRemaining}</div>
                  </div>
                  <div className="mx-record-field">
                    <div className="mx-record-label">
                      {t("activity.monetization_renews_at", undefined, "Renews at")}
                    </div>
                    <div className="mx-record-value">{item.renewsAt}</div>
                  </div>
                </div>

                <div className="mx-monetization-card-secondary">
                  {item.hasNamedCurrency ? (
                    <div className="mx-monetization-card-secondary-row">
                      <span className="mx-monetization-card-secondary-label">
                        {t("xapp.virtual_currency_label", undefined, "Currency")}
                      </span>
                      <span className="mx-monetization-card-secondary-value">
                        {item.virtualCurrencyLabel}
                      </span>
                    </div>
                  ) : null}
                  <div className="mx-monetization-card-secondary-row">
                    <span className="mx-monetization-card-secondary-label">
                      {t("activity.monetization_coverage_label", undefined, "Renewal state")}
                    </span>
                    <span className="mx-monetization-card-secondary-value">
                      {item.subscriptionCoverage}
                    </span>
                  </div>
                  <div className="mx-monetization-card-secondary-row">
                    <span className="mx-monetization-card-secondary-label">
                      {t("activity.monetization_balance_state", undefined, "Balance status")}
                    </span>
                    <span className="mx-monetization-card-secondary-value">
                      {item.balanceState}
                    </span>
                  </div>
                  <div className="mx-monetization-card-secondary-row">
                    <span className="mx-monetization-card-secondary-label">
                      {t("activity.monetization_source_label", undefined, "Origin")}
                    </span>
                    <span className="mx-monetization-card-secondary-value">{item.sourceLabel}</span>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default MonetizationPage;
