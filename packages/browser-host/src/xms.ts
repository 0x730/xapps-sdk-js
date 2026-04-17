import { buildXmsPackageCopy, buildXmsSurfaceCopy } from "./xmsCopy.js";
import { buildModalShellLayout, buildModalShellTheme } from "./modalShell.js";
export { buildXmsSurfaceCopy } from "./xmsCopy.js";

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function readNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readLower(value: unknown): string {
  return readString(value).toLowerCase();
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readLocalizedText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return readString(value) || fallback;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  return (
    readString(record.en) ||
    readString(record.ro) ||
    Object.values(record)
      .map((item) => readString(item))
      .find(Boolean) ||
    fallback
  );
}

function readVirtualCurrencyDefinition(value: unknown): Record<string, unknown> | null {
  const record = readRecord(value);
  if (!record) return null;
  const code = readString(record.code);
  const name = readString(record.name);
  if (!code && !name) return null;
  return record;
}

function hasNamedVirtualCurrency(value: unknown): boolean {
  return Boolean(readVirtualCurrencyDefinition(value));
}

function formatVirtualCurrencyLabel(
  value: unknown,
  options?: {
    includeCode?: boolean;
    preferCode?: boolean;
  },
): string {
  const record = readVirtualCurrencyDefinition(value);
  if (!record) return "";
  const code = readString(record.code);
  const name = readString(record.name);
  if (options?.preferCode && code) return code;
  if (options?.includeCode && name && code && readLower(name) !== readLower(code)) {
    return `${name} (${code})`;
  }
  return name || code;
}

function formatVirtualCurrencyAmountLabel(input: {
  amount: unknown;
  virtualCurrency?: unknown;
  fallbackUnit?: string;
}): string {
  const amount = readString(input.amount);
  if (!amount) return "";
  const currencyLabel = formatVirtualCurrencyLabel(input.virtualCurrency);
  if (currencyLabel) return `${amount} ${currencyLabel}`;
  const fallbackUnit = readString(input.fallbackUnit);
  return fallbackUnit ? `${amount} ${fallbackUnit}` : amount;
}

function normalizeVirtualCurrencyDisplayLabel(label: unknown): string {
  const normalized = readString(label);
  if (!normalized) return "";
  return normalized.replace(/\s+\([^)]+\)\s*$/, "").trim() || normalized;
}

function readPackageVirtualCurrency(item: unknown): Record<string, unknown> | null {
  const record = readRecord(item);
  return (
    readVirtualCurrencyDefinition(record?.virtualCurrency) ??
    readVirtualCurrencyDefinition(readRecord(record?.productMetadata)?.virtual_currency)
  );
}

function readFeatureCurrencyUnitLabel(input: {
  snapshotSummary?: unknown;
  activePackage?: unknown;
}): string {
  const snapshotSummary = readRecord(input.snapshotSummary);
  const wallet = readRecord(snapshotSummary?.wallet);
  const walletCurrencyLabel = normalizeVirtualCurrencyDisplayLabel(wallet?.virtualCurrencyLabel);
  if (walletCurrencyLabel) return walletCurrencyLabel;
  const packageCurrencyLabel = normalizeVirtualCurrencyDisplayLabel(
    formatVirtualCurrencyLabel(readPackageVirtualCurrency(input.activePackage), {
      includeCode: true,
    }),
  );
  return packageCurrencyLabel || "credits";
}

function formatNamedUnitAmount(amount: unknown, unitLabel: string): string {
  const normalizedAmount = readString(amount);
  return normalizedAmount ? `${normalizedAmount} ${unitLabel}` : "";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readColorToken(value: unknown): string {
  const token = readString(value);
  if (!token) return "";
  return token;
}

function buildPaywallThemeStyle(options: {
  themeTokens?: unknown;
  compact?: boolean;
  emphasis?: unknown;
}): string {
  const theme = readRecord(options.themeTokens) ?? {};
  const emphasis = readLower(options.emphasis) || "default";
  const compact = options.compact === true;
  const vars = new Map<string, string>();
  const setVar = (name: string, value: unknown) => {
    const token = readColorToken(value);
    if (!token) return;
    vars.set(name, token);
  };

  setVar("--xapps-paywall-surface", theme.surface);
  setVar("--xapps-paywall-package-surface", theme.package_surface ?? theme.surface_alt);
  setVar("--xapps-paywall-text", theme.text);
  setVar("--xapps-paywall-muted", theme.muted_text ?? theme.muted);
  setVar("--xapps-paywall-border", theme.border);
  setVar("--xapps-paywall-accent-start", theme.accent_start ?? theme.accent);
  setVar("--xapps-paywall-accent-end", theme.accent_end ?? theme.accent_alt);
  setVar("--xapps-paywall-badge-bg", theme.badge_bg);
  setVar("--xapps-paywall-badge-text", theme.badge_text);
  setVar("--xapps-paywall-action-text", theme.action_text);
  setVar("--xapps-paywall-money-bg", theme.money_bg);
  setVar("--xapps-paywall-money-text", theme.money_text);
  setVar("--xapps-paywall-primary-bg", theme.primary_bg);
  setVar("--xapps-paywall-primary-border", theme.primary_border);
  setVar("--xapps-paywall-primary-text", theme.primary_text);
  setVar("--xapps-paywall-selected-bg", theme.selected_bg);
  setVar("--xapps-paywall-selected-border", theme.selected_border);
  setVar("--xapps-paywall-selected-shadow", theme.selected_shadow);
  setVar("--xapps-paywall-default-bg", theme.default_bg);
  setVar("--xapps-paywall-default-border", theme.default_border);
  setVar("--xapps-paywall-default-shadow", theme.default_shadow);
  setVar("--xapps-paywall-signal-bg", theme.signal_bg);
  setVar("--xapps-paywall-signal-text", theme.signal_text);
  setVar("--xapps-paywall-notice-bg", theme.notice_bg);
  setVar("--xapps-paywall-notice-border", theme.notice_border);
  setVar("--xapps-paywall-notice-text", theme.notice_text);
  setVar("--xapps-paywall-success-bg", theme.success_bg);
  setVar("--xapps-paywall-success-border", theme.success_border);
  setVar("--xapps-paywall-success-text", theme.success_text);
  setVar("--xapps-paywall-warning-bg", theme.warning_bg);
  setVar("--xapps-paywall-warning-border", theme.warning_border);
  setVar("--xapps-paywall-warning-text", theme.warning_text);
  setVar("--xapps-paywall-danger-bg", theme.danger_bg);
  setVar("--xapps-paywall-danger-border", theme.danger_border);
  setVar("--xapps-paywall-danger-text", theme.danger_text);

  if (compact) {
    vars.set("--xapps-paywall-gap", "10px");
    vars.set("--xapps-paywall-padding", "14px");
    vars.set("--xapps-paywall-package-padding", "10px");
  }

  if (emphasis === "soft") {
    vars.set("--xapps-paywall-shadow", "0 8px 24px rgba(15, 23, 42, 0.06)");
  } else if (emphasis === "strong") {
    vars.set("--xapps-paywall-shadow", "0 14px 36px rgba(15, 23, 42, 0.14)");
    vars.set("--xapps-paywall-package-shadow", "0 8px 24px rgba(15, 23, 42, 0.12)");
  }

  return Array.from(vars.entries())
    .map(([name, value]) => `${name}:${escapeHtml(value)}`)
    .join(";");
}

function formatStateLabel(value: unknown, fallback = "—"): string {
  const raw = readString(value);
  if (!raw) return fallback;
  return raw.replace(/_/g, " ");
}

function hasPositiveCredits(accessProjection: Record<string, unknown> | null): boolean {
  return readNumber(accessProjection?.credits_remaining, 0) > 0;
}

function isExhaustedIncludedCreditAccess(input: {
  accessProjection: Record<string, unknown> | null;
  currentSubscription?: Record<string, unknown> | null;
}): boolean {
  const balanceState = readLower(input.accessProjection?.balance_state);
  const entitlementState = readLower(input.accessProjection?.entitlement_state);
  return (
    !input.currentSubscription &&
    entitlementState === "active" &&
    !hasPositiveCredits(input.accessProjection) &&
    (balanceState === "empty" || balanceState === "insufficient")
  );
}

function hasEffectiveCoverage(input: {
  accessProjection: Record<string, unknown> | null;
  currentSubscription?: Record<string, unknown> | null;
}): boolean {
  if (isExhaustedIncludedCreditAccess(input)) return false;
  return Boolean(input.accessProjection?.has_current_access);
}

function formatCoverageLabel(input: {
  accessProjection: Record<string, unknown> | null;
  currentSubscription?: Record<string, unknown> | null;
  locale?: unknown;
}): string {
  const copy = buildXmsSurfaceCopy({ locale: input.locale });
  if (isExhaustedIncludedCreditAccess(input)) {
    return buildXmsPackageCopy(input.locale).consumedLabel;
  }
  if (hasEffectiveCoverage(input)) return copy.coverageActiveLabel;
  return copy.coverageInactiveLabel;
}

function resolveSubscriptionCoverageLabel(input: {
  currentSubscription: Record<string, unknown> | null;
  overduePolicy: Record<string, unknown> | null;
  locale?: unknown;
}): string {
  const copy = buildXmsSurfaceCopy({ locale: input.locale });
  if (typeof input.overduePolicy?.has_current_access === "boolean") {
    return input.overduePolicy.has_current_access
      ? copy.coverageActiveLabel
      : copy.coverageInactiveLabel;
  }
  const status = readLower(input.currentSubscription?.status);
  if (
    status === "active" ||
    status === "trialing" ||
    status === "grace" ||
    status === "cancelled"
  ) {
    return copy.coverageActiveLabel;
  }
  if (status === "past_due" || status === "expired" || status === "suspended") {
    return copy.coverageInactiveLabel;
  }
  return "";
}

function resolveSubscriptionReasonLabel(input: {
  overduePolicy: Record<string, unknown> | null;
  locale?: unknown;
}): string {
  const copy = buildXmsSurfaceCopy({ locale: input.locale });
  const reason = readLower(input.overduePolicy?.effective_status_reason);
  if (!reason) return "";
  if (reason === "grace_covered_past_due") return copy.reasonGraceCoveredPastDueLabel;
  if (reason === "past_due_after_period_end") return copy.reasonPastDueAfterPeriodEndLabel;
  if (reason === "expired_after_boundary") return copy.reasonExpiredAfterBoundaryLabel;
  return formatStateLabel(reason, "");
}

function resolveSubscriptionOperatorAuthorityLabel(input: {
  currentSubscription: Record<string, unknown> | null;
  locale?: unknown;
}): string {
  const copy = buildXmsSurfaceCopy({ locale: input.locale });
  const management = readRecord(input.currentSubscription?.subscription_management);
  const ownerScope = readLower(management?.operator_owner_scope);
  if (ownerScope === "gateway") return copy.operatorAuthorityGatewayLabel;
  if (ownerScope === "tenant") return copy.operatorAuthorityTenantLabel;
  if (ownerScope === "publisher") return copy.operatorAuthorityPublisherLabel;
  if (ownerScope === "owner") return copy.operatorAuthorityOwnerLabel;
  return "";
}

function resolveSubscriptionManagementDestinationLabel(input: {
  currentSubscription: Record<string, unknown> | null;
  locale?: unknown;
}): string {
  const copy = buildXmsSurfaceCopy({ locale: input.locale });
  const management = readRecord(input.currentSubscription?.subscription_management);
  const destination = readRecord(management?.management_destination);
  const kind = readLower(destination?.kind);
  if (kind === "gateway_admin") return copy.managementDestinationGatewayLabel;
  if (kind === "tenant_app") return copy.managementDestinationTenantLabel;
  if (kind === "publisher_app") return copy.managementDestinationPublisherLabel;
  if (kind === "app_owner") return copy.managementDestinationOwnerLabel;
  return "";
}

function resolveSubscriptionManagementDestinationHint(input: {
  currentSubscription: Record<string, unknown> | null;
  locale?: unknown;
}): string {
  const copy = buildXmsSurfaceCopy({ locale: input.locale });
  const management = readRecord(input.currentSubscription?.subscription_management);
  const destination = readRecord(management?.management_destination);
  const kind = readLower(destination?.kind);
  if (kind === "gateway_admin") return copy.managementDestinationHintGatewayLabel;
  if (kind === "tenant_app") return copy.managementDestinationHintTenantLabel;
  if (kind === "publisher_app") return copy.managementDestinationHintPublisherLabel;
  if (kind === "app_owner") return copy.managementDestinationHintOwnerLabel;
  return "";
}

function resolveSubscriptionManagementDestinationHref(input: {
  currentSubscription: Record<string, unknown> | null;
}): string {
  const management = readRecord(input.currentSubscription?.subscription_management);
  const destination = readRecord(management?.management_destination);
  return readString(destination?.href);
}

function readSubscriptionActionAvailability(input: {
  currentSubscription: Record<string, unknown> | null;
  actionKey: "refresh_status" | "cancel_subscription";
  fallback: boolean;
}): boolean {
  const management = readRecord(input.currentSubscription?.subscription_management);
  const subjectActions = readRecord(management?.subject_actions);
  const action = readRecord(subjectActions?.[input.actionKey]);
  return readBoolean(action?.available, input.fallback);
}

export function buildXmsSubscriptionLifecycleSummary(input: {
  currentSubscription?: unknown;
  current_subscription?: unknown;
  locale?: unknown;
}): {
  present: boolean;
  status: string;
  statusLabel: string;
  coverageLabel: string;
  reasonCode: string | null;
  reasonLabel: string;
  renewsAt: string | null;
  currentPeriodEndsAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  overdueSince: string | null;
  expiryBoundaryAt: string | null;
  canCancel: boolean;
  canRefresh: boolean;
} {
  function timestampsMatch(left: string | null, right: string | null): boolean {
    if (!left || !right) return false;
    const leftMs = Date.parse(left);
    const rightMs = Date.parse(right);
    if (!Number.isNaN(leftMs) && !Number.isNaN(rightMs)) return leftMs === rightMs;
    return left === right;
  }

  const currentSubscription = readRecord(input.currentSubscription ?? input.current_subscription);
  const overduePolicy =
    currentSubscription?.overdue_policy &&
    typeof currentSubscription.overdue_policy === "object" &&
    !Array.isArray(currentSubscription.overdue_policy)
      ? (currentSubscription.overdue_policy as Record<string, unknown>)
      : null;
  const status = readLower(currentSubscription?.status);
  const renewsAt = readString(currentSubscription?.renews_at) || null;
  const currentPeriodEndsAt = readString(currentSubscription?.current_period_ends_at) || null;
  const expiresAt = readString(currentSubscription?.expired_at) || null;
  const cancelledAt = readString(currentSubscription?.cancelled_at) || null;
  const overdueSince = readString(overduePolicy?.overdue_since) || null;
  let expiryBoundaryAt = readString(overduePolicy?.expiry_boundary_at) || null;

  const normalizedRenewsAt = renewsAt;
  let normalizedCurrentPeriodEndsAt = currentPeriodEndsAt;
  if (
    timestampsMatch(normalizedRenewsAt, normalizedCurrentPeriodEndsAt) ||
    timestampsMatch(expiresAt, normalizedCurrentPeriodEndsAt)
  ) {
    normalizedCurrentPeriodEndsAt = null;
  }
  if (
    timestampsMatch(normalizedRenewsAt, expiryBoundaryAt) ||
    timestampsMatch(normalizedCurrentPeriodEndsAt, expiryBoundaryAt) ||
    timestampsMatch(expiresAt, expiryBoundaryAt)
  ) {
    expiryBoundaryAt = null;
  }

  return {
    present: Boolean(currentSubscription),
    status,
    statusLabel: formatStateLabel(currentSubscription?.status, ""),
    coverageLabel: resolveSubscriptionCoverageLabel({
      currentSubscription,
      overduePolicy,
      locale: input.locale,
    }),
    reasonCode: readString(overduePolicy?.effective_status_reason) || null,
    reasonLabel: resolveSubscriptionReasonLabel({
      overduePolicy,
      locale: input.locale,
    }),
    renewsAt: normalizedRenewsAt,
    currentPeriodEndsAt: normalizedCurrentPeriodEndsAt,
    expiresAt,
    cancelledAt,
    overdueSince,
    expiryBoundaryAt,
    canCancel:
      Boolean(currentSubscription) &&
      (status === "active" || status === "trialing" || status === "grace" || status === "past_due"),
    canRefresh: Boolean(currentSubscription),
  };
}

export function hasSubjectMonetizationContext(session: unknown): boolean {
  const record = session && typeof session === "object" ? (session as Record<string, unknown>) : {};
  const context =
    record.context && typeof record.context === "object" && !Array.isArray(record.context)
      ? (record.context as Record<string, unknown>)
      : {};
  return Boolean(readString(context.subject_id));
}

export function hasInstallationMonetizationContext(session: unknown): boolean {
  const record = session && typeof session === "object" ? (session as Record<string, unknown>) : {};
  const context =
    record.context && typeof record.context === "object" && !Array.isArray(record.context)
      ? (record.context as Record<string, unknown>)
      : {};
  return Boolean(readString(context.installation_id));
}

export function getDefaultXappMonetizationScopeKind(
  session: unknown,
): "subject" | "installation" | "realm" {
  if (hasSubjectMonetizationContext(session)) return "subject";
  if (hasInstallationMonetizationContext(session)) return "installation";
  return "realm";
}

export function flattenXappMonetizationCatalog(items: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const offering of Array.isArray(items) ? items : []) {
    const packages = Array.isArray((offering as any)?.packages) ? (offering as any).packages : [];
    for (const pkg of packages) {
      const price = Array.isArray((pkg as any)?.prices) ? (pkg as any).prices[0] || null : null;
      out.push({
        offeringId: readString((offering as any)?.id),
        offeringSlug: readString((offering as any)?.slug),
        offeringTitle: readLocalizedText(
          (offering as any)?.title,
          readString((offering as any)?.slug) || buildXmsSurfaceCopy().offeringFallbackLabel,
        ),
        offeringPlacement: readString((offering as any)?.placement) || null,
        packageId: readString((pkg as any)?.id),
        packageSlug: readString((pkg as any)?.slug),
        packageTitle: readLocalizedText(
          (pkg as any)?.title,
          readString((pkg as any)?.slug) || buildXmsSurfaceCopy().packageFallbackLabel,
        ),
        packageKind: readString((pkg as any)?.package_kind) || "standard",
        productId: readString((pkg as any)?.product?.id),
        productSlug: readString((pkg as any)?.product?.slug),
        productFamily: readString((pkg as any)?.product?.product_family),
        virtualCurrency: readVirtualCurrencyDefinition((pkg as any)?.product?.virtual_currency),
        productMetadata:
          (pkg as any)?.product?.metadata && typeof (pkg as any).product.metadata === "object"
            ? (pkg as any).product.metadata
            : {},
        priceId: readString((price as any)?.id),
        amount: readString((price as any)?.amount),
        currency: readString((price as any)?.currency),
        billingPeriod: readString((price as any)?.billing_period) || null,
        description:
          readLocalizedText((pkg as any)?.description) ||
          readLocalizedText((pkg as any)?.product?.description),
        metadata:
          (pkg as any)?.metadata && typeof (pkg as any).metadata === "object"
            ? (pkg as any).metadata
            : {},
      });
    }
  }
  return out.filter((item) => item.offeringId && item.packageId && item.priceId);
}

