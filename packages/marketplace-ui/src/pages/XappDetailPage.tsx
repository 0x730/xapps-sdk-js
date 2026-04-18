import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { resolveMarketplaceText, useMarketplaceI18n } from "../i18n";
import type { TranslateFunction } from "@xapps-platform/platform-i18n";
import {
  buildXmsSubscriptionLifecycleSummary,
  buildMonetizationHistorySurfaceHtml,
  buildMonetizationPaywallRenderModel,
  flattenXappMonetizationPaywallPackages,
  listXappMonetizationPaywalls,
  resolveMonetizationPackagePurchasePolicy,
  selectXappMonetizationPaywall,
  summarizeVirtualCurrencyBalances,
} from "@xapps-platform/browser-host/xms";
import { useMarketplace } from "../MarketplaceContext";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { MarketplacePrimaryNav } from "../components/MarketplacePrimaryNav";
import { XappWorkspaceNav } from "../components/XappWorkspaceNav";
import { buildTokenSearch } from "../utils/embedSearch";
import {
  hasMarketplaceCatalogMonetization,
  resolveMarketplaceDefaultAccessState,
} from "../utils/monetizationAccess";
import { shouldHideMarketplaceVersions } from "../utils/installationPolicy";
import { buildMarketplaceHref } from "../utils/marketplaceRouting";
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
  const keysToDelete: string[] = [];
  for (const key of url.searchParams.keys()) {
    if (key.startsWith("xapps_payment_")) keysToDelete.push(key);
  }
  keysToDelete.push(
    "xapps_resume",
    "xapps_theme",
    "xapps_monetization_intent_id",
    "paywallPackage",
  );
  for (const key of keysToDelete) url.searchParams.delete(key);
  url.searchParams.set("focus", "plans");
  url.searchParams.set("xapps_monetization_intent_id", input.intentId);
  if (input.packageSlug) {
    url.searchParams.set("paywallPackage", input.packageSlug);
  }
  return url.toString();
}

function buildHostedPaymentPageUrl(input: {
  currentHref: string;
  apiBaseUrl?: string | null;
}): string {
  const apiBaseUrl = String(input.apiBaseUrl || "").trim();
  if (apiBaseUrl) {
    try {
      const apiUrl = new URL(apiBaseUrl, window.location.href);
      return `${apiUrl.origin}/v1/gateway-payment.html`;
    } catch {
      // fall through
    }
  }
  const url = new URL(input.currentHref, window.location.href);
  return `${url.origin}/v1/gateway-payment.html`;
}

function normalizeHostedCheckoutUrl(input: {
  paymentPageUrl: string;
  apiBaseUrl?: string | null;
}): string {
  const raw = String(input.paymentPageUrl || "").trim();
  if (!raw) return "";
  try {
    const apiBaseUrl = String(input.apiBaseUrl || "").trim();
    if (apiBaseUrl) {
      return new URL(raw, apiBaseUrl).toString();
    }
  } catch {
    // fall through
  }
  try {
    return new URL(raw, window.location.href).toString();
  } catch {
    return raw;
  }
}

