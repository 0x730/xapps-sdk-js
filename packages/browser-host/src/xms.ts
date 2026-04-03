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