export function listXappMonetizationPaywalls(items: unknown): Array<Record<string, unknown>> {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as Record<string, unknown>);
}

function buildPaywallPlacementCandidates(value: unknown): string[] {
  const raw = readLower(value);
  if (!raw) return [];
  const out = new Set<string>([raw]);
  if (raw === "paywall" || raw === "default_paywall") {
    out.add("paywall");
    out.add("default_paywall");
  }
  if (raw === "feature_paywall" || raw === "feature_gate") {
    out.add("feature_paywall");
    out.add("feature_gate");
  }
  if (raw === "upgrade" || raw === "upgrade_paywall") {
    out.add("upgrade");
    out.add("upgrade_paywall");
  }
  if (raw === "retention" || raw === "retention_paywall") {
    out.add("retention");
    out.add("retention_paywall");
  }
  if (raw === "checkout" || raw === "checkout_entry") {
    out.add("checkout");
    out.add("checkout_entry");
  }
  return Array.from(out);
}

export function selectXappMonetizationPaywall(input: {
  paywalls: unknown;
  slug?: unknown;
  placement?: unknown;
}): Record<string, unknown> | null {
  const paywalls = listXappMonetizationPaywalls(input.paywalls);
  const slug = readLower(input.slug);
  const placement = readLower(input.placement);
  if (slug) {
    const matched = paywalls.find((item) => readLower(item.slug) === slug);
    if (matched) return matched;
  }
  if (placement) {
    const candidates = buildPaywallPlacementCandidates(placement);
    const matched = paywalls.find((item) => candidates.includes(readLower(item.placement)));
    if (matched) return matched;
  }
  return paywalls[0] || null;
}

export function flattenXappMonetizationPaywallPackages(
  paywall: unknown,
): Array<Record<string, unknown>> {
  const record =
    paywall && typeof paywall === "object" && !Array.isArray(paywall)
      ? (paywall as Record<string, unknown>)
      : {};
  const out: Array<Record<string, unknown>> = [];
  for (const pkg of Array.isArray(record.packages) ? record.packages : []) {
    const packageRecord =
      pkg && typeof pkg === "object" && !Array.isArray(pkg) ? (pkg as Record<string, unknown>) : {};
    const price = Array.isArray(packageRecord.prices) ? packageRecord.prices[0] || null : null;
    out.push({
      offeringId: readString(packageRecord.offering_id),
      offeringSlug: readString(packageRecord.offering_slug),
      offeringTitle: readLocalizedText(
        packageRecord.offering_title,
        readString(packageRecord.offering_slug) || buildXmsSurfaceCopy().offeringFallbackLabel,
      ),
      offeringPlacement: readString(packageRecord.offering_placement) || null,
      packageId: readString(packageRecord.id),
      packageSlug: readString(packageRecord.slug),
      packageTitle: readLocalizedText(
        packageRecord.title,
        readLocalizedText(
          (packageRecord.product as Record<string, unknown> | undefined)?.title,
          readString(packageRecord.slug) || buildXmsSurfaceCopy().packageFallbackLabel,
        ),
      ),
      packageKind: readString(packageRecord.package_kind) || "standard",
      productId: readString((packageRecord.product as Record<string, unknown> | undefined)?.id),
      productSlug: readString((packageRecord.product as Record<string, unknown> | undefined)?.slug),
      productTitle: readLocalizedText(
        (packageRecord.product as Record<string, unknown> | undefined)?.title,
        readString((packageRecord.product as Record<string, unknown> | undefined)?.slug),
      ),
      productFamily: readString(
        (packageRecord.product as Record<string, unknown> | undefined)?.product_family,
      ),
      virtualCurrency:
        readVirtualCurrencyDefinition(
          (packageRecord.product as Record<string, unknown> | undefined)?.virtual_currency,
        ) ?? null,
      productMetadata:
        (packageRecord.product as Record<string, unknown> | undefined)?.metadata &&
        typeof (packageRecord.product as Record<string, unknown>).metadata === "object"
          ? ((packageRecord.product as Record<string, unknown>).metadata as Record<string, unknown>)
          : {},
      priceId: readString((price as Record<string, unknown> | null)?.id),
      amount: readString((price as Record<string, unknown> | null)?.amount),
      currency: readString((price as Record<string, unknown> | null)?.currency),
      billingPeriod: readString((price as Record<string, unknown> | null)?.billing_period) || null,
      purchasePolicy: readProjectedPurchasePolicy(packageRecord.purchase_policy),
      metadata:
        packageRecord.metadata && typeof packageRecord.metadata === "object"
          ? (packageRecord.metadata as Record<string, unknown>)
          : {},
    });
  }
  return out.filter((item) => item.offeringId && item.packageId && item.priceId);
}

function formatPlacementLabel(value: unknown, fallback = "General placement"): string {
  const raw = readString(value);
  if (!raw) return fallback;
  return raw.replace(/[_-]+/g, " ");
}

function readPackageCredits(item: Record<string, unknown>): number {
  const metadata =
    item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};
  const direct = readNumber((item as any).credits ?? metadata.credits, -1);
  if (direct > 0) return direct;
  const included = readNumber(metadata.included_credits, -1);
  if (included > 0) return included;
  return 0;
}

export function buildMonetizationOfferingPresentation(input: unknown): {
  offeringLabel: string;
  placementLabel: string;
  summary: string;
} {
  const record =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const surfaceCopy = buildXmsSurfaceCopy({ locale: record.locale });
  const offeringLabel =
    readString(record.offeringTitle) ||
    formatStateLabel(record.offeringSlug, surfaceCopy.offeringFallbackLabel);
  const placementRaw = readLower(record.offeringPlacement);
  const placementLabel = formatPlacementLabel(record.offeringPlacement);
  const copy = buildXmsPackageCopy(record.locale);
  let summary = copy.generalOfferingSummary;

  if (placementRaw.includes("feature") && placementRaw.includes("paywall")) {
    summary = copy.featurePaywallOfferingSummary;
  } else if (placementRaw.includes("paywall")) {
    summary = copy.defaultPaywallOfferingSummary;
  } else if (placementRaw.includes("checkout")) {
    summary = copy.checkoutOfferingSummary;
  } else if (placementRaw.includes("upgrade")) {
    summary = copy.upgradeOfferingSummary;
  }

  return {
    offeringLabel,
    placementLabel,
    summary,
  };
}

export function buildMonetizationPaywallPresentation(input: unknown): {
  paywallLabel: string;
  placementLabel: string;
  summary: string;
  defaultPackageLabel: string;
  packageCountLabel: string;
} {
  const record =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const paywallLabel =
    readLocalizedText(
      record.title,
      formatStateLabel(
        record.slug,
        buildXmsSurfaceCopy({ locale: record.locale }).paywallFallbackLabel,
      ),
    ) || buildXmsSurfaceCopy({ locale: record.locale }).paywallFallbackLabel;
  const placementLabel = formatPlacementLabel(record.placement);
  const packages = flattenXappMonetizationPaywallPackages(record);
  const defaultPackageRef = readString(record.default_package_ref);
  const defaultPackage =
    packages.find((item) => readString(item.packageSlug) === defaultPackageRef) ||
    packages[0] ||
    null;
  const summary =
    readLocalizedText(record.description) ||
    (placementLabel === "General placement"
      ? "Presentation surface for monetized package selection."
      : `${placementLabel} surface for monetized package selection.`);
  return {
    paywallLabel,
    placementLabel,
    summary,
    defaultPackageLabel: defaultPackage ? readString(defaultPackage.packageTitle) : "",
    packageCountLabel: `${packages.length} package${packages.length === 1 ? "" : "s"}`,
  };
}

export function buildMonetizationPaywallRenderModel(input: unknown): {
  paywallLabel: string;
  placementLabel: string;
  summary: string;
  defaultPackageLabel: string;
  packageCountLabel: string;
  badges: string[];
  packages: Array<{
    packageId: string;
    packageSlug: string;
    packageTitle: string;
    productId: string;
    productSlug: string;
    productFamily: string;
    virtualCurrencyCode: string;
    virtualCurrencyName: string;
    virtualCurrencyLabel: string;
    productMetadata: Record<string, unknown>;
    metadata: Record<string, unknown>;
    description: string;
    fitLabel: string;
    moneyLabel: string;
    offeringLabel: string;
    placementLabel: string;
    signals: string[];
    isDefault: boolean;
  }>;
} {
  const record =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const presentation = buildMonetizationPaywallPresentation(record);
  const defaultPackageRef = readString(record.default_package_ref);
  const packages = flattenXappMonetizationPaywallPackages(record).map((item) => {
    const packagePresentation = buildMonetizationPackagePresentation(item);
    return {
      packageId: readString(item.packageId),
      packageSlug: readString(item.packageSlug),
      packageTitle: readString(item.packageTitle) || buildXmsSurfaceCopy().packageFallbackLabel,
      productId: readString(item.productId),
      productSlug: readString(item.productSlug),
      productFamily: readString(item.productFamily),
      virtualCurrencyCode: formatVirtualCurrencyLabel(item.virtualCurrency, { preferCode: true }),
      virtualCurrencyName: formatVirtualCurrencyLabel(item.virtualCurrency),
      virtualCurrencyLabel: formatVirtualCurrencyLabel(item.virtualCurrency, { includeCode: true }),
      productMetadata:
        item.productMetadata &&
        typeof item.productMetadata === "object" &&
        !Array.isArray(item.productMetadata)
          ? (item.productMetadata as Record<string, unknown>)
          : {},
      metadata:
        item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : {},
      description: readString(item.description) || packagePresentation.summary,
      fitLabel: packagePresentation.fitLabel,
      moneyLabel: packagePresentation.moneyLabel,
      offeringLabel: packagePresentation.offeringLabel,
      placementLabel: packagePresentation.placementLabel,
      signals: packagePresentation.signals,
      isDefault: Boolean(defaultPackageRef) && readString(item.packageSlug) === defaultPackageRef,
    };
  });

  const badges = [presentation.placementLabel, presentation.packageCountLabel];
  if (presentation.defaultPackageLabel) {
    badges.push(`default ${presentation.defaultPackageLabel}`);
  }

  return {
    ...presentation,
    badges,
    packages,
  };
}

