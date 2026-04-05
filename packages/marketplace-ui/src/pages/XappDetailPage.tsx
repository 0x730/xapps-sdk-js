import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { resolveMarketplaceText, useMarketplaceI18n } from "../i18n";
import type { TranslateFunction } from "@xapps-platform/platform-i18n";
import {
  buildMonetizationPaywallRenderModel,
  flattenXappMonetizationPaywallPackages,
  listXappMonetizationPaywalls,
  resolveMonetizationPackagePurchasePolicy,
  selectXappMonetizationPaywall,
} from "@xapps-platform/browser-host/xms";
import { useMarketplace } from "../MarketplaceContext";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { buildTokenSearch } from "../utils/embedSearch";
import {
  hasMarketplaceCatalogMonetization,
  resolveMarketplaceDefaultAccessState,
} from "../utils/monetizationAccess";
import {
  buildOperationalSurfaceHref,
  discoverOperationalSurfaceData,
  getVisibleOperationalSurfaces,
  type OperationalSurfaceKey,
} from "../utils/operationalSurfaces";
import type {
  CatalogXappDetail,
  MarketplaceMonetizationAccessProjection,
  MarketplaceXappMonetizationState,
} from "../types";
import "../marketplace.css";

type GuardInfo = {
  slug: string;
  label?: string;
  trigger: string;
  headless: boolean;
  blocking: boolean;
  order: number | null;
  policyKind: string;
};

type UsageCreditToolSummary = {
  tool_name: string;
  available_count: number;
  available_session_backed_count: number;
  available_ledger_only_count: number;
  reserved_count: number;
  reserved_active_count: number;
  reserved_stale_count: number;
  consumed_count: number;
};

type UsageCreditSummary = {
  available_count: number;
  available_session_backed_count: number;
  available_ledger_only_count: number;
  reserved_count: number;
  reserved_active_count: number;
  reserved_stale_count: number;
  consumed_count: number;
  updated_at: string | null;
  by_tool: UsageCreditToolSummary[];
};

type MonetizationPaywallRenderModel = ReturnType<typeof buildMonetizationPaywallRenderModel>;
type MonetizationPaywallRenderPackage = MonetizationPaywallRenderModel["packages"][number];
type MonetizationPaywallPackageRecord = ReturnType<
  typeof flattenXappMonetizationPaywallPackages
>[number];

function useQueryToken(): string {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  return qs.get("token") ?? "";
}

function useQueryAction(): string {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  return qs.get("action") ?? "";
}

function useQueryToolName(): string {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  return qs.get("toolName") ?? qs.get("tool_name") ?? "";
}

