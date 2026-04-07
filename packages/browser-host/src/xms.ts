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

function formatCoverageLabel(accessProjection: Record<string, unknown> | null): string {
  if (accessProjection?.has_current_access) return "Available";
  return formatStateLabel(accessProjection?.entitlement_state, "Unavailable");
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
          readString((offering as any)?.slug) || "Offering",
        ),
        offeringPlacement: readString((offering as any)?.placement) || null,
        packageId: readString((pkg as any)?.id),
        packageSlug: readString((pkg as any)?.slug),
        packageTitle: readLocalizedText(
          (pkg as any)?.title,
          readString((pkg as any)?.slug) || "Package",
        ),
        packageKind: readString((pkg as any)?.package_kind) || "standard",
        productId: readString((pkg as any)?.product?.id),
        productSlug: readString((pkg as any)?.product?.slug),
        productFamily: readString((pkg as any)?.product?.product_family),
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
      offeringTitle: readString(packageRecord.offering_slug) || "Offering",
      offeringPlacement: readString(packageRecord.offering_placement) || null,
      packageId: readString(packageRecord.id),
      packageSlug: readString(packageRecord.slug),
      packageTitle: readString(packageRecord.slug) || "Package",
      packageKind: readString(packageRecord.package_kind) || "standard",
      productId: readString((packageRecord.product as Record<string, unknown> | undefined)?.id),
      productSlug: readString((packageRecord.product as Record<string, unknown> | undefined)?.slug),
      productFamily: readString(
        (packageRecord.product as Record<string, unknown> | undefined)?.product_family,
      ),
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
  const offeringLabel =
    readString(record.offeringTitle) || formatStateLabel(record.offeringSlug, "Offering");
  const placementRaw = readLower(record.offeringPlacement);
  const placementLabel = formatPlacementLabel(record.offeringPlacement);
  let summary = "General offering surface for this xapp.";

  if (placementRaw.includes("feature") && placementRaw.includes("paywall")) {
    summary = "Feature-paywall placement for gated in-app flows.";
  } else if (placementRaw.includes("paywall")) {
    summary = "Default paywall placement for monetized upgrade prompts.";
  } else if (placementRaw.includes("checkout")) {
    summary = "Direct checkout placement for purchase-driven flows.";
  } else if (placementRaw.includes("upgrade")) {
    summary = "Upgrade-oriented placement for membership and package switching.";
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
    readLocalizedText(record.title, formatStateLabel(record.slug, "Paywall")) || "Paywall";
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
      packageTitle: readString(item.packageTitle) || "Package",
      productId: readString(item.productId),
      productSlug: readString(item.productSlug),
      productFamily: readString(item.productFamily),
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
  font: 700 1.15rem/1.15 "IBM Plex Serif", Georgia, serif;
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
  border-color: rgba(15,118,110,0.28);
  box-shadow: inset 0 0 0 1px rgba(15,118,110,0.08);
}
.xapps-paywall__package.is-selected {
  border-color: rgba(21,94,117,0.32);
  box-shadow: inset 0 0 0 1px rgba(21,94,117,0.1);
}
.xapps-paywall__package-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}
.xapps-paywall__package-title {
  margin: 0;
  font: 700 1rem/1.15 "IBM Plex Serif", Georgia, serif;
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
  color: #0f172a;
  font-family: Inter, "Segoe UI", sans-serif;
}
.xapps-xms-plans__header {
  display: grid;
  gap: 6px;
}
.xapps-xms-plans__title {
  margin: 0;
  font: 700 1.05rem/1.15 "IBM Plex Serif", Georgia, serif;
}
.xapps-xms-plans__subtitle {
  color: #64748b;
  font-size: 13px;
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
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 100%);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
}
.xapps-xms-plans__section-title {
  margin: 0;
  font: 700 0.98rem/1.1 "IBM Plex Serif", Georgia, serif;
}
.xapps-xms-plans__meta {
  display: grid;
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
  color: #64748b;
  flex: 0 0 124px;
}
.xapps-xms-plans__meta-value {
  color: #0f172a;
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
  background: rgba(14, 116, 144, 0.08);
  color: #0f766e;
  font-size: 13px;
}
.xapps-xms-plans__error {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(220, 38, 38, 0.08);
  color: #b91c1c;
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
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255,255,255,0.92);
}
.xapps-xms-plans__package.is-selected {
  border-color: rgba(37, 99, 235, 0.3);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.08);
}
.xapps-xms-plans__package.is-default {
  border-color: rgba(15, 118, 110, 0.28);
  box-shadow: inset 0 0 0 1px rgba(15, 118, 110, 0.08);
}
.xapps-xms-plans__package-head {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
}
.xapps-xms-plans__package-title {
  margin: 0;
  font: 700 0.98rem/1.15 "IBM Plex Serif", Georgia, serif;
}
.xapps-xms-plans__package-description {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}
.xapps-xms-plans__money {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: #1e293b;
  font-size: 12px;
  font-weight: 700;
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
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
  font-weight: 700;
}
.xapps-xms-plans__signal {
  background: rgba(15, 23, 42, 0.05);
  color: #475569;
}
.xapps-xms-plans__action {
  justify-self: start;
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #0f766e, #155e75);
  color: #f8fafc;
  font-weight: 700;
  cursor: pointer;
}
.xapps-xms-plans__action[disabled] {
  cursor: not-allowed;
  opacity: 0.6;
}
.xapps-xms-plans__empty {
  color: #64748b;
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
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255,255,255,0.94);
}
.xapps-xms-plans__timeline-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.xapps-xms-plans__timeline-title {
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}
.xapps-xms-plans__timeline-when {
  color: #64748b;
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
  font: 700 0.92rem/1.1 "IBM Plex Serif", Georgia, serif;
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
  const actionLabel = readString(options.actionLabel) || "Choose package";
  const selectedPackageId = readString(options.selectedPackageId);
  const showSummary = options.showSummary !== false;
  const showSignals = options.showSignals !== false;
  const showBadges = options.showBadges !== false;
  const interactive = options.interactive !== false;
  const emptyLabel =
    readString(options.emptyLabel) || "No paywall packages are currently available.";
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
            ? `<span class="xapps-paywall__badge">default</span>`
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

function buildPlansActionLabel(input: {
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
  if (input.policy.status === "owned_additive_unlock") return "Owned unlock active";
  if (input.policy.status === "current_recurring_plan") return "Current plan active";
  if (input.busy) return "Starting checkout...";
  if (input.policy.transitionKind === "buy_additive_unlock") return "Purchase add-on unlock";
  return "Continue to checkout";
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

function readHistoryTitle(item: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = readString(item[key]);
    if (value) return value;
  }
  return fallback;
}

function readHistoryMeta(item: Record<string, unknown>, keys: string[], locale: string): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const value = key.endsWith("_at")
      ? formatPlansDateTime(item[key], locale)
      : readString(item[key]);
    if (value) out.push(formatStateLabel(value, value));
  }
  return out;
}

