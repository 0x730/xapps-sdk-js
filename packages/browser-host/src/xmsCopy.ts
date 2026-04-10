function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function readLower(value: unknown): string {
  return readString(value).toLowerCase();
}

export function isRomanianLocale(value: unknown): boolean {
  const locale = readLower(value);
  return locale === "ro" || locale.startsWith("ro-");
}

export type XmsPackageCopy = {
  consumedLabel: string;
  currentPlanLabel: string;
  ownedUnlockLabel: string;
  addOnWithMembershipLabel: string;
  selectedLabel: string;
  defaultLabel: string;
  ownedUnlockActiveLabel: string;
  currentPlanActiveLabel: string;
  startingCheckoutLabel: string;
  purchaseAddOnUnlockLabel: string;
  continueToCheckoutLabel: string;
};

export type XmsSurfaceCopy = {
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
  operatorAuthorityLabel: string;
  managementDestinationLabel: string;
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
  historySettlementDetailDisputeWarningNeedsResponse: string;
  historySettlementDetailDisputeWarningUnderReview: string;
  historySettlementDetailDisputeWarningClosed: string;
  historySettlementDetailDisputeNeedsResponse: string;
  historySettlementDetailDisputeUnderReview: string;
  historySettlementDetailDisputeWon: string;
  historySettlementDetailDisputeLost: string;
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

export const XMS_COPY_CATALOG = {
  en: {
    package: {
      consumedLabel: "Consumed",
      currentPlanLabel: "Current plan",
      ownedUnlockLabel: "Owned unlock",
      addOnWithMembershipLabel: "Add-on with membership",
      selectedLabel: "Selected",
      defaultLabel: "Default",
      ownedUnlockActiveLabel: "Owned unlock active",
      currentPlanActiveLabel: "Current plan active",
      startingCheckoutLabel: "Starting checkout...",
      purchaseAddOnUnlockLabel: "Purchase add-on unlock",
      continueToCheckoutLabel: "Continue to checkout",
    },
    surface: {
      plansTitle: "Plans",
      historyTitle: "History",
      plansSubtitle: "Current access and published plans for this app",
      historySubtitle: "Recent monetization events, invoices, subscriptions, and wallet activity",
      plansLabel: "Plans",
      historyLabel: "History",
      closeLabel: "Close",
      tabsAriaLabel: "XMS view",
      loadingLabel: "Loading plans...",
      subjectRequiredNotice:
        "Checkout requires a subject-bound catalog session. Start from a signed host session to purchase plans.",
      paymentCompletedNotice: "Payment completed and access was refreshed.",
      checkoutCancelledNotice: "Checkout was cancelled before completion.",
      paymentFailedNotice: "Payment failed before access could be issued.",
      subscriptionRefreshCompletedNotice: "Subscription status was refreshed.",
      subscriptionRefreshFailedNotice: "Subscription status could not be refreshed.",
      subscriptionCancelCompletedNotice: "Subscription renewal was cancelled.",
      subscriptionCancelFailedNotice: "Subscription could not be cancelled.",
      subscriptionCancelConfirmTitle: "Cancel subscription",
      subscriptionCancelConfirmMessage: "Cancel renewal for this subscription?",
      subscriptionCancelConfirmLabel: "Cancel subscription",
      subscriptionCancelDismissLabel: "Keep subscription",
      missingPackageMetadataMessage:
        "This package is missing purchase metadata in the published paywall.",
      missingIntentMessage: "Purchase intent was created without an identifier.",
      missingPaymentPageMessage: "Payment page is not available for this package.",
      startCheckoutFailedMessage: "Unable to start checkout for this package.",
      loadFailedMessage: "Unable to load plans.",
      currentCoverageTitle: "Current coverage",
      currentPlanLabel: "Current plan",
      membershipAccessLabel: "Membership access",
      subscriptionStatusLabel: "Subscription status",
      subscriptionCoverageLabel: "Coverage",
      subscriptionReasonLabel: "Status reason",
      currentPeriodEndsLabel: "Current period ends",
      renewsAtLabel: "Renews at",
      expiresAtLabel: "Expires at",
      overdueSinceLabel: "Overdue since",
      expiryBoundaryLabel: "Expiry boundary",
      cancelledAtLabel: "Cancelled at",
      operatorAuthorityLabel: "Operator authority",
      managementDestinationLabel: "Manage in",
      operatorAuthorityGatewayLabel: "Gateway",
      operatorAuthorityTenantLabel: "Tenant",
      operatorAuthorityPublisherLabel: "Publisher",
      operatorAuthorityOwnerLabel: "App owner",
      managementDestinationGatewayLabel: "Gateway admin",
      managementDestinationTenantLabel: "Tenant app",
      managementDestinationPublisherLabel: "Publisher app",
      managementDestinationOwnerLabel: "App owner",
      managementDestinationHintGatewayLabel:
        "Advanced subscription management is handled in Gateway admin.",
      managementDestinationHintTenantLabel:
        "Advanced subscription management is handled in the tenant app.",
      managementDestinationHintPublisherLabel:
        "Advanced subscription management is handled in the publisher app.",
      managementDestinationHintOwnerLabel:
        "Advanced subscription management is handled by the app owner.",
      openManagementDestinationActionLabel: "Open management",
      creditsRemainingLabel: "Credits remaining",
      addOnUnlocksLabel: "Add-on unlocks",
      coverageActiveLabel: "Still covered",
      coverageInactiveLabel: "Not covered",
      noOverdueRestrictionLabel: "No active overdue restriction.",
      reasonGraceCoveredPastDueLabel: "Coverage remains during grace period",
      reasonPastDueAfterPeriodEndLabel: "Current period ended without successful renewal",
      reasonExpiredAfterBoundaryLabel: "Expiry boundary reached",
      refreshStatusActionLabel: "Refresh status",
      refreshingStatusActionLabel: "Refreshing...",
      cancelSubscriptionActionLabel: "Cancel subscription",
      cancellingSubscriptionActionLabel: "Cancelling...",
      noPublishedPlansLabel: "No published plans are currently available.",
      recentTimelineTitle: "Recent timeline",
      recentTimelineSubtitle: "Latest monetization events correlated for this subject and app.",
      historyAuditTitle: "History and audit",
      historyAuditSubtitle: "Recent monetization records for this subject and app.",
      noHistoryAvailableLabel: "No monetization history is available for this app yet.",
      historyGenericLabel: "History",
      historyPurchaseIntentsTitle: "Purchase intents",
      historyPurchaseIntentLabel: "Purchase intent",
      historyTransactionsTitle: "Transactions",
      historyTransactionLabel: "Transaction",
      historySettlementDetailDisputeWarningNeedsResponse: "Dispute warning: response needed",
      historySettlementDetailDisputeWarningUnderReview: "Dispute warning under review",
      historySettlementDetailDisputeWarningClosed: "Dispute warning closed",
      historySettlementDetailDisputeNeedsResponse: "Dispute needs response",
      historySettlementDetailDisputeUnderReview: "Dispute under review",
      historySettlementDetailDisputeWon: "Dispute won",
      historySettlementDetailDisputeLost: "Dispute lost",
      historySubscriptionsTitle: "Subscriptions",
      historySubscriptionContractLabel: "Subscription contract",
      historyEntitlementsTitle: "Entitlements",
      historyEntitlementLabel: "Entitlement",
      historyWalletAccountsTitle: "Wallet accounts",
      historyWalletAccountLabel: "Wallet account",
      historyWalletLedgerTitle: "Wallet ledger",
      historyWalletLedgerEntryLabel: "Wallet ledger entry",
      historyAccessSnapshotsTitle: "Access snapshots",
      historyAccessSnapshotLabel: "Access snapshot",
      historyInvoicesTitle: "Invoices",
      historyInvoiceLabel: "Invoice",
    },
  },
  ro: {
    package: {
      consumedLabel: "Consumat",
      currentPlanLabel: "Plan curent",
      ownedUnlockLabel: "Unlock deținut",
      addOnWithMembershipLabel: "Supliment cu abonament",
      selectedLabel: "Selectat",
      defaultLabel: "Implicit",
      ownedUnlockActiveLabel: "Unlock deja activ",
      currentPlanActiveLabel: "Plan activ",
      startingCheckoutLabel: "Se pornește checkout-ul...",
      purchaseAddOnUnlockLabel: "Cumpără suplimentul",
      continueToCheckoutLabel: "Continuă spre checkout",
    },
    surface: {
      plansTitle: "Planuri",
      historyTitle: "Istoric",
      plansSubtitle: "Accesul curent și planurile publicate pentru această aplicație",
      historySubtitle:
        "Evenimente recente de monetizare, facturi, abonamente și activitate din portofel",
      plansLabel: "Planuri",
      historyLabel: "Istoric",
      closeLabel: "Închide",
      tabsAriaLabel: "Vizualizare XMS",
      loadingLabel: "Se încarcă planurile...",
      subjectRequiredNotice:
        "Checkout-ul necesită o sesiune de catalog asociată unui subiect. Pornește dintr-o sesiune gazdă autentificată pentru a cumpăra planuri.",
      paymentCompletedNotice: "Plata a fost finalizată și accesul a fost actualizat.",
      checkoutCancelledNotice: "Checkout-ul a fost anulat înainte de finalizare.",
      paymentFailedNotice: "Plata a eșuat înainte ca accesul să poată fi acordat.",
      subscriptionRefreshCompletedNotice: "Starea abonamentului a fost actualizată.",
      subscriptionRefreshFailedNotice: "Starea abonamentului nu a putut fi actualizată.",
      subscriptionCancelCompletedNotice: "Reînnoirea abonamentului a fost anulată.",
      subscriptionCancelFailedNotice: "Abonamentul nu a putut fi anulat.",
      subscriptionCancelConfirmTitle: "Anulează abonamentul",
      subscriptionCancelConfirmMessage: "Anulezi reînnoirea acestui abonament?",
      subscriptionCancelConfirmLabel: "Anulează abonamentul",
      subscriptionCancelDismissLabel: "Păstrează abonamentul",
      missingPackageMetadataMessage:
        "Acest pachet nu are metadatele de cumpărare necesare în paywall-ul publicat.",
      missingIntentMessage: "Intentul de cumpărare a fost creat fără identificator.",
      missingPaymentPageMessage: "Pagina de plată nu este disponibilă pentru acest pachet.",
      startCheckoutFailedMessage: "Nu s-a putut porni checkout-ul pentru acest pachet.",
      loadFailedMessage: "Planurile nu au putut fi încărcate.",
      currentCoverageTitle: "Acoperire curentă",
      currentPlanLabel: "Plan curent",
      membershipAccessLabel: "Acces de membru",
      subscriptionStatusLabel: "Stare abonament",
      subscriptionCoverageLabel: "Acoperire",
      subscriptionReasonLabel: "Motiv stare",
      currentPeriodEndsLabel: "Perioada curentă se încheie la",
      renewsAtLabel: "Se reînnoiește la",
      expiresAtLabel: "Expiră la",
      overdueSinceLabel: "Restant din",
      expiryBoundaryLabel: "Limită expirare",
      cancelledAtLabel: "Anulat la",
      operatorAuthorityLabel: "Autoritate operator",
      managementDestinationLabel: "Administrează în",
      operatorAuthorityGatewayLabel: "Gateway",
      operatorAuthorityTenantLabel: "Tenant",
      operatorAuthorityPublisherLabel: "Publisher",
      operatorAuthorityOwnerLabel: "Proprietar aplicație",
      managementDestinationGatewayLabel: "Administrare gateway",
      managementDestinationTenantLabel: "Aplicația tenantului",
      managementDestinationPublisherLabel: "Aplicația publisherului",
      managementDestinationOwnerLabel: "Proprietarul aplicației",
      managementDestinationHintGatewayLabel:
        "Administrarea avansată a abonamentului se face în administrarea gateway-ului.",
      managementDestinationHintTenantLabel:
        "Administrarea avansată a abonamentului se face în aplicația tenantului.",
      managementDestinationHintPublisherLabel:
        "Administrarea avansată a abonamentului se face în aplicația publisherului.",
      managementDestinationHintOwnerLabel:
        "Administrarea avansată a abonamentului este gestionată de proprietarul aplicației.",
      openManagementDestinationActionLabel: "Deschide administrarea",
      creditsRemainingLabel: "Credite rămase",
      addOnUnlocksLabel: "Unlock-uri suplimentare",
      coverageActiveLabel: "Încă activ",
      coverageInactiveLabel: "Neacoperit",
      noOverdueRestrictionLabel: "Nu există restricții active de întârziere.",
      reasonGraceCoveredPastDueLabel: "Accesul rămâne activ în perioada de grație",
      reasonPastDueAfterPeriodEndLabel: "Perioada curentă s-a încheiat fără o reînnoire reușită",
      reasonExpiredAfterBoundaryLabel: "A fost atinsă limita de expirare",
      refreshStatusActionLabel: "Actualizează starea",
      refreshingStatusActionLabel: "Se actualizează...",
      cancelSubscriptionActionLabel: "Anulează abonamentul",
      cancellingSubscriptionActionLabel: "Se anulează...",
      noPublishedPlansLabel: "Nu există planuri publicate disponibile în acest moment.",
      recentTimelineTitle: "Cronologie recentă",
      recentTimelineSubtitle:
        "Cele mai recente evenimente de monetizare corelate pentru acest subiect și această aplicație.",
      historyAuditTitle: "Istoric și audit",
      historyAuditSubtitle:
        "Înregistrări recente de monetizare pentru acest subiect și această aplicație.",
      noHistoryAvailableLabel:
        "Nu există încă istoric de monetizare disponibil pentru această aplicație.",
      historyGenericLabel: "Istoric",
      historyPurchaseIntentsTitle: "Intenții de cumpărare",
      historyPurchaseIntentLabel: "Intenție de cumpărare",
      historyTransactionsTitle: "Tranzacții",
      historyTransactionLabel: "Tranzacție",
      historySettlementDetailDisputeWarningNeedsResponse:
        "Avertisment dispută: este necesar un răspuns",
      historySettlementDetailDisputeWarningUnderReview: "Avertisment dispută în analiză",
      historySettlementDetailDisputeWarningClosed: "Avertisment dispută închis",
      historySettlementDetailDisputeNeedsResponse: "Dispută ce necesită răspuns",
      historySettlementDetailDisputeUnderReview: "Dispută în analiză",
      historySettlementDetailDisputeWon: "Dispută câștigată",
      historySettlementDetailDisputeLost: "Dispută pierdută",
      historySubscriptionsTitle: "Abonamente",
      historySubscriptionContractLabel: "Contract de abonament",
      historyEntitlementsTitle: "Drepturi de acces",
      historyEntitlementLabel: "Drept de acces",
      historyWalletAccountsTitle: "Conturi de portofel",
      historyWalletAccountLabel: "Cont de portofel",
      historyWalletLedgerTitle: "Registru portofel",
      historyWalletLedgerEntryLabel: "Înregistrare în registrul portofelului",
      historyAccessSnapshotsTitle: "Instantanee acces",
      historyAccessSnapshotLabel: "Instantaneu acces",
      historyInvoicesTitle: "Facturi",
      historyInvoiceLabel: "Factură",
    },
  },
} as const;

export type XmsCopyLocale = keyof typeof XMS_COPY_CATALOG;

export function resolveXmsCopyLocale(locale: unknown): XmsCopyLocale {
  return isRomanianLocale(locale) ? "ro" : "en";
}

export function buildXmsPackageCopy(locale: unknown): XmsPackageCopy {
  return XMS_COPY_CATALOG[resolveXmsCopyLocale(locale)].package;
}

export function buildXmsSurfaceCopy(input?: { locale?: unknown }): XmsSurfaceCopy {
  return XMS_COPY_CATALOG[resolveXmsCopyLocale(input?.locale)].surface;
}