export const monetizationPaywallRendererStyles = `
.xapps-paywall {
  display: grid;
  gap: var(--xapps-paywall-gap, 14px);
  padding: var(--xapps-paywall-padding, 18px);
  border-radius: 18px;
  border: 1px solid var(--xapps-paywall-border, rgba(58, 47, 28, 0.14));
  background: var(--xapps-paywall-surface, rgba(255,255,255,0.92));
  color: var(--xapps-paywall-text, #241b10);
  box-shadow: var(--xapps-paywall-shadow, none);
}
.xapps-paywall__head {
  display: grid;
  gap: 8px;
}
.xapps-paywall__title {
  margin: 0;
  font: 700 1.15rem/1.15
    var(--xapps-display-font, var(--mx-display-font, var(--mx-font-family, "Inter", "Segoe UI", system-ui, -apple-system, sans-serif)));
}
.xapps-paywall__summary {
  color: var(--xapps-paywall-muted, #6c5d49);
  font-size: 14px;
}
.xapps-paywall__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.xapps-paywall__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--xapps-paywall-badge-bg, rgba(15,118,110,0.08));
  color: var(--xapps-paywall-badge-text, #155e75);
  font-size: 12px;
  font-weight: 700;
}
.xapps-paywall__packages {
  display: grid;
  gap: 12px;
}
.xapps-paywall__package {
  display: grid;
  gap: 10px;
  padding: var(--xapps-paywall-package-padding, 14px);
  border-radius: 16px;
  border: 1px solid var(--xapps-paywall-package-border, rgba(58, 47, 28, 0.12));
  background: var(--xapps-paywall-package-surface, rgba(255,255,255,0.88));
  box-shadow: var(--xapps-paywall-package-shadow, none);
}
.xapps-paywall__package.is-default {
  border-color: var(
    --xapps-paywall-default-border,
    color-mix(in srgb, var(--xapps-accent, #0f766e) 28%, var(--xapps-paywall-border, transparent))
  );
  box-shadow: var(
    --xapps-paywall-default-shadow,
    inset 0 0 0 1px color-mix(in srgb, var(--xapps-accent, #0f766e) 8%, transparent)
  );
}
.xapps-paywall__package.is-selected {
  border-color: var(
    --xapps-paywall-selected-border,
    color-mix(in srgb, var(--xapps-accent-strong, var(--xapps-accent, #155e75)) 32%, var(--xapps-paywall-border, transparent))
  );
  box-shadow: var(
    --xapps-paywall-selected-shadow,
    inset 0 0 0 1px color-mix(in srgb, var(--xapps-accent-strong, var(--xapps-accent, #155e75)) 10%, transparent)
  );
}
.xapps-paywall__package-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}
.xapps-paywall__package-title {
  margin: 0;
  font: 700 1rem/1.15
    var(--xapps-display-font, var(--mx-display-font, var(--mx-font-family, "Inter", "Segoe UI", system-ui, -apple-system, sans-serif)));
}
.xapps-paywall__money {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--xapps-paywall-money-bg, rgba(58, 47, 28, 0.08));
  color: var(--xapps-paywall-money-text, #3a2f1c);
  font-size: 12px;
  font-weight: 700;
}
.xapps-paywall__desc {
  color: var(--xapps-paywall-muted, #6c5d49);
  font-size: 14px;
}
.xapps-paywall__signals {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.xapps-paywall__signal {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--xapps-paywall-signal-bg, rgba(58, 47, 28, 0.06));
  color: var(--xapps-paywall-signal-text, #5a4a31);
  font-size: 12px;
}
.xapps-paywall__action {
  justify-self: start;
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  background: linear-gradient(
    135deg,
    var(--xapps-paywall-accent-start, #0f766e),
    var(--xapps-paywall-accent-end, #155e75)
  );
  color: var(--xapps-paywall-action-text, #f5fffd);
  font-weight: 700;
  cursor: pointer;
}
.xapps-paywall__empty {
  color: var(--xapps-paywall-muted, #6c5d49);
  font-size: 14px;
}
`;

export const monetizationPlansSurfaceStyles = `
.xapps-xms-plans {
  display: grid;
  gap: 16px;
  color: var(--xapps-text-primary, #0f172a);
  font-family: var(
    --xapps-font-family,
    var(--mx-font-family, "Inter", "Segoe UI", system-ui, -apple-system, sans-serif)
  );
}
.xapps-xms-plans__header {
  display: grid;
  gap: 6px;
}
.xapps-xms-plans__title {
  margin: 0;
  font: 700 1.05rem/1.15
    var(--xapps-display-font, var(--mx-display-font, var(--mx-font-family, "Inter", "Segoe UI", system-ui, -apple-system, sans-serif)));
  letter-spacing: -0.01em;
}
.xapps-xms-plans__subtitle {
  color: var(--xapps-text-secondary, #64748b);
  font-size: 13px;
  line-height: 1.45;
}
.xapps-xms-plans__grid {
  display: grid;
  gap: 14px;
}
.xapps-xms-plans__card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--xapps-border-color, rgba(148, 163, 184, 0.24)) 92%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--xapps-surface-bg, #ffffff) 98%, var(--xapps-surface-subtle, #f8fafc)) 0%,
    color-mix(in srgb, var(--xapps-surface-bg, #ffffff) 92%, var(--xapps-surface-subtle, #f8fafc)) 100%
  );
  box-shadow: 0 16px 36px color-mix(in srgb, var(--xapps-text-primary, #0f172a) 8%, transparent);
}
.xapps-xms-plans__section-title {
  margin: 0;
  font: 700 0.98rem/1.1
    var(--xapps-display-font, var(--mx-display-font, var(--mx-font-family, "Inter", "Segoe UI", system-ui, -apple-system, sans-serif)));
  letter-spacing: -0.01em;
}
.xapps-xms-plans__meta {
  display: grid;
  gap: 10px;
}
.xapps-xms-plans__surface-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.xapps-xms-plans__meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  font-size: 13px;
}
.xapps-xms-plans__meta-label {
  color: var(--xapps-text-secondary, #64748b);
  flex: 0 0 124px;
}
.xapps-xms-plans__meta-value {
  color: var(--xapps-text-primary, #0f172a);
  text-align: right;
  font-weight: 600;
}
.xapps-xms-plans__stack {
  display: grid;
  gap: 6px;
}
.xapps-xms-plans__notice {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid
    var(
      --xapps-paywall-notice-border,
      color-mix(in srgb, var(--xapps-accent, #0f766e) 18%, var(--xapps-border-color, transparent))
    );
  background: var(
    --xapps-paywall-notice-bg,
    color-mix(in srgb, var(--xapps-accent, #0f766e) 8%, var(--xapps-surface-bg, #ffffff))
  );
  color: var(
    --xapps-paywall-notice-text,
    color-mix(in srgb, var(--xapps-accent, #0f766e) 82%, var(--xapps-text-primary, #0f172a))
  );
  font-size: 13px;
}
.xapps-xms-plans__error {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid
    var(
      --xapps-paywall-danger-border,
      color-mix(in srgb, var(--xapps-danger, #dc2626) 18%, var(--xapps-border-color, transparent))
    );
  background: var(
    --xapps-paywall-danger-bg,
    color-mix(in srgb, var(--xapps-danger, #dc2626) 8%, var(--xapps-surface-bg, #ffffff))
  );
  color: var(--xapps-paywall-danger-text, var(--xapps-danger, #b91c1c));
  font-size: 13px;
}
.xapps-xms-plans__packages {
  display: grid;
  gap: 12px;
}
.xapps-xms-plans__package {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--xapps-border-color, rgba(148, 163, 184, 0.22)) 88%, transparent);
  background: color-mix(in srgb, var(--xapps-surface-bg, #ffffff) 94%, var(--xapps-surface-subtle, #f8fafc));
}
.xapps-xms-plans__package.is-selected {
  border-color: var(
    --xapps-paywall-selected-border,
    color-mix(in srgb, var(--xapps-accent, #2563eb) 34%, var(--xapps-border-color, transparent))
  );
  box-shadow: var(
    --xapps-paywall-selected-shadow,
    inset 0 0 0 1px color-mix(in srgb, var(--xapps-accent, #2563eb) 12%, transparent)
  );
}
.xapps-xms-plans__package.is-default {
  border-color: var(
    --xapps-paywall-default-border,
    color-mix(in srgb, var(--xapps-accent, #0f766e) 28%, var(--xapps-border-color, transparent))
  );
  box-shadow: var(
    --xapps-paywall-default-shadow,
    inset 0 0 0 1px color-mix(in srgb, var(--xapps-accent, #0f766e) 10%, transparent)
  );
}
.xapps-xms-plans__package-head {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
}
.xapps-xms-plans__package-title {
  margin: 0;
  font: 700 0.98rem/1.15
    var(--xapps-display-font, var(--mx-display-font, var(--mx-font-family, "Inter", "Segoe UI", system-ui, -apple-system, sans-serif)));
  letter-spacing: -0.01em;
}
.xapps-xms-plans__package-description {
  margin-top: 4px;
  color: var(--xapps-text-secondary, #64748b);
  font-size: 13px;
  line-height: 1.45;
}
.xapps-xms-plans__money {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(
    --xapps-paywall-money-bg,
    color-mix(in srgb, var(--xapps-accent, #0f766e) 7%, var(--xapps-surface-bg, #ffffff))
  );
  color: var(
    --xapps-paywall-money-text,
    color-mix(in srgb, var(--xapps-accent, #0f766e) 28%, var(--xapps-text-primary, #1e293b))
  );
  font-size: 12px;
  font-weight: 700;
  border: 1px solid
    var(
      --xapps-paywall-primary-border,
      color-mix(in srgb, var(--xapps-accent, #0f766e) 14%, var(--xapps-border-color, transparent))
    );
}
.xapps-xms-plans__badges,
.xapps-xms-plans__signals {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.xapps-xms-plans__badge,
.xapps-xms-plans__signal {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 12px;
}
.xapps-xms-plans__badge {
  background: var(
    --xapps-paywall-badge-bg,
    color-mix(in srgb, var(--xapps-accent, #2563eb) 8%, var(--xapps-surface-bg, #ffffff))
  );
  color: var(
    --xapps-paywall-badge-text,
    color-mix(in srgb, var(--xapps-accent, #2563eb) 66%, var(--xapps-text-primary, #1d4ed8))
  );
  font-weight: 700;
}
.xapps-xms-plans__signal {
  background: var(
    --xapps-paywall-signal-bg,
    color-mix(in srgb, var(--xapps-text-primary, #0f172a) 4%, var(--xapps-surface-bg, #ffffff))
  );
  color: var(
    --xapps-paywall-signal-text,
    color-mix(in srgb, var(--xapps-text-primary, #0f172a) 42%, var(--xapps-text-secondary, #64748b))
  );
}
.xapps-xms-plans__action {
  justify-self: start;
  min-height: 40px;
  border: 0;
  border-radius: 12px;
  padding: 10px 14px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--xapps-accent, #0f766e) 94%, white),
    color-mix(in srgb, var(--xapps-accent-strong, var(--xapps-accent, #155e75)) 94%, black)
  );
  color: var(--xapps-paywall-action-text, #f8fafc);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 22px color-mix(in srgb, var(--xapps-accent, #0f766e) 18%, transparent);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    filter 0.18s ease;
}
.xapps-xms-plans__action:hover,
.xapps-xms-plans__action:focus-visible {
  color: var(--xapps-paywall-action-text, #f8fafc);
  filter: saturate(1.04) brightness(1.01);
  box-shadow: 0 14px 28px color-mix(in srgb, var(--xapps-accent, #0f766e) 24%, transparent);
}
.xapps-xms-plans__action:active {
  transform: translateY(1px);
}
.xapps-xms-plans__action[disabled] {
  cursor: not-allowed;
  opacity: 0.6;
  filter: none;
  transform: none;
  box-shadow: none;
}
.xapps-xms-plans__surface-action {
  min-height: 38px;
  border-radius: 12px;
  padding: 9px 13px;
  border: 1px solid color-mix(in srgb, var(--xapps-border-color, rgba(148, 163, 184, 0.24)) 92%, transparent);
  background: color-mix(in srgb, var(--xapps-surface-bg, #ffffff) 96%, var(--xapps-surface-subtle, #f8fafc));
  color: var(--xapps-text-primary, #0f172a);
  font-weight: 700;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}
.xapps-xms-plans__surface-action:hover,
.xapps-xms-plans__surface-action:focus-visible {
  border-color: var(
    --xapps-paywall-primary-border,
    color-mix(in srgb, var(--xapps-accent, #0f766e) 28%, var(--xapps-border-color, transparent))
  );
  background: var(
    --xapps-paywall-primary-bg,
    color-mix(in srgb, var(--xapps-accent, #0f766e) 7%, var(--xapps-surface-bg, #ffffff))
  );
  color: var(
    --xapps-paywall-primary-text,
    color-mix(in srgb, var(--xapps-accent, #0f766e) 24%, var(--xapps-text-primary, #0f172a))
  );
}
.xapps-xms-plans__surface-action[data-variant="danger"] {
  border-color: var(
    --xapps-paywall-danger-border,
    color-mix(in srgb, var(--xapps-danger, #dc2626) 22%, var(--xapps-border-color, transparent))
  );
  color: var(--xapps-paywall-danger-text, var(--xapps-danger, #b91c1c));
}
.xapps-xms-plans__surface-action[data-variant="danger"]:hover,
.xapps-xms-plans__surface-action[data-variant="danger"]:focus-visible {
  border-color: var(
    --xapps-paywall-danger-border,
    color-mix(in srgb, var(--xapps-danger, #dc2626) 34%, var(--xapps-border-color, transparent))
  );
  background: var(
    --xapps-paywall-danger-bg,
    color-mix(in srgb, var(--xapps-danger, #dc2626) 8%, var(--xapps-surface-bg, #ffffff))
  );
  color: var(
    --xapps-paywall-danger-text,
    color-mix(in srgb, var(--xapps-danger, #dc2626) 72%, var(--xapps-text-primary, #991b1b))
  );
}
.xapps-xms-plans__surface-action[disabled] {
  cursor: not-allowed;
  opacity: 0.6;
  box-shadow: none;
}
.xapps-xms-plans__empty {
  color: var(--xapps-text-secondary, #64748b);
  font-size: 14px;
}
.xapps-xms-plans__timeline {
  display: grid;
  gap: 10px;
}
.xapps-xms-plans__timeline-item {
  display: grid;
  gap: 5px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--xapps-border-color, rgba(148, 163, 184, 0.18)) 86%, transparent);
  background: color-mix(in srgb, var(--xapps-surface-bg, #ffffff) 95%, var(--xapps-surface-subtle, #f8fafc));
}
.xapps-xms-plans__timeline-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.xapps-xms-plans__timeline-title {
  color: var(--xapps-text-primary, #0f172a);
  font-size: 13px;
  font-weight: 700;
}
.xapps-xms-plans__timeline-when {
  color: var(--xapps-text-secondary, #64748b);
  font-size: 12px;
  white-space: nowrap;
}
.xapps-xms-plans__timeline-meta {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.xapps-xms-plans__history-grid {
  display: grid;
  gap: 12px;
}
.xapps-xms-plans__history-section {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255,255,255,0.92);
}
.xapps-xms-plans__history-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.xapps-xms-plans__history-title {
  margin: 0;
  font: 700 0.92rem/1.1
    var(--xapps-display-font, var(--mx-display-font, var(--mx-font-family, "Inter", "Segoe UI", system-ui, -apple-system, sans-serif)));
}
.xapps-xms-plans__history-count {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}
.xapps-xms-plans__history-list {
  display: grid;
  gap: 9px;
}
.xapps-xms-plans__history-item {
  display: grid;
  gap: 4px;
}
.xapps-xms-plans__history-item-head {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: flex-start;
}
.xapps-xms-plans__history-item-title {
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}
.xapps-xms-plans__history-item-status {
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.xapps-xms-plans__history-item-meta {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
`;

