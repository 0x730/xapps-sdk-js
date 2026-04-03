import { describe, expect, it } from "vitest";
import {
  buildFeaturePaywallCopyModel,
  buildMonetizationOfferingPresentation,
  buildMonetizationPackagePresentation,
  buildFeaturePaywall,
  flattenXappMonetizationCatalog,
  getDefaultXappMonetizationScopeKind,
  resolveXmsModeForPackage,
  summarizeXappMonetizationSnapshot,
} from "./src/xms.js";

describe("@xapps-platform/browser-host xms helpers", () => {
  it("chooses the default scope from available widget context", () => {
    expect(
      getDefaultXappMonetizationScopeKind({
        context: { subject_id: "sub_123", installation_id: "inst_123" },
      }),
    ).toBe("subject");
    expect(
      getDefaultXappMonetizationScopeKind({
        context: { installation_id: "inst_123" },
      }),
    ).toBe("installation");
    expect(getDefaultXappMonetizationScopeKind({ context: {} })).toBe("realm");
  });

  it("flattens xapp monetization catalog offerings into package cards", () => {
    const packages = flattenXappMonetizationCatalog([
      {
        id: "off_123",
        slug: "creator_default_paywall",
        title: { en: "Creator Default Paywall" },
        packages: [
          {
            id: "pkg_123",
            slug: "creator_credits_500",
            title: { en: "Creator Credits 500" },
            package_kind: "credit_pack",
            product: {
              product_family: "credit_pack",
            },
            prices: [
              {
                id: "price_123",
                amount: "79",
                currency: "RON",
                billing_period: "one_time",
              },
            ],
          },
        ],
      },
    ]);

    expect(packages).toHaveLength(1);
    expect(packages[0]?.offeringId).toBe("off_123");
    expect(packages[0]?.offeringPlacement).toBeNull();
    expect(packages[0]?.packageId).toBe("pkg_123");
    expect(packages[0]?.priceId).toBe("price_123");
  });

  it("builds shared offering and package presentation helpers for host apps", () => {
    const item = flattenXappMonetizationCatalog([
      {
        id: "off_paywall",
        slug: "creator_feature_paywall",
        title: { en: "Creator Feature Paywall" },
        placement: "feature_paywall",
        packages: [
          {
            id: "pkg_unlock",
            slug: "creator_unlock_pro",
            title: { en: "Creator Unlock Pro" },
            package_kind: "one_time_unlock",
            metadata: { badge: "Popular" },
            product: {
              product_family: "one_time_unlock",
            },
            prices: [
              {
                id: "price_unlock",
                amount: "29",
                currency: "RON",
                billing_period: "one_time",
              },
            ],
          },
        ],
      },
    ])[0];

    const offering = buildMonetizationOfferingPresentation(item);
    const pkg = buildMonetizationPackagePresentation(item);

    expect(offering.offeringLabel).toBe("Creator Feature Paywall");
    expect(offering.placementLabel).toBe("feature paywall");
    expect(offering.summary).toContain("Feature-paywall placement");
    expect(pkg.fitLabel).toBe("Durable unlock");
    expect(pkg.moneyLabel).toBe("29 RON / one_time");
    expect(pkg.signals).toContain("Popular");
    expect(pkg.signals).toContain("feature paywall");
  });

  it("resolves the canonical XMS mode for a package card", () => {
    expect(resolveXmsModeForPackage({ productFamily: "credit_pack" }).key).toBe("credit_wallet");
    expect(resolveXmsModeForPackage({ productFamily: "subscription_plan" }).key).toBe(
      "subscription",
    );
  });

  it("builds candidate packages for a feature paywall", () => {
    const paywall = buildFeaturePaywall({
      feature: {
        requirements: {
          credits: 250,
        },
      },
      packages: [
        {
          packageId: "pkg_unlock",
          packageSlug: "creator_starter_unlock",
          packageKind: "one_time_unlock",
          metadata: {},
        },
        {
          packageId: "pkg_credits",
          packageSlug: "creator_credits_500",
          packageKind: "credit_pack",
          metadata: { credits: 500 },
        },
      ],
    });

    expect(paywall.activePackage?.packageId).toBe("pkg_credits");
    expect(paywall.candidatePackages[0]?.packageId).toBe("pkg_credits");
    expect(paywall.recommendedPackages[0]?.packageId).toBe("pkg_credits");
    expect(paywall.candidatePackages[0]?.candidateReasons?.length).toBeGreaterThan(0);
  });

  it("builds shared paywall copy from feature requirements and snapshot summary", () => {
    const copy = buildFeaturePaywallCopyModel({
      feature: {
        title: "Premium export",
        requirements: {
          currentAccess: true,
          credits: 25,
        },
      },
      snapshotSummary: {
        accessCoverage: {
          available: false,
          coverageLabel: "Unavailable",
        },
        wallet: {
          creditsRemaining: "10",
        },
      },
      currentSubscriptionStatus: null,
      activePackage: {
        packageTitle: "Creator Hybrid Pro",
        packageSlug: "creator_hybrid_pro",
      },
      assetMixLabel: "Credits only",
    });

    expect(copy.summary).toContain("Current access coverage is not active");
    expect(copy.openPaywallLabel).toBe("View hybrid options");
    expect(copy.ctaLabel).toBe("Start hybrid checkout");
    expect(copy.statusLabel).toBe("needs mixed access");
    expect(copy.gapBadges).toContain("15 credits short");
    expect(copy.assetMixLabel).toBe("Credits only");
    expect(copy.candidateLead).toContain("one package candidate");
  });

  it("summarizes a mixed XMS snapshot into reusable access, subscription, and wallet sections", () => {
    const summary = summarizeXappMonetizationSnapshot({
      access_projection: {
        entitlement_state: "active",
        has_current_access: true,
        tier: "creator_team_hybrid_access",
        source_ref: "xplace-example-playground",
        credits_remaining: "500",
        balance_state: "sufficient",
      },
      current_subscription: {
        status: "active",
        tier: "creator_team_hybrid_access",
        renews_at: "2026-05-02T19:45:00.000Z",
        current_period_ends_at: "2026-05-02T19:45:00.000Z",
        payment_session_id: null,
        overdue_policy: {
          has_current_access: true,
          effective_status_reason: null,
        },
      },
    });

    expect(summary.accessCoverage.coverageLabel).toBe("Available");
    expect(summary.accessCoverage.tierLabel).toBe("creator team hybrid access");
    expect(summary.currentSubscription.present).toBe(true);
    expect(summary.currentSubscription.coverageLabel).toBe("Still active");
    expect(summary.wallet.creditsRemaining).toBe("500");
    expect(summary.wallet.currentAccessLabel).toBe("Yes");
  });
});
