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
  virtualCurrency?: Record<string, unknown> | null;
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
  virtualCurrencyCode: string;
  virtualCurrencyName: string;
  virtualCurrencyLabel: string;
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

export function buildXmsSurfaceCopy(input?: { locale?: unknown }): {
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
  subscriptionRefreshCompletedNotice: string;
  subscriptionRefreshFailedNotice: string;
  subscriptionCancelCompletedNotice: string;
  subscriptionCancelFailedNotice: string;
  subscriptionCancelConfirmTitle: string;
  subscriptionCancelConfirmMessage: string;
  subscriptionCancelConfirmLabel: string;
  subscriptionCancelDismissLabel: string;
  missingPackageMetadataMessage: string;
  missingIntentMessage: string;
  missingPaymentPageMessage: string;
  startCheckoutFailedMessage: string;
  loadFailedMessage: string;
  currentCoverageTitle: string;
  currentPlanLabel: string;
  membershipAccessLabel: string;
  subscriptionStatusLabel: string;
  subscriptionCoverageLabel: string;
  subscriptionReasonLabel: string;
  currentPeriodEndsLabel: string;
  renewsAtLabel: string;
  expiresAtLabel: string;
  overdueSinceLabel: string;
  expiryBoundaryLabel: string;
  cancelledAtLabel: string;
  managementDestinationLabel: string;
  creditsRemainingLabel: string;
  addOnUnlocksLabel: string;
  coverageActiveLabel: string;
  coverageInactiveLabel: string;
  noOverdueRestrictionLabel: string;
  reasonGraceCoveredPastDueLabel: string;
  reasonPastDueAfterPeriodEndLabel: string;
  reasonExpiredAfterBoundaryLabel: string;
  refreshStatusActionLabel: string;
  refreshingStatusActionLabel: string;
  cancelSubscriptionActionLabel: string;
  cancellingSubscriptionActionLabel: string;
  operatorAuthorityLabel: string;
  operatorAuthorityGatewayLabel: string;
  operatorAuthorityTenantLabel: string;
  operatorAuthorityPublisherLabel: string;
  operatorAuthorityOwnerLabel: string;
  managementDestinationGatewayLabel: string;
  managementDestinationTenantLabel: string;
  managementDestinationPublisherLabel: string;
  managementDestinationOwnerLabel: string;
  managementDestinationHintGatewayLabel: string;
  managementDestinationHintTenantLabel: string;
  managementDestinationHintPublisherLabel: string;
  managementDestinationHintOwnerLabel: string;
  openManagementDestinationActionLabel: string;
  virtualCurrencyLabel: string;
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
    busyAction?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
    interactive?: boolean;
    showOperatorManagement?: boolean;
    onRefreshSubscription?: (() => void) | null;
    onCancelSubscription?: (() => void) | null;
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
    busyAction?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
    interactive?: boolean;
    showOperatorManagement?: boolean;
    onCheckoutPackage?: ((input: { packageId: string; packageSlug: string }) => void) | null;
    onRefreshSubscription?: (() => void) | null;
    onCancelSubscription?: (() => void) | null;
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
};
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
};
export function summarizeVirtualCurrencyBalances(input: unknown): {
  balances: Array<{
    key: string;
    label: string;
    amount: string;
    amountLabel: string;
    accountCount: number;
  }>;
  totalAccounts: number;
  totalCurrencies: number;
};
export function resolveMonetizationPackagePurchasePolicy(input: {
  item: unknown;
  currentSubscription?: unknown;
  additiveEntitlements?: unknown;
  accessProjection?: unknown;
}): MonetizationPackagePurchasePolicy;
