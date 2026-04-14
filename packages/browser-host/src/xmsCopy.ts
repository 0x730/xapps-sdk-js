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
  generalUpgradeFitLabel: string;
  generalUpgradeSummary: string;
  durableUnlockFitLabel: string;
  durableUnlockSummary: string;
  recurringMembershipFitLabel: string;
  recurringMembershipSummary: string;
  creditTopUpFitLabel: string;
  hybridUpgradeFitLabel: string;
  creditPackFitSummary(unitLabel: string): string;
  hybridPackFitSummary(unitLabel: string): string;
  packageCurrencySignalLabel(unitLabel: string): string;
  billedSignalLabel(periodLabel: string): string;
  generalOfferingSummary: string;
  featurePaywallOfferingSummary: string;
  defaultPaywallOfferingSummary: string;
  checkoutOfferingSummary: string;
  upgradeOfferingSummary: string;
  featureDurableUnlockReason: string;
  featureRecurringAccessReason: string;
  featureHybridAccessReason: string;
  featureSubscriptionDirectReason: string;
  featureHybridSubscriptionReason: string;
  creditRequirementCoveredLabel(amountLabel: string): string;
  creditRequirementAddedLabel(amountLabel: string): string;
  hybridCreditsSupportLabel(unitLabel: string): string;
};

