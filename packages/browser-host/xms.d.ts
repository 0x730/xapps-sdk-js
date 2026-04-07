export type MonetizationPackagePurchasePolicy = {
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

export type MonetizationPaywallPackageRecord = Record<string, unknown> & {
  offeringId: string;
  packageId: string;
  packageSlug: string;
  priceId: string;
  productId: string;
  productSlug: string;
  productFamily: string;
  packageKind: string;
  purchasePolicy?: MonetizationPackagePurchasePolicy | null;
};

export type MonetizationPaywallRenderPackage = {
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
};

export type MonetizationPaywallRenderModel = {
  paywallLabel: string;
  placementLabel: string;
  summary: string;
  defaultPackageLabel: string;
  packageCountLabel: string;
  badges: string[];
  packages: MonetizationPaywallRenderPackage[];
};

export type MonetizationPlansSurfaceInput = {
  accessProjection?: unknown;
  access_projection?: unknown;
  currentSubscription?: unknown;
  current_subscription?: unknown;
  additiveEntitlements?: unknown;
  additive_entitlements?: unknown;
  paywall?: unknown;
};

export function listXappMonetizationPaywalls(items: unknown): Array<Record<string, unknown>>;
export function selectXappMonetizationPaywall(input: {
  paywalls: unknown;
  slug?: unknown;
  placement?: unknown;
}): Record<string, unknown> | null;
export function flattenXappMonetizationPaywallPackages(
  paywall: unknown,
): MonetizationPaywallPackageRecord[];
export function buildMonetizationPaywallRenderModel(input: unknown): MonetizationPaywallRenderModel;
export const monetizationPlansSurfaceStyles: string;
export function buildMonetizationPlansSurfaceHtml(
  input: unknown,
  options?: {
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
  },
): string;
export function renderMonetizationPlansSurface(
  root: Element,
  input: unknown,
  options?: {
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
  },
): { destroy: () => void };
export function resolveMonetizationPackagePurchasePolicy(input: {
  item: unknown;
  currentSubscription?: unknown;
  additiveEntitlements?: unknown;
  accessProjection?: unknown;
}): MonetizationPackagePurchasePolicy;