function formatTimelineBucketLabel(value: unknown): string {
  const normalized = readLower(value);
  if (!normalized) return "History";
  if (normalized === "purchase_intents") return "Purchase intent";
  if (normalized === "transactions") return "Transaction";
  if (normalized === "subscriptions") return "Subscription";
  if (normalized === "entitlements") return "Entitlement";
  if (normalized === "wallet_ledger") return "Wallet ledger";
  if (normalized === "access_snapshots") return "Access snapshot";
  if (normalized === "invoices") return "Invoice";
  return formatStateLabel(normalized, normalized);
}

function buildTimelineHtml(input: {
  total: number;
  items: Array<Record<string, unknown>>;
  locale: string;
}): string {
  if (!input.total) return "";
  return `
    <div class="xapps-xms-plans__timeline">
      ${input.items
        .map((item) => {
          const title =
            readString(item.title) || readString(item.id) || formatTimelineBucketLabel(item.bucket);
          const when = formatPlansDateTime(item.occurred_at, input.locale);
          const meta = [
            formatTimelineBucketLabel(item.bucket),
            readString(item.status) ? formatStateLabel(item.status, readString(item.status)) : "",
            readString(item.scope),
            readString(item.correlation),
            readString(item.amount) && readString(item.currency)
              ? `${readString(item.amount)} ${readString(item.currency)}`
              : readString(item.amount),
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

export function buildMonetizationPlansSurfaceHtml(
  input: unknown,
  options: {
    title?: unknown;
    subtitle?: unknown;
    locale?: unknown;
    selectedPackageSlug?: unknown;
    busyPackageSlug?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
    interactive?: boolean;
  } = {},
): string {
  const record = readRecord(input) ?? {};
  const accessProjection = readRecord(record.accessProjection ?? record.access_projection);
  const currentSubscription = readRecord(record.currentSubscription ?? record.current_subscription);
  const additiveEntitlements = readActiveAdditiveEntitlements(
    record.additiveEntitlements ?? record.additive_entitlements,
  );
  const history = readRecord(record.history);
  const paywall = readRecord(record.paywall) ?? record;
  const locale = readString(options.locale) || "en";
  const renderModel = buildMonetizationPaywallRenderModel(paywall);
  const packageRecords = flattenXappMonetizationPaywallPackages(paywall);
  const packageRecordBySlug = new Map(
    packageRecords.map((item) => [readLower(item.packageSlug), item]),
  );
  const selectedPackageSlug = readLower(options.selectedPackageSlug);
  const busyPackageSlug = readLower(options.busyPackageSlug);
  const includeStyles = options.includeStyles !== false;
  const showHeader = options.showHeader !== false;
  const currentTier = readString(currentSubscription?.tier) || readString(accessProjection?.tier);
  const accessState = formatCoverageLabel(accessProjection);
  const subscriptionStatus = formatStateLabel(currentSubscription?.status, "");
  const renewsAt = formatPlansDateTime(currentSubscription?.renews_at, locale);
  const expiresAt =
    formatPlansDateTime(currentSubscription?.expired_at, locale) ||
    formatPlansDateTime(currentSubscription?.current_period_ends_at, locale);
  const creditsRemaining = readString(accessProjection?.credits_remaining);
  const additiveUnlocks = additiveEntitlements
    .map((item) => readString(item.tier) || readString(item.product_slug))
    .filter(Boolean);
  const accessRows = [
    currentTier ? ["Current plan", currentTier] : null,
    accessState ? ["Membership access", accessState] : null,
    subscriptionStatus ? ["Subscription status", subscriptionStatus] : null,
    renewsAt ? ["Renews at", renewsAt] : null,
    expiresAt ? ["Expires at", expiresAt] : null,
    creditsRemaining ? ["Credits remaining", creditsRemaining] : null,
  ].filter((item): item is [string, string] => Boolean(item));
  const historySections = [
    buildHistorySectionHtml({
      title: "Purchase intents",
      total: readHistoryBucket(history, "purchase_intents").total,
      items: readHistoryBucket(history, "purchase_intents").items,
      locale,
      itemTitleKeys: ["package_slug", "product_slug", "id"],
      itemFallbackTitle: "Purchase intent",
      itemStatusKeys: ["status"],
      itemMetaKeys: ["amount", "currency", "payment_lane", "updated_at"],
    }),
    buildHistorySectionHtml({
      title: "Transactions",
      total: readHistoryBucket(history, "transactions").total,
      items: readHistoryBucket(history, "transactions").items,
      locale,
      itemTitleKeys: ["package_slug", "product_slug", "id"],
      itemFallbackTitle: "Transaction",
      itemStatusKeys: ["status"],
      itemMetaKeys: ["amount", "currency", "payment_session_id", "occurred_at"],
    }),
    buildHistorySectionHtml({
      title: "Subscriptions",
      total: readHistoryBucket(history, "subscriptions").total,
      items: readHistoryBucket(history, "subscriptions").items,
      locale,
      itemTitleKeys: ["tier", "product_slug", "id"],
      itemFallbackTitle: "Subscription contract",
      itemStatusKeys: ["status"],
      itemMetaKeys: ["billing_period", "renews_at", "expired_at", "cancelled_at"],
    }),
    buildHistorySectionHtml({
      title: "Entitlements",
      total: readHistoryBucket(history, "entitlements").total,
      items: readHistoryBucket(history, "entitlements").items,
      locale,
      itemTitleKeys: ["tier", "product_slug", "id"],
      itemFallbackTitle: "Entitlement",
      itemStatusKeys: ["status"],
      itemMetaKeys: ["source_kind", "starts_at", "expires_at"],
    }),
    buildHistorySectionHtml({
      title: "Wallet accounts",
      total: readHistoryBucket(history, "wallet_accounts").total,
      items: readHistoryBucket(history, "wallet_accounts").items,
      locale,
      itemTitleKeys: ["product_slug", "id"],
      itemFallbackTitle: "Wallet account",
      itemStatusKeys: ["status"],
      itemMetaKeys: ["currency", "balance_remaining", "updated_at"],
    }),
    buildHistorySectionHtml({
      title: "Wallet ledger",
      total: readHistoryBucket(history, "wallet_ledger").total,
      items: readHistoryBucket(history, "wallet_ledger").items,
      locale,
      itemTitleKeys: ["event_kind", "wallet_product_slug", "id"],
      itemFallbackTitle: "Wallet ledger entry",
      itemStatusKeys: [],
      itemMetaKeys: ["amount", "currency", "source_kind", "occurred_at"],
    }),
    buildHistorySectionHtml({
      title: "Access snapshots",
      total: readHistoryBucket(history, "access_snapshots").total,
      items: readHistoryBucket(history, "access_snapshots").items,
      locale,
      itemTitleKeys: ["tier", "id"],
      itemFallbackTitle: "Access snapshot",
      itemStatusKeys: ["entitlement_state"],
      itemMetaKeys: ["balance_state", "credits_remaining", "updated_at"],
    }),
    buildHistorySectionHtml({
      title: "Invoices",
      total: readHistoryBucket(history, "invoices").total,
      items: readHistoryBucket(history, "invoices").items,
      locale,
      itemTitleKeys: ["invoice_identifier", "id"],
      itemFallbackTitle: "Invoice",
      itemStatusKeys: ["status"],
      itemMetaKeys: ["provider_key", "owner_scope", "created_at"],
    }),
  ].filter(Boolean);
  const timeline = readHistoryBucket(history, "timeline");

  const packagesHtml = renderModel.packages.length
    ? renderModel.packages
        .map((item) => {
          const packageRecord = packageRecordBySlug.get(readLower(item.packageSlug)) ?? item;
          const purchasePolicy = resolveMonetizationPackagePurchasePolicy({
            item: packageRecord,
            currentSubscription,
            additiveEntitlements,
          });
          const badges = [item.fitLabel];
          if (selectedPackageSlug && readLower(item.packageSlug) === selectedPackageSlug) {
            badges.push("Selected");
          }
          if (purchasePolicy.status === "owned_additive_unlock") {
            badges.push("Owned unlock");
          } else if (purchasePolicy.status === "current_recurring_plan") {
            badges.push("Current plan");
          } else if (purchasePolicy.transitionKind === "buy_additive_unlock") {
            badges.push("Add-on with membership");
          }
          if (item.isDefault) badges.push("Default");
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
                item.signals.length
                  ? `<div class="xapps-xms-plans__signals">${item.signals
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
                  policy: purchasePolicy,
                  busy: busyPackageSlug === readLower(item.packageSlug),
                }),
              )}</button>
            </section>
          `;
        })
        .join("")
    : `<div class="xapps-xms-plans__empty">No published plans are currently available.</div>`;

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
              <h4 class="xapps-xms-plans__section-title">Current coverage</h4>
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
                        <span class="xapps-xms-plans__meta-label">Add-on unlocks</span>
                        <span class="xapps-xms-plans__meta-value">
                          <span class="xapps-xms-plans__stack">${additiveUnlocks
                            .map((label) => `<span>${escapeHtml(label)}</span>`)
                            .join("")}</span>
                        </span>
                      </div>`
                    : ""
                }
              </div>
            </section>`
          : ""
      }
      <section class="xapps-xms-plans__card">
        <h4 class="xapps-xms-plans__section-title">${escapeHtml(
          renderModel.paywallLabel || "Plans",
        )}</h4>
        ${
          renderModel.summary
            ? `<div class="xapps-xms-plans__subtitle">${escapeHtml(renderModel.summary)}</div>`
            : ""
        }
        <div class="xapps-xms-plans__packages">${packagesHtml}</div>
      </section>
      ${
        timeline.total
          ? `<section class="xapps-xms-plans__card">
              <h4 class="xapps-xms-plans__section-title">Recent timeline</h4>
              <div class="xapps-xms-plans__subtitle">Latest monetization events correlated for this subject and app.</div>
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
              <h4 class="xapps-xms-plans__section-title">History and audit</h4>
              <div class="xapps-xms-plans__subtitle">Recent monetization records for this subject and app.</div>
              <div class="xapps-xms-plans__history-grid">${historySections.join("")}</div>
            </section>`
          : ""
      }
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
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
    interactive?: boolean;
    onCheckoutPackage?: ((input: { packageId: string; packageSlug: string }) => void) | null;
  } = {},
): { destroy: () => void } {
  root.innerHTML = buildMonetizationPlansSurfaceHtml(input, options);
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".xapps-xms-plans__action"));
  const listeners: Array<() => void> = [];
  const onCheckoutPackage =
    typeof options.onCheckoutPackage === "function" ? options.onCheckoutPackage : null;

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

  return {
    destroy() {
      for (const cleanup of listeners) cleanup();
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
  const packageKind = readString(item.packageKind);
  const packageSlug = readLower(item.packageSlug);
  const metadata =
    item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};
  const credits = readPackageCredits(item);
  const moneyLabel = normalizeMoneyLabel(item);
  const offeringPresentation = buildMonetizationOfferingPresentation(item);
  let fitLabel = "General upgrade";
  let summary = "Useful as a general monetization upgrade for this creator scope.";

  if (packageKind === "one_time_unlock") {
    fitLabel = "Durable unlock";
    summary = "Best when the feature mainly needs current access without ongoing membership.";
  } else if (packageKind === "subscription") {
    fitLabel = "Recurring membership";
    summary = "Best when the feature depends on ongoing membership coverage.";
  } else if (packageKind === "credit_pack") {
    fitLabel = "Credit top-up";
    summary = "Best when the feature spends credits for each advanced action.";
  } else if (packageSlug.includes("hybrid")) {
    fitLabel = "Hybrid upgrade";
    summary = "Blends access coverage with bundled credits for mixed workflows.";
  }

  const signals: string[] = [];
  if (readString(metadata.badge)) {
    signals.push(readString(metadata.badge));
  }
  if (credits > 0) {
    signals.push(`${credits} credits`);
  }
  if (readString(item.billingPeriod)) {
    signals.push(`billed ${readString(item.billingPeriod)}`);
  }
  if (offeringPresentation.offeringLabel) {
    signals.push(offeringPresentation.offeringLabel);
  }
  if (
    offeringPresentation.placementLabel &&
    offeringPresentation.placementLabel !== "General placement"
  ) {
    signals.push(offeringPresentation.placementLabel);
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
  return [
    readLower(item.productSlug),
    readLower(item.packageSlug),
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
  const ownershipCandidates = new Set(collectPackageOwnershipCandidates(item));
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
  if (!amount && !currency) return "Price unavailable";
  return `${amount} ${currency}${billingPeriod ? ` / ${billingPeriod}` : ""}`.trim();
}

function packageCredits(item: Record<string, unknown>) {
  return readPackageCredits(item);
}

function scorePackageForFeature(feature: Record<string, unknown>, item: Record<string, unknown>) {
  const requirements =
    feature.requirements && typeof feature.requirements === "object"
      ? (feature.requirements as Record<string, unknown>)
      : {};
  const packageKind = readString(item.packageKind);
  const packageSlug = readString(item.packageSlug);
  const offeringSlug = readString(item.offeringSlug);
  const credits = packageCredits(item);
  let score = 0;
  const reasons: string[] = [];

  if (requirements.currentAccess) {
    if (packageKind === "one_time_unlock") {
      score += 7;
      reasons.push("Aligned with durable unlock access.");
    } else if (packageKind === "subscription") {
      score += 6;
      reasons.push("Recurring membership also grants current access.");
    } else if (packageSlug.includes("hybrid")) {
      score += 5;
      reasons.push("Hybrid package contributes to current access coverage.");
    }
  }

  if (requirements.subscription) {
    if (packageKind === "subscription") {
      score += 8;
      reasons.push("Matches the subscription requirement directly.");
    } else if (packageSlug.includes("hybrid")) {
      score += 5;
      reasons.push("Hybrid package can also cover part of the subscription shape.");
    }
  }

  const requiredCredits = Number(requirements.credits || 0);
  if (requiredCredits) {
    if (credits >= requiredCredits) {
      score += 8;
      reasons.push(`Covers the ${requiredCredits} credit requirement.`);
    } else if (credits > 0) {
      score += 4;
      reasons.push(`Adds ${credits} credits toward the requirement.`);
    } else if (packageSlug.includes("hybrid")) {
      score += 3;
      reasons.push("Hybrid package can add bundled credits for this flow.");
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
      const scored = scorePackageForFeature(feature, record);
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
    wallet?: { creditsRemaining?: string | null };
  };
  currentSubscriptionStatus?: unknown;
}): string[] {
  const badges: string[] = [];
  const creditsRemaining = readNumber(input.snapshotSummary?.wallet?.creditsRemaining);
  if (input.requirements.currentAccess && !input.snapshotSummary?.accessCoverage?.available) {
    badges.push("current access missing");
  }
  const hasSubscription = Boolean(readString(input.currentSubscriptionStatus));
  if (input.requirements.subscription && !hasSubscription) {
    badges.push("membership not active");
  }
  const requiredCredits = readNumber(input.requirements.credits);
  if (requiredCredits > 0 && creditsRemaining < requiredCredits) {
    badges.push(`${requiredCredits - creditsRemaining} credits short`);
  }
  return badges;
}

function buildFeatureNeedLabel(requirements: Record<string, unknown>): string {
  const needsAccess = Boolean(requirements.currentAccess);
  const needsSubscription = Boolean(requirements.subscription);
  const needsCredits = readNumber(requirements.credits) > 0;
  if (needsAccess && needsCredits) return "needs mixed access";
  if (needsSubscription && needsCredits) return "needs membership + credits";
  if (needsSubscription) return "needs membership";
  if (needsCredits) return "needs credits";
  if (needsAccess) return "needs access";
  return "locked";
}

function buildFeaturePaywallOpenLabel(requirements: Record<string, unknown>): string {
  const needsAccess = Boolean(requirements.currentAccess);
  const needsSubscription = Boolean(requirements.subscription);
  const needsCredits = readNumber(requirements.credits) > 0;
  if (needsAccess && needsCredits) return "View hybrid options";
  if (needsSubscription && needsCredits) return "View membership options";
  if (needsSubscription) return "View membership options";
  if (needsCredits) return "View credit options";
  if (needsAccess) return "View unlock options";
  return "Open paywall";
}

function buildFeatureCheckoutLabel(activePackage: Record<string, unknown> | null): string {
  const packageKind = readString(activePackage?.packageKind);
  if (packageKind === "one_time_unlock") return "Unlock with hosted checkout";
  if (packageKind === "subscription") return "Start membership checkout";
  if (packageKind === "credit_pack") return "Buy credits with hosted checkout";
  if (readString(activePackage?.packageSlug).includes("hybrid")) {
    return "Start hybrid checkout";
  }
  return "Create payment session";
}

export function buildFeaturePaywallCopyModel(input: {
  feature: unknown;
  snapshotSummary: unknown;
  currentSubscriptionStatus?: unknown;
  activePackage?: unknown;
  assetMixLabel?: unknown;
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

  const missingLines: string[] = [];
  if (requirements.currentAccess && !hasCurrentAccess) {
    missingLines.push("Current access coverage is not active on this scope.");
  }
  if (requirements.subscription && !hasSubscription) {
    missingLines.push("No active recurring membership is visible for this scope.");
  }
  if (requiredCredits > 0 && creditsRemaining < requiredCredits) {
    missingLines.push(
      `This action needs ${requiredCredits} credits, but only ${creditsRemaining} are visible right now.`,
    );
  }

  let summary = `${readString(feature.title) || "Feature"} is blocked on the current scope.`;
  if (!missingLines.length) {
    summary = `${readString(feature.title) || "Feature"} can be unlocked from the current paywall package candidates.`;
  } else if (missingLines.length === 1) {
    summary = missingLines[0];
  } else {
    summary = `${missingLines[0]} ${missingLines[1]}`;
  }

  const candidateLead = activePackage
    ? `${readString(activePackage.packageTitle) || "Selected package"} is one package candidate for this access gap.`
    : "Choose a package candidate that covers the current access gap.";

  return {
    summary,
    missingLines,
    candidateLead,
    recommendationLead: candidateLead,
    ctaLabel: buildFeatureCheckoutLabel(activePackage),
    openPaywallLabel: buildFeaturePaywallOpenLabel(requirements),
    activePackageLabel: activePackage ? readString(activePackage.packageTitle) : "",
    statusLabel: missingLines.length ? buildFeatureNeedLabel(requirements) : "ready",
    assetMixLabel: readString(input.assetMixLabel) || "unknown",
    coverageLabel: formatStateLabel(snapshotSummary?.accessCoverage?.coverageLabel, "Unavailable"),
    subscriptionLabel: formatStateLabel(input.currentSubscriptionStatus, "inactive"),
    creditsLabel: String(creditsRemaining),
    gapBadges: buildFeatureGapBadges({
      requirements,
      snapshotSummary: snapshotSummary as any,
      currentSubscriptionStatus: input.currentSubscriptionStatus,
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
  const overduePolicy =
    currentSubscription?.overdue_policy &&
    typeof currentSubscription.overdue_policy === "object" &&
    !Array.isArray(currentSubscription.overdue_policy)
      ? (currentSubscription.overdue_policy as Record<string, unknown>)
      : null;

  return {
    accessCoverage: {
      available: Boolean(accessProjection?.has_current_access),
      coverageLabel: formatCoverageLabel(accessProjection),
      accessStateLabel: formatStateLabel(accessProjection?.entitlement_state, "inactive"),
      tierLabel: formatStateLabel(accessProjection?.tier),
      sourceRefLabel: formatStateLabel(accessProjection?.source_ref),
    },
    currentSubscription: {
      present: Boolean(currentSubscription),
      statusLabel: formatStateLabel(currentSubscription?.status),
      tierLabel: formatStateLabel(currentSubscription?.tier),
      coverageLabel: overduePolicy?.has_current_access ? "Still active" : "Expired or blocked",
      coverageReasonLabel: overduePolicy?.effective_status_reason
        ? formatStateLabel(overduePolicy.effective_status_reason)
        : "No active overdue restriction.",
      renewsAt: readString(currentSubscription?.renews_at) || null,
      expiresAt: readString(currentSubscription?.current_period_ends_at) || null,
      paymentSessionIdLabel: formatStateLabel(currentSubscription?.payment_session_id),
    },
    wallet: {
      creditsRemaining: readString(accessProjection?.credits_remaining) || "0",
      balanceStateLabel: formatStateLabel(accessProjection?.balance_state, "unknown"),
      currentAccessLabel: accessProjection?.has_current_access ? "Yes" : "No",
    },
  };
}