export function buildMonetizationPaywallHtml(
  input: unknown,
  options: {
    actionLabel?: unknown;
    selectedPackageId?: unknown;
    showSummary?: boolean;
    showSignals?: boolean;
    showBadges?: boolean;
    interactive?: boolean;
    emptyLabel?: unknown;
    themeTokens?: unknown;
    compact?: boolean;
    emphasis?: "default" | "soft" | "strong" | unknown;
  } = {},
): string {
  const renderModel = buildMonetizationPaywallRenderModel(input);
  const surfaceCopy = buildXmsSurfaceCopy();
  const actionLabel = readString(options.actionLabel) || surfaceCopy.choosePackageActionLabel;
  const selectedPackageId = readString(options.selectedPackageId);
  const showSummary = options.showSummary !== false;
  const showSignals = options.showSignals !== false;
  const showBadges = options.showBadges !== false;
  const interactive = options.interactive !== false;
  const emptyLabel = readString(options.emptyLabel) || surfaceCopy.noPaywallPackagesLabel;
  const themeStyle = buildPaywallThemeStyle({
    themeTokens: options.themeTokens,
    compact: options.compact === true,
    emphasis: options.emphasis,
  });

  const packagesHtml = renderModel.packages.length
    ? renderModel.packages
        .map((item) => {
          const classes = [
            "xapps-paywall__package",
            item.isDefault ? "is-default" : "",
            selectedPackageId && item.packageId === selectedPackageId ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const signalHtml =
            showSignals && item.signals.length
              ? `<div class="xapps-paywall__signals">${item.signals
                  .map(
                    (signal) => `<span class="xapps-paywall__signal">${escapeHtml(signal)}</span>`,
                  )
                  .join("")}</div>`
              : "";
          const defaultBadge = item.isDefault
            ? `<span class="xapps-paywall__badge">${escapeHtml(surfaceCopy.defaultBadgeLabel)}</span>`
            : "";
          const buttonAttrs = interactive
            ? ` type="button" data-package-id="${escapeHtml(item.packageId)}" data-package-slug="${escapeHtml(
                item.packageSlug,
              )}"`
            : ` type="button" disabled`;
          return `
            <div class="${classes}">
              <div class="xapps-paywall__package-head">
                <div>
                  <h4 class="xapps-paywall__package-title">${escapeHtml(item.packageTitle)}</h4>
                  <div class="xapps-paywall__desc">${escapeHtml(item.description)}</div>
                </div>
                <div class="xapps-paywall__money">${escapeHtml(item.moneyLabel)}</div>
              </div>
              <div class="xapps-paywall__badges">
                <span class="xapps-paywall__badge">${escapeHtml(item.fitLabel)}</span>
                <span class="xapps-paywall__badge">${escapeHtml(item.offeringLabel)}</span>
                ${defaultBadge}
              </div>
              ${signalHtml}
              <button class="xapps-paywall__action"${buttonAttrs}>${escapeHtml(actionLabel)}</button>
            </div>
          `;
        })
        .join("")
    : `<div class="xapps-paywall__empty">${escapeHtml(emptyLabel)}</div>`;

  const badgesHtml =
    showBadges && renderModel.badges.length
      ? `<div class="xapps-paywall__badges">${renderModel.badges
          .map((badge) => `<span class="xapps-paywall__badge">${escapeHtml(badge)}</span>`)
          .join("")}</div>`
      : "";

  return `
    <section class="xapps-paywall${options.compact ? " is-compact" : ""}"${
      themeStyle ? ` style="${themeStyle}"` : ""
    }>
      <div class="xapps-paywall__head">
        <h3 class="xapps-paywall__title">${escapeHtml(renderModel.paywallLabel)}</h3>
        ${
          showSummary
            ? `<div class="xapps-paywall__summary">${escapeHtml(renderModel.summary)}</div>`
            : ""
        }
      </div>
      ${badgesHtml}
      <div class="xapps-paywall__packages">${packagesHtml}</div>
    </section>
  `;
}

export function renderMonetizationPaywall(
  root: Element,
  input: unknown,
  options: {
    actionLabel?: unknown;
    selectedPackageId?: unknown;
    showSummary?: boolean;
    showSignals?: boolean;
    showBadges?: boolean;
    interactive?: boolean;
    emptyLabel?: unknown;
    themeTokens?: unknown;
    compact?: boolean;
    emphasis?: "default" | "soft" | "strong" | unknown;
    onSelectPackage?: ((input: { packageId: string; packageSlug: string }) => void) | null;
  } = {},
): { destroy: () => void } {
  root.innerHTML = buildMonetizationPaywallHtml(input, options);
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".xapps-paywall__action"));
  const listeners: Array<() => void> = [];
  const onSelectPackage =
    typeof options.onSelectPackage === "function" ? options.onSelectPackage : null;

  if (onSelectPackage) {
    for (const button of buttons) {
      const handler = () => {
        onSelectPackage({
          packageId: readString(button.dataset.packageId),
          packageSlug: readString(button.dataset.packageSlug),
        });
      };
      button.addEventListener("click", handler);
      listeners.push(() => button.removeEventListener("click", handler));
    }
  }

  return {
    destroy() {
      for (const cleanup of listeners) cleanup();
      root.innerHTML = "";
    },
  };
}

function formatPlansDateTime(value: unknown, locale = "en"): string {
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

function readActiveAdditiveEntitlements(items: unknown): Array<Record<string, unknown>> {
  return (Array.isArray(items) ? items : [])
    .map((item) => readRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => hasCurrentOwnedEntitlement(item));
}

function buildMonetizationPackageLabelResolver(
  items: Array<Record<string, unknown>>,
): (value: unknown) => string {
  const labels = new Map<string, string>();
  for (const item of items) {
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
      const key = readLower(candidate);
      if (key && !labels.has(key)) labels.set(key, label);
    }
  }
  return (value: unknown) => labels.get(readLower(value)) || "";
}

function formatResolvedAdditiveEntitlementLabels(
  items: Array<Record<string, unknown>>,
  resolveLabel: (value: unknown) => string,
): string[] {
  const labels = new Map<string, string>();
  for (const item of items) {
    const label =
      resolveLabel(item.product_slug) ||
      resolveLabel(item.tier) ||
      readString(item.product_slug) ||
      readString(item.tier);
    if (!label) continue;
    const identity =
      readString(item.product_id) || readString(item.product_slug) || readString(item.id) || label;
    if (!labels.has(identity)) labels.set(identity, label);
  }
  return Array.from(labels.values());
}

function buildPlansActionLabel(input: {
  locale?: unknown;
  policy: {
    canPurchase: boolean;
    status: "available" | "current_recurring_plan" | "owned_additive_unlock";
    transitionKind:
      | "start_recurring"
      | "replace_recurring"
      | "buy_additive_unlock"
      | "buy_credit_pack"
      | "activate_hybrid"
      | "none";
    reason: string | null;
  };
  busy: boolean;
}): string {
  const copy = buildXmsPackageCopy(input.locale);
  if (input.policy.status === "owned_additive_unlock") return copy.ownedUnlockActiveLabel;
  if (input.policy.status === "current_recurring_plan") return copy.currentPlanActiveLabel;
  if (input.busy) return copy.startingCheckoutLabel;
  if (input.policy.transitionKind === "buy_additive_unlock") return copy.purchaseAddOnUnlockLabel;
  return copy.continueToCheckoutLabel;
}

function readHistoryBucket(
  history: Record<string, unknown> | null,
  key: string,
): { total: number; items: Array<Record<string, unknown>> } {
  const bucketSource = history ? history[key] : undefined;
  const bucket = readRecord(bucketSource);
  const bucketItems = bucket ? bucket.items : undefined;
  const items = (Array.isArray(bucketItems) ? bucketItems : [])
    .map((item) => readRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
  return {
    total: readNumber(bucket?.total, items.length),
    items,
  };
}

function formatBalanceQuantity(value: number): string {
  if (!Number.isFinite(value)) return "";
  const normalized = Math.round(value * 10000) / 10000;
  if (Number.isInteger(normalized)) return String(normalized);
  return normalized.toFixed(4).replace(/\.?0+$/, "");
}

export function summarizeVirtualCurrencyBalances(input: unknown): {
  balances: Array<{
    key: string;
    label: string;
    amount: string;
    amountLabel: string;
    accountCount: number;
    hasNamedCurrency: boolean;
  }>;
  totalAccounts: number;
  totalCurrencies: number;
  totalNamedCurrencies: number;
} {
  const record = readRecord(input) ?? {};
  const history = readRecord(record.history) ?? record;
  const walletAccounts = readHistoryBucket(history, "wallet_accounts").items;
  const accessSnapshots = readHistoryBucket(history, "access_snapshots").items;
  const aggregates = new Map<
    string,
    {
      label: string;
      amount: number;
      accountCount: number;
      virtualCurrency: unknown;
      fallbackUnit: string;
    }
  >();

  const upsertBalance = (inputValue: {
    amount: unknown;
    virtualCurrency?: unknown;
    fallbackUnit?: unknown;
    fallbackKey?: unknown;
  }) => {
    const amount = readNumber(inputValue.amount, Number.NaN);
    if (!Number.isFinite(amount) || Math.abs(amount) < 0.0000001) return;
    const label =
      formatVirtualCurrencyLabel(inputValue.virtualCurrency, {
        includeCode: true,
      }) ||
      readString(inputValue.fallbackUnit) ||
      readString(inputValue.fallbackKey) ||
      "Balance";
    const key =
      formatVirtualCurrencyLabel(inputValue.virtualCurrency, {
        preferCode: true,
      }) ||
      readString(inputValue.fallbackKey) ||
      label.toLowerCase();
    const existing = aggregates.get(key);
    if (existing) {
      existing.amount += amount;
      existing.accountCount += 1;
      return;
    }
    aggregates.set(key, {
      label,
      amount,
      accountCount: 1,
      virtualCurrency: inputValue.virtualCurrency ?? null,
      fallbackUnit: readString(inputValue.fallbackUnit),
    });
  };

  for (const item of walletAccounts) {
    upsertBalance({
      amount: item.balance_remaining,
      virtualCurrency: item.virtual_currency,
      fallbackUnit: "credits",
      fallbackKey: item.product_slug || item.id,
    });
  }

  if (aggregates.size === 0 && accessSnapshots.length > 0) {
    for (const item of accessSnapshots) {
      upsertBalance({
        amount: item.credits_remaining,
        virtualCurrency: item.virtual_currency,
        fallbackUnit: "credits",
        fallbackKey: item.tier || item.id,
      });
    }
  }

  const balances = Array.from(aggregates.entries())
    .map(([key, item]) => {
      const amount = formatBalanceQuantity(item.amount);
      return {
        key,
        label: item.label,
        amount,
        amountLabel:
          formatVirtualCurrencyAmountLabel({
            amount,
            virtualCurrency: item.virtualCurrency,
            fallbackUnit: item.fallbackUnit,
          }) || amount,
        accountCount: item.accountCount,
        hasNamedCurrency: hasNamedVirtualCurrency(item.virtualCurrency),
      };
    })
    .sort((left, right) => {
      const amountDiff = readNumber(right.amount) - readNumber(left.amount);
      if (Math.abs(amountDiff) > 0.0000001) return amountDiff > 0 ? 1 : -1;
      return left.label.localeCompare(right.label);
    });

  return {
    balances,
    totalAccounts: walletAccounts.length,
    totalCurrencies: balances.length,
    totalNamedCurrencies: balances.filter((item) => item.hasNamedCurrency).length,
  };
}

function readHistoryTitle(item: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const segments = key.split(".");
    let current: unknown = item;
    for (const segment of segments) {
      const record = readRecord(current);
      current = record ? record[segment] : undefined;
    }
    if (key.startsWith("virtual_currency.")) {
      const value = formatVirtualCurrencyLabel(item.virtual_currency ?? current, {
        includeCode: true,
      });
      if (value) return value;
    }
    const value = readString(current);
    if (value) return value;
  }
  return fallback;
}

function readHistoryMeta(item: Record<string, unknown>, keys: string[], locale: string): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const segments = key.split(".");
    let current: unknown = item;
    for (const segment of segments) {
      const record = readRecord(current);
      current = record ? record[segment] : undefined;
    }
    const value =
      key === "settlement_effect_detail"
        ? formatSettlementEffectDetailLabel(item.settlement_effect, current, locale)
        : key === "balance_remaining"
          ? formatVirtualCurrencyAmountLabel({
              amount: current,
              virtualCurrency: item.virtual_currency,
              fallbackUnit: readString(item.currency),
            })
          : key === "amount"
            ? formatVirtualCurrencyAmountLabel({
                amount: current,
                virtualCurrency: item.virtual_currency,
                fallbackUnit: readString(item.currency),
              })
            : key === "credits_remaining"
              ? formatVirtualCurrencyAmountLabel({
                  amount: current,
                  virtualCurrency: item.virtual_currency,
                  fallbackUnit: "credits",
                })
              : key.endsWith("_at")
                ? formatPlansDateTime(current, locale)
                : readString(current);
    if (value) out.push(formatStateLabel(value, value));
  }
  return out;
}

function formatTimelineBucketLabel(value: unknown, locale: string): string {
  const normalized = readLower(value);
  const copy = buildXmsSurfaceCopy({ locale });
  if (!normalized) return copy.historyGenericLabel;
  if (normalized === "purchase_intents") return copy.historyPurchaseIntentLabel;
  if (normalized === "transactions") return copy.historyTransactionLabel;
  if (normalized === "subscriptions") return copy.historySubscriptionContractLabel;
  if (normalized === "entitlements") return copy.historyEntitlementLabel;
  if (normalized === "wallet_ledger") return copy.historyWalletLedgerTitle;
  if (normalized === "access_snapshots") return copy.historyAccessSnapshotLabel;
  if (normalized === "invoices") return copy.historyInvoiceLabel;
  return formatStateLabel(normalized, normalized);
}

function formatSettlementEffectDetailLabel(
  effect: unknown,
  detail: unknown,
  locale: string,
): string | null {
  const rawDetail = readString(detail);
  if (!rawDetail) return null;
  const normalizedEffect = readLower(effect);
  const normalizedDetail = readLower(detail);
  const copy = buildXmsSurfaceCopy({ locale });
  if (normalizedEffect === "transaction_chargeback") {
    if (normalizedDetail === "warning_needs_response") {
      return copy.historySettlementDetailDisputeWarningNeedsResponse;
    }
    if (normalizedDetail === "warning_under_review") {
      return copy.historySettlementDetailDisputeWarningUnderReview;
    }
    if (normalizedDetail === "warning_closed") {
      return copy.historySettlementDetailDisputeWarningClosed;
    }
    if (normalizedDetail === "needs_response") {
      return copy.historySettlementDetailDisputeNeedsResponse;
    }
    if (normalizedDetail === "under_review") {
      return copy.historySettlementDetailDisputeUnderReview;
    }
    if (normalizedDetail === "won") {
      return copy.historySettlementDetailDisputeWon;
    }
    if (normalizedDetail === "lost") {
      return copy.historySettlementDetailDisputeLost;
    }
    return normalizedDetail.replace(/_/g, " ");
  }
  return rawDetail;
}