function navigateToHostedCheckout(url: string): void {
  const target = String(url || "").trim();
  if (!target) return;
  try {
    const opened = window.open(target, "_top");
    if (opened) return;
  } catch {
    // Fall through to direct location assignment attempts below.
  }
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

function readVirtualCurrencyDefinition(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  if (!record) return null;
  const code = readString(record.code);
  const name = readString(record.name);
  if (!code && !name) return null;
  return record;
}

function formatVirtualCurrencyLabel(
  value: unknown,
  options?: {
    includeCode?: boolean;
  },
): string {
  const record = readVirtualCurrencyDefinition(value);
  if (!record) return "";
  const code = readString(record.code);
  const name = readString(record.name);
  if (options?.includeCode && name && code && name.toLowerCase() !== code.toLowerCase()) {
    return `${name} (${code})`;
  }
  return name || code;
}

function formatVirtualCurrencyAmount(value: unknown, virtualCurrency: unknown): string {
  const amount = readString(value);
  if (!amount) return "";
  const currencyLabel = formatVirtualCurrencyLabel(virtualCurrency);
  return currencyLabel ? `${amount} ${currencyLabel}` : amount;
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
    label: defaultInvoiceRef ? `Payment completed · ${defaultInvoiceRef}` : "Payment completed",
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
        ? `Payment completed · ${paymentGuardRef} · ${invoiceRef}`
        : `Payment completed · ${paymentGuardRef}`,
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
  const routeView = String(routeQuery.get("view") || "")
    .trim()
    .toLowerCase();
  const paymentReturnSessionId = String(routeQuery.get("xapps_payment_session_id") || "").trim();
  const paymentReturnIntentId = String(routeQuery.get("xapps_monetization_intent_id") || "").trim();
  const tokenSearch = buildTokenSearch(token, loc.search);
  const navigate = useNavigate();
  const autoOpenedWidgetKeyRef = useRef<string>("");
  const plansSectionRef = useRef<HTMLDivElement | null>(null);
  const widgetSectionRef = useRef<HTMLElement | null>(null);
  const visibilityRefreshRef = useRef<number>(0);

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
  const hasSubject = Boolean(host.subjectId);
  const installationPolicyResolved = env?.installationPolicyResolved !== false;
  const mutationControlsReady = installationPolicyResolved || !hasSubject || !canMutate;
  const installationPolicy = env?.installationPolicy ?? host.installationPolicy ?? null;
  const hideVersions = shouldHideMarketplaceVersions({
    installationPolicy,
    installationPolicyResolved,
    subjectId: host.subjectId,
  });

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [monetization, setMonetization] = useState<MarketplaceXappMonetizationState | null>(null);
  const [monetizationHistory, setMonetizationHistory] = useState<Record<string, unknown> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAction, setTermsAction] = useState<"none" | "install" | "update">("none");
  const [termsWidgetId, setTermsWidgetId] = useState<string | null>(null);
  const [termsWidgetName, setTermsWidgetName] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [guardSummaryOpen, setGuardSummaryOpen] = useState(false);
  const [checkoutBusyPackageSlug, setCheckoutBusyPackageSlug] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [subscriptionActionBusy, setSubscriptionActionBusy] = useState<"" | "cancel" | "refresh">(
    "",
  );
  const [subscriptionActionError, setSubscriptionActionError] = useState<string | null>(null);
  const [cancelSubscriptionConfirmOpen, setCancelSubscriptionConfirmOpen] = useState(false);
  const checkoutFinalizeKeyRef = useRef<string>("");

  const installationsByXappId = hasSubject ? host.getInstallationsByXappId() : {};
  const routeInstallationId = String(routeQuery.get("installationId") || "").trim();
  const routePreviewAt = String(
    routeQuery.get("previewAt") || routeQuery.get("preview_at") || "",
  ).trim();
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
  const autoAvailableMode =
    mutationControlsReady &&
    installationPolicy?.mode === "auto_available" &&
    Boolean(hasSubject) &&
    canMutate;
  const autoUpdateMode =
    mutationControlsReady &&
    installationPolicy?.update_mode === "auto_update_compatible" &&
    Boolean(hasSubject) &&
    canMutate;
  const widgetsEnabled =
    Boolean(hasSubject) &&
    (Boolean(installation) || autoAvailableMode) &&
    (!updateAvailable || autoUpdateMode);

  const isEmbedded = window.location.pathname.startsWith("/embed");
  const singleXappMode = env?.singleXappMode;
  const lifecyclePreviewEnabled = env?.devMode === true;
  const routeSurfaceView = routeView === "history" ? "history" : "plans";

  const refresh = useCallback(async () => {
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
  }, [client, installation?.installationId, xappId]);

  const refreshMonetization = useCallback(async () => {
    const currentXappId = String(xappId ?? "").trim();
    if (!currentXappId || !host.subjectId || typeof client.getMyXappMonetization !== "function") {
      setMonetization(null);
      return;
    }
    try {
      const next = await client.getMyXappMonetization(currentXappId, {
        installationId: installation?.installationId ?? null,
        locale,
        previewAt: lifecyclePreviewEnabled ? routePreviewAt || null : null,
      });
      setMonetization(next);
    } catch {
      setMonetization(null);
    }
  }, [
    client,
    host.subjectId,
    installation?.installationId,
    lifecyclePreviewEnabled,
    locale,
    routePreviewAt,
    xappId,
  ]);

  const refreshMonetizationHistory = useCallback(async () => {
    const currentXappId = String(xappId ?? "").trim();
    if (
      !currentXappId ||
      !host.subjectId ||
      typeof client.getMyXappMonetizationHistory !== "function"
    ) {
      setMonetizationHistory(null);
      return;
    }
    try {
      const next = await client.getMyXappMonetizationHistory(currentXappId, {
        installationId: installation?.installationId ?? null,
        limit: 12,
      });
      setMonetizationHistory(asRecord(next));
    } catch {
      setMonetizationHistory(null);
    }
  }, [client, host.subjectId, installation?.installationId, xappId]);

  useEffect(() => {
    void refresh();
    host.notifyNavigation?.({
      path: window.location.pathname,
      page: "xapp-detail",
      params: { xappId },
    });
    // Intentionally avoid depending on the whole host object here.
    // The host changes when installations refresh, and re-running this effect
    // would re-trigger the page fetch and make the plans/paywall redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, xappId]);

  useEffect(() => {
    void refreshMonetization();
  }, [refreshMonetization]);

  useEffect(() => {
    void refreshMonetizationHistory();
  }, [refreshMonetizationHistory]);

  useEffect(() => {
    function handleVisibilityRefresh() {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - visibilityRefreshRef.current < 1500) return;
      visibilityRefreshRef.current = now;
      void refresh();
      void refreshMonetization();
      void refreshMonetizationHistory();
    }
    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [refresh, refreshMonetization, refreshMonetizationHistory]);

  const manifest = asRecord(data?.manifest);
  const xappRecord = asRecord(data?.xapp);
  const versionRecord = asRecord(data?.version);
  const publisherRecord = asRecord(xappRecord?.publisher);
  const title =
    resolveMarketplaceText(manifest?.title as any, locale) ||
    resolveMarketplaceText(xappRecord?.name as any, locale) ||
    readString(xappRecord?.name) ||
    t("xapp.kicker_default", undefined, "Xapp");
  const description =
    resolveMarketplaceText(manifest?.description as any, locale) ||
    resolveMarketplaceText(xappRecord?.description as any, locale) ||
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
  const defaultWidgetId = readString(defaultWidget?.id);
  const defaultWidgetName =
    resolveMarketplaceText(defaultWidget?.title as any, locale) ||
    readString(defaultWidget?.widget_name) ||
    readString(defaultWidget?.name) ||
    "";
  const defaultWidgetToolName = readString(defaultWidget?.bind_tool_name);
  const openAppStrategy = widgets.length > 1 ? "choose_widget" : "direct_widget";
  const handleWorkspaceOpenApp =
    openAppStrategy === "direct_widget" && defaultWidgetId
      ? () => {
          launchWidgetForSubject(
            defaultWidgetId,
            defaultWidgetName,
            defaultWidgetToolName || undefined,
          );
        }
      : undefined;

  const backTo = buildMarketplaceHref(loc.pathname, "", { token });
  const marketplaceRootHref = buildMarketplaceHref(loc.pathname, "", { token });
  const detailHref = buildMarketplaceHref(
    loc.pathname,
    `xapps/${encodeURIComponent(String(xappId ?? ""))}`,
    {
      token,
      installationId: installation?.installationId,
    },
  );

  const terms = asRecord(manifest?.terms);
  const termsTitle =
    resolveMarketplaceText(terms?.title as any, locale) ||
    t("xapp.terms_title", undefined, "Terms & Conditions");
  const termsText = resolveMarketplaceText(terms?.text as any, locale) || readString(terms?.text);
  const termsUrl = readString(terms?.url);
  const hasTermsContent = Boolean(termsText || termsUrl);
  const requiresTerms = Boolean(terms || action === "install" || action === "update");

  function requestInstallForWidget(
    widgetId: string | null,
    widgetName: string | null = null,
    acceptedTerms = false,
    openAfterInstall = false,
  ) {
    host.requestInstall({
      xappId: String(xappId ?? ""),
      defaultWidgetId: widgetId,
      xappTitle: String(title),
      widgetName,
      openAfterInstall,
      subjectId: host.subjectId ?? null,
      ...(acceptedTerms ? { termsAccepted: true } : {}),
    });
  }

  function requestUpdateForWidget(widgetId: string | null, acceptedTerms = false) {
    if (!installation?.installationId || !host.requestUpdate) return;
    const activeWidget =
      widgetId && Array.isArray(widgets)
        ? widgets.find((entry) => readString(entry.id) === widgetId) || null
        : null;
    host.requestUpdate({
      installationId: installation.installationId,
      xappId: String(xappId ?? ""),
      widgetId,
      xappTitle: String(title),
      widgetName:
        resolveMarketplaceText(activeWidget?.title as any, locale) ||
        readString(activeWidget?.name) ||
        null,
      ...(acceptedTerms ? { termsAccepted: true } : {}),
    });
  }

  function openInstalledWidget(widgetId: string, widgetName: string, toolName?: string) {
    if (!installation) return;
    if (env?.embedMode) {
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
      widgetName,
      toolName,
    });
  }

  function launchWidgetForSubject(widgetId: string, widgetName: string, toolName?: string) {
    if (!hasSubject || !widgetId) return;
    if (!installation) {
      if (requiresTerms) {
        setTermsAccepted(false);
        setTermsAction("install");
        setTermsWidgetId(widgetId);
        setTermsWidgetName(widgetName);
        setTermsOpen(true);
        return;
      }
      requestInstallForWidget(widgetId, widgetName, false, true);
      return;
    }
    if (updateAvailable) {
      if (autoUpdateMode && host.requestUpdate) {
        if (requiresTerms) {
          setTermsAccepted(false);
          setTermsAction("update");
          setTermsWidgetId(widgetId);
          setTermsWidgetName(widgetName);
          setTermsOpen(true);
          return;
        }
        requestUpdateForWidget(widgetId);
      }
      return;
    }
    openInstalledWidget(widgetId, widgetName, toolName);
  }

  useEffect(() => {
    if (action === "install") {
      setTermsAccepted(false);
      setTermsAction("install");
      setTermsWidgetId(readString(defaultWidget?.id) || null);
      setTermsWidgetName(resolveMarketplaceText(defaultWidget?.title as any, locale) || null);
      setTermsOpen(true);
      return;
    }
    if (action === "update" && installation) {
      setTermsAccepted(false);
      setTermsAction("update");
      setTermsWidgetId(null);
      setTermsWidgetName(null);
      setTermsOpen(true);
    }
  }, [action, defaultWidget, installation, locale]);

  useEffect(() => {
    if (action !== "open-widget") return;
    if (env?.embedMode) return;
    if (!requestedWidget || !widgetsEnabled) return;

    const widget = requestedWidget;
    const widgetId = readString(widget?.id);
    if (!widgetId) return;

    const key = [
      String(xappId ?? ""),
      installation?.installationId || "auto",
      widgetId,
      readString(queryToolName),
    ].join(":");
    if (autoOpenedWidgetKeyRef.current === key) return;
    autoOpenedWidgetKeyRef.current = key;

    launchWidgetForSubject(
      widgetId,
      resolveMarketplaceText(widget?.title as any, locale) ||
        readString(widget?.widget_name) ||
        readString(widget?.name) ||
        t("common.widget", undefined, "Widget"),
      readString(widget?.bind_tool_name),
    );
  }, [
    action,
    env?.embedMode,
    installation,
    launchWidgetForSubject,
    locale,
    queryToolName,
    requestedWidget,
    widgetsEnabled,
    xappId,
  ]);

  const publisherSlug = readString(publisherRecord?.slug);
  const publisherName = readString(publisherRecord?.name) || publisherSlug;
  const publisherTo = publisherSlug
    ? buildMarketplaceHref(loc.pathname, `publishers/${encodeURIComponent(publisherSlug)}`, {
        token,
      })
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
  const resolvePaywallPackageLabel = useMemo(() => {
    const labels = new Map<string, string>();
    for (const item of selectedPaywallPackageRecords) {
      const productMetadata =
        item.productMetadata && typeof item.productMetadata === "object"
          ? (item.productMetadata as Record<string, unknown>)
          : {};
      const label =
        readString(item.packageTitle) ||
        readString(item.productTitle) ||
        readString(item.productSlug);
      if (!label) continue;
      for (const candidate of [
        item.packageSlug,
        item.productSlug,
        productMetadata.access_tier,
        item.packageId,
        item.productId,
      ]) {
        const key = readString(candidate).trim().toLowerCase();
        if (key && !labels.has(key)) labels.set(key, label);
      }
    }
    return (value: unknown) => labels.get(readString(value).trim().toLowerCase()) || "";
  }, [selectedPaywallPackageRecords]);

  useEffect(() => {
    if (focusedSection !== "plans" || !plansSectionRef.current) return;
    if (typeof plansSectionRef.current.scrollIntoView === "function") {
      plansSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusedSection]);

  useEffect(() => {
    if (
      (focusedSection !== "views" && focusedSection !== "open-app") ||
      !widgetSectionRef.current
    ) {
      return;
    }
    if (typeof widgetSectionRef.current.scrollIntoView === "function") {
      widgetSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
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
            previewAt: lifecyclePreviewEnabled ? routePreviewAt || null : null,
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
    lifecyclePreviewEnabled,
    routePreviewAt,
    t,
    xappId,
  ]);

  async function refreshSubscriptionLifecycle() {
    const currentXappId = String(xappId ?? "").trim();
    const contractId = readString(monetizationSubscription?.id);
    if (
      !currentXappId ||
      !contractId ||
      typeof client.refreshMyXappSubscriptionContractState !== "function"
    ) {
      return;
    }
    setSubscriptionActionBusy("refresh");
    setSubscriptionActionError(null);
    try {
      await client.refreshMyXappSubscriptionContractState({
        xappId: currentXappId,
        contractId,
      });
      await refreshMonetization();
      await refreshMonetizationHistory();
    } catch (error) {
      const message =
        readString(asRecord(error)?.message) ||
        (error instanceof Error ? error.message : "") ||
        t("xapp.subscription_refresh_failed", undefined, "Unable to refresh subscription state.");
      setSubscriptionActionError(message);
    } finally {
      setSubscriptionActionBusy("");
    }
  }

  async function cancelSubscriptionLifecycle() {
    const currentXappId = String(xappId ?? "").trim();
    const contractId = readString(monetizationSubscription?.id);
    if (
      !currentXappId ||
      !contractId ||
      typeof client.cancelMyXappSubscriptionContract !== "function"
    ) {
      return;
    }
    setSubscriptionActionBusy("cancel");
    setSubscriptionActionError(null);
    try {
      await client.cancelMyXappSubscriptionContract({
        xappId: currentXappId,
        contractId,
      });
      await refreshMonetization();
      await refreshMonetizationHistory();
      setCancelSubscriptionConfirmOpen(false);
    } catch (error) {
      const message =
        readString(asRecord(error)?.message) ||
        (error instanceof Error ? error.message : "") ||
        t("xapp.subscription_cancel_failed", undefined, "Unable to cancel this subscription.");
      setSubscriptionActionError(message);
    } finally {
      setSubscriptionActionBusy("");
    }
  }

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
        previewAt: lifecyclePreviewEnabled ? routePreviewAt || null : null,
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
    if (!hasSubject || !canMutate) {
      setCheckoutError(
        t(
          "xapp.checkout_session_required",
          undefined,
          "Checkout requires a subject-bound catalog session. Start from a signed host session to purchase plans.",
        ),
      );
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
        pageUrl: buildHostedPaymentPageUrl({
          currentHref: window.location.href,
          apiBaseUrl: env?.apiBaseUrl || null,
        }),
        returnUrl,
        cancelUrl: returnUrl,
        locale,
      });
      const paymentPageUrl = normalizeHostedCheckoutUrl({
        paymentPageUrl: readString(payment.payment_page_url),
        apiBaseUrl: env?.apiBaseUrl || null,
      });
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
    .map(
      (item) =>
        resolvePaywallPackageLabel(item.tier) ||
        resolvePaywallPackageLabel(item.product_slug) ||
        readString(item.tier) ||
        readString(item.product_slug),
    )
    .filter(Boolean)
    .reduce<string[]>((labels, label) => {
      if (!labels.includes(label)) labels.push(label);
      return labels;
    }, []);
  const subscriptionLifecycle = buildXmsSubscriptionLifecycleSummary({
    currentSubscription: monetizationSubscription,
    locale,
  });
  const subscriptionManagement = asRecord(monetizationSubscription?.subscription_management);
  const subscriptionSubjectActions = asRecord(subscriptionManagement?.subject_actions);
  const canRefreshSubscriptionAction = readBoolean(
    asRecord(subscriptionSubjectActions?.refresh_status)?.available,
    true,
  );
  const canCancelSubscriptionAction = readBoolean(
    asRecord(subscriptionSubjectActions?.cancel_subscription)?.available,
    true,
  );
  const currentTier =
    readString(monetizationSubscription?.tier) || readString(monetizationAccess?.tier);
  const currentTierLabel = resolvePaywallPackageLabel(currentTier) || currentTier;
  const balanceState = readString(monetizationAccess?.balance_state);
  const subscriptionStatus = subscriptionLifecycle.statusLabel;
  const subscriptionCoverage = subscriptionLifecycle.coverageLabel;
  const subscriptionReason = subscriptionLifecycle.reasonLabel;
  const overdueSince = formatDateTime(subscriptionLifecycle.overdueSince, locale);
  const expiryBoundaryAt = formatDateTime(subscriptionLifecycle.expiryBoundaryAt, locale);
  const renewsAt = formatDateTime(subscriptionLifecycle.renewsAt, locale);
  const currentPeriodEndsAt = formatDateTime(subscriptionLifecycle.currentPeriodEndsAt, locale);
  const cancelledAt = formatDateTime(subscriptionLifecycle.cancelledAt, locale);
  const expiresAt = formatDateTime(subscriptionLifecycle.expiresAt, locale);
  const lifecyclePreviewAt = lifecyclePreviewEnabled ? formatDateTime(routePreviewAt, locale) : "";
  const usageCreditAvailableCount = usageCreditSummary
    ? Math.max(0, usageCreditSummary.available_count)
    : null;
  const creditsRemaining =
    usageCreditAvailableCount != null
      ? String(usageCreditAvailableCount)
      : readString(monetizationAccess?.credits_remaining);
  const accessVirtualCurrencyLabel = formatVirtualCurrencyLabel(
    monetizationAccess?.virtual_currency,
    {
      includeCode: true,
    },
  );
  const creditsRemainingLabel = formatVirtualCurrencyAmount(
    creditsRemaining,
    monetizationAccess?.virtual_currency,
  );
  const hasNamedAccessCurrency = Boolean(accessVirtualCurrencyLabel);
  const currentCreditBalanceLabel = hasNamedAccessCurrency
    ? t("xapp.credits_remaining_label", undefined, "Balance")
    : t("xapp.credit_balance_label", undefined, "Credits");
  const accessState = resolveMarketplaceDefaultAccessState({
    projection: monetizationAccessProjection,
    hasCatalogMonetization,
    availableLabel: t("xapp.access_state_available", undefined, "available"),
  });
  const hasMonetizationState = Boolean(
    currentTierLabel ||
    accessState ||
    subscriptionStatus ||
    subscriptionCoverage ||
    subscriptionReason ||
    overdueSince ||
    expiryBoundaryAt ||
    renewsAt ||
    currentPeriodEndsAt ||
    cancelledAt ||
    expiresAt ||
    lifecyclePreviewAt ||
    accessVirtualCurrencyLabel ||
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
      accessProjection: monetizationAccessProjection,
    });
  }
  const currentAccessCard = hasMonetizationState ? (
    <div className="mx-sidebar-card">
      <h3 className="mx-section-title mx-detail-sidebar-title">
        {t("xapp.current_access_title", undefined, "Current access")}
      </h3>
      {currentTierLabel ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.current_plan_label", undefined, "Current plan")}
          </span>
          <span className="mx-meta-value">{currentTierLabel}</span>
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
            {t("xapp.subscription_status_label", undefined, "Subscription state")}
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
      {currentPeriodEndsAt ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.current_period_ends_label", undefined, "Current period ends")}
          </span>
          <span className="mx-meta-value">{currentPeriodEndsAt}</span>
        </div>
      ) : null}
      {cancelledAt ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.cancelled_at_label", undefined, "Cancelled at")}
          </span>
          <span className="mx-meta-value">{cancelledAt}</span>
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
      {lifecyclePreviewAt ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.lifecycle_preview_at_label", undefined, "Preview as of")}
          </span>
          <span className="mx-meta-value">{lifecyclePreviewAt}</span>
        </div>
      ) : null}
      {accessVirtualCurrencyLabel ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">
            {t("xapp.virtual_currency_label", undefined, "Currency")}
          </span>
          <span className="mx-meta-value">{accessVirtualCurrencyLabel}</span>
        </div>
      ) : null}
      {creditsRemaining ? (
        <div className="mx-meta-item">
          <span className="mx-meta-label">{currentCreditBalanceLabel}</span>
          <span className="mx-meta-value">{creditsRemainingLabel || creditsRemaining}</span>
        </div>
      ) : null}
      {additiveUnlockLabels.length > 0 ? (
        <div className="mx-meta-item mx-meta-item-top">
          <span className="mx-meta-label">
            {t("xapp.add_on_unlocks_label", undefined, "Add-on unlocks")}
          </span>
          <div className="mx-meta-value mx-meta-stack-sm">
            {additiveUnlockLabels.map((label, index) => (
              <div key={`${label}:${index}`}>{label}</div>
            ))}
          </div>
        </div>
      ) : null}
      {lifecyclePreviewAt ? (
        <div className="mx-subtle-note">
          {t(
            "xapp.lifecycle_preview_hint",
            undefined,
            "Subscription state is being previewed for the selected time.",
          )}
        </div>
      ) : null}
      {subscriptionActionError ? (
        <div className="mx-subtle-note">{subscriptionActionError}</div>
      ) : null}
      {monetizationSubscription?.id &&
      ((canRefreshSubscriptionAction &&
        typeof client.refreshMyXappSubscriptionContractState === "function") ||
        (canCancelSubscriptionAction &&
          subscriptionLifecycle.canCancel &&
          typeof client.cancelMyXappSubscriptionContract === "function")) ? (
        <div className="mx-detail-actions">
          {canRefreshSubscriptionAction &&
          typeof client.refreshMyXappSubscriptionContractState === "function" ? (
            <button
              className="mx-btn mx-btn-secondary"
              disabled={subscriptionActionBusy !== ""}
              onClick={() => {
                void refreshSubscriptionLifecycle();
              }}
            >
              {subscriptionActionBusy === "refresh"
                ? t("xapp.subscription_refreshing", undefined, "Refreshing...")
                : t("xapp.subscription_refresh_action", undefined, "Refresh status")}
            </button>
          ) : null}
          {canCancelSubscriptionAction &&
          subscriptionLifecycle.canCancel &&
          typeof client.cancelMyXappSubscriptionContract === "function" ? (
            <button
              className="mx-btn mx-btn-outline"
              data-variant="danger"
              disabled={subscriptionActionBusy !== ""}
              onClick={() => setCancelSubscriptionConfirmOpen(true)}
            >
              {subscriptionActionBusy === "cancel"
                ? t("xapp.subscription_cancelling", undefined, "Cancelling...")
                : t("xapp.subscription_cancel_action", undefined, "Cancel subscription")}
            </button>
          ) : null}
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
        <div className="mx-paywall-card-kicker">
          {t("xapp.plan_options_title", undefined, "Plans")}
        </div>
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
        {selectedPaywallRenderModel.packages.map(
          (item: MonetizationPaywallRenderPackage, index) => {
            const normalizedPackageSlug = item.packageSlug.trim().toLowerCase();
            const purchasePolicy = getPackagePurchasePolicy(item);
            const packageSignals = item.signals.filter(
              (signal: string) =>
                !(
                  purchasePolicy.transitionKind === "replace_recurring" &&
                  signal.toLowerCase().includes("trial")
                ),
            );
            const isCurrentPackage = purchasePolicy.status === "current_recurring_plan";
            const isOwnedAdditive = purchasePolicy.status === "owned_additive_unlock";
            const isAdditiveCompanion =
              purchasePolicy.transitionKind === "buy_additive_unlock" &&
              subscriptionStatus === "active";
            const packageActionNote = isOwnedAdditive
              ? t(
                  "xapp.owned_unlock_note",
                  undefined,
                  "This add-on is already included in the current access.",
                )
              : isCurrentPackage
                ? t(
                    "xapp.current_plan_note",
                    undefined,
                    "This plan is already active for this app.",
                  )
                : t(
                    "xapp.checkout_hint",
                    undefined,
                    "Checkout opens in a secure hosted payment page managed by the platform.",
                  );
            return (
              <div
                key={`${item.packageId || item.packageSlug || normalizedPackageSlug}:${index}`}
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
                {packageSignals.length > 0 ? (
                  <div className="mx-paywall-card-signals">
                    {packageSignals.map((signal: string) => (
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
                      "This one-time unlock is additive. It adds access on top of the active subscription instead of replacing it.",
                    )}
                  </div>
                ) : null}
                <div className="mx-paywall-card-package-actions">
                  {typeof client.prepareMyXappPurchaseIntent === "function" &&
                  typeof client.createMyXappPurchasePaymentSession === "function" &&
                  hasSubject &&
                  canMutate ? (
                    <button
                      className={`mx-btn ${
                        purchasePolicy.canPurchase &&
                        !checkoutBusyPackageSlug &&
                        !isOwnedAdditive &&
                        !isCurrentPackage
                          ? "mx-btn-primary"
                          : "mx-btn-secondary"
                      }`}
                      disabled={
                        !purchasePolicy.canPurchase ||
                        checkoutBusyPackageSlug === normalizedPackageSlug
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
                              ? t(
                                  "xapp.additive_unlock_action",
                                  undefined,
                                  "Purchase add-on unlock",
                                )
                              : t("xapp.checkout_action", undefined, "Start checkout")}
                    </button>
                  ) : null}
                  <div className="mx-paywall-card-package-note">{packageActionNote}</div>
                </div>
              </div>
            );
          },
        )}
      </div>
      {checkoutNotice ? <div className="mx-paywall-card-summary">{checkoutNotice}</div> : null}
      {checkoutError ? <div className="mx-payment-lock-error">{checkoutError}</div> : null}
    </div>
  ) : null;
  const detailsCard = (
    <div className="mx-sidebar-card">
      <h3 className="mx-section-title mx-detail-sidebar-title">
        {t("xapp.details_title", undefined, "Details")}
      </h3>

      <div className="mx-meta-item">
        <span className="mx-meta-label">{t("xapp.app_id_label", undefined, "App ID")}</span>
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
          <span className="mx-meta-label">{t("xapp.publisher_label", undefined, "Publisher")}</span>
          <Link to={publisherTo as any} className="mx-meta-value">
            {publisherName}
          </Link>
        </div>
      ) : null}

      {manifestTags.length > 0 && (
        <div className="mx-meta-item">
          <span className="mx-meta-label">{t("xapp.tags_label", undefined, "Tags")}</span>
          <div className="mx-tag-list">
            {manifestTags.map((tag) => (
              <span key={tag} className="mx-tag">
                {tag}
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
  );
  const historySurfaceHtml = useMemo(
    () =>
      buildMonetizationHistorySurfaceHtml(
        {
          history:
            (asRecord(monetizationHistory)?.history as
              | Record<string, unknown>
              | null
              | undefined) ?? monetizationHistory,
        },
        {
          title: t("xapp.history_title", undefined, "History"),
          subtitle: title
            ? t(
                "xapp.history_route_subtitle",
                { title },
                `Balances, recent activity, and purchases for ${title}.`,
              )
            : t(
                "xapp.history_route_subtitle_default",
                undefined,
                "Balances, recent activity, and purchases for this app.",
              ),
          locale,
          showHeader: false,
        },
      ),
    [locale, monetizationHistory, t, title],
  );
  if (plansOnlyMode) {
    return (
      <div
        className={`mx-detail-container mx-detail-container-section-shell ${
          isEmbedded ? "is-embedded" : ""
        }`}
      >
        {error && <div className="mx-detail-error">{error}</div>}
        {busy && !data ? (
          <div className="mx-sidebar-card mx-detail-empty mx-plans-route-empty" aria-busy="true">
            <div className="mx-empty-catalog">
              <div className="mx-empty-catalog-icon">◎</div>
              <div className="mx-empty-catalog-title">
                {t("xapp.plans_loading_title", undefined, "Loading plans")}
              </div>
              <div className="mx-empty-catalog-desc">
                {t(
                  "xapp.plans_loading_desc",
                  undefined,
                  "Preparing published plans, balances, and current access for this app.",
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={`mx-plans-route ${widgetHostedPlansMode ? "is-widget-hosted" : ""}`}>
            {!widgetHostedPlansMode ? (
              <>
                <div className="mx-breadcrumb">
                  <Link to={marketplaceRootHref as any}>
                    {t("common.marketplace", undefined, "Marketplace")}
                  </Link>
                  <span className="mx-breadcrumb-sep">/</span>
                  <Link to={detailHref as any}>{title}</Link>
                  <span className="mx-breadcrumb-sep">/</span>
                  <span>
                    {routeSurfaceView === "history"
                      ? t("xapp.history_title", undefined, "History")
                      : t("xapp.plan_options_title", undefined, "Plans")}
                  </span>
                </div>
                <header className="mx-header">
                  <h1 className="mx-title">
                    {routeSurfaceView === "history"
                      ? t("xapp.history_title", undefined, "History")
                      : t("xapp.plan_options_title", undefined, "Plans")}
                  </h1>
                  <div className="mx-header-actions">
                    <MarketplacePrimaryNav
                      active="xapps"
                      isEmbedded={isEmbedded}
                      tokenSearch={token ? `?token=${encodeURIComponent(token)}` : ""}
                    />
                    {!singleXappMode && (
                      <Link to={marketplaceRootHref as any} className="mx-btn mx-btn-ghost">
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
              </>
            ) : null}
            <XappWorkspaceNav
              xappId={String(xappId ?? "")}
              xappTitle={title}
              isEmbedded={isEmbedded}
              token={token}
              installationId={installation?.installationId}
              active="billing"
              billingActive="plans"
              openWidgetId={defaultWidgetId}
              openWidgetName={defaultWidgetName}
              openToolName={defaultWidgetToolName}
              openAppStrategy={openAppStrategy}
              onOpenApp={handleWorkspaceOpenApp}
            />
            <div className="mx-plans-route-grid">
              <div className="mx-plans-route-main">
                {routeSurfaceView === "history" ? (
                  <div
                    className="mx-history-route-surface"
                    dangerouslySetInnerHTML={{ __html: historySurfaceHtml }}
                  />
                ) : (
                  plansCard || (
                    <div className="mx-sidebar-card mx-detail-empty mx-plans-route-empty">
                      <div className="mx-empty-catalog">
                        <div className="mx-empty-catalog-icon">◎</div>
                        <div className="mx-empty-catalog-title">
                          {t(
                            "xapp.no_plans_available",
                            undefined,
                            "No plans are currently available.",
                          )}
                        </div>
                        <div className="mx-empty-catalog-desc">
                          {t(
                            "xapp.no_plans_available_desc",
                            undefined,
                            "Published plans will appear here when this app exposes a paywall.",
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
              <aside className="mx-detail-sidebar">
                {currentAccessCard}
                {detailsCard}
              </aside>
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

      <XappWorkspaceNav
        xappId={String(xappId ?? "")}
        xappTitle={title}
        isEmbedded={isEmbedded}
        token={token}
        installationId={installation?.installationId}
        active="overview"
        openWidgetId={defaultWidgetId}
        openWidgetName={defaultWidgetName}
        openToolName={defaultWidgetToolName}
        openAppStrategy={openAppStrategy}
        onOpenApp={handleWorkspaceOpenApp}
      />

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
                {!hideVersions && readString(versionRecord?.version) && (
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
              {canMutate && mutationControlsReady ? (
                <>
                  {installation &&
                  updateAvailable &&
                  host.requestUpdate &&
                  installationPolicy?.update_mode !== "auto_update_compatible" ? (
                    <button
                      className="mx-btn mx-btn-primary"
                      disabled={busy || !installation.installationId}
                      onClick={() => {
                        if (requiresTerms) {
                          setTermsAccepted(false);
                          setTermsAction("update");
                          setTermsWidgetId(null);
                          setTermsWidgetName(null);
                          setTermsOpen(true);
                          return;
                        }
                        if (!installation.installationId) return;
                        requestUpdateForWidget(null);
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
                          setTermsWidgetId(readString(defaultWidget?.id) || null);
                          setTermsWidgetName(
                            resolveMarketplaceText(defaultWidget?.title as any, locale) || null,
                          );
                          setTermsOpen(true);
                          return;
                        }
                        requestInstallForWidget(
                          readString(defaultWidget?.id) || null,
                          resolveMarketplaceText(defaultWidget?.title as any, locale) || null,
                          false,
                          autoAvailableMode,
                        );
                      }}
                    >
                      {autoAvailableMode ? openAppLabel : addAppLabel}
                    </button>
                  ) : !autoAvailableMode ? (
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
                  ) : null}
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

              <section
                className="mx-detail-section mx-detail-section-widgets"
                ref={widgetSectionRef}
              >
                <h2 className="mx-section-title">
                  {t("xapp.available_views_title", undefined, "Available Views")}
                </h2>
                {!widgetsEnabled ? (
                  <div className="mx-sidebar-card mx-detail-empty">
                    {!installation
                      ? autoAvailableMode
                        ? t(
                            "xapp.open_to_access_views",
                            undefined,
                            "Open this app to start and install it automatically for your workspace.",
                          )
                        : t(
                            "xapp.add_to_access_views",
                            undefined,
                            "Add this app to your workspace to access its available views.",
                          )
                      : updateAvailable
                        ? autoUpdateMode
                          ? t(
                              "xapp.update_to_access_views_auto",
                              undefined,
                              "Open a view to update the app automatically for your workspace.",
                            )
                          : t(
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
                            if (!widgetsEnabled) return;
                            const widgetId = readString(w.id);
                            if (!widgetId) return;
                            launchWidgetForSubject(widgetId, name, readString(w.bind_tool_name));
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

              {plansCard ? (
                <section className="mx-detail-section mx-detail-section-plans">{plansCard}</section>
              ) : null}

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
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M7 10l2 2 4-4"
                            stroke="currentColor"
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

              {detailsCard}

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

              {defaultWidget && hasSubject && (installation || autoAvailableMode) && (
                <button
                  className="mx-btn mx-btn-primary mx-detail-primary-cta"
                  onClick={() => {
                    const widgetId = readString(defaultWidget.id);
                    if (!widgetId) return;
                    launchWidgetForSubject(
                      widgetId,
                      resolveMarketplaceText(defaultWidget?.title as any, locale) ||
                        readString(defaultWidget?.widget_name) ||
                        readString(defaultWidget?.name) ||
                        t("common.widget", undefined, "Widget"),
                      readString(defaultWidget?.bind_tool_name),
                    );
                  }}
                >
                  {openAppLabel}
                </button>
              )}
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
                  <button
                    className="mx-btn mx-btn-outline"
                    onClick={() => {
                      setTermsOpen(false);
                      setTermsAction("none");
                      setTermsWidgetId(null);
                      setTermsWidgetName(null);
                    }}
                  >
                    {t("common.cancel", undefined, "Cancel")}
                  </button>
                  {termsAction === "install" ? (
                    <button
                      className="mx-btn mx-btn-primary"
                      disabled={!termsAccepted}
                      onClick={() => {
                        requestInstallForWidget(
                          termsWidgetId ?? readString(defaultWidget?.id) ?? null,
                          termsWidgetName ||
                            resolveMarketplaceText(defaultWidget?.title as any, locale) ||
                            null,
                          true,
                          autoAvailableMode,
                        );
                        setTermsOpen(false);
                        setTermsAction("none");
                        setTermsWidgetId(null);
                        setTermsWidgetName(null);
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
                        requestUpdateForWidget(termsWidgetId, true);
                        setTermsOpen(false);
                        setTermsAction("none");
                        setTermsWidgetId(null);
                        setTermsWidgetName(null);
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
            open={cancelSubscriptionConfirmOpen}
            title={t("xapp.subscription_cancel_title", undefined, "Cancel subscription?")}
            description={t(
              "xapp.subscription_cancel_description",
              undefined,
              "The subscription will stop renewing. Current access remains available until the current period ends.",
            )}
            confirmLabel={t("xapp.subscription_cancel_action", undefined, "Cancel subscription")}
            onCancel={() => setCancelSubscriptionConfirmOpen(false)}
            onConfirm={() => {
              void cancelSubscriptionLifecycle();
            }}
          />

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