function buildRequestsHref(input: { xappId: string; token?: string; isEmbedded: boolean }): string {
  const params = new URLSearchParams({
    xappId: input.xappId,
    ...(input.token ? { token: input.token } : {}),
  });
  const s = params.toString();

  // IMPORTANT: Navigate from `xapps/:xappId` to the sibling `requests` route.
  // In Portal, this is sibling. In Embed, we want absolute path to be safe.
  if (input.isEmbedded) return `/requests?${s}`;
  return `/marketplace/requests?${s}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildMonetizationCheckoutReturnUrl(input: {
  currentHref: string;
  intentId: string;
  packageSlug?: string | null;
}): string {
  const url = new URL(input.currentHref, window.location.href);
  url.searchParams.set("focus", "plans");
  url.searchParams.set("xapps_monetization_intent_id", input.intentId);
  if (input.packageSlug) {
    url.searchParams.set("paywallPackage", input.packageSlug);
  }
  return url.toString();
}

function navigateToHostedCheckout(url: string): void {
  const target = String(url || "").trim();
  if (!target) return;
  try {
    if (typeof window !== "undefined" && window.top && window.top !== window) {
      window.top.location.assign(target);
      return;
    }
  } catch {
    // Cross-window access can fail; fall through to same-window navigation.
  }
  window.location.assign(target);
}

function stripMonetizationCheckoutReturnParams(search: string): string {
  const next = new URLSearchParams(search);
  const keysToDelete: string[] = [];
  for (const key of next.keys()) {
    if (key.startsWith("xapps_payment_")) keysToDelete.push(key);
  }
  keysToDelete.push("xapps_monetization_intent_id");
  for (const key of keysToDelete) next.delete(key);
  const rendered = next.toString();
  return rendered ? `?${rendered}` : "";
}

function formatDateTime(value: unknown, locale: string): string {
  const raw = readString(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  try {
    return parsed.toLocaleString(locale || undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return parsed.toISOString();
  }
}

function normalizeUsageCreditSummary(value: unknown): UsageCreditSummary | null {
  const summary = asRecord(value);
  if (!summary) return null;
  const availableCount = readNumber(summary.available_count) ?? 0;
  const availableSessionBackedCount = readNumber(summary.available_session_backed_count) ?? 0;
  const availableLedgerOnlyCount = readNumber(summary.available_ledger_only_count) ?? 0;
  const reservedCount = readNumber(summary.reserved_count) ?? 0;
  const reservedActiveCount = readNumber(summary.reserved_active_count) ?? reservedCount;
  const reservedStaleCount = readNumber(summary.reserved_stale_count) ?? 0;
  const consumedCount = readNumber(summary.consumed_count) ?? 0;
  const byToolRaw = Array.isArray(summary.by_tool) ? summary.by_tool : [];
  const byTool = byToolRaw
    .map((entry): UsageCreditToolSummary | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const toolName = readString(record.tool_name);
      if (!toolName) return null;
      return {
        tool_name: toolName,
        available_count: readNumber(record.available_count) ?? 0,
        available_session_backed_count: readNumber(record.available_session_backed_count) ?? 0,
        available_ledger_only_count: readNumber(record.available_ledger_only_count) ?? 0,
        reserved_count: readNumber(record.reserved_count) ?? 0,
        reserved_active_count:
          readNumber(record.reserved_active_count) ?? readNumber(record.reserved_count) ?? 0,
        reserved_stale_count: readNumber(record.reserved_stale_count) ?? 0,
        consumed_count: readNumber(record.consumed_count) ?? 0,
      };
    })
    .filter((entry): entry is UsageCreditToolSummary => Boolean(entry))
    .filter(
      (entry) =>
        entry.available_count > 0 ||
        entry.available_ledger_only_count > 0 ||
        entry.reserved_active_count > 0 ||
        entry.reserved_stale_count > 0,
    );
  if (
    availableCount <= 0 &&
    availableLedgerOnlyCount <= 0 &&
    reservedCount <= 0 &&
    consumedCount <= 0 &&
    byTool.length === 0
  ) {
    return null;
  }
  return {
    available_count: availableCount,
    available_session_backed_count: availableSessionBackedCount,
    available_ledger_only_count: availableLedgerOnlyCount,
    reserved_count: reservedCount,
    reserved_active_count: reservedActiveCount,
    reserved_stale_count: reservedStaleCount,
    consumed_count: consumedCount,
    updated_at: readString(summary.updated_at) || null,
    by_tool: byTool,
  };
}

function normalizeGuardPolicyKind(policy: unknown): string {
  if (policy === "all" || policy === "any") return policy;
  const policyObj = asRecord(policy);
  const mode = readString(policyObj?.mode);
  return mode === "any" ? "any" : "all";
}

function defaultBlockingForTrigger(trigger: string): boolean {
  return !trigger.startsWith("after:");
}

function humanizeSlug(slug: string): string {
  return String(slug || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildMonetizationHookSummaryItems(manifest: Record<string, unknown> | null): GuardInfo[] {
  const monetization = asRecord(manifest?.monetization);
  const hooks = asRecord(monetization?.hooks);
  const afterPaymentCompleted = asRecord(
    hooks?.after_payment_completed ?? hooks?.afterPaymentCompleted,
  );
  if (!afterPaymentCompleted || readBoolean(afterPaymentCompleted.enabled, true) === false) {
    return [];
  }

  const baseItems: GuardInfo[] = [];
  const defaultInvoiceRef = readString(
    afterPaymentCompleted.invoice_ref ?? afterPaymentCompleted.invoiceRef,
  );
  baseItems.push({
    slug: "xms_after_payment_completed",
    label: defaultInvoiceRef
      ? `XMS payment completed · ${defaultInvoiceRef}`
      : "XMS payment completed",
    trigger: "after:payment_completed",
    headless: true,
    blocking: false,
    order: null,
    policyKind: "all",
  });

  const byPaymentGuardRef = asRecord(
    afterPaymentCompleted.by_payment_guard_ref ?? afterPaymentCompleted.byPaymentGuardRef,
  );
  for (const [paymentGuardRef, rawValue] of Object.entries(byPaymentGuardRef ?? {})) {
    const config = asRecord(rawValue);
    if (!config || readBoolean(config.enabled, true) === false) continue;
    const invoiceRef = readString(config.invoice_ref ?? config.invoiceRef);
    baseItems.push({
      slug: `xms_after_payment_completed_${paymentGuardRef}`,
      label: invoiceRef
        ? `XMS payment completed · ${paymentGuardRef} · ${invoiceRef}`
        : `XMS payment completed · ${paymentGuardRef}`,
      trigger: "after:payment_completed",
      headless: true,
      blocking: false,
      order: null,
      policyKind: "all",
    });
  }

  return baseItems;
}

function humanizeTrigger(trigger: string, translate: TranslateFunction): string {
  const normalized = String(trigger || "")
    .trim()
    .toLowerCase();
  if (normalized === "before:tool_run") {
    return translate("xapp.trigger_before_tool_run", undefined, "Before running this app");
  }
  if (normalized === "after:tool_run") {
    return translate("xapp.trigger_after_tool_run", undefined, "After this app finishes");
  }
  if (normalized === "before:widget_open") {
    return translate("xapp.trigger_before_widget_open", undefined, "Before opening this app");
  }
  if (normalized === "after:widget_open") {
    return translate("xapp.trigger_after_widget_open", undefined, "After opening this app");
  }
  if (!normalized) return translate("xapp.trigger_default", undefined, "App stage");
  return humanizeSlug(normalized.replace(/:/g, " "));
}

function describeGuardChain(policyKind: string, translate: TranslateFunction): string {
  return policyKind === "any"
    ? translate("xapp.policy_any", undefined, "Any one satisfies")
    : translate("xapp.policy_all", undefined, "All steps apply");
}

export default function XappDetailPage() {
  return <XappDetailPageContent />;
}

export { XappDetailPage };

export function XappPlansPage() {
  return <XappDetailPageContent renderMode="plans_only" />;
}

function XappDetailPageContent(props?: { renderMode?: "full" | "plans_only" }) {
  const { client, host, env } = useMarketplace();
  const { locale, t } = useMarketplaceI18n();
  const { xappId } = useParams();
  const loc = useLocation();
  const token = useQueryToken();
  const action = useQueryAction();
  const queryToolName = useQueryToolName();
  const routeQuery = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const routeSource = String(routeQuery.get("from") || "")
    .trim()
    .toLowerCase();
  const focusedSection = String(routeQuery.get("focus") || "")
    .trim()
    .toLowerCase();
  const requestedPaywallSlug = String(routeQuery.get("paywall") || "")
    .trim()
    .toLowerCase();
  const selectedPaywallPackageSlug = String(routeQuery.get("paywallPackage") || "")
    .trim()
    .toLowerCase();
  const paymentReturnStatus = String(routeQuery.get("xapps_payment_status") || "")
    .trim()
    .toLowerCase();
  const paymentReturnSessionId = String(routeQuery.get("xapps_payment_session_id") || "").trim();
  const paymentReturnIntentId = String(routeQuery.get("xapps_monetization_intent_id") || "").trim();
  const tokenSearch = buildTokenSearch(token, loc.search);
  const navigate = useNavigate();
  const autoOpenedWidgetKeyRef = useRef<string>("");
  const plansSectionRef = useRef<HTMLDivElement | null>(null);

  const canMutate = host.canMutate ? host.canMutate() : true;
  const renderMode = props?.renderMode === "plans_only" ? "plans_only" : "full";
  const plansOnlyMode = renderMode === "plans_only";
  const widgetHostedPlansMode = plansOnlyMode && routeSource === "widget";
  const addAppLabel =
    env?.copy?.addAppLabel || t("xapp.add_to_workspace", undefined, "Add to workspace");
  const removeAppLabel =
    env?.copy?.removeAppLabel ||
    t("xapp.remove_from_workspace", undefined, "Remove from workspace");
  const updateAppLabel = env?.copy?.updateAppLabel || t("xapp.update_app", undefined, "Update app");
  const openAppLabel = env?.copy?.openAppLabel || t("xapp.open_app", undefined, "Open app");

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [monetization, setMonetization] = useState<MarketplaceXappMonetizationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [discoveredOperationalSurfaces, setDiscoveredOperationalSurfaces] = useState<
    OperationalSurfaceKey[]
  >([]);

  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAction, setTermsAction] = useState<"none" | "install" | "update">("none");
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [guardSummaryOpen, setGuardSummaryOpen] = useState(false);
  const [checkoutBusyPackageSlug, setCheckoutBusyPackageSlug] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const checkoutFinalizeKeyRef = useRef<string>("");

  const hasSubject = Boolean(host.subjectId);
  const installationsByXappId = hasSubject ? host.getInstallationsByXappId() : {};
  const routeInstallationId = String(routeQuery.get("installationId") || "").trim();
  const installation =
    xappId && installationsByXappId[String(xappId)]
      ? installationsByXappId[String(xappId)]
      : xappId && routeInstallationId
        ? {
            installationId: routeInstallationId,
            xappId: String(xappId),
          }
        : null;
  const updateAvailable = Boolean(installation?.updateAvailable);
  const widgetsEnabled = Boolean(installation) && !updateAvailable && hasSubject;

  const isEmbedded = window.location.pathname.startsWith("/embed");
  const singleXappMode = env?.singleXappMode;

  async function refresh() {
    if (!xappId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await client.getCatalogXapp(String(xappId), {
        installationId: installation?.installationId ?? null,
      });
      setData(asRecord(res));
    } catch (e) {
      setError(readString(asRecord(e)?.message) || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    host.refreshInstallations();
    host.notifyNavigation?.({
      path: window.location.pathname,
      page: "xapp-detail",
      params: { xappId },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, installation?.installationId, xappId]);

  useEffect(() => {
    const currentXappId = String(xappId ?? "").trim();
    if (!currentXappId) {
      setDiscoveredOperationalSurfaces([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const discovered = await discoverOperationalSurfaceData({
        client,
        xappId: currentXappId,
        installationId: installation?.installationId ?? null,
      });
      if (!cancelled) {
        setDiscoveredOperationalSurfaces(discovered);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, installation?.installationId, xappId]);

  useEffect(() => {
    const currentXappId = String(xappId ?? "").trim();
    if (!currentXappId || !host.subjectId || typeof client.getMyXappMonetization !== "function") {
      setMonetization(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await client.getMyXappMonetization!(currentXappId, {
          installationId: installation?.installationId ?? null,
          locale,
        });
        if (!cancelled) {
          setMonetization(next);
        }
      } catch {
        if (!cancelled) {
          setMonetization(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, host.subjectId, installation?.installationId, xappId]);

  const manifest = asRecord(data?.manifest);
  const xappRecord = asRecord(data?.xapp);
  const versionRecord = asRecord(data?.version);
  const publisherRecord = asRecord(xappRecord?.publisher);
  const title =
    resolveMarketplaceText(manifest?.title as any, locale) ||
    readString(xappRecord?.name) ||
    t("xapp.kicker_default", undefined, "Xapp");
  const description =
    resolveMarketplaceText(manifest?.description as any, locale) ||
    readString(xappRecord?.description) ||
    "";
  const imageUrl = readString(manifest?.image) || "https://picsum.photos/seed/xapps-detail/840/360";

  const widgets: Record<string, unknown>[] = Array.isArray(data?.widgets)
    ? data.widgets.filter((widget): widget is Record<string, unknown> => Boolean(asRecord(widget)))
    : [];
  const defaultWidget = useMemo(() => {
    const def = widgets.find((w) => readBoolean(w.default, false));
    return def || widgets[0] || null;
  }, [widgets]);
  const requestedWidget = useMemo(() => {
    const desiredToolName = readString(queryToolName);
    if (!desiredToolName) return defaultWidget;
    return (
      widgets.find((widget) => readString(widget.bind_tool_name) === desiredToolName) ||
      defaultWidget
    );
  }, [defaultWidget, queryToolName, widgets]);

  const backTo = {
    pathname: isEmbedded ? "/embed/catalog" : "..",
    search: tokenSearch,
  };

  const terms = asRecord(manifest?.terms);
  const termsTitle =
    resolveMarketplaceText(terms?.title as any, locale) ||
    t("xapp.terms_title", undefined, "Terms & Conditions");
  const termsText = resolveMarketplaceText(terms?.text as any, locale) || readString(terms?.text);
  const termsUrl = readString(terms?.url);
  const hasTermsContent = Boolean(termsText || termsUrl);
  const requiresTerms = Boolean(terms || action === "install" || action === "update");

  useEffect(() => {
    if (action === "install") {
      setTermsAccepted(false);
      setTermsAction("install");
      setTermsOpen(true);
      return;
    }
    if (action === "update" && installation) {
      setTermsAccepted(false);
      setTermsAction("update");
      setTermsOpen(true);
    }
  }, [action, installation]);

  useEffect(() => {
    if (action !== "open-widget") return;
    if (env?.embedMode) return;
    if (!installation || !widgetsEnabled) return;

    const widget = requestedWidget;
    const widgetId = readString(widget?.id);
    if (!widgetId) return;

    const key = [
      String(xappId ?? ""),
      installation.installationId,
      widgetId,
      readString(queryToolName),
    ].join(":");
    if (autoOpenedWidgetKeyRef.current === key) return;
    autoOpenedWidgetKeyRef.current = key;

    host.openWidget({
      installationId: installation.installationId,
      widgetId,
      xappId: String(xappId ?? ""),
      xappTitle: String(title),
      widgetName:
        resolveMarketplaceText(widget?.title as any, locale) ||
        readString(widget?.widget_name) ||
        readString(widget?.name) ||
        t("common.widget", undefined, "Widget"),
      toolName: readString(widget?.bind_tool_name),
    });
  }, [
    action,
    env?.embedMode,
    host,
    installation,
    locale,
    queryToolName,
    requestedWidget,
    title,
    widgetsEnabled,
    xappId,
  ]);

  const requestsTo = buildRequestsHref({
    xappId: String(xappId ?? ""),
    isEmbedded,
    ...(token ? { token } : {}),
  });
  const detailForOperationalSurfaces = data as unknown as CatalogXappDetail | null;
  const visibleOperationalSurfaces = useMemo(
    () =>
      getVisibleOperationalSurfaces({
        detail: detailForOperationalSurfaces,
        client,
        env,
        isEmbedded,
      }),
    [client, detailForOperationalSurfaces, env, isEmbedded],
  );
  const secondarySurfaceLinks = Array.from(
    new Set([...visibleOperationalSurfaces, ...discoveredOperationalSurfaces]),
  ).filter((surface) => surface !== "requests");
  function getLocalizedOperationalSurfaceLabel(surface: OperationalSurfaceKey): string {
    if (surface === "payments") {
      return t("activity.payments_title", undefined, "Payments");
    }
    if (surface === "invoices") {
      return t("activity.invoices_title", undefined, "Invoices");
    }
    if (surface === "notifications") {
      return t("activity.notifications_title", undefined, "Notifications");
    }
    return t("activity.requests_title", undefined, "Requests");
  }
  const publisherSlug = readString(publisherRecord?.slug);
  const publisherName = readString(publisherRecord?.name) || publisherSlug;
  const publisherTo = publisherSlug
    ? {
        pathname: isEmbedded
          ? `/publishers/${encodeURIComponent(publisherSlug)}`
          : `/marketplace/publishers/${encodeURIComponent(publisherSlug)}`,
        search: tokenSearch,
      }
    : null;
  const guardSummary = useMemo(() => {
    const guardsRaw = Array.isArray(manifest?.guards) ? manifest.guards : [];
    const policyMap = asRecord(manifest?.guards_policy) ?? {};
    const guardItems: GuardInfo[] = guardsRaw
      .map((raw): GuardInfo | null => {
        const guard = asRecord(raw);
        if (!guard) return null;
        const trigger = readString(guard.trigger);
        const slug = readString(guard.slug);
        if (!trigger || !slug) return null;
        const policyKind = normalizeGuardPolicyKind(policyMap[trigger]);
        return {
          slug,
          trigger,
          headless: readBoolean(guard.headless, true),
          blocking: readBoolean(guard.blocking, defaultBlockingForTrigger(trigger)),
          order: readNumber(guard.order),
          policyKind,
        };
      })
      .filter((item): item is GuardInfo => Boolean(item));
    const items: GuardInfo[] = [...guardItems, ...buildMonetizationHookSummaryItems(manifest)].sort(
      (a, b) => {
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        if (a.trigger !== b.trigger) return a.trigger.localeCompare(b.trigger);
        return a.slug.localeCompare(b.slug);
      },
    );
    const byTrigger = new Map<string, GuardInfo[]>();
    for (const item of items) {
      const existing = byTrigger.get(item.trigger) ?? [];
      existing.push(item);
      byTrigger.set(item.trigger, existing);
    }
    return { items, byTrigger };
  }, [manifest]);
  const usageCreditSummary = useMemo(
    () => normalizeUsageCreditSummary(data?.usage_credit_summary),
    [data?.usage_credit_summary],
  );
  const monetizationAccessProjection =
    (monetization?.access_projection as
      | MarketplaceMonetizationAccessProjection
      | null
      | undefined) ?? null;
  const monetizationPaywalls = useMemo(
    () => listXappMonetizationPaywalls(monetization?.paywalls),
    [monetization?.paywalls],
  );
  const selectedPaywall = useMemo(
    () =>
      monetizationPaywalls.find(
        (item) => readString(asRecord(item)?.slug).trim().toLowerCase() === requestedPaywallSlug,
      ) ||
      selectXappMonetizationPaywall({
        paywalls: monetizationPaywalls,
        placement: "default_paywall",
      }) ||
      selectXappMonetizationPaywall({
        paywalls: monetizationPaywalls,
        placement: "paywall",
      }) ||
      monetizationPaywalls[0] ||
      null,
    [monetizationPaywalls, requestedPaywallSlug],
  );
  const selectedPaywallRenderModel = useMemo(
    () => (selectedPaywall ? buildMonetizationPaywallRenderModel(selectedPaywall) : null),
    [selectedPaywall],
  );
  const selectedPaywallPackageRecords = useMemo(
    (): MonetizationPaywallPackageRecord[] =>
      selectedPaywall ? flattenXappMonetizationPaywallPackages(selectedPaywall) : [],
    [selectedPaywall],
  );

  useEffect(() => {
    if (focusedSection !== "plans" || !plansSectionRef.current) return;
    if (typeof plansSectionRef.current.scrollIntoView === "function") {
      plansSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusedSection]);

  useEffect(() => {
    const currentXappId = String(xappId ?? "").trim();
    if (!currentXappId || !paymentReturnIntentId || !paymentReturnStatus) return;

    const handledKey = [
      currentXappId,
      paymentReturnIntentId,
      paymentReturnSessionId,
      paymentReturnStatus,
    ].join(":");
    if (checkoutFinalizeKeyRef.current === handledKey) return;
    checkoutFinalizeKeyRef.current = handledKey;

    const clearReturnParams = () => {
      const nextSearch = stripMonetizationCheckoutReturnParams(loc.search);
      void navigate(
        {
          pathname: loc.pathname,
          search: nextSearch,
        },
        { replace: true },
      );
    };

    if (paymentReturnStatus === "cancelled" || paymentReturnStatus === "canceled") {
      setCheckoutError(null);
      setCheckoutNotice(
        t("xapp.checkout_cancelled", undefined, "Checkout was cancelled before completion."),
      );
      clearReturnParams();
      return;
    }

    if (paymentReturnStatus === "failed") {
      setCheckoutNotice(null);
      setCheckoutError(
        t("xapp.checkout_failed", undefined, "Payment failed before access could be issued."),
      );
      clearReturnParams();
      return;
    }

    if (
      paymentReturnStatus !== "paid" ||
      typeof client.finalizeMyXappPurchasePaymentSession !== "function"
    ) {
      return;
    }

    let cancelled = false;
    setCheckoutNotice(
      t("xapp.checkout_finalizing", undefined, "Finalizing payment and refreshing access..."),
    );
    setCheckoutError(null);

    void (async () => {
      try {
        await client.finalizeMyXappPurchasePaymentSession!({
          xappId: currentXappId,
          intentId: paymentReturnIntentId,
        });
        if (typeof client.getMyXappMonetization === "function") {
          const next = await client.getMyXappMonetization(currentXappId, {
            installationId: installation?.installationId ?? null,
            locale,
          });
          if (!cancelled) setMonetization(next);
        }
        if (!cancelled) {
          setCheckoutNotice(
            t("xapp.checkout_finalized", undefined, "Payment completed and access was refreshed."),
          );
          clearReturnParams();
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          readString(asRecord(error)?.message) ||
          (error instanceof Error ? error.message : "") ||
          t(
            "xapp.checkout_finalize_failed",
            undefined,
            "Payment returned, but access refresh did not complete yet.",
          );
        setCheckoutNotice(null);
        setCheckoutError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    client,
    installation?.installationId,
    locale,
    loc.pathname,
    loc.search,
    navigate,
    paymentReturnIntentId,
    paymentReturnSessionId,
    paymentReturnStatus,
    t,
    xappId,
  ]);

  async function finalizeCurrentUserCheckoutIntent(currentXappId: string, intentId: string) {
    if (typeof client.finalizeMyXappPurchasePaymentSession !== "function") {
      throw new Error(
        t(
          "xapp.checkout_finalize_unavailable",
          undefined,
          "Access refresh is not available for this checkout flow.",
        ),
      );
    }
    setCheckoutNotice(
      t("xapp.checkout_finalizing", undefined, "Finalizing payment and refreshing access..."),
    );
    setCheckoutError(null);
    await client.finalizeMyXappPurchasePaymentSession({
      xappId: currentXappId,
      intentId,
    });
    if (typeof client.getMyXappMonetization === "function") {
      const next = await client.getMyXappMonetization(currentXappId, {
        installationId: installation?.installationId ?? null,
        locale,
      });
      setMonetization(next);
    }
    setCheckoutNotice(
      t("xapp.checkout_finalized", undefined, "Payment completed and access was refreshed."),
    );
  }

  async function startPackageCheckout(packageSlug: string) {
    const normalizedSlug = packageSlug.trim().toLowerCase();
    if (
      !xappId ||
      typeof client.prepareMyXappPurchaseIntent !== "function" ||
      typeof client.createMyXappPurchasePaymentSession !== "function" ||
      !normalizedSlug
    ) {
      return;
    }

    const pkg = selectedPaywallPackageRecords.find(
      (item: MonetizationPaywallPackageRecord) =>
        readString(item.packageSlug).trim().toLowerCase() === normalizedSlug,
    );
    if (pkg) {
      const purchasePolicy = getPackagePurchasePolicy(pkg);
      if (!purchasePolicy.canPurchase) {
        setCheckoutError(
          purchasePolicy.status === "owned_additive_unlock"
            ? t(
                "xapp.checkout_owned_unlock_blocked",
                undefined,
                "This add-on unlock is already owned for the current monetization scope.",
              )
            : t(
                "xapp.checkout_current_plan_blocked",
                undefined,
                "This plan is already active for the current monetization scope.",
              ),
        );
        return;
      }
    }
    const offeringId = readString(pkg?.offeringId);
    const packageId = readString(pkg?.packageId);
    const priceId = readString(pkg?.priceId);
    if (!offeringId || !packageId || !priceId) {
      setCheckoutError(
        t(
          "xapp.checkout_package_missing",
          undefined,
          "This package is missing purchase metadata in the published paywall.",
        ),
      );
      return;
    }

    setCheckoutBusyPackageSlug(normalizedSlug);
    setCheckoutError(null);
    setCheckoutNotice(null);
    try {
      const prepared = await client.prepareMyXappPurchaseIntent({
        xappId: String(xappId),
        offeringId,
        packageId,
        priceId,
        installationId: installation?.installationId ?? null,
      });
      const returnUrl = buildMonetizationCheckoutReturnUrl({
        currentHref: window.location.href,
        intentId: String(prepared.prepared_intent.purchase_intent_id || ""),
        packageSlug: normalizedSlug,
      });
      const payment = await client.createMyXappPurchasePaymentSession({
        xappId: String(xappId),
        intentId: String(prepared.prepared_intent.purchase_intent_id || ""),
        returnUrl,
        cancelUrl: returnUrl,
        xappsResume: returnUrl,
        locale,
      });
      const paymentPageUrl = readString(payment.payment_page_url);
      const paymentStatus = readString(payment.payment_session?.status).trim().toLowerCase();
      if (!paymentPageUrl && (paymentStatus === "paid" || paymentStatus === "completed")) {
        await finalizeCurrentUserCheckoutIntent(
          String(xappId),
          String(prepared.prepared_intent.purchase_intent_id || ""),
        );
        return;
      }
      if (!paymentPageUrl) {
        throw new Error(
          t(
            "xapp.checkout_page_missing",
            undefined,
            "Payment page is not available for this package.",
          ),
        );
      }
      navigateToHostedCheckout(paymentPageUrl);
    } catch (error) {
      const message =
        readString(asRecord(error)?.message) ||
        (error instanceof Error ? error.message : "") ||
        t("xapp.checkout_start_failed", undefined, "Unable to start checkout for this package.");
      setCheckoutError(message);
    } finally {
      setCheckoutBusyPackageSlug("");
    }
  }

  const hasCatalogMonetization = hasMarketplaceCatalogMonetization(manifest);
  const monetizationAccess = asRecord(monetization?.access_projection);
  const monetizationSubscription = asRecord(monetization?.current_subscription);
  const additiveEntitlements = Array.isArray(monetization?.additive_entitlements)
    ? (monetization.additive_entitlements
        .map((item) => asRecord(item))
        .filter((item) => (item ? Object.keys(item).length > 0 : false)) as Array<
        Record<string, unknown>
      >)
    : [];
  const activeAdditiveEntitlements = additiveEntitlements.filter((item) => {
    const status = readString(item.status).trim().toLowerCase();
    return status === "active" || status === "grace_period";
  });
  const additiveUnlockLabels = activeAdditiveEntitlements
    .map((item) => readString(item.tier) || readString(item.product_slug))
    .filter(Boolean);
  const overduePolicy = asRecord(monetizationSubscription?.overdue_policy);
  const currentTier =
    readString(monetizationSubscription?.tier) || readString(monetizationAccess?.tier);
  const balanceState = readString(monetizationAccess?.balance_state);
  const subscriptionStatus = readString(monetizationSubscription?.status);
  const subscriptionCoverage =
    typeof overduePolicy?.has_current_access === "boolean"
      ? overduePolicy.has_current_access
        ? t("xapp.subscription_coverage_active", undefined, "Still covered")
        : t("xapp.subscription_coverage_inactive", undefined, "Not covered")
      : null;
  const subscriptionReasonKey = readString(overduePolicy?.effective_status_reason);
  const subscriptionReason =
    subscriptionReasonKey === "grace_covered_past_due"
      ? t(
          "xapp.subscription_reason_grace_covered_past_due",
          undefined,
          "Coverage remains during grace period",
        )
      : subscriptionReasonKey === "past_due_after_period_end"
        ? t(
            "xapp.subscription_reason_past_due_after_period_end",
            undefined,
            "Current period ended without successful renewal",
          )
        : subscriptionReasonKey === "expired_after_boundary"
          ? t(
              "xapp.subscription_reason_expired_after_boundary",
              undefined,
              "Expiry boundary reached",
            )
          : null;
  const overdueSince = formatDateTime(overduePolicy?.overdue_since, locale);
  const expiryBoundaryAt = formatDateTime(overduePolicy?.expiry_boundary_at, locale);
  const renewsAt = formatDateTime(monetizationSubscription?.renews_at, locale);
  const expiresAt =
    formatDateTime(monetizationSubscription?.expired_at, locale) ||
    formatDateTime(monetizationSubscription?.current_period_ends_at, locale);
  const creditsRemaining = readString(monetizationAccess?.credits_remaining);
  const accessState = resolveMarketplaceDefaultAccessState({
    projection: monetizationAccessProjection,
    hasCatalogMonetization,
    availableLabel: t("xapp.access_state_available", undefined, "available"),
  });
  const hasMonetizationState = Boolean(
    currentTier ||
    accessState ||
    subscriptionStatus ||
    subscriptionCoverage ||
    subscriptionReason ||
    overdueSince ||
    expiryBoundaryAt ||
    renewsAt ||
    expiresAt ||
    creditsRemaining ||
    additiveUnlockLabels.length > 0,
  );
  const manifestScreenshots = Array.isArray(manifest?.screenshots)
    ? manifest.screenshots.map((shot) => readString(shot)).filter(Boolean)
    : [];
  const manifestTags = Array.isArray(manifest?.tags)
    ? manifest.tags.map((tag) => readString(tag)).filter(Boolean)
    : [];

  function getPackagePurchasePolicy(item: Record<string, unknown>) {
    return resolveMonetizationPackagePurchasePolicy({
      item,
      currentSubscription: monetizationSubscription,
      additiveEntitlements: activeAdditiveEntitlements,
    });
  }
  const currentAccessCard = hasMonetizationState ? (
    <div className="mx-sidebar-card">
      <h3 className="mx-section-title mx-detail-sidebar-title">
        {t("xapp.current_access_title", undefined, "Current Access")}
      </h3>
      {currentTier ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.current_plan_label", undefined, "Current plan")}
          </span>
          <span className="mx-meta-value">{currentTier}</span>
        </div>
      ) : null}
      {accessState ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.access_state_label", undefined, "Access state")}
          </span>
          <span className="mx-meta-value">{accessState}</span>
        </div>
      ) : null}
      {subscriptionStatus ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.subscription_status_label", undefined, "Subscription status")}
          </span>
          <span className="mx-meta-value">{subscriptionStatus}</span>
        </div>
      ) : null}
      {subscriptionCoverage ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.subscription_coverage_label", undefined, "Coverage")}
          </span>
          <span className="mx-meta-value">{subscriptionCoverage}</span>
        </div>
      ) : null}
      {subscriptionReason ? (
        <div className="mx-meta-item mx-meta-item-top">
          <span className="mx-meta-label">
            {t("xapp.subscription_reason_label", undefined, "Status reason")}
          </span>
          <span className="mx-meta-value">{subscriptionReason}</span>
        </div>
      ) : null}
      {overdueSince ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.subscription_overdue_since_label", undefined, "Overdue since")}
          </span>
          <span className="mx-meta-value">{overdueSince}</span>
        </div>
      ) : null}
      {expiryBoundaryAt ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.subscription_expiry_boundary_label", undefined, "Expiry boundary")}
          </span>
          <span className="mx-meta-value">{expiryBoundaryAt}</span>
        </div>
      ) : null}
      {renewsAt ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">{t("xapp.renews_at_label", undefined, "Renews at")}</span>
          <span className="mx-meta-value">{renewsAt}</span>
        </div>
      ) : null}
      {expiresAt ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.expires_at_label", undefined, "Expires at")}
          </span>
          <span className="mx-meta-value">{expiresAt}</span>
        </div>
      ) : null}
      {creditsRemaining ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.credits_remaining_label", undefined, "Credits remaining")}
          </span>
          <span className="mx-meta-value">{creditsRemaining}</span>
        </div>
      ) : null}
      {additiveUnlockLabels.length > 0 ? (
        <div className="mx-meta-item mx-meta-item-top">
          <span className="mx-meta-label">
            {t("xapp.add_on_unlocks_label", undefined, "Add-on unlocks")}
          </span>
          <div className="mx-meta-value mx-meta-stack-sm">
            {additiveUnlockLabels.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  ) : null;
  const plansCard = selectedPaywallRenderModel ? (
    <div className="mx-sidebar-card" ref={plansSectionRef}>
      <h3 className="mx-section-title mx-detail-sidebar-title">
        {t("xapp.plan_options_title", undefined, "Plans")}
      </h3>
      <div className="mx-paywall-card-head">
        <div className="mx-paywall-card-title">{selectedPaywallRenderModel.paywallLabel}</div>
        {selectedPaywallRenderModel.summary ? (
          <div className="mx-paywall-card-summary">{selectedPaywallRenderModel.summary}</div>
        ) : null}
      </div>
      {selectedPaywallRenderModel.badges.length > 0 ? (
        <div className="mx-paywall-card-badges">
          {selectedPaywallRenderModel.badges.map((badge: string) => (
            <span key={badge} className="mx-paywall-card-badge">
              {badge}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mx-paywall-card-packages">
        {selectedPaywallRenderModel.packages.map((item: MonetizationPaywallRenderPackage) => {
          const normalizedPackageSlug = item.packageSlug.trim().toLowerCase();
          const purchasePolicy = getPackagePurchasePolicy(item);
          const isCurrentPackage = purchasePolicy.status === "current_recurring_plan";
          const isOwnedAdditive = purchasePolicy.status === "owned_additive_unlock";
          const isAdditiveCompanion =
            purchasePolicy.transitionKind === "buy_additive_unlock" &&
            subscriptionStatus === "active";
          return (
            <div
              key={item.packageId || item.packageSlug}
              className={`mx-paywall-card-package ${item.isDefault ? "is-default" : ""} ${
                selectedPaywallPackageSlug && normalizedPackageSlug === selectedPaywallPackageSlug
                  ? "is-selected"
                  : ""
              }`}
            >
              <div className="mx-paywall-card-package-head">
                <div>
                  <div className="mx-paywall-card-package-title">{item.packageTitle}</div>
                  {item.description ? (
                    <div className="mx-paywall-card-package-description">{item.description}</div>
                  ) : null}
                </div>
                <div className="mx-paywall-card-money">{item.moneyLabel}</div>
              </div>
              <div className="mx-paywall-card-package-meta">
                <span className="mx-paywall-card-package-fit">{item.fitLabel}</span>
                {selectedPaywallPackageSlug &&
                normalizedPackageSlug === selectedPaywallPackageSlug ? (
                  <span className="mx-paywall-card-package-default">
                    {t("xapp.selected_label", undefined, "Selected")}
                  </span>
                ) : null}
                {isOwnedAdditive ? (
                  <span className="mx-paywall-card-package-default">
                    {t("xapp.owned_unlock_label", undefined, "Owned unlock")}
                  </span>
                ) : null}
                {isCurrentPackage && !isOwnedAdditive ? (
                  <span className="mx-paywall-card-package-default">
                    {t("xapp.current_plan_label", undefined, "Current plan")}
                  </span>
                ) : null}
                {isAdditiveCompanion ? (
                  <span className="mx-paywall-card-package-default">
                    {t("xapp.additive_unlock_label", undefined, "Add-on with membership")}
                  </span>
                ) : null}
                {item.isDefault ? (
                  <span className="mx-paywall-card-package-default">
                    {t("xapp.default_label", undefined, "Default")}
                  </span>
                ) : null}
              </div>
              {item.signals.length > 0 ? (
                <div className="mx-paywall-card-signals">
                  {item.signals.map((signal: string) => (
                    <span key={signal} className="mx-paywall-card-signal">
                      {signal}
                    </span>
                  ))}
                </div>
              ) : null}
              {isAdditiveCompanion ? (
                <div className="mx-paywall-card-summary">
                  {t(
                    "xapp.additive_unlock_message",
                    undefined,
                    "This one-time unlock is additive. It adds access on top of the active recurring membership instead of replacing it.",
                  )}
                </div>
              ) : null}
              {typeof client.prepareMyXappPurchaseIntent === "function" &&
              typeof client.createMyXappPurchasePaymentSession === "function" &&
              canMutate ? (
                <button
                  className="mx-btn mx-btn-secondary"
                  disabled={
                    !purchasePolicy.canPurchase || checkoutBusyPackageSlug === normalizedPackageSlug
                  }
                  onClick={() => void startPackageCheckout(item.packageSlug)}
                >
                  {isOwnedAdditive
                    ? t("xapp.owned_unlock_active", undefined, "Owned unlock active")
                    : isCurrentPackage
                      ? t("xapp.current_plan_active", undefined, "Current plan active")
                      : checkoutBusyPackageSlug === normalizedPackageSlug
                        ? t("xapp.checkout_starting", undefined, "Starting checkout...")
                        : isAdditiveCompanion
                          ? t("xapp.additive_unlock_action", undefined, "Purchase add-on unlock")
                          : t("xapp.checkout_action", undefined, "Continue to checkout")}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {checkoutNotice ? <div className="mx-paywall-card-summary">{checkoutNotice}</div> : null}
      {checkoutError ? <div className="mx-payment-lock-error">{checkoutError}</div> : null}
    </div>
  ) : null;
  if (plansOnlyMode) {
    return (
      <div className={`mx-detail-container ${isEmbedded ? "is-embedded" : ""}`}>
        {error && <div className="mx-detail-error">{error}</div>}
        {busy && !data ? (
          <div className="mx-sidebar-card mx-detail-empty" aria-busy="true">
            {t("common.loading", undefined, "Loading...")}
          </div>
        ) : (
          <div className={`mx-plans-route ${widgetHostedPlansMode ? "is-widget-hosted" : ""}`}>
            {!widgetHostedPlansMode ? (
              <div className="mx-plans-route-header">
                <div className="mx-plans-route-title">
                  {t("xapp.plan_options_title", undefined, "Plans")}
                </div>
                <div className="mx-plans-route-subtitle">
                  {title
                    ? t(
                        "xapp.plans_route_subtitle",
                        { title },
                        `Current access and published plans for ${title}.`,
                      )
                    : t(
                        "xapp.plans_route_subtitle_default",
                        undefined,
                        "Current access and published plans for this app.",
                      )}
                </div>
              </div>
            ) : null}
            <div className="mx-plans-route-grid">
              <div className="mx-plans-route-main">
                {currentAccessCard}
                {plansCard || (
                  <div className="mx-sidebar-card mx-detail-empty">
                    {t(
                      "xapp.no_plans_available",
                      undefined,
                      "No published plans are currently available.",
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={`mx-detail-container ${isEmbedded ? "is-embedded" : ""}`}>
      <div className="mx-detail-topbar">
        <div className="mx-detail-topbar-left">
          {!singleXappMode && (
            <Link to={backTo as any} relative="path" className="mx-btn mx-btn-ghost">
              ← {t("common.back", undefined, "Back")}
            </Link>
          )}
          <div className="mx-detail-topbar-title">{title}</div>
        </div>
        <div className="mx-detail-topbar-right">
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
      </div>

      {error && <div className="mx-detail-error">{error}</div>}

      {busy && !data ? (
        <>
          <div className="mx-detail-skeleton-header" aria-busy="true">
            <div className="mx-detail-skeleton-icon" />
            <div className="mx-detail-skeleton-info">
              <div className="mx-skeleton-line mx-skeleton-line-sm" />
              <div className="mx-skeleton-line mx-skeleton-line-title" style={{ width: "55%" }} />
              <div className="mx-skeleton-line mx-skeleton-line-full" />
              <div className="mx-skeleton-line" style={{ width: "45%" }} />
            </div>
          </div>
          <div className="mx-detail-skeleton-grid">
            <div className="mx-detail-skeleton-sections">
              <div className="mx-detail-skeleton-section">
                <div className="mx-skeleton-line mx-skeleton-line-title" style={{ width: "30%" }} />
                <div className="mx-skeleton-line mx-skeleton-line-full" />
                <div className="mx-skeleton-line mx-skeleton-line-full" />
                <div className="mx-skeleton-line" style={{ width: "70%" }} />
              </div>
              <div className="mx-detail-skeleton-section">
                <div className="mx-skeleton-line mx-skeleton-line-title" style={{ width: "40%" }} />
                <div className="mx-skeleton-line mx-skeleton-line-full" />
                <div className="mx-skeleton-line" style={{ width: "60%" }} />
              </div>
            </div>
            <div>
              <div className="mx-detail-skeleton-sidebar-card">
                <div className="mx-skeleton-line mx-skeleton-line-title" style={{ width: "45%" }} />
                <div className="mx-skeleton-line mx-skeleton-line-sm" />
                <div className="mx-skeleton-line mx-skeleton-line-full" />
                <div className="mx-skeleton-line mx-skeleton-line-sm" />
                <div className="mx-skeleton-line" style={{ width: "65%" }} />
                <div className="mx-skeleton-line mx-skeleton-line-sm" />
                <div className="mx-skeleton-line mx-skeleton-line-short" />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <header className="mx-detail-header">
            <img src={imageUrl} alt={title} className="mx-detail-icon" />
            <div className="mx-detail-info">
              <div className="mx-detail-kicker">
                {publisherName
                  ? t(
                      "xapp.kicker_publisher",
                      { publisher: publisherName },
                      `Publisher: ${publisherName}`,
                    )
                  : t("xapp.kicker_default", undefined, "Xapp")}
              </div>
              <h1 className="mx-detail-title">{title}</h1>
              {description ? <p className="mx-detail-subtitle">{description}</p> : null}
              <div className="mx-detail-meta-row">
                <div className="mx-card-slug">{xappId}</div>
                {readString(versionRecord?.version) && (
                  <div className="mx-card-version mx-detail-version-pill">
                    v{readString(versionRecord?.version)}
                  </div>
                )}
                {updateAvailable ? (
                  <div className="mx-detail-update-pill">
                    {t("xapp.update_available", undefined, "Update available")}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mx-detail-actions">
              {canMutate ? (
                <>
                  {installation && updateAvailable && host.requestUpdate ? (
                    <button
                      className="mx-btn mx-btn-primary"
                      disabled={busy || !installation.installationId}
                      onClick={() => {
                        if (requiresTerms) {
                          setTermsAccepted(false);
                          setTermsAction("update");
                          setTermsOpen(true);
                          return;
                        }
                        if (!installation.installationId) return;
                        host.requestUpdate?.({
                          installationId: installation.installationId,
                          xappId: String(xappId ?? ""),
                        });
                      }}
                    >
                      {updateAppLabel}
                    </button>
                  ) : null}

                  {!installation ? (
                    <button
                      className="mx-btn mx-btn-primary"
                      disabled={busy}
                      onClick={() => {
                        if (requiresTerms) {
                          setTermsAccepted(false);
                          setTermsAction("install");
                          setTermsOpen(true);
                          return;
                        }
                        host.requestInstall({
                          xappId: String(xappId ?? ""),
                          defaultWidgetId: readString(defaultWidget?.id) || null,
                          subjectId: host.subjectId ?? null,
                        });
                      }}
                    >
                      {addAppLabel}
                    </button>
                  ) : (
                    <button
                      className="mx-btn mx-btn-outline"
                      data-variant="danger"
                      disabled={busy || !installation.installationId}
                      onClick={() => {
                        if (!installation.installationId) return;
                        setRemoveConfirmOpen(true);
                      }}
                    >
                      {removeAppLabel}
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </header>

          <div className="mx-detail-grid">
            <main className="mx-detail-main">
              <section className="mx-detail-section mx-detail-section-about">
                <h2 className="mx-section-title">{t("xapp.about_title", undefined, "About")}</h2>
                <div className="mx-detail-desc">{description}</div>
              </section>

              <section className="mx-detail-section mx-detail-section-widgets">
                <h2 className="mx-section-title">
                  {t("xapp.available_views_title", undefined, "Available Views")}
                </h2>
                {!widgetsEnabled ? (
                  <div className="mx-sidebar-card mx-detail-empty">
                    {!installation
                      ? t(
                          "xapp.add_to_access_views",
                          undefined,
                          "Add this app to your workspace to access its available views.",
                        )
                      : updateAvailable
                        ? t(
                            "xapp.update_to_access_views",
                            undefined,
                            "An update is available. Please update the app to access its available views.",
                          )
                        : !hasSubject
                          ? t(
                              "xapp.load_as_user_to_access",
                              undefined,
                              "Load the catalog as a user to access this app.",
                            )
                          : null}
                  </div>
                ) : widgets.length === 0 ? (
                  <div className="mx-sidebar-card mx-detail-empty">
                    {t(
                      "xapp.no_views_available",
                      undefined,
                      "No app views are currently available.",
                    )}
                  </div>
                ) : (
                  <div className="mx-detail-widget-list">
                    {widgets.map((w, idx) => {
                      const name =
                        resolveMarketplaceText(w.title as any, locale) ||
                        readString(w.widget_name) ||
                        readString(w.name) ||
                        readString(w.id) ||
                        t("common.widget", undefined, "Widget");
                      const disabled = !widgetsEnabled;
                      const isDefault =
                        readBoolean(w.default, false) ||
                        (idx === 0 && !widgets.some((ww) => readBoolean(ww.default, false)));
                      const widgetType = String(w.type || "").toLowerCase();
                      return (
                        <button
                          key={String(w.id)}
                          disabled={disabled}
                          className={`mx-detail-widget-card ${disabled ? "is-disabled" : ""} ${isDefault ? "is-default" : ""}`}
                          onClick={() => {
                            if (!installation || !widgetsEnabled) return;
                            const widgetId = readString(w.id);
                            if (!widgetId) return;

                            if (env?.embedMode && installation) {
                              navigate({
                                pathname: isEmbedded
                                  ? `/widget/${encodeURIComponent(installation.installationId)}/${encodeURIComponent(widgetId)}`
                                  : `/marketplace/widget/${encodeURIComponent(installation.installationId)}/${encodeURIComponent(widgetId)}`,
                                search: tokenSearch,
                              });
                              return;
                            }

                            host.openWidget({
                              installationId: installation.installationId,
                              widgetId,
                              xappId: String(xappId ?? ""),
                              xappTitle: String(title),
                              widgetName: name,
                              toolName: readString(w.bind_tool_name),
                            });
                          }}
                        >
                          <div className="mx-detail-widget-icon">
                            {widgetType === "read" ? (
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            ) : (
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                              </svg>
                            )}
                          </div>
                          <div className="mx-detail-widget-body">
                            <div className="mx-detail-widget-name">{name}</div>
                            {readString(w.bind_tool_name) && (
                              <div className="mx-detail-widget-tool">
                                {readString(w.bind_tool_name)}
                              </div>
                            )}
                            <div className="mx-detail-widget-badges">
                              {isDefault && (
                                <span className="mx-detail-widget-badge is-primary">
                                  {t("xapp.widget_primary", undefined, "Primary")}
                                </span>
                              )}
                              {widgetType && (
                                <span className="mx-detail-widget-badge">{widgetType}</span>
                              )}
                            </div>
                          </div>
                          <div className="mx-detail-widget-action">
                            <span className="mx-detail-widget-action-label">
                              {t("xapp.widget_open", undefined, "Open")}
                            </span>
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
              <section className="mx-detail-section mx-detail-section-guards">
                <div className="mx-detail-guard-header">
                  <h2 className="mx-section-title mx-section-title-tight">
                    {t("xapp.how_app_runs", undefined, "How This App Runs")}
                  </h2>
                  <button
                    className="mx-btn mx-btn-ghost mx-btn-sm"
                    onClick={() => setGuardSummaryOpen((v) => !v)}
                  >
                    {guardSummaryOpen
                      ? t("activity.hide_details", undefined, "Hide details")
                      : t("xapp.view_details", undefined, "View details")}
                  </button>
                </div>
                {!guardSummaryOpen ? (
                  <div className="mx-sidebar-card mx-guard-summary-card">
                    <div className="mx-guard-summary-icon">
                      {guardSummary.items.length === 0 ? (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <circle cx="10" cy="10" r="9" stroke="#94a3b8" strokeWidth="1.5" />
                          <path
                            d="M6 10l3 3 5-5"
                            stroke="#94a3b8"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M10 2l7 4v4c0 4.42-2.98 8.28-7 9.5C5.98 18.28 3 14.42 3 10V6l7-4z"
                            stroke="#126bf1"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M7 10l2 2 4-4"
                            stroke="#126bf1"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="mx-guard-summary-text">
                      {guardSummary.items.length === 0
                        ? t(
                            "xapp.no_run_requirements",
                            undefined,
                            "This app has no extra run requirements configured.",
                          )
                        : t(
                            "xapp.guard_summary",
                            {
                              itemCount: guardSummary.items.length,
                              itemSuffix: guardSummary.items.length === 1 ? "" : "s",
                              stageCount: guardSummary.byTrigger.size,
                              stageSuffix: guardSummary.byTrigger.size === 1 ? "" : "s",
                            },
                            `This app includes ${guardSummary.items.length} run check${guardSummary.items.length === 1 ? "" : "s"} across ${guardSummary.byTrigger.size} stage${guardSummary.byTrigger.size === 1 ? "" : "s"}. Open details to review access, payment, or follow-up steps.`,
                          )}
                    </div>
                  </div>
                ) : guardSummary.items.length === 0 ? (
                  <div className="mx-sidebar-card mx-guard-summary-card">
                    <div className="mx-guard-summary-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" stroke="#94a3b8" strokeWidth="1.5" />
                        <path
                          d="M6 10l3 3 5-5"
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="mx-guard-summary-text">
                      {t(
                        "xapp.no_run_requirements",
                        undefined,
                        "This app has no extra run requirements configured.",
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mx-guard-pipeline">
                    {Array.from(guardSummary.byTrigger.entries()).map(
                      ([trigger, items], stageIdx) => (
                        <div key={trigger} className="mx-guard-stage">
                          <div className="mx-guard-stage-header">
                            <div className="mx-guard-stage-number">{stageIdx + 1}</div>
                            <div className="mx-guard-stage-icon">
                              {trigger.startsWith("after:") ? (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path
                                    d="M4 8l3 3 5-5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path d="M6 3.5l6 4.5-6 4.5V3.5z" fill="currentColor" />
                                </svg>
                              )}
                            </div>
                            <div className="mx-guard-stage-title">
                              {humanizeTrigger(trigger, t)}
                            </div>
                            <div className="mx-guard-stage-policy">
                              {describeGuardChain(items[0]?.policyKind || "all", t)}
                            </div>
                          </div>
                          <div className="mx-guard-stage-body">
                            {items.map((guard, guardIdx) => (
                              <div
                                key={`${trigger}-${guard.slug}`}
                                className={`mx-guard-row ${guard.blocking ? "mx-guard-row--required" : "mx-guard-row--info"}`}
                              >
                                <div className="mx-guard-row-left">
                                  {guard.order !== null ? (
                                    <span className="mx-guard-row-order">{guard.order}</span>
                                  ) : (
                                    <span className="mx-guard-row-order">{guardIdx + 1}</span>
                                  )}
                                  <span
                                    className="mx-guard-row-name"
                                    title={guard.label || guard.slug}
                                  >
                                    {guard.label ? guard.label : humanizeSlug(guard.slug)}
                                  </span>
                                </div>
                                <div className="mx-guard-row-right">
                                  <span
                                    className={`mx-guard-indicator ${guard.headless ? "mx-guard-indicator--auto" : "mx-guard-indicator--user"}`}
                                  >
                                    {guard.headless ? (
                                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <circle
                                          cx="7"
                                          cy="7"
                                          r="6"
                                          stroke="currentColor"
                                          strokeWidth="1.4"
                                        />
                                        <path
                                          d="M4.5 7l2 2 3.5-3.5"
                                          stroke="currentColor"
                                          strokeWidth="1.4"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <circle
                                          cx="7"
                                          cy="4.5"
                                          r="2.5"
                                          stroke="currentColor"
                                          strokeWidth="1.4"
                                        />
                                        <path
                                          d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5"
                                          stroke="currentColor"
                                          strokeWidth="1.4"
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                    )}
                                    <span>
                                      {guard.headless
                                        ? t("xapp.auto", undefined, "Auto")
                                        : t("xapp.user_step", undefined, "User step")}
                                    </span>
                                  </span>
                                  <span
                                    className={`mx-guard-severity ${guard.blocking ? "mx-guard-severity--required" : "mx-guard-severity--optional"}`}
                                  >
                                    {guard.blocking
                                      ? t("xapp.required", undefined, "Required")
                                      : t("xapp.info", undefined, "Info")}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </section>

              {manifestScreenshots.length > 0 && (
                <section className="mx-detail-section mx-detail-section-screenshots">
                  <h2 className="mx-section-title">
                    {t("xapp.screenshots_title", undefined, "Screenshots")}
                  </h2>
                  <div className="mx-screenshots">
                    {manifestScreenshots.map((s, i) => (
                      <img
                        key={i}
                        src={s}
                        alt={t("xapp.screenshot_alt", { index: i + 1 }, `Screenshot ${i + 1}`)}
                        className="mx-screenshot"
                      />
                    ))}
                  </div>
                </section>
              )}
            </main>

            <aside className="mx-detail-sidebar">
              {currentAccessCard}

              {usageCreditSummary ? (
                <div className="mx-sidebar-card">
                  <h3 className="mx-section-title mx-detail-sidebar-title">
                    {t("xapp.usage_credits_title", undefined, "Usage Credits")}
                  </h3>
                  <div className="mx-meta-item">
                    <span className="mx-meta-label">
                      {t("xapp.available_label", undefined, "Available")}
                    </span>
                    <span className="mx-meta-value">
                      {t(
                        "xapp.ready_to_use",
                        { count: usageCreditSummary.available_count },
                        `${usageCreditSummary.available_count} ready to use`,
                      )}
                    </span>
                  </div>
                  {usageCreditSummary.available_session_backed_count > 0 ? (
                    <div className="mx-meta-item mx-meta-item-top">
                      <span className="mx-meta-label">
                        {t("xapp.source_label", undefined, "Source")}
                      </span>
                      <div className="mx-meta-value mx-meta-stack-sm">
                        <div>
                          {t(
                            "xapp.linked_payment_sessions",
                            { count: usageCreditSummary.available_session_backed_count },
                            `${usageCreditSummary.available_session_backed_count} linked to visible payment sessions`,
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {usageCreditSummary.reserved_active_count > 0 ? (
                    <div className="mx-meta-item">
                      <span className="mx-meta-label">
                        {t("xapp.in_flight_label", undefined, "In flight")}
                      </span>
                      <span className="mx-meta-value">
                        {usageCreditSummary.reserved_active_count}
                      </span>
                    </div>
                  ) : null}
                  {usageCreditSummary.reserved_stale_count > 0 ? (
                    <div className="mx-meta-item">
                      <span className="mx-meta-label">
                        {t("xapp.needs_review_label", undefined, "Needs review")}
                      </span>
                      <span className="mx-meta-value">
                        {usageCreditSummary.reserved_stale_count}
                      </span>
                    </div>
                  ) : null}
                  {usageCreditSummary.available_ledger_only_count > 0 ? (
                    <div className="mx-meta-item mx-meta-item-top">
                      <span className="mx-meta-label">
                        {t("xapp.invalid_label", undefined, "Invalid")}
                      </span>
                      <div className="mx-meta-value mx-meta-stack-sm">
                        <div>
                          {t(
                            "xapp.invalid_credits",
                            { count: usageCreditSummary.available_ledger_only_count },
                            `${usageCreditSummary.available_ledger_only_count} orphan ledger rows are not usable credits`,
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {usageCreditSummary.by_tool.length > 0 ? (
                    <div className="mx-meta-item mx-meta-item-top">
                      <span className="mx-meta-label">
                        {t("xapp.by_tool_label", undefined, "By tool")}
                      </span>
                      <div className="mx-meta-value mx-meta-stack-md">
                        {usageCreditSummary.by_tool.map((tool) => (
                          <div key={tool.tool_name}>
                            <strong>{tool.available_count}</strong>{" "}
                            {t("xapp.for_label", undefined, "for")} <code>{tool.tool_name}</code>
                            {tool.available_ledger_only_count > 0
                              ? ` · ${t(
                                  "xapp.invalid_short",
                                  { count: tool.available_ledger_only_count },
                                  `${tool.available_ledger_only_count} invalid`,
                                )}`
                              : ""}
                            {tool.reserved_active_count > 0
                              ? ` · ${t(
                                  "xapp.in_flight_short",
                                  { count: tool.reserved_active_count },
                                  `${tool.reserved_active_count} in flight`,
                                )}`
                              : ""}
                            {tool.reserved_stale_count > 0
                              ? ` · ${t(
                                  "xapp.stale_short",
                                  { count: tool.reserved_stale_count },
                                  `${tool.reserved_stale_count} stale`,
                                )}`
                              : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {plansCard}

              {installation && defaultWidget && hasSubject && (
                <button
                  className="mx-btn mx-btn-primary mx-detail-primary-cta"
                  onClick={() => {
                    if (env?.embedMode) {
                      navigate({
                        pathname: isEmbedded
                          ? `/widget/${encodeURIComponent(installation.installationId)}/${encodeURIComponent(String(defaultWidget.id))}`
                          : `/marketplace/widget/${encodeURIComponent(installation.installationId)}/${encodeURIComponent(String(defaultWidget.id))}`,
                        search: tokenSearch,
                      });
                      return;
                    }
                    host.openWidget({
                      installationId: installation.installationId,
                      widgetId: readString(defaultWidget.id),
                      xappId: String(xappId ?? ""),
                      xappTitle: String(title),
                      widgetName:
                        resolveMarketplaceText(defaultWidget?.title as any, locale) ||
                        readString(defaultWidget?.widget_name) ||
                        readString(defaultWidget?.name) ||
                        t("common.widget", undefined, "Widget"),
                      toolName: readString(defaultWidget?.bind_tool_name),
                    });
                  }}
                >
                  {openAppLabel}
                </button>
              )}

              {(env?.requestsEnabled !== false || secondarySurfaceLinks.length > 0) && (
                <div className="mx-sidebar-card mx-activity-card">
                  <h3 className="mx-section-title mx-detail-sidebar-title">
                    {t("xapp.activity_title", undefined, "Activity")}
                  </h3>
                  {env?.requestsEnabled !== false && (
                    <Link to={requestsTo} relative="path" className="mx-activity-link">
                      <div className="mx-activity-link-icon mx-activity-link-icon-requests">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                      <span className="mx-activity-link-label">
                        {t("activity.requests_title", undefined, "Requests")}
                      </span>
                      <span className="mx-activity-link-arrow">→</span>
                    </Link>
                  )}
                  {secondarySurfaceLinks.map((surface: OperationalSurfaceKey) => {
                    const iconClass =
                      surface === "payments"
                        ? "mx-activity-link-icon-payments"
                        : surface === "invoices"
                          ? "mx-activity-link-icon-invoices"
                          : "mx-activity-link-icon-notifications";
                    return (
                      <Link
                        key={surface}
                        to={buildOperationalSurfaceHref({
                          surface,
                          xappId: String(xappId ?? ""),
                          token,
                          isEmbedded,
                        })}
                        className="mx-activity-link"
                      >
                        <div className={`mx-activity-link-icon ${iconClass}`}>
                          {surface === "payments" ? (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                              <line x1="1" y1="10" x2="23" y2="10" />
                            </svg>
                          ) : surface === "invoices" ? (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                          ) : (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                          )}
                        </div>
                        <span className="mx-activity-link-label">
                          {getLocalizedOperationalSurfaceLabel(surface)}
                        </span>
                        <span className="mx-activity-link-arrow">→</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              <div className="mx-sidebar-card">
                <h3 className="mx-section-title mx-detail-sidebar-title">
                  {t("xapp.details_title", undefined, "Details")}
                </h3>

                <div className="mx-meta-item">
                  <span className="mx-meta-label">
                    {t("xapp.app_id_label", undefined, "App ID")}
                  </span>
                  <code className="mx-meta-value mx-meta-code">{xappId}</code>
                </div>

                <div className="mx-meta-item">
                  <span className="mx-meta-label">{t("common.status", undefined, "Status")}</span>
                  <span className="mx-meta-value">
                    {installation
                      ? t("xapp.status_added", undefined, "Added")
                      : t("xapp.status_available", undefined, "Available")}
                  </span>
                </div>

                {publisherTo ? (
                  <div className="mx-meta-item">
                    <span className="mx-meta-label">
                      {t("xapp.publisher_label", undefined, "Publisher")}
                    </span>
                    <Link to={publisherTo as any} className="mx-meta-value">
                      {publisherName}
                    </Link>
                  </div>
                ) : null}

                {manifestTags.length > 0 && (
                  <div className="mx-meta-item">
                    <span className="mx-meta-label">{t("xapp.tags_label", undefined, "Tags")}</span>
                    <div className="mx-tag-list">
                      {manifestTags.map((t) => (
                        <span key={t} className="mx-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {requiresTerms && (
                  <div className="mx-detail-terms-link-wrap">
                    <button
                      className="mx-btn mx-btn-ghost mx-detail-terms-link"
                      onClick={() => {
                        setTermsAction("none");
                        setTermsOpen(true);
                      }}
                    >
                      {t("xapp.view_terms", undefined, "View Terms & Conditions")} →
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>

          {termsOpen && (
            <div className="mx-detail-modal-backdrop" onClick={() => setTermsOpen(false)}>
              <div className="mx-sidebar-card mx-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="mx-detail-modal-head">
                  <h2 className="mx-section-title mx-section-title-tight">{termsTitle}</h2>
                  <button
                    onClick={() => setTermsOpen(false)}
                    className="mx-btn mx-btn-ghost"
                    aria-label={t("xapp.close_terms_dialog", undefined, "Close terms dialog")}
                  >
                    ×
                  </button>
                </div>

                <div className="mx-detail-modal-body">
                  {termsText && (
                    <div className="mx-detail-desc mx-detail-modal-copy">{termsText}</div>
                  )}
                  {termsUrl && (
                    <a
                      href={termsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mx-btn mx-btn-outline mx-detail-modal-link"
                    >
                      {t("xapp.view_full_document", undefined, "View Full Document")}
                    </a>
                  )}

                  {(termsAction === "install" || termsAction === "update") && (
                    <label className="mx-detail-terms-accept">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mx-detail-terms-checkbox"
                      />
                      <span className="mx-detail-terms-copy">
                        {t(
                          "xapp.accept_terms",
                          undefined,
                          "I have read and accept the terms and conditions.",
                        )}
                      </span>
                    </label>
                  )}
                </div>

                <div className="mx-detail-modal-actions">
                  <button className="mx-btn mx-btn-outline" onClick={() => setTermsOpen(false)}>
                    {t("common.cancel", undefined, "Cancel")}
                  </button>
                  {termsAction === "install" ? (
                    <button
                      className="mx-btn mx-btn-primary"
                      disabled={!termsAccepted}
                      onClick={() => {
                        host.requestInstall({
                          xappId: String(xappId ?? ""),
                          defaultWidgetId: readString(defaultWidget?.id) || null,
                          subjectId: host.subjectId ?? null,
                          termsAccepted: true,
                        });
                        setTermsOpen(false);
                        setTermsAction("none");
                      }}
                    >
                      {t("xapp.accept_add_app", undefined, "Accept & Add app")}
                    </button>
                  ) : termsAction === "update" ? (
                    <button
                      className="mx-btn mx-btn-primary"
                      disabled={!termsAccepted || !installation}
                      onClick={() => {
                        if (!installation) return;
                        host.requestUpdate?.({
                          installationId: installation.installationId,
                          xappId: String(xappId ?? ""),
                          termsAccepted: true,
                        });
                        setTermsOpen(false);
                        setTermsAction("none");
                      }}
                    >
                      {t("xapp.accept_update", undefined, "Accept & Update")}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <ConfirmActionModal
            open={removeConfirmOpen}
            title={t("catalog.remove_app_title", undefined, "Remove app?")}
            description={t(
              "catalog.remove_app_description",
              { title },
              `Remove ${title} from your current workspace? You can add it again later.`,
            )}
            confirmLabel={removeAppLabel}
            onCancel={() => setRemoveConfirmOpen(false)}
            onConfirm={() => {
              if (!host.requestUninstall || !installation?.installationId) return;
              host.requestUninstall({
                installationId: installation.installationId,
                xappId: String(xappId ?? ""),
              });
              setRemoveConfirmOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}
