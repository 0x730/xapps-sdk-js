import { summarizeXappMonetizationSnapshot } from "@xapps-platform/browser-host/xms";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMarketplace } from "../MarketplaceContext";
import { resolveMarketplaceText, useMarketplaceI18n } from "../i18n";
import { MarketplaceActivityTabs } from "../components/MarketplaceActivityTabs";
import { MarketplacePrimaryNav } from "../components/MarketplacePrimaryNav";
import type { CatalogXappDetail, InstallationInfo } from "../types";
import { asRecord, readFirstString, readString } from "../utils/readers";
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
  creditsRemaining: string;
  balanceState: string;
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
  const query = useQuery();
  const xappIdFilter = query.get("xappId") ?? "";
  const installationIdFilter = query.get("installationId") ?? "";
  const showPast = query.get("showPast") === "1";
  const subjectResolutionPending = env?.subjectResolved === false;
  const [items, setItems] = useState<MonetizationCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [xappTitle, setXappTitle] = useState("");
  const visibilityRefreshRef = useRef<number>(0);

  const isEmbedded = typeof window !== "undefined" && window.location.pathname.startsWith("/embed");

  const refresh = useCallback(async () => {
    if (!client.getMyXappMonetization) {
      setError(
        t(
          "activity.unavailable_monetization_title",
          undefined,
          "Monetization is unavailable in this host.",
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
          const detail = await client.getCatalogXapp(item.xappId, {
            installationId: item.installationId || null,
          });
          if (!xappIdFilter && !isMonetizationCandidate(detail)) return null;
          const state = await client.getMyXappMonetization!(item.xappId, {
            installationId: item.installationId || null,
            locale,
          });
          const summary = summarizeXappMonetizationSnapshot(state);
          const detailRecord = asRecord(detail);
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
              "Current XMS state, active access, subscriptions, and credits for this app.",
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
            creditsRemaining: summary.wallet.creditsRemaining || "0",
            balanceState:
              summary.wallet.balanceStateLabel ||
              t("activity.monetization_balance_unknown", undefined, "unknown"),
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
  }, [client, installationIdFilter, locale, xappIdFilter]);

  const clearHref = {
    pathname: isEmbedded ? "/monetization" : "/marketplace/monetization",
    search: token ? `?token=${encodeURIComponent(token)}` : "",
  };
  const togglePastHref = !xappIdFilter
    ? ({
        pathname: isEmbedded ? "/monetization" : "/marketplace/monetization",
        search: (() => {
          const qs = new URLSearchParams();
          if (token) qs.set("token", token);
          if (!showPast) qs.set("showPast", "1");
          const suffix = qs.toString();
          return suffix ? `?${suffix}` : "";
        })(),
      } as const)
    : null;

  const xappLink = xappIdFilter
    ? ({
        pathname: isEmbedded
          ? `/xapps/${encodeURIComponent(String(xappIdFilter))}`
          : `/marketplace/xapps/${encodeURIComponent(String(xappIdFilter))}`,
        search: (() => {
          const qs = new URLSearchParams();
          if (token) qs.set("token", token);
          if (installationIdFilter) qs.set("installationId", installationIdFilter);
          const suffix = qs.toString();
          return suffix ? `?${suffix}` : "";
        })(),
      } as any)
    : null;

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

      <MarketplaceActivityTabs
        active="monetization"
        isEmbedded={isEmbedded}
        token={token}
        xappId={xappIdFilter || undefined}
        installationId={installationIdFilter || undefined}
      />

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
        <div className="mx-subtle-note">
          {t("activity.showing_monetization_for_prefix", undefined, "Showing XMS state for")}{" "}
          <span className="mx-subtle-note-strong">{xappIdFilter}</span>
        </div>
      ) : (
        <div className="mx-subtle-note">
          {showPast
            ? t(
                "activity.monetization_overview_hint_with_past",
                undefined,
                "Review current and past XMS access, subscriptions, and credits across this subject's apps.",
              )
            : t(
                "activity.monetization_overview_hint",
                undefined,
                "Review current XMS access, subscriptions, and credits across the apps linked to this subject.",
              )}
        </div>
      )}

      {busy ? (
        <div className="mx-table-container">
          {t("activity.loading_monetization", undefined, "Loading monetization state...")}
        </div>
      ) : null}

      {!busy && !error && items.length === 0 ? (
        <div className="mx-table-container">
          {showPast
            ? t(
                "activity.no_monetization_history",
                undefined,
                "No monetization history was found for this subject.",
              )
            : t(
                "activity.no_monetization_current",
                undefined,
                "No current monetization coverage was found for this subject.",
              )}
        </div>
      ) : null}

      {!busy && items.length > 0 ? (
        <div className="mx-record-panel-stack">
          {items.map((item) => (
            <section key={item.xappId} className="mx-record-panel mx-record-panel-monetization">
              <div className="mx-record-panel-head">
                <div>
                  <div className="mx-record-panel-kicker">
                    {t("activity.monetization", undefined, "Monetization")}
                  </div>
                  <div className="mx-record-panel-id">{item.title}</div>
                  <div className="mx-record-panel-subtitle">{item.subtitle}</div>
                </div>
                <div className="mx-record-actions mx-record-actions-monetization">
                  <div className="mx-action-group">
                    <Link to={item.plansHref as any} className="mx-btn mx-btn-primary">
                      {t("activity.monetization_open_plans", undefined, "Open plans")}
                    </Link>
                    <Link to={item.historyHref as any} className="mx-btn mx-btn-secondary">
                      {t("activity.monetization_open_history", undefined, "Open history")}
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
                        {t("activity.monetization_focus_xapp", undefined, "Focus this app")}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mx-record-grid">
                <div className="mx-record-field">
                  <div className="mx-record-label">
                    {t("activity.monetization_access_label", undefined, "Current access")}
                  </div>
                  <div className="mx-record-value is-strong">{item.accessLabel}</div>
                </div>
                <div className="mx-record-field">
                  <div className="mx-record-label">
                    {t("activity.monetization_plan_label", undefined, "Current plan")}
                  </div>
                  <div className="mx-record-value is-strong">{item.tierLabel}</div>
                </div>
                <div className="mx-record-field">
                  <div className="mx-record-label">
                    {t("activity.monetization_credits_label", undefined, "Credits remaining")}
                  </div>
                  <div className="mx-record-value is-strong">{item.creditsRemaining}</div>
                </div>
                <div className="mx-record-field">
                  <div className="mx-record-label">
                    {t("activity.monetization_subscription_label", undefined, "Subscription")}
                  </div>
                  <div className="mx-record-value">{item.subscriptionStatus}</div>
                </div>
                <div className="mx-record-field">
                  <div className="mx-record-label">
                    {t("activity.monetization_coverage_label", undefined, "Coverage")}
                  </div>
                  <div className="mx-record-value">{item.subscriptionCoverage}</div>
                </div>
                <div className="mx-record-field">
                  <div className="mx-record-label">
                    {t("activity.monetization_renews_at", undefined, "Renews at")}
                  </div>
                  <div className="mx-record-value">{item.renewsAt}</div>
                </div>
                <div className="mx-record-field">
                  <div className="mx-record-label">
                    {t("activity.monetization_balance_state", undefined, "Balance state")}
                  </div>
                  <div className="mx-record-value">{item.balanceState}</div>
                </div>
                <div className="mx-record-field">
                  <div className="mx-record-label">
                    {t("activity.monetization_source_label", undefined, "Source")}
                  </div>
                  <div className="mx-record-value">{item.sourceLabel}</div>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