function buildTimelineHtml(input: {
  total: number;
  items: Array<Record<string, unknown>>;
  locale: string;
}): string {
  if (!input.total) return "";
  const items = [...input.items].sort((left, right) => {
    const leftAt = Date.parse(readString(left.occurred_at));
    const rightAt = Date.parse(readString(right.occurred_at));
    if (Number.isFinite(leftAt) && Number.isFinite(rightAt) && leftAt !== rightAt) {
      return rightAt - leftAt;
    }
    return readString(right.id).localeCompare(readString(left.id));
  });
  return `
    <div class="xapps-xms-plans__timeline">
      ${items
        .map((item) => {
          const title =
            readString(item.title) ||
            readString(item.id) ||
            formatTimelineBucketLabel(item.bucket, input.locale);
          const when = formatPlansDateTime(item.occurred_at, input.locale);
          const meta = [
            formatTimelineBucketLabel(item.bucket, input.locale),
            readString(item.status) ? formatStateLabel(item.status, readString(item.status)) : "",
            readString(item.settlement_effect)
              ? formatStateLabel(item.settlement_effect, readString(item.settlement_effect))
              : "",
            formatSettlementEffectDetailLabel(
              item.settlement_effect,
              item.settlement_effect_detail,
              input.locale,
            ),
            readString(item.scope),
            readString(item.correlation),
            formatVirtualCurrencyAmountLabel({
              amount: item.amount,
              virtualCurrency: item.virtual_currency,
              fallbackUnit: readString(item.currency),
            }),
            readString(item.note),
          ].filter(Boolean);
          return `
            <div class="xapps-xms-plans__timeline-item">
              <div class="xapps-xms-plans__timeline-top">
                <div class="xapps-xms-plans__timeline-title">${escapeHtml(title)}</div>
                ${when ? `<div class="xapps-xms-plans__timeline-when">${escapeHtml(when)}</div>` : ""}
              </div>
              ${
                meta.length
                  ? `<div class="xapps-xms-plans__timeline-meta">${escapeHtml(meta.join(" • "))}</div>`
                  : ""
              }
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function buildHistorySectionHtml(input: {
  title: string;
  total: number;
  items: Array<Record<string, unknown>>;
  locale: string;
  itemTitleKeys: string[];
  itemFallbackTitle: string;
  itemStatusKeys?: string[];
  itemMetaKeys: string[];
}): string {
  if (!input.total) return "";
  return `
    <section class="xapps-xms-plans__history-section">
      <div class="xapps-xms-plans__history-head">
        <h5 class="xapps-xms-plans__history-title">${escapeHtml(input.title)}</h5>
        <span class="xapps-xms-plans__history-count">${escapeHtml(String(input.total))}</span>
      </div>
      <div class="xapps-xms-plans__history-list">
        ${input.items
          .map((item) => {
            const title = readHistoryTitle(item, input.itemTitleKeys, input.itemFallbackTitle);
            const statusKeys = input.itemStatusKeys || [];
            const status = statusKeys.map((key) => readString(item[key])).find(Boolean);
            const meta = readHistoryMeta(item, input.itemMetaKeys, input.locale);
            return `
              <div class="xapps-xms-plans__history-item">
                <div class="xapps-xms-plans__history-item-head">
                  <div class="xapps-xms-plans__history-item-title">${escapeHtml(title)}</div>
                  ${
                    status
                      ? `<div class="xapps-xms-plans__history-item-status">${escapeHtml(
                          formatStateLabel(status, status),
                        )}</div>`
                      : ""
                  }
                </div>
                ${
                  meta.length
                    ? `<div class="xapps-xms-plans__history-item-meta">${escapeHtml(
                        meta.join(" • "),
                      )}</div>`
                    : ""
                }
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function buildMonetizationHistorySections(input: {
  history: Record<string, unknown> | null;
  locale: string;
}): string[] {
  const { history, locale } = input;
  const copy = buildXmsSurfaceCopy({ locale });
  return [
    buildHistorySectionHtml({
      title: copy.historySubscriptionsTitle,
      total: readHistoryBucket(history, "subscriptions").total,
      items: readHistoryBucket(history, "subscriptions").items,
      locale,
      itemTitleKeys: ["tier", "product_slug", "id"],
      itemFallbackTitle: copy.historySubscriptionContractLabel,
      itemStatusKeys: ["status"],
      itemMetaKeys: ["billing_period", "renews_at", "expired_at", "cancelled_at"],
    }),
    buildHistorySectionHtml({
      title: copy.historyEntitlementsTitle,
      total: readHistoryBucket(history, "entitlements").total,
      items: readHistoryBucket(history, "entitlements").items,
      locale,
      itemTitleKeys: ["tier", "product_slug", "id"],
      itemFallbackTitle: copy.historyEntitlementLabel,
      itemStatusKeys: ["status"],
      itemMetaKeys: ["source_kind", "starts_at", "expires_at"],
    }),
    buildHistorySectionHtml({
      title: copy.historyWalletAccountsTitle,
      total: readHistoryBucket(history, "wallet_accounts").total,
      items: readHistoryBucket(history, "wallet_accounts").items,
      locale,
      itemTitleKeys: ["virtual_currency.code", "product_slug", "id"],
      itemFallbackTitle: copy.historyWalletAccountLabel,
      itemStatusKeys: ["status"],
      itemMetaKeys: ["balance_remaining", "updated_at"],
    }),
    buildHistorySectionHtml({
      title: copy.historyWalletLedgerTitle,
      total: readHistoryBucket(history, "wallet_ledger").total,
      items: readHistoryBucket(history, "wallet_ledger").items,
      locale,
      itemTitleKeys: ["event_kind", "virtual_currency.code", "wallet_product_slug", "id"],
      itemFallbackTitle: copy.historyWalletLedgerEntryLabel,
      itemStatusKeys: [],
      itemMetaKeys: ["amount", "settlement_effect", "source_kind", "occurred_at"],
    }),
    buildHistorySectionHtml({
      title: copy.historyTransactionsTitle,
      total: readHistoryBucket(history, "transactions").total,
      items: readHistoryBucket(history, "transactions").items,
      locale,
      itemTitleKeys: ["package_slug", "product_slug", "id"],
      itemFallbackTitle: copy.historyTransactionLabel,
      itemStatusKeys: ["status"],
      itemMetaKeys: [
        "amount",
        "currency",
        "settlement_effect",
        "payment_session_id",
        "occurred_at",
      ],
    }),
    buildHistorySectionHtml({
      title: copy.historyPurchaseIntentsTitle,
      total: readHistoryBucket(history, "purchase_intents").total,
      items: readHistoryBucket(history, "purchase_intents").items,
      locale,
      itemTitleKeys: ["package_slug", "product_slug", "id"],
      itemFallbackTitle: copy.historyPurchaseIntentLabel,
      itemStatusKeys: ["status"],
      itemMetaKeys: ["amount", "currency", "payment_lane", "updated_at"],
    }),
    buildHistorySectionHtml({
      title: copy.historyInvoicesTitle,
      total: readHistoryBucket(history, "invoices").total,
      items: readHistoryBucket(history, "invoices").items,
      locale,
      itemTitleKeys: ["invoice_identifier", "id"],
      itemFallbackTitle: copy.historyInvoiceLabel,
      itemStatusKeys: ["status"],
      itemMetaKeys: [
        "settlement_effect",
        "settlement_effect_detail",
        "provider_key",
        "owner_scope",
        "created_at",
      ],
    }),
    buildHistorySectionHtml({
      title: copy.historyAccessSnapshotsTitle,
      total: readHistoryBucket(history, "access_snapshots").total,
      items: readHistoryBucket(history, "access_snapshots").items,
      locale,
      itemTitleKeys: ["tier", "id"],
      itemFallbackTitle: copy.historyAccessSnapshotLabel,
      itemStatusKeys: ["entitlement_state"],
      itemMetaKeys: ["balance_state", "credits_remaining", "updated_at"],
    }),
  ].filter(Boolean);
}

function buildMonetizationHistoryBalanceSummaryHtml(input: {
  history: Record<string, unknown> | null;
  locale: string;
}): string {
  const { history, locale } = input;
  const copy = buildXmsSurfaceCopy({ locale });
  const summary = summarizeVirtualCurrencyBalances(history);
  if (!summary.balances.length) return "";
  const summaryTitle =
    summary.totalNamedCurrencies > 0
      ? copy.historyBalanceSummaryTitle
      : copy.historyCreditSummaryTitle;
  return `
    <section class="xapps-xms-plans__card">
      <h4 class="xapps-xms-plans__section-title">${escapeHtml(summaryTitle)}</h4>
      <div class="xapps-xms-plans__subtitle">${escapeHtml(copy.historyBalanceSummarySubtitle)}</div>
      <div class="xapps-xms-plans__badges">
        ${summary.balances
          .map(
            (item) => `<span class="xapps-xms-plans__badge">${escapeHtml(item.amountLabel)}</span>`,
          )
          .join("")}
      </div>
    </section>
  `;
}

export type XmsSurfaceView = "plans" | "history";

export function buildXmsSurfaceShellTheme(input?: { themeTokens?: unknown }): {
  overlayBg: string;
  panelBg: string;
  panelBorder: string;
  panelRadius: string;
  panelShadow: string;
  headerBg: string;
  headerBorder: string;
  titleColor: string;
  subtitleColor: string;
  tabRailBg: string;
  tabRailBorder: string;
  tabActiveBg: string;
  tabActiveText: string;
  tabInactiveText: string;
  closeBg: string;
  closeBorder: string;
  closeText: string;
  bodyBg: string;
} {
  const shell = buildModalShellTheme(input);
  return {
    overlayBg: shell.overlayBg,
    panelBg: shell.panelBg,
    panelBorder: shell.panelBorder,
    panelRadius: shell.panelRadius,
    panelShadow: shell.panelShadow,
    headerBg: shell.headerBg,
    headerBorder: shell.headerBorder,
    titleColor: shell.titleColor,
    subtitleColor: shell.subtitleColor,
    tabRailBg: "rgba(226, 232, 240, 0.72)",
    tabRailBorder: "1px solid rgba(203, 213, 225, 0.92)",
    tabActiveBg: shell.panelBg,
    tabActiveText: shell.titleColor,
    tabInactiveText: shell.subtitleColor,
    closeBg: shell.closeBg,
    closeBorder: shell.closeBorder,
    closeText: shell.closeText,
    bodyBg: shell.bodyBg,
  };
}

export function buildXmsSurfaceShellLayout(): {
  overlayPadding: string;
  overlayBlur: string;
  panelWidth: string;
  panelMaxWidth: string;
  panelMaxHeight: string;
  panelGap: string;
  headerGap: string;
  headerPadding: string;
  bodyPadding: string;
  bodyMaxHeight: string;
  tabsGap: string;
  tabRailGap: string;
  tabRailPadding: string;
  tabPadding: string;
  tabRadius: string;
  titleFont: string;
  titleLetterSpacing: string;
  subtitleMarginTop: string;
  subtitleFont: string;
  tabFont: string;
  closeButtonSize: string;
  closeButtonRadius: string;
  closeButtonFont: string;
  closeButtonLineHeight: string;
  closeButtonShadow: string;
} {
  const shell = buildModalShellLayout();
  return {
    overlayPadding: shell.overlayPadding,
    overlayBlur: shell.overlayBlur,
    panelWidth: shell.panelWidth,
    panelMaxWidth: shell.panelMaxWidth,
    panelMaxHeight: shell.panelMaxHeight,
    panelGap: shell.panelGap,
    headerGap: shell.headerGap,
    headerPadding: shell.headerPadding,
    bodyPadding: shell.bodyPadding,
    bodyMaxHeight: shell.bodyMaxHeight,
    tabsGap: "10px",
    tabRailGap: "4px",
    tabRailPadding: "4px",
    tabPadding: "8px 12px",
    tabRadius: "999px",
    titleFont: shell.titleFont,
    titleLetterSpacing: shell.titleLetterSpacing,
    subtitleMarginTop: shell.subtitleMarginTop,
    subtitleFont: shell.subtitleFont,
    tabFont: "600 0.75rem system-ui,sans-serif",
    closeButtonSize: shell.closeButtonSize,
    closeButtonRadius: shell.closeButtonRadius,
    closeButtonFont: shell.closeButtonFont,
    closeButtonLineHeight: shell.closeButtonLineHeight,
    closeButtonShadow: shell.closeButtonShadow,
  };
}

export function resolveXmsSurfaceView(
  value: unknown,
  fallback: XmsSurfaceView = "plans",
): XmsSurfaceView {
  const normalized = readLower(value);
  return normalized === "history" ? "history" : fallback;
}

export function buildXmsSurfaceShellModel(input: {
  view?: unknown;
  locale?: unknown;
  plansTitle?: unknown;
  plansSubtitle?: unknown;
  historyTitle?: unknown;
  historySubtitle?: unknown;
  plansLabel?: unknown;
  historyLabel?: unknown;
  closeLabel?: unknown;
}): {
  view: XmsSurfaceView;
  title: string;
  subtitle: string;
  closeLabel: string;
  tabs: Array<{ key: XmsSurfaceView; label: string; active: boolean }>;
} {
  const view = resolveXmsSurfaceView(input.view);
  const copy = buildXmsSurfaceCopy({ locale: input.locale });
  const plansTitle = readString(input.plansTitle) || copy.plansTitle;
  const historyTitle = readString(input.historyTitle) || copy.historyTitle;
  const plansSubtitle = readString(input.plansSubtitle) || copy.plansSubtitle;
  const historySubtitle = readString(input.historySubtitle) || copy.historySubtitle;
  const plansLabel = readString(input.plansLabel) || copy.plansLabel;
  const historyLabel = readString(input.historyLabel) || copy.historyLabel;
  const closeLabel = readString(input.closeLabel) || copy.closeLabel;
  return {
    view,
    title: view === "history" ? historyTitle : plansTitle,
    subtitle: view === "history" ? historySubtitle : plansSubtitle,
    closeLabel,
    tabs: [
      { key: "plans", label: plansLabel, active: view === "plans" },
      { key: "history", label: historyLabel, active: view === "history" },
    ],
  };
}

export function buildMonetizationPlansSurfaceHtml(
  input: unknown,
  options: {
    title?: unknown;
    subtitle?: unknown;
    locale?: unknown;
    selectedPackageSlug?: unknown;
    busyPackageSlug?: unknown;
    busyAction?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
    interactive?: boolean;
    subscriptionInteractive?: boolean;
    showOperatorManagement?: boolean;
    onRefreshSubscription?: (() => void) | null;
    onCancelSubscription?: (() => void) | null;
  } = {},
): string {
  const record = readRecord(input) ?? {};
  const accessProjection = readRecord(record.accessProjection ?? record.access_projection);
  const currentSubscription = readRecord(record.currentSubscription ?? record.current_subscription);
  const additiveEntitlements = readActiveAdditiveEntitlements(
    record.additiveEntitlements ?? record.additive_entitlements,
  );
  const paywall = readRecord(record.paywall) ?? record;
  const locale = readString(options.locale) || "en";
  const renderModel = buildMonetizationPaywallRenderModel(paywall);
  const packageRecords = flattenXappMonetizationPaywallPackages(paywall);
  const resolvePackageLabel = buildMonetizationPackageLabelResolver(packageRecords);
  const packageRecordBySlug = new Map(
    packageRecords.map((item) => [readLower(item.packageSlug), item]),
  );
  const selectedPackageSlug = readLower(options.selectedPackageSlug);
  const busyPackageSlug = readLower(options.busyPackageSlug);
  const busyAction = readLower(options.busyAction);
  const includeStyles = options.includeStyles !== false;
  const showHeader = options.showHeader !== false;
  const packageCopy = buildXmsPackageCopy(locale);
  const surfaceCopy = buildXmsSurfaceCopy({ locale });
  const lifecycle = buildXmsSubscriptionLifecycleSummary({
    currentSubscription,
    locale,
  });
  const lifecycleInteractive =
    typeof options.subscriptionInteractive === "boolean"
      ? options.subscriptionInteractive
      : options.interactive !== false;
  const showOperatorManagement = options.showOperatorManagement === true;
  const operatorAuthority = showOperatorManagement
    ? resolveSubscriptionOperatorAuthorityLabel({
        currentSubscription,
        locale,
      })
    : "";
  const managementDestination = showOperatorManagement
    ? resolveSubscriptionManagementDestinationLabel({
        currentSubscription,
        locale,
      })
    : "";
  const managementDestinationHref = showOperatorManagement
    ? resolveSubscriptionManagementDestinationHref({
        currentSubscription,
      })
    : "";
  const managementDestinationHint = showOperatorManagement
    ? resolveSubscriptionManagementDestinationHint({
        currentSubscription,
        locale,
      })
    : "";
  const hasRefreshSubscriptionAction =
    lifecycleInteractive &&
    typeof options.onRefreshSubscription === "function" &&
    readSubscriptionActionAvailability({
      currentSubscription,
      actionKey: "refresh_status",
      fallback: true,
    });
  const hasCancelSubscriptionAction =
    lifecycleInteractive &&
    lifecycle.canCancel &&
    typeof options.onCancelSubscription === "function" &&
    readSubscriptionActionAvailability({
      currentSubscription,
      actionKey: "cancel_subscription",
      fallback: true,
    });
  const currentTier = readString(currentSubscription?.tier) || readString(accessProjection?.tier);
  const currentTierLabel = resolvePackageLabel(currentTier) || currentTier;
  const accessState = formatCoverageLabel({ accessProjection, currentSubscription, locale });
  const creditsRemaining = readString(accessProjection?.credits_remaining);
  const accessVirtualCurrency = readVirtualCurrencyDefinition(accessProjection?.virtual_currency);
  const hasNamedAccessCurrency = Boolean(accessVirtualCurrency);
  const additiveUnlocks = formatResolvedAdditiveEntitlementLabels(
    additiveEntitlements,
    resolvePackageLabel,
  );
  const accessRows = [
    currentTierLabel ? [surfaceCopy.currentPlanLabel, currentTierLabel] : null,
    accessState ? [surfaceCopy.membershipAccessLabel, accessState] : null,
    lifecycle.statusLabel ? [surfaceCopy.subscriptionStatusLabel, lifecycle.statusLabel] : null,
    lifecycle.coverageLabel
      ? [surfaceCopy.subscriptionCoverageLabel, lifecycle.coverageLabel]
      : null,
    lifecycle.reasonLabel ? [surfaceCopy.subscriptionReasonLabel, lifecycle.reasonLabel] : null,
    lifecycle.overdueSince
      ? [surfaceCopy.overdueSinceLabel, formatPlansDateTime(lifecycle.overdueSince, locale)]
      : null,
    lifecycle.expiryBoundaryAt
      ? [surfaceCopy.expiryBoundaryLabel, formatPlansDateTime(lifecycle.expiryBoundaryAt, locale)]
      : null,
    lifecycle.renewsAt
      ? [surfaceCopy.renewsAtLabel, formatPlansDateTime(lifecycle.renewsAt, locale)]
      : null,
    lifecycle.currentPeriodEndsAt
      ? [
          surfaceCopy.currentPeriodEndsLabel,
          formatPlansDateTime(lifecycle.currentPeriodEndsAt, locale),
        ]
      : null,
    lifecycle.cancelledAt
      ? [surfaceCopy.cancelledAtLabel, formatPlansDateTime(lifecycle.cancelledAt, locale)]
      : null,
    lifecycle.expiresAt
      ? [surfaceCopy.expiresAtLabel, formatPlansDateTime(lifecycle.expiresAt, locale)]
      : null,
    operatorAuthority ? [surfaceCopy.operatorAuthorityLabel, operatorAuthority] : null,
    managementDestination ? [surfaceCopy.managementDestinationLabel, managementDestination] : null,
    accessVirtualCurrency
      ? [
          surfaceCopy.virtualCurrencyLabel,
          formatVirtualCurrencyLabel(accessVirtualCurrency, { includeCode: true }),
        ]
      : null,
    creditsRemaining
      ? [
          hasNamedAccessCurrency
            ? surfaceCopy.creditsRemainingLabel
            : surfaceCopy.creditBalanceLabel,
          formatVirtualCurrencyAmountLabel({
            amount: creditsRemaining,
            virtualCurrency: accessVirtualCurrency,
            fallbackUnit: "credits",
          }),
        ]
      : null,
  ].filter((item): item is [string, string] => Boolean(item));
  const lifecycleActionsHtml =
    lifecycle.present && (hasRefreshSubscriptionAction || hasCancelSubscriptionAction)
      ? `<div class="xapps-xms-plans__surface-actions">
          ${
            hasRefreshSubscriptionAction
              ? `<button
                  type="button"
                  class="xapps-xms-plans__surface-action"
                  data-subscription-action="refresh"
                  ${busyAction ? "disabled" : ""}
                >${escapeHtml(
                  busyAction === "refresh"
                    ? surfaceCopy.refreshingStatusActionLabel
                    : surfaceCopy.refreshStatusActionLabel,
                )}</button>`
              : ""
          }
          ${
            hasCancelSubscriptionAction
              ? `<button
                  type="button"
                  class="xapps-xms-plans__surface-action"
                  data-subscription-action="cancel"
                  data-variant="danger"
                  ${busyAction ? "disabled" : ""}
                >${escapeHtml(
                  busyAction === "cancel"
                    ? surfaceCopy.cancellingSubscriptionActionLabel
                    : surfaceCopy.cancelSubscriptionActionLabel,
                )}</button>`
              : ""
          }
          ${
            managementDestinationHref
              ? `<a
                  class="xapps-xms-plans__surface-action"
                  href="${escapeHtml(managementDestinationHref)}"
                  target="_top"
                  rel="noopener noreferrer"
                >${escapeHtml(surfaceCopy.openManagementDestinationActionLabel)}</a>`
              : ""
          }
        </div>`
      : managementDestinationHref
        ? `<div class="xapps-xms-plans__surface-actions">
            <a
              class="xapps-xms-plans__surface-action"
              href="${escapeHtml(managementDestinationHref)}"
              target="_top"
              rel="noopener noreferrer"
            >${escapeHtml(surfaceCopy.openManagementDestinationActionLabel)}</a>
          </div>`
        : "";

  const packagesHtml = renderModel.packages.length
    ? renderModel.packages
        .map((item) => {
          const packageRecord = packageRecordBySlug.get(readLower(item.packageSlug)) ?? item;
          const purchasePolicy = resolveMonetizationPackagePurchasePolicy({
            item: packageRecord,
            currentSubscription,
            additiveEntitlements,
            accessProjection,
          });
          const packageSignals = item.signals.filter(
            (signal) =>
              !(
                purchasePolicy.transitionKind === "replace_recurring" &&
                readLower(signal).includes("trial")
              ),
          );
          const badges = [item.fitLabel];
          if (selectedPackageSlug && readLower(item.packageSlug) === selectedPackageSlug) {
            badges.push(packageCopy.selectedLabel);
          }
          if (purchasePolicy.status === "owned_additive_unlock") {
            badges.push(packageCopy.ownedUnlockLabel);
          } else if (purchasePolicy.status === "current_recurring_plan") {
            badges.push(packageCopy.currentPlanLabel);
          } else if (purchasePolicy.transitionKind === "buy_additive_unlock") {
            badges.push(packageCopy.addOnWithMembershipLabel);
          }
          if (item.isDefault) badges.push(packageCopy.defaultLabel);
          const interactive = options.interactive !== false;
          const disabled =
            !interactive ||
            !purchasePolicy.canPurchase ||
            (busyPackageSlug && busyPackageSlug !== readLower(item.packageSlug));
          return `
            <section class="xapps-xms-plans__package ${item.isDefault ? "is-default" : ""} ${
              selectedPackageSlug && readLower(item.packageSlug) === selectedPackageSlug
                ? "is-selected"
                : ""
            }">
              <div class="xapps-xms-plans__package-head">
                <div>
                  <h4 class="xapps-xms-plans__package-title">${escapeHtml(item.packageTitle)}</h4>
                  <div class="xapps-xms-plans__package-description">${escapeHtml(
                    item.description,
                  )}</div>
                </div>
                <div class="xapps-xms-plans__money">${escapeHtml(item.moneyLabel)}</div>
              </div>
              <div class="xapps-xms-plans__badges">
                ${badges
                  .map(
                    (badge) => `<span class="xapps-xms-plans__badge">${escapeHtml(badge)}</span>`,
                  )
                  .join("")}
              </div>
              ${
                packageSignals.length
                  ? `<div class="xapps-xms-plans__signals">${packageSignals
                      .map(
                        (signal) =>
                          `<span class="xapps-xms-plans__signal">${escapeHtml(signal)}</span>`,
                      )
                      .join("")}</div>`
                  : ""
              }
              <button
                class="xapps-xms-plans__action"
                type="button"
                data-package-id="${escapeHtml(item.packageId)}"
                data-package-slug="${escapeHtml(item.packageSlug)}"
                ${disabled ? "disabled" : ""}
              >${escapeHtml(
                buildPlansActionLabel({
                  locale,
                  policy: purchasePolicy,
                  busy: busyPackageSlug === readLower(item.packageSlug),
                }),
              )}</button>
            </section>
          `;
        })
        .join("")
    : `<div class="xapps-xms-plans__empty">${escapeHtml(surfaceCopy.noPublishedPlansLabel)}</div>`;

  return `
    ${includeStyles ? `<style>${monetizationPlansSurfaceStyles}</style>` : ""}
    <section class="xapps-xms-plans">
      ${
        showHeader
          ? `<div class="xapps-xms-plans__header">
              <h3 class="xapps-xms-plans__title">${escapeHtml(
                readString(options.title) || renderModel.paywallLabel || "Plans",
              )}</h3>
              ${
                readString(options.subtitle)
                  ? `<div class="xapps-xms-plans__subtitle">${escapeHtml(
                      readString(options.subtitle),
                    )}</div>`
                  : ""
              }
            </div>`
          : ""
      }
      ${readString(options.notice) ? `<div class="xapps-xms-plans__notice">${escapeHtml(readString(options.notice))}</div>` : ""}
      ${readString(options.error) ? `<div class="xapps-xms-plans__error">${escapeHtml(readString(options.error))}</div>` : ""}
      ${
        accessRows.length || additiveUnlocks.length
          ? `<section class="xapps-xms-plans__card">
              <h4 class="xapps-xms-plans__section-title">${escapeHtml(surfaceCopy.currentCoverageTitle)}</h4>
              <div class="xapps-xms-plans__meta">
                ${accessRows
                  .map(
                    ([label, value]) => `
                      <div class="xapps-xms-plans__meta-row">
                        <span class="xapps-xms-plans__meta-label">${escapeHtml(label)}</span>
                        <span class="xapps-xms-plans__meta-value">${escapeHtml(value)}</span>
                      </div>`,
                  )
                  .join("")}
                ${
                  additiveUnlocks.length
                    ? `<div class="xapps-xms-plans__meta-row">
                        <span class="xapps-xms-plans__meta-label">${escapeHtml(surfaceCopy.addOnUnlocksLabel)}</span>
                        <span class="xapps-xms-plans__meta-value">
                          <span class="xapps-xms-plans__stack">${additiveUnlocks
                            .map((label) => `<span>${escapeHtml(label)}</span>`)
                            .join("")}</span>
                        </span>
                      </div>`
                    : ""
                }
              </div>
              ${
                managementDestinationHint
                  ? `<div class="xapps-xms-plans__notice">${escapeHtml(managementDestinationHint)}</div>`
                  : ""
              }
              ${lifecycleActionsHtml}
            </section>`
          : ""
      }
      <section class="xapps-xms-plans__card">
        <h4 class="xapps-xms-plans__section-title">${escapeHtml(
          renderModel.paywallLabel || surfaceCopy.plansTitle,
        )}</h4>
        ${
          renderModel.summary
            ? `<div class="xapps-xms-plans__subtitle">${escapeHtml(renderModel.summary)}</div>`
            : ""
        }
        <div class="xapps-xms-plans__packages">${packagesHtml}</div>
      </section>
    </section>
  `;
}

export function renderMonetizationPlansSurface(
  root: Element,
  input: unknown,
  options: {
    title?: unknown;
    subtitle?: unknown;
    locale?: unknown;
    selectedPackageSlug?: unknown;
    busyPackageSlug?: unknown;
    busyAction?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
    interactive?: boolean;
    subscriptionInteractive?: boolean;
    showOperatorManagement?: boolean;
    onCheckoutPackage?: ((input: { packageId: string; packageSlug: string }) => void) | null;
    onRefreshSubscription?: (() => void) | null;
    onCancelSubscription?: (() => void) | null;
  } = {},
): { destroy: () => void } {
  root.innerHTML = buildMonetizationPlansSurfaceHtml(input, options);
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".xapps-xms-plans__action"));
  const refreshButton = root.querySelector<HTMLButtonElement>(
    '[data-subscription-action="refresh"]',
  );
  const cancelButton = root.querySelector<HTMLButtonElement>('[data-subscription-action="cancel"]');
  const listeners: Array<() => void> = [];
  const onCheckoutPackage =
    typeof options.onCheckoutPackage === "function" ? options.onCheckoutPackage : null;
  const onRefreshSubscription =
    typeof options.onRefreshSubscription === "function" ? options.onRefreshSubscription : null;
  const onCancelSubscription =
    typeof options.onCancelSubscription === "function" ? options.onCancelSubscription : null;

  if (onCheckoutPackage) {
    for (const button of buttons) {
      if (button.disabled) continue;
      const handler = () => {
        onCheckoutPackage({
          packageId: readString(button.dataset.packageId),
          packageSlug: readString(button.dataset.packageSlug),
        });
      };
      button.addEventListener("click", handler);
      listeners.push(() => button.removeEventListener("click", handler));
    }
  }

  if (onRefreshSubscription && refreshButton && !refreshButton.disabled) {
    const handler = () => {
      onRefreshSubscription();
    };
    refreshButton.addEventListener("click", handler);
    listeners.push(() => refreshButton.removeEventListener("click", handler));
  }

  if (onCancelSubscription && cancelButton && !cancelButton.disabled) {
    const handler = () => {
      onCancelSubscription();
    };
    cancelButton.addEventListener("click", handler);
    listeners.push(() => cancelButton.removeEventListener("click", handler));
  }

  return {
    destroy() {
      for (const cleanup of listeners) cleanup();
      root.innerHTML = "";
    },
  };
}