export type XmsSurfaceCopy = {
  plansTitle: string;
  historyTitle: string;
  plansSubtitle: string;
  historySubtitle: string;
  offeringFallbackLabel: string;
  packageFallbackLabel: string;
  paywallFallbackLabel: string;
  availableLabel: string;
  unavailableLabel: string;
  unknownLabel: string;
  yesLabel: string;
  noLabel: string;
  defaultBadgeLabel: string;
  choosePackageActionLabel: string;
  noPaywallPackagesLabel: string;
  priceUnavailableLabel: string;
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
  virtualCurrencyLabel: string;
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
  historyBalanceSummaryTitle: string;
  historyBalanceSummarySubtitle: string;
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
  featureCurrentAccessMissingLabel: string;
  featureSubscriptionMissingLabel: string;
  featureCreditsMissingLabel(requiredLabel: string, availableLabel: string): string;
  featureBlockedSummary(title: string): string;
  featureReadySummary(title: string): string;
  featureNeedMixedAccessLabel: string;
  featureNeedMembershipAndCreditsLabel(unitLabel: string): string;
  featureNeedMembershipLabel: string;
  featureNeedCreditsLabel(unitLabel: string): string;
  featureNeedAccessLabel: string;
  featureLockedLabel: string;
  featureGapShortLabel(amountLabel: string): string;
  featureCurrentAccessMissingBadge: string;
  featureMembershipNotActiveBadge: string;
  featureCandidateLead(selectedPackageTitle: string): string;
  featureCandidateFallbackLead: string;
  featureViewHybridOptionsLabel: string;
  featureViewMembershipOptionsLabel: string;
  featureViewCreditOptionsLabel(unitLabel: string): string;
  featureViewUnlockOptionsLabel: string;
  featureOpenPaywallLabel: string;
  featureUnlockCheckoutLabel: string;
  featureStartMembershipCheckoutLabel: string;
  featureBuyCreditsCheckoutLabel(unitLabel: string): string;
  featureStartHybridCheckoutLabel: string;
  featureCreatePaymentSessionLabel: string;
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
      generalUpgradeFitLabel: "Flexible option",
      generalUpgradeSummary: "A general plan option for this app.",
      durableUnlockFitLabel: "One-time unlock",
      durableUnlockSummary: "Best when you want access without an ongoing subscription.",
      recurringMembershipFitLabel: "Subscription",
      recurringMembershipSummary:
        "Best when this app is meant to stay active through recurring coverage.",
      creditTopUpFitLabel: "Balance top-up",
      hybridUpgradeFitLabel: "Access + balance",
      creditPackFitSummary: (unitLabel: string) =>
        `Best when the feature spends ${unitLabel} for each advanced action.`,
      hybridPackFitSummary: (unitLabel: string) =>
        `Blends access coverage with bundled ${unitLabel} for mixed workflows.`,
      packageCurrencySignalLabel: (unitLabel: string) => `currency ${unitLabel}`,
      billedSignalLabel: (periodLabel: string) => `billed ${periodLabel}`,
      generalOfferingSummary: "Available plans for this app.",
      featurePaywallOfferingSummary: "Shown when this app needs extra access or balance.",
      defaultPaywallOfferingSummary: "Main plan selection for this app.",
      checkoutOfferingSummary: "Direct purchase flow for this app.",
      upgradeOfferingSummary: "Best for switching or upgrading your current plan.",
      featureDurableUnlockReason: "Aligned with one-time unlock access.",
      featureRecurringAccessReason: "Recurring membership also grants current access.",
      featureHybridAccessReason: "Hybrid package contributes to current access coverage.",
      featureSubscriptionDirectReason: "Matches the subscription requirement directly.",
      featureHybridSubscriptionReason:
        "Hybrid package can also cover part of the subscription shape.",
      creditRequirementCoveredLabel: (amountLabel: string) =>
        `Covers the ${amountLabel} requirement.`,
      creditRequirementAddedLabel: (amountLabel: string) =>
        `Adds ${amountLabel} toward the requirement.`,
      hybridCreditsSupportLabel: (unitLabel: string) =>
        `Hybrid package can add bundled ${unitLabel} for this flow.`,
    },
    surface: {
      plansTitle: "Plans",
      historyTitle: "History",
      plansSubtitle: "Access, plans, and balances for this app",
      historySubtitle: "Recent monetization events, invoices, subscriptions, and wallet activity",
      offeringFallbackLabel: "Offering",
      packageFallbackLabel: "Package",
      paywallFallbackLabel: "Plans",
      availableLabel: "Available",
      unavailableLabel: "Unavailable",
      unknownLabel: "Unknown",
      yesLabel: "Yes",
      noLabel: "No",
      defaultBadgeLabel: "default",
      choosePackageActionLabel: "Choose package",
      noPaywallPackagesLabel: "No plans are currently available.",
      priceUnavailableLabel: "Price unavailable",
      plansLabel: "Plans",
      historyLabel: "History",
      closeLabel: "Close",
      tabsAriaLabel: "Plans and history view",
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
        "This package is missing purchase metadata in the published plans configuration.",
      missingIntentMessage: "Purchase intent was created without an identifier.",
      missingPaymentPageMessage: "Payment page is not available for this package.",
      startCheckoutFailedMessage: "Unable to start checkout for this package.",
      loadFailedMessage: "Unable to load plans.",
      currentCoverageTitle: "Current coverage",
      currentPlanLabel: "Current plan",
      membershipAccessLabel: "Membership access",
      subscriptionStatusLabel: "Subscription state",
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
      virtualCurrencyLabel: "Currency",
      creditsRemainingLabel: "Balance",
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
      noPublishedPlansLabel: "No plans are currently available.",
      recentTimelineTitle: "Recent activity",
      recentTimelineSubtitle:
        "Latest subscription, balance, purchase, and invoice activity for this app.",
      historyAuditTitle: "Detailed history",
      historyAuditSubtitle:
        "Recent records grouped by subscriptions, balances, purchases, and invoices.",
      historyBalanceSummaryTitle: "Balances now",
      historyBalanceSummarySubtitle:
        "Latest visible wallet balances grouped by virtual currency for this app.",
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
      featureCurrentAccessMissingLabel: "Current access coverage is not active on this scope.",
      featureSubscriptionMissingLabel: "No active subscription is visible for this scope.",
      featureCreditsMissingLabel: (requiredLabel: string, availableLabel: string) =>
        `This action needs ${requiredLabel}, but only ${availableLabel} are visible right now.`,
      featureBlockedSummary: (title: string) =>
        `${title || "Feature"} is blocked on the current scope.`,
      featureReadySummary: (title: string) =>
        `${title || "Feature"} can be unlocked from the current plan options.`,
      featureNeedMixedAccessLabel: "needs mixed access",
      featureNeedMembershipAndCreditsLabel: (unitLabel: string) =>
        `needs membership + ${unitLabel}`,
      featureNeedMembershipLabel: "needs membership",
      featureNeedCreditsLabel: (unitLabel: string) => `needs ${unitLabel}`,
      featureNeedAccessLabel: "needs access",
      featureLockedLabel: "locked",
      featureGapShortLabel: (amountLabel: string) => `${amountLabel} short`,
      featureCurrentAccessMissingBadge: "current access missing",
      featureMembershipNotActiveBadge: "membership not active",
      featureCandidateLead: (selectedPackageTitle: string) =>
        `${selectedPackageTitle || "Selected package"} is one package candidate for this access gap.`,
      featureCandidateFallbackLead: "Choose a plan option that covers the current access gap.",
      featureViewHybridOptionsLabel: "View hybrid options",
      featureViewMembershipOptionsLabel: "View membership options",
      featureViewCreditOptionsLabel: (unitLabel: string) => `View ${unitLabel} options`,
      featureViewUnlockOptionsLabel: "View unlock options",
      featureOpenPaywallLabel: "Open plans",
      featureUnlockCheckoutLabel: "Unlock with hosted checkout",
      featureStartMembershipCheckoutLabel: "Start membership checkout",
      featureBuyCreditsCheckoutLabel: (unitLabel: string) =>
        `Buy ${unitLabel} with hosted checkout`,
      featureStartHybridCheckoutLabel: "Start hybrid checkout",
      featureCreatePaymentSessionLabel: "Create payment session",
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
      generalUpgradeFitLabel: "Opțiune flexibilă",
      generalUpgradeSummary: "O opțiune generală de plan pentru această aplicație.",
      durableUnlockFitLabel: "Unlock unic",
      durableUnlockSummary: "Potrivit când vrei acces fără un abonament recurent.",
      recurringMembershipFitLabel: "Abonament",
      recurringMembershipSummary:
        "Potrivit când această aplicație trebuie să rămână activă prin acoperire recurentă.",
      creditTopUpFitLabel: "Top-up sold",
      hybridUpgradeFitLabel: "Acces + sold",
      creditPackFitSummary: (unitLabel: string) =>
        `Potrivit când funcția consumă ${unitLabel} pentru fiecare acțiune avansată.`,
      hybridPackFitSummary: (unitLabel: string) =>
        `Combină acoperirea accesului cu ${unitLabel} incluse pentru fluxuri mixte.`,
      packageCurrencySignalLabel: (unitLabel: string) => `monedă ${unitLabel}`,
      billedSignalLabel: (periodLabel: string) => `facturat ${periodLabel}`,
      generalOfferingSummary: "Planuri disponibile pentru această aplicație.",
      featurePaywallOfferingSummary:
        "Afișat când această aplicație are nevoie de acces sau sold suplimentar.",
      defaultPaywallOfferingSummary: "Selecția principală de planuri pentru această aplicație.",
      checkoutOfferingSummary: "Flux de cumpărare direct pentru această aplicație.",
      upgradeOfferingSummary: "Potrivit pentru schimbarea sau îmbunătățirea planului curent.",
      featureDurableUnlockReason: "Se potrivește cu accesul de tip unlock unic.",
      featureRecurringAccessReason: "Abonamentul recurent oferă și acces curent pentru acest flux.",
      featureHybridAccessReason: "Pachetul hibrid contribuie la acoperirea accesului curent.",
      featureSubscriptionDirectReason: "Se potrivește direct cu cerința de abonament.",
      featureHybridSubscriptionReason:
        "Pachetul hibrid poate acoperi și o parte din forma de abonament.",
      creditRequirementCoveredLabel: (amountLabel: string) => `Acoperă cerința de ${amountLabel}.`,
      creditRequirementAddedLabel: (amountLabel: string) => `Adaugă ${amountLabel} către cerință.`,
      hybridCreditsSupportLabel: (unitLabel: string) =>
        `Pachetul hibrid poate adăuga ${unitLabel} incluse pentru acest flux.`,
    },
    surface: {
      plansTitle: "Planuri",
      historyTitle: "Istoric",
      plansSubtitle: "Acces, planuri și solduri pentru această aplicație",
      historySubtitle:
        "Evenimente recente de monetizare, facturi, abonamente și activitate din portofel",
      offeringFallbackLabel: "Ofertă",
      packageFallbackLabel: "Pachet",
      paywallFallbackLabel: "Planuri",
      availableLabel: "Disponibil",
      unavailableLabel: "Indisponibil",
      unknownLabel: "Necunoscut",
      yesLabel: "Da",
      noLabel: "Nu",
      defaultBadgeLabel: "implicit",
      choosePackageActionLabel: "Alege pachetul",
      noPaywallPackagesLabel: "Nu există momentan planuri disponibile.",
      priceUnavailableLabel: "Preț indisponibil",
      plansLabel: "Planuri",
      historyLabel: "Istoric",
      closeLabel: "Închide",
      tabsAriaLabel: "Vizualizare planuri și istoric",
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
        "Acest pachet nu are metadatele de cumpărare necesare în configurația publicată a planurilor.",
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
      virtualCurrencyLabel: "Monedă virtuală",
      creditsRemainingLabel: "Sold",
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
      noPublishedPlansLabel: "Nu există planuri disponibile în acest moment.",
      recentTimelineTitle: "Activitate recentă",
      recentTimelineSubtitle:
        "Cele mai recente actualizări pentru abonamente, solduri, cumpărări și facturi pentru această aplicație.",
      historyAuditTitle: "Istoric detaliat",
      historyAuditSubtitle:
        "Înregistrări recente grupate după abonamente, solduri, cumpărări și facturi.",
      historyBalanceSummaryTitle: "Solduri acum",
      historyBalanceSummarySubtitle:
        "Cele mai recente solduri vizibile din portofel, grupate după moneda virtuală pentru această aplicație.",
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
      featureCurrentAccessMissingLabel: "Acoperirea de acces curent nu este activă pe acest scope.",
      featureSubscriptionMissingLabel: "Nu este vizibil niciun abonament activ pentru acest scope.",
      featureCreditsMissingLabel: (requiredLabel: string, availableLabel: string) =>
        `Această acțiune are nevoie de ${requiredLabel}, dar acum sunt vizibile doar ${availableLabel}.`,
      featureBlockedSummary: (title: string) =>
        `${title || "Funcția"} este blocată pe scope-ul curent.`,
      featureReadySummary: (title: string) =>
        `${title || "Funcția"} poate fi deblocată din opțiunile curente de plan.`,
      featureNeedMixedAccessLabel: "necesită acces mixt",
      featureNeedMembershipAndCreditsLabel: (unitLabel: string) =>
        `necesită abonament + ${unitLabel}`,
      featureNeedMembershipLabel: "necesită abonament",
      featureNeedCreditsLabel: (unitLabel: string) => `necesită ${unitLabel}`,
      featureNeedAccessLabel: "necesită acces",
      featureLockedLabel: "blocat",
      featureGapShortLabel: (amountLabel: string) => `lipsește ${amountLabel}`,
      featureCurrentAccessMissingBadge: "lipsește accesul curent",
      featureMembershipNotActiveBadge: "abonamentul nu este activ",
      featureCandidateLead: (selectedPackageTitle: string) =>
        `${selectedPackageTitle || "Pachetul selectat"} este un pachet candidat pentru acest gol de acces.`,
      featureCandidateFallbackLead: "Alege o opțiune de plan care acoperă golul curent de acces.",
      featureViewHybridOptionsLabel: "Vezi opțiunile hibride",
      featureViewMembershipOptionsLabel: "Vezi opțiunile de abonament",
      featureViewCreditOptionsLabel: (unitLabel: string) => `Vezi opțiunile ${unitLabel}`,
      featureViewUnlockOptionsLabel: "Vezi opțiunile de unlock",
      featureOpenPaywallLabel: "Deschide planurile",
      featureUnlockCheckoutLabel: "Deblochează prin checkout găzduit",
      featureStartMembershipCheckoutLabel: "Pornește checkout-ul de abonament",
      featureBuyCreditsCheckoutLabel: (unitLabel: string) =>
        `Cumpără ${unitLabel} prin checkout găzduit`,
      featureStartHybridCheckoutLabel: "Pornește checkout-ul hibrid",
      featureCreatePaymentSessionLabel: "Creează sesiunea de plată",
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
