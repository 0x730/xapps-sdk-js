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

export type XmsSurfaceView = "plans" | "history";

export function buildXmsSurfaceCopy(input?: {
  locale?: unknown;
}): {
  plansTitle: string;
  historyTitle: string;
  plansSubtitle: string;
  historySubtitle: string;
  plansLabel: string;
  historyLabel: string;
  closeLabel: string;
  tabsAriaLabel: string;
  loadingLabel: string;
  subjectRequiredNotice: string;
  paymentCompletedNotice: string;
  checkoutCancelledNotice: string;
  paymentFailedNotice: string;
  missingPackageMetadataMessage: string;
  missingIntentMessage: string;
  missingPaymentPageMessage: string;
  startCheckoutFailedMessage: string;
  loadFailedMessage: string;
  currentCoverageTitle: string;
  currentPlanLabel: string;
  membershipAccessLabel: string;
  subscriptionStatusLabel: string;
  renewsAtLabel: string;
  expiresAtLabel: string;
  creditsRemainingLabel: string;
  addOnUnlocksLabel: string;
  noPublishedPlansLabel: string;
  recentTimelineTitle: string;
  recentTimelineSubtitle: string;
  historyAuditTitle: string;
  historyAuditSubtitle: string;
  noHistoryAvailableLabel: string;
  historyGenericLabel: string;
  historyPurchaseIntentsTitle: string;
  historyPurchaseIntentLabel: string;
  historyTransactionsTitle: string;
  historyTransactionLabel: string;
  historySubscriptionsTitle: string;
  historySubscriptionContractLabel: string;
  historyEntitlementsTitle: string;
  historyEntitlementLabel: string;
  historyWalletAccountsTitle: string;
  historyWalletAccountLabel: string;
  historyWalletLedgerTitle: string;
  historyWalletLedgerEntryLabel: string;
  historyAccessSnapshotsTitle: string;
  historyAccessSnapshotLabel: string;
  historyInvoicesTitle: string;
  historyInvoiceLabel: string;
};
export function buildXmsSurfaceShellTheme(input?: {
  themeTokens?: unknown;
}): {
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
};
export type MonetizationPlansSurfaceInput = {
  accessProjection?: unknown;
  access_projection?: unknown;
  currentSubscription?: unknown;
  current_subscription?: unknown;
  additiveEntitlements?: unknown;
  additive_entitlements?: unknown;
  paywall?: unknown;
  history?: unknown;
};

export function listXappMonetizationPaywalls(items: unknown): Array<Record<string, unknown>>;
export function resolveXmsSurfaceView(value: unknown, fallback?: XmsSurfaceView): XmsSurfaceView;
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
};
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
export function buildMonetizationHistorySurfaceHtml(
  input: unknown,
  options?: {
    title?: unknown;
    subtitle?: unknown;
    locale?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
  },
): string;
export function renderMonetizationHistorySurface(
  root: Element,
  input: unknown,
  options?: {
    title?: unknown;
    subtitle?: unknown;
    locale?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
  },
): { destroy: () => void };
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
};
export function resolveMonetizationPackagePurchasePolicy(input: {
  item: unknown;
  currentSubscription?: unknown;
  additiveEntitlements?: unknown;
  accessProjection?: unknown;
}): MonetizationPackagePurchasePolicy;