export function buildMonetizationHistorySurfaceHtml(
  input: unknown,
  options: {
    title?: unknown;
    subtitle?: unknown;
    locale?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
  } = {},
): string {
  const record = readRecord(input) ?? {};
  const history = readRecord(record.history) ?? record;
  const locale = readString(options.locale) || "en";
  const includeStyles = options.includeStyles !== false;
  const showHeader = options.showHeader !== false;
  const surfaceCopy = buildXmsSurfaceCopy({ locale });
  const historySections = buildMonetizationHistorySections({ history, locale });
  const balanceSummaryHtml = buildMonetizationHistoryBalanceSummaryHtml({ history, locale });
  const timeline = readHistoryBucket(history, "timeline");
  const hasHistory = Boolean(timeline.total || historySections.length || balanceSummaryHtml);

  return `
    ${includeStyles ? `<style>${monetizationPlansSurfaceStyles}</style>` : ""}
    <section class="xapps-xms-plans">
      ${
        showHeader
          ? `<div class="xapps-xms-plans__header">
              <h3 class="xapps-xms-plans__title">${escapeHtml(
                readString(options.title) || surfaceCopy.historyTitle,
              )}</h3>
              ${
                readString(options.subtitle)
                  ? `<div class="xapps-xms-plans__subtitle">${escapeHtml(
                      readString(options.subtitle),
                    )}</div>`
                  : ""
              }
            </div>`
          : ""
      }
      ${readString(options.notice) ? `<div class="xapps-xms-plans__notice">${escapeHtml(readString(options.notice))}</div>` : ""}
      ${readString(options.error) ? `<div class="xapps-xms-plans__error">${escapeHtml(readString(options.error))}</div>` : ""}
      ${balanceSummaryHtml}
      ${
        timeline.total
          ? `<section class="xapps-xms-plans__card">
              <h4 class="xapps-xms-plans__section-title">${escapeHtml(surfaceCopy.recentTimelineTitle)}</h4>
              <div class="xapps-xms-plans__subtitle">${escapeHtml(surfaceCopy.recentTimelineSubtitle)}</div>
              ${buildTimelineHtml({
                total: timeline.total,
                items: timeline.items,
                locale,
              })}
            </section>`
          : ""
      }
      ${
        historySections.length
          ? `<section class="xapps-xms-plans__card">
              <h4 class="xapps-xms-plans__section-title">${escapeHtml(surfaceCopy.historyAuditTitle)}</h4>
              <div class="xapps-xms-plans__subtitle">${escapeHtml(surfaceCopy.historyAuditSubtitle)}</div>
              <div class="xapps-xms-plans__history-grid">${historySections.join("")}</div>
            </section>`
          : ""
      }
      ${
        !hasHistory
          ? `<section class="xapps-xms-plans__card">
              <div class="xapps-xms-plans__empty">${escapeHtml(surfaceCopy.noHistoryAvailableLabel)}</div>
            </section>`
          : ""
      }
    </section>
  `;
}

export function renderMonetizationHistorySurface(
  root: Element,
  input: unknown,
  options: {
    title?: unknown;
    subtitle?: unknown;
    locale?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
  } = {},
): { destroy: () => void } {
  root.innerHTML = buildMonetizationHistorySurfaceHtml(input, options);
  return {
    destroy() {
      root.innerHTML = "";
    },
  };
}

export function buildMonetizationPackagePresentation(input: unknown): {
  fitLabel: string;
  summary: string;
  signals: string[];
  moneyLabel: string;
  offeringLabel: string;
  placementLabel: string;
  offeringSummary: string;
} {
  const item =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const copy = buildXmsPackageCopy(item.locale);
  const packageKind = readString(item.packageKind);
  const packageSlug = readLower(item.packageSlug);
  const metadata =
    item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};
  const credits = readPackageCredits(item);
  const virtualCurrency =
    readVirtualCurrencyDefinition(item.virtualCurrency) ??
    readVirtualCurrencyDefinition(
      item.productMetadata && typeof item.productMetadata === "object"
        ? (item.productMetadata as Record<string, unknown>).virtual_currency
        : null,
    );
  const moneyLabel = normalizeMoneyLabel(item);
  const offeringPresentation = buildMonetizationOfferingPresentation(item);
  let fitLabel = copy.generalUpgradeFitLabel;
  let summary = copy.generalUpgradeSummary;

  if (packageKind === "one_time_unlock") {
    fitLabel = copy.durableUnlockFitLabel;
    summary = copy.durableUnlockSummary;
  } else if (packageKind === "subscription") {
    fitLabel = copy.recurringMembershipFitLabel;
    summary = copy.recurringMembershipSummary;
  } else if (packageKind === "credit_pack") {
    const unitLabel = normalizeVirtualCurrencyDisplayLabel(
      formatVirtualCurrencyLabel(virtualCurrency, { includeCode: true }),
    );
    fitLabel = copy.creditTopUpFitLabel;
    summary = copy.creditPackFitSummary(unitLabel || "credits");
  } else if (packageSlug.includes("hybrid")) {
    const unitLabel = normalizeVirtualCurrencyDisplayLabel(
      formatVirtualCurrencyLabel(virtualCurrency, { includeCode: true }),
    );
    fitLabel = copy.hybridUpgradeFitLabel;
    summary = copy.hybridPackFitSummary(unitLabel || "credits");
  }

  const signals: string[] = [];
  if (readString(metadata.badge)) {
    signals.push(readString(metadata.badge));
  }
  if (credits > 0 && virtualCurrency) {
    signals.push(
      formatVirtualCurrencyAmountLabel({
        amount: String(credits),
        virtualCurrency,
        fallbackUnit: "credits",
      }),
    );
  } else if (credits > 0) {
    signals.push(`${credits} credits`);
  } else if (virtualCurrency) {
    signals.push(
      copy.packageCurrencySignalLabel(
        formatVirtualCurrencyLabel(virtualCurrency, { includeCode: true }),
      ),
    );
  }
  if (readString(item.billingPeriod)) {
    signals.push(copy.billedSignalLabel(readString(item.billingPeriod)));
  }
  if (offeringPresentation.offeringLabel) {
    signals.push(offeringPresentation.offeringLabel);
  }

  return {
    fitLabel,
    summary,
    signals,
    moneyLabel,
    offeringLabel: offeringPresentation.offeringLabel,
    placementLabel: offeringPresentation.placementLabel,
    offeringSummary: offeringPresentation.summary,
  };
}

export function resolveXmsModeForPackage(item: unknown): {
  key: string;
  label: string;
  description: string;
} {
  const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const productFamily = readLower(record.productFamily);
  const packageKind = readLower(record.packageKind);

  if (productFamily === "one_time_unlock" || packageKind === "one_time_unlock") {
    return {
      key: "one_time_purchase",
      label: "one_time_purchase",
      description: "Durable entitlement/unlock after a single successful purchase.",
    };
  }

  if (productFamily === "subscription_plan" || packageKind === "subscription") {
    return {
      key: "subscription",
      label: "subscription",
      description: "Recurring contract with current subscription and access state.",
    };
  }

  if (productFamily === "credit_pack" || packageKind === "credit_pack") {
    return {
      key: "credit_wallet",
      label: "credit_wallet",
      description: "Wallet top-up flow that issues credits and ledger entries.",
    };
  }

  if (productFamily === "hybrid_plan") {
    return {
      key: "hybrid_composition",
      label: "hybrid_composition",
      description: "Composition of subscription/access and bundled credit behavior.",
    };
  }

  return {
    key: "unknown",
    label: "unknown",
    description: "Package shape is not yet mapped to an explicit XMS mode.",
  };
}

function collectPackageOwnershipCandidates(item: Record<string, unknown>): string[] {
  const metadata =
    item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};
  const productMetadata =
    item.productMetadata &&
    typeof item.productMetadata === "object" &&
    !Array.isArray(item.productMetadata)
      ? (item.productMetadata as Record<string, unknown>)
      : {};
  return [
    readLower(item.productSlug),
    readLower(item.packageSlug),
    readLower(metadata.tier),
    readLower(metadata.access_tier),
    readLower(productMetadata.tier),
    readLower(productMetadata.access_tier),
  ].filter(Boolean);
}

function collectCurrentSubscriptionCandidates(
  currentSubscription: Record<string, unknown>,
): string[] {
  const metadata =
    currentSubscription.metadata && typeof currentSubscription.metadata === "object"
      ? (currentSubscription.metadata as Record<string, unknown>)
      : currentSubscription.metadata_jsonb && typeof currentSubscription.metadata_jsonb === "object"
        ? (currentSubscription.metadata_jsonb as Record<string, unknown>)
        : {};
  return [
    readLower(currentSubscription.product_slug),
    readLower(currentSubscription.tier),
    readLower(metadata.product_slug),
    readLower(metadata.tier),
    readLower(metadata.access_tier),
  ].filter(Boolean);
}

function hasActiveRecurringSubscription(currentSubscription: unknown): boolean {
  const record =
    currentSubscription &&
    typeof currentSubscription === "object" &&
    !Array.isArray(currentSubscription)
      ? (currentSubscription as Record<string, unknown>)
      : {};
  const status = readLower(record.status);
  if (!status || status === "expired") return false;
  const expiredAt = readString(record.expired_at);
  if (!expiredAt) return true;
  const expiresAtMs = Date.parse(expiredAt);
  return Number.isNaN(expiresAtMs) || expiresAtMs > Date.now();
}

function hasCurrentOwnedEntitlement(entitlement: Record<string, unknown>): boolean {
  const status = readLower(entitlement.status);
  if (status !== "active" && status !== "grace_period") return false;
  const expiresAt = readString(entitlement.expires_at);
  if (!expiresAt) return true;
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isNaN(expiresAtMs) || expiresAtMs > Date.now();
}

function readProjectedPurchasePolicy(value: unknown): {
  canPurchase: boolean;
  status: "available" | "current_recurring_plan" | "owned_additive_unlock";
  transitionKind:
    | "start_recurring"
    | "replace_recurring"
    | "buy_additive_unlock"
    | "buy_credit_pack"
    | "activate_hybrid"
    | "none";
  reason: string | null;
} | null {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  if (!record) return null;
  const status = readLower(record.status);
  const transitionKind = readLower(record.transition_kind ?? record.transitionKind);
  if (!status || !transitionKind) return null;
  return {
    canPurchase: readBoolean(record.can_purchase ?? record.canPurchase, true),
    status:
      status === "current_recurring_plan" || status === "owned_additive_unlock"
        ? status
        : "available",
    transitionKind:
      transitionKind === "start_recurring" ||
      transitionKind === "replace_recurring" ||
      transitionKind === "buy_additive_unlock" ||
      transitionKind === "buy_credit_pack" ||
      transitionKind === "activate_hybrid"
        ? transitionKind
        : "none",
    reason: readString(record.reason) || null,
  };
}

export function resolveMonetizationPackagePurchasePolicy(input: {
  item: unknown;
  currentSubscription?: unknown;
  additiveEntitlements?: unknown;
  accessProjection?: unknown;
}): {
  canPurchase: boolean;
  status: "available" | "current_recurring_plan" | "owned_additive_unlock";
  transitionKind:
    | "start_recurring"
    | "replace_recurring"
    | "buy_additive_unlock"
    | "buy_credit_pack"
    | "activate_hybrid"
    | "none";
  reason: string | null;
} {
  const item =
    input.item && typeof input.item === "object" ? (input.item as Record<string, unknown>) : {};
  const projectedPolicy = readProjectedPurchasePolicy(item.purchasePolicy ?? item.purchase_policy);
  if (projectedPolicy) return projectedPolicy;
  const currentSubscription =
    input.currentSubscription &&
    typeof input.currentSubscription === "object" &&
    !Array.isArray(input.currentSubscription)
      ? (input.currentSubscription as Record<string, unknown>)
      : {};
  const additiveEntitlements = Array.isArray(input.additiveEntitlements)
    ? (input.additiveEntitlements as unknown[])
    : [];
  const productFamily = readLower(item.productFamily);
  const packageKind = readLower(item.packageKind);
  const productId = readLower(item.productId);
  const currentSubscriptionProductId = readLower(currentSubscription.product_id);
  const includedCredits = readPackageCredits(item);
  const ownershipCandidates = new Set(collectPackageOwnershipCandidates(item));
  const currentSubscriptionCandidates = new Set(
    collectCurrentSubscriptionCandidates(currentSubscription),
  );
  const ownedAdditiveUnlock = additiveEntitlements.some((entry) => {
    const entitlement =
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : {};
    if (!hasCurrentOwnedEntitlement(entitlement)) return false;
    const entitlementProductId = readLower(entitlement.product_id);
    if (productId && entitlementProductId && productId === entitlementProductId) return true;
    const candidateValues = [
      readLower(entitlement.product_slug),
      readLower(entitlement.tier),
    ].filter(Boolean);
    return candidateValues.some((value) => ownershipCandidates.has(value));
  });

  if (
    hasActiveRecurringSubscription(currentSubscription) &&
    productId &&
    currentSubscriptionProductId &&
    productId === currentSubscriptionProductId
  ) {
    return {
      canPurchase: false,
      status: "current_recurring_plan",
      transitionKind: "none",
      reason: "current_recurring_plan",
    };
  }

  if (
    hasActiveRecurringSubscription(currentSubscription) &&
    Array.from(ownershipCandidates).some((value) => currentSubscriptionCandidates.has(value))
  ) {
    return {
      canPurchase: false,
      status: "current_recurring_plan",
      transitionKind: "none",
      reason: "current_recurring_plan",
    };
  }

  const consumableOneTimeUnlock =
    (productFamily === "one_time_unlock" || packageKind === "one_time_unlock") &&
    includedCredits > 0;

  if (consumableOneTimeUnlock) {
    return {
      canPurchase: true,
      status: "available",
      transitionKind: "buy_additive_unlock",
      reason: null,
    };
  }

  if (
    (productFamily === "one_time_unlock" || packageKind === "one_time_unlock") &&
    ownedAdditiveUnlock
  ) {
    return {
      canPurchase: false,
      status: "owned_additive_unlock",
      transitionKind: "none",
      reason: "owned_additive_unlock",
    };
  }

  if (productFamily === "credit_pack" || packageKind === "credit_pack") {
    return {
      canPurchase: true,
      status: "available",
      transitionKind: "buy_credit_pack",
      reason: null,
    };
  }

  if (productFamily === "one_time_unlock" || packageKind === "one_time_unlock") {
    return {
      canPurchase: true,
      status: "available",
      transitionKind: "buy_additive_unlock",
      reason: null,
    };
  }

  if (productFamily === "subscription_plan" || packageKind === "subscription") {
    return {
      canPurchase: true,
      status: "available",
      transitionKind: hasActiveRecurringSubscription(currentSubscription)
        ? "replace_recurring"
        : "start_recurring",
      reason: null,
    };
  }

  if (productFamily === "hybrid_plan") {
    return {
      canPurchase: true,
      status: "available",
      transitionKind: "activate_hybrid",
      reason: null,
    };
  }

  return {
    canPurchase: true,
    status: "available",
    transitionKind: "none",
    reason: null,
  };
}

function normalizeMoneyLabel(item: Record<string, unknown>) {
  const amount = readString(item.amount);
  const currency = readString(item.currency);
  const billingPeriod = readString(item.billingPeriod);
  if (!amount && !currency) {
    return buildXmsSurfaceCopy({ locale: item.locale }).priceUnavailableLabel;
  }
  return `${amount} ${currency}${billingPeriod ? ` / ${billingPeriod}` : ""}`.trim();
}

function packageCredits(item: Record<string, unknown>) {
  return readPackageCredits(item);
}

function scorePackageForFeature(
  feature: Record<string, unknown>,
  item: Record<string, unknown>,
  locale?: unknown,
) {
  const copy = buildXmsPackageCopy(locale);
  const requirements =
    feature.requirements && typeof feature.requirements === "object"
      ? (feature.requirements as Record<string, unknown>)
      : {};
  const packageKind = readString(item.packageKind);
  const packageSlug = readString(item.packageSlug);
  const offeringSlug = readString(item.offeringSlug);
  const credits = packageCredits(item);
  const virtualCurrency = readPackageVirtualCurrency(item);
  const unitLabel =
    normalizeVirtualCurrencyDisplayLabel(
      formatVirtualCurrencyLabel(virtualCurrency, { includeCode: true }),
    ) || "credits";
  let score = 0;
  const reasons: string[] = [];

  if (requirements.currentAccess) {
    if (packageKind === "one_time_unlock") {
      score += 7;
      reasons.push(copy.featureDurableUnlockReason);
    } else if (packageKind === "subscription") {
      score += 6;
      reasons.push(copy.featureRecurringAccessReason);
    } else if (packageSlug.includes("hybrid")) {
      score += 5;
      reasons.push(copy.featureHybridAccessReason);
    }
  }

  if (requirements.subscription) {
    if (packageKind === "subscription") {
      score += 8;
      reasons.push(copy.featureSubscriptionDirectReason);
    } else if (packageSlug.includes("hybrid")) {
      score += 5;
      reasons.push(copy.featureHybridSubscriptionReason);
    }
  }

  const requiredCredits = Number(requirements.credits || 0);
  if (requiredCredits) {
    if (credits >= requiredCredits) {
      score += 8;
      reasons.push(
        copy.creditRequirementCoveredLabel(formatNamedUnitAmount(requiredCredits, unitLabel)),
      );
    } else if (credits > 0) {
      score += 4;
      reasons.push(copy.creditRequirementAddedLabel(formatNamedUnitAmount(credits, unitLabel)));
    } else if (packageSlug.includes("hybrid")) {
      score += 3;
      reasons.push(copy.hybridCreditsSupportLabel(unitLabel));
    }
  }

  if (packageSlug.includes("default_paywall") || offeringSlug.includes("paywall")) {
    score += 1;
  }

  return {
    score,
    reasons,
    credits,
    moneyLabel: normalizeMoneyLabel(item),
  };
}

export function buildFeaturePaywall(input: {
  feature: unknown;
  packages: unknown;
  selectedPackage?: unknown;
  locale?: unknown;
}): {
  activePackage: Record<string, unknown> | null;
  candidatePackages: Array<Record<string, unknown>>;
  recommendedPackages: Array<Record<string, unknown>>;
  rankedPackages: Array<Record<string, unknown>>;
  allPackages: Array<Record<string, unknown>>;
} {
  const feature =
    input.feature && typeof input.feature === "object"
      ? (input.feature as Record<string, unknown>)
      : {};
  const selectedPackage =
    input.selectedPackage && typeof input.selectedPackage === "object"
      ? (input.selectedPackage as Record<string, unknown>)
      : null;
  const ranked: Array<Record<string, unknown>> = (
    Array.isArray(input.packages) ? input.packages : []
  )
    .map((item) => {
      const record =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : ({} as Record<string, unknown>);
      const scored = scorePackageForFeature(feature, record, input.locale);
      return {
        ...record,
        recommendationScore: scored.score,
        candidateScore: scored.score,
        recommendationReasons: scored.reasons,
        candidateReasons: scored.reasons,
        credits: scored.credits,
        moneyLabel: scored.moneyLabel,
      };
    })
    .sort((left, right) => {
      if (Number(right.recommendationScore) !== Number(left.recommendationScore)) {
        return Number(right.recommendationScore) - Number(left.recommendationScore);
      }
      return readString((left as Record<string, unknown>).packageTitle).localeCompare(
        readString((right as Record<string, unknown>).packageTitle),
      );
    });

  const recommended = ranked.filter((item) => Number(item.recommendationScore) > 0);
  const selectedPackageId = readString(selectedPackage?.packageId);
  const activePackage =
    recommended.find(
      (item) => readString((item as Record<string, unknown>).packageId) === selectedPackageId,
    ) ||
    recommended[0] ||
    ranked.find(
      (item) => readString((item as Record<string, unknown>).packageId) === selectedPackageId,
    ) ||
    ranked[0] ||
    null;

  return {
    activePackage,
    candidatePackages: recommended.slice(0, 3),
    recommendedPackages: recommended.slice(0, 3),
    rankedPackages: ranked,
    allPackages: ranked,
  };
}

function readFeatureRequirements(feature: Record<string, unknown>) {
  return feature.requirements && typeof feature.requirements === "object"
    ? (feature.requirements as Record<string, unknown>)
    : {};
}

function buildFeatureGapBadges(input: {
  requirements: Record<string, unknown>;
  snapshotSummary: {
    accessCoverage?: { available?: boolean | null };
    wallet?: { creditsRemaining?: string | null; virtualCurrencyLabel?: string | null };
  };
  activePackage?: unknown;
  currentSubscriptionStatus?: unknown;
  locale?: unknown;
}): string[] {
  const copy = buildXmsSurfaceCopy({ locale: input.locale });
  const badges: string[] = [];
  const creditsRemaining = readNumber(input.snapshotSummary?.wallet?.creditsRemaining);
  const unitLabel = readFeatureCurrencyUnitLabel({
    snapshotSummary: input.snapshotSummary,
    activePackage: input.activePackage,
  });
  if (input.requirements.currentAccess && !input.snapshotSummary?.accessCoverage?.available) {
    badges.push(copy.featureCurrentAccessMissingBadge);
  }
  const hasSubscription = Boolean(readString(input.currentSubscriptionStatus));
  if (input.requirements.subscription && !hasSubscription) {
    badges.push(copy.featureMembershipNotActiveBadge);
  }
  const requiredCredits = readNumber(input.requirements.credits);
  if (requiredCredits > 0 && creditsRemaining < requiredCredits) {
    badges.push(
      copy.featureGapShortLabel(
        formatNamedUnitAmount(requiredCredits - creditsRemaining, unitLabel),
      ),
    );
  }
  return badges;
}

function buildFeatureNeedLabel(
  requirements: Record<string, unknown>,
  unitLabel: string,
  locale?: unknown,
): string {
  const copy = buildXmsSurfaceCopy({ locale });
  const needsAccess = Boolean(requirements.currentAccess);
  const needsSubscription = Boolean(requirements.subscription);
  const needsCredits = readNumber(requirements.credits) > 0;
  if (needsAccess && needsCredits) return copy.featureNeedMixedAccessLabel;
  if (needsSubscription && needsCredits)
    return copy.featureNeedMembershipAndCreditsLabel(unitLabel);
  if (needsSubscription) return copy.featureNeedMembershipLabel;
  if (needsCredits) return copy.featureNeedCreditsLabel(unitLabel);
  if (needsAccess) return copy.featureNeedAccessLabel;
  return copy.featureLockedLabel;
}

function buildFeaturePaywallOpenLabel(
  requirements: Record<string, unknown>,
  unitLabel: string,
  locale?: unknown,
): string {
  const copy = buildXmsSurfaceCopy({ locale });
  const needsAccess = Boolean(requirements.currentAccess);
  const needsSubscription = Boolean(requirements.subscription);
  const needsCredits = readNumber(requirements.credits) > 0;
  if (needsAccess && needsCredits) return copy.featureViewHybridOptionsLabel;
  if (needsSubscription && needsCredits) return copy.featureViewMembershipOptionsLabel;
  if (needsSubscription) return copy.featureViewMembershipOptionsLabel;
  if (needsCredits) return copy.featureViewCreditOptionsLabel(unitLabel);
  if (needsAccess) return copy.featureViewUnlockOptionsLabel;
  return copy.featureOpenPaywallLabel;
}

function buildFeatureCheckoutLabel(
  activePackage: Record<string, unknown> | null,
  locale?: unknown,
): string {
  const copy = buildXmsSurfaceCopy({ locale });
  const packageKind = readString(activePackage?.packageKind);
  if (packageKind === "one_time_unlock") return copy.featureUnlockCheckoutLabel;
  if (packageKind === "subscription") return copy.featureStartMembershipCheckoutLabel;
  if (packageKind === "credit_pack") {
    const unitLabel = readFeatureCurrencyUnitLabel({ activePackage });
    return copy.featureBuyCreditsCheckoutLabel(unitLabel);
  }
  if (readString(activePackage?.packageSlug).includes("hybrid")) {
    return copy.featureStartHybridCheckoutLabel;
  }
  return copy.featureCreatePaymentSessionLabel;
}

export function buildFeaturePaywallCopyModel(input: {
  feature: unknown;
  snapshotSummary: unknown;
  currentSubscriptionStatus?: unknown;
  activePackage?: unknown;
  assetMixLabel?: unknown;
  locale?: unknown;
}): {
  summary: string;
  missingLines: string[];
  candidateLead: string;
  recommendationLead: string;
  ctaLabel: string;
  openPaywallLabel: string;
  activePackageLabel: string;
  statusLabel: string;
  assetMixLabel: string;
  coverageLabel: string;
  subscriptionLabel: string;
  creditsLabel: string;
  gapBadges: string[];
} {
  const feature =
    input.feature && typeof input.feature === "object"
      ? (input.feature as Record<string, unknown>)
      : {};
  const snapshotSummary =
    input.snapshotSummary && typeof input.snapshotSummary === "object"
      ? (input.snapshotSummary as Record<string, any>)
      : {};
  const requirements = readFeatureRequirements(feature);
  const creditsRemaining = readNumber(snapshotSummary?.wallet?.creditsRemaining);
  const requiredCredits = readNumber(requirements.credits);
  const hasCurrentAccess = Boolean(snapshotSummary?.accessCoverage?.available);
  const hasSubscription = Boolean(readString(input.currentSubscriptionStatus));
  const activePackage =
    input.activePackage && typeof input.activePackage === "object"
      ? (input.activePackage as Record<string, unknown>)
      : null;
  const copy = buildXmsSurfaceCopy({ locale: input.locale });
  const unitLabel = readFeatureCurrencyUnitLabel({
    snapshotSummary,
    activePackage,
  });

  const missingLines: string[] = [];
  if (requirements.currentAccess && !hasCurrentAccess) {
    missingLines.push(copy.featureCurrentAccessMissingLabel);
  }
  if (requirements.subscription && !hasSubscription) {
    missingLines.push(copy.featureSubscriptionMissingLabel);
  }
  if (requiredCredits > 0 && creditsRemaining < requiredCredits) {
    missingLines.push(
      copy.featureCreditsMissingLabel(
        formatNamedUnitAmount(requiredCredits, unitLabel),
        formatNamedUnitAmount(creditsRemaining, unitLabel),
      ),
    );
  }

  let summary = copy.featureBlockedSummary(readString(feature.title) || "Feature");
  if (!missingLines.length) {
    summary = copy.featureReadySummary(readString(feature.title) || "Feature");
  } else if (missingLines.length === 1) {
    summary = missingLines[0];
  } else {
    summary = `${missingLines[0]} ${missingLines[1]}`;
  }

  const candidateLead = activePackage
    ? copy.featureCandidateLead(readString(activePackage.packageTitle))
    : copy.featureCandidateFallbackLead;

  return {
    summary,
    missingLines,
    candidateLead,
    recommendationLead: candidateLead,
    ctaLabel: buildFeatureCheckoutLabel(activePackage, input.locale),
    openPaywallLabel: buildFeaturePaywallOpenLabel(requirements, unitLabel, input.locale),
    activePackageLabel: activePackage ? readString(activePackage.packageTitle) : "",
    statusLabel: missingLines.length
      ? buildFeatureNeedLabel(requirements, unitLabel, input.locale)
      : "ready",
    assetMixLabel: readString(input.assetMixLabel) || "unknown",
    coverageLabel: formatStateLabel(
      snapshotSummary?.accessCoverage?.coverageLabel,
      buildXmsSurfaceCopy({ locale: input.locale }).unavailableLabel,
    ),
    subscriptionLabel: formatStateLabel(input.currentSubscriptionStatus, "inactive"),
    creditsLabel: formatNamedUnitAmount(creditsRemaining, unitLabel),
    gapBadges: buildFeatureGapBadges({
      requirements,
      snapshotSummary: snapshotSummary as any,
      activePackage,
      currentSubscriptionStatus: input.currentSubscriptionStatus,
      locale: input.locale,
    }),
  };
}

export function summarizeXappMonetizationSnapshot(input: unknown): {
  accessCoverage: {
    available: boolean;
    coverageLabel: string;
    accessStateLabel: string;
    tierLabel: string;
    sourceRefLabel: string;
  };
  currentSubscription: {
    present: boolean;
    statusLabel: string;
    tierLabel: string;
    coverageLabel: string;
    coverageReasonLabel: string;
    renewsAt: string | null;
    expiresAt: string | null;
    paymentSessionIdLabel: string;
  };
  wallet: {
    creditsRemaining: string;
    virtualCurrencyLabel: string;
    balanceStateLabel: string;
    currentAccessLabel: string;
  };
} {
  const record =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const accessProjection =
    record.access_projection &&
    typeof record.access_projection === "object" &&
    !Array.isArray(record.access_projection)
      ? (record.access_projection as Record<string, unknown>)
      : null;
  const currentSubscription =
    record.current_subscription &&
    typeof record.current_subscription === "object" &&
    !Array.isArray(record.current_subscription)
      ? (record.current_subscription as Record<string, unknown>)
      : null;
  const lifecycle = buildXmsSubscriptionLifecycleSummary({ currentSubscription });

  return {
    accessCoverage: {
      available: hasEffectiveCoverage({ accessProjection, currentSubscription }),
      coverageLabel: formatCoverageLabel({ accessProjection, currentSubscription }),
      accessStateLabel: formatStateLabel(accessProjection?.entitlement_state, "inactive"),
      tierLabel: formatStateLabel(accessProjection?.tier),
      sourceRefLabel: formatStateLabel(accessProjection?.source_ref),
    },
    currentSubscription: {
      present: lifecycle.present,
      statusLabel: lifecycle.statusLabel || formatStateLabel(currentSubscription?.status),
      tierLabel: formatStateLabel(currentSubscription?.tier),
      coverageLabel: lifecycle.coverageLabel || buildXmsSurfaceCopy().unknownLabel,
      coverageReasonLabel: lifecycle.reasonLabel || buildXmsSurfaceCopy().noOverdueRestrictionLabel,
      renewsAt: lifecycle.renewsAt,
      expiresAt: lifecycle.expiresAt || lifecycle.currentPeriodEndsAt,
      paymentSessionIdLabel: formatStateLabel(currentSubscription?.payment_session_id),
    },
    wallet: {
      creditsRemaining: readString(accessProjection?.credits_remaining) || "0",
      virtualCurrencyLabel: formatVirtualCurrencyLabel(accessProjection?.virtual_currency, {
        includeCode: true,
      }),
      balanceStateLabel: formatStateLabel(accessProjection?.balance_state, "unknown"),
      currentAccessLabel: hasEffectiveCoverage({ accessProjection, currentSubscription })
        ? buildXmsSurfaceCopy().yesLabel
        : buildXmsSurfaceCopy().noLabel,
    },
  };
}
