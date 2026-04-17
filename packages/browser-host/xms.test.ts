import { describe, expect, it } from "vitest";
import {
  buildXmsSubscriptionLifecycleSummary,
  buildXmsSurfaceShellModel,
  buildMonetizationHistorySurfaceHtml,
  buildMonetizationPlansSurfaceHtml,
  buildFeaturePaywallCopyModel,
  buildMonetizationPaywallHtml,
  buildMonetizationOfferingPresentation,
  buildMonetizationPaywallPresentation,
  buildMonetizationPaywallRenderModel,
  buildMonetizationPackagePresentation,
  buildFeaturePaywall,
  flattenXappMonetizationPaywallPackages,
  flattenXappMonetizationCatalog,
  getDefaultXappMonetizationScopeKind,
  listXappMonetizationPaywalls,
  resolveXmsSurfaceView,
  resolveMonetizationPackagePurchasePolicy,
  resolveXmsModeForPackage,
  selectXappMonetizationPaywall,
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

  it("builds a shared XMS shell model for plans and history views", () => {
    expect(resolveXmsSurfaceView("history")).toBe("history");
    expect(resolveXmsSurfaceView("other")).toBe("plans");

    const plans = buildXmsSurfaceShellModel({
      view: "plans",
      plansTitle: "Certificate access",
      plansSubtitle: "Current coverage and packages",
      plansLabel: "Plans",
      historyLabel: "History",
    });
    const history = buildXmsSurfaceShellModel({
      view: "history",
      plansTitle: "Certificate access",
      plansSubtitle: "Current coverage and packages",
      historyTitle: "Certificate history",
      historySubtitle: "Recent events and invoices",
      plansLabel: "Plans",
      historyLabel: "History",
    });

    expect(plans.title).toBe("Certificate access");
    expect(plans.subtitle).toBe("Current coverage and packages");
    expect(plans.tabs.find((item) => item.key === "plans")?.active).toBe(true);
    expect(history.title).toBe("Certificate history");
    expect(history.subtitle).toBe("Recent events and invoices");
    expect(history.tabs.find((item) => item.key === "history")?.active).toBe(true);
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
            metadata: { badge: "Popular", credits: 25 },
            product: {
              id: "prod_unlock",
              slug: "creator_unlock",
              product_family: "one_time_unlock",
              virtual_currency: {
                code: "CREATOR_CREDITS",
                name: "Creator Credits",
              },
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
    expect(offering.summary).toContain("Shown when this app needs extra access or balance");
    expect(pkg.fitLabel).toBe("One-time unlock");
    expect(pkg.moneyLabel).toBe("29 RON / one_time");
    expect(pkg.signals).toContain("Popular");
    expect(pkg.signals).toContain("25 Creator Credits");
    expect(pkg.signals).not.toContain("feature paywall");
  });

  it("lists, selects, and presents paywall definitions without forcing a visual policy", () => {
    const paywalls = listXappMonetizationPaywalls([
      {
        slug: "workspace_default",
        title: { en: "Workspace plans" },
        placement: "paywall",
        default_package_ref: "creator_unlock_pro",
        packages: [
          {
            id: "pkg_unlock",
            slug: "creator_unlock_pro",
            package_kind: "one_time_unlock",
            offering_id: "off_paywall",
            offering_slug: "creator_feature_paywall",
            offering_placement: "paywall",
            product: {
              id: "prod_unlock",
              slug: "creator_unlock",
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
    ]);

    const paywall = selectXappMonetizationPaywall({
      paywalls,
      placement: "paywall",
    });
    const presentation = buildMonetizationPaywallPresentation(paywall);
    const packages = flattenXappMonetizationPaywallPackages(paywall);

    expect(paywall?.slug).toBe("workspace_default");
    expect(presentation.paywallLabel).toBe("Workspace plans");
    expect(presentation.packageCountLabel).toBe("1 package");
    expect(presentation.defaultPackageLabel).toBe("creator_unlock_pro");
    expect(packages[0]?.packageId).toBe("pkg_unlock");
    expect(packages[0]?.offeringPlacement).toBe("paywall");
  });

  it("prefers authored package and product titles over technical slugs in paywall views", () => {
    const packages = flattenXappMonetizationPaywallPackages({
      slug: "workspace_default",
      packages: [
        {
          id: "pkg_unlock",
          slug: "cert_single_unlock",
          title: { en: "Single Certificate Unlock" },
          package_kind: "one_time_unlock",
          offering_id: "off_paywall",
          offering_slug: "cert_default_paywall",
          offering_title: { en: "Certificate Plans" },
          offering_placement: "paywall",
          product: {
            id: "prod_unlock",
            slug: "cert_single_unlock_access",
            title: { en: "Certificate Access" },
            product_family: "one_time_unlock",
          },
          prices: [
            {
              id: "price_unlock",
              amount: "19",
              currency: "RON",
              billing_period: "one_time",
            },
          ],
        },
      ],
    });

    expect(packages[0]?.packageTitle).toBe("Single Certificate Unlock");
    expect(packages[0]?.productTitle).toBe("Certificate Access");
    expect(packages[0]?.offeringTitle).toBe("Certificate Plans");
  });

  it("matches placement families and builds a shared render model for paywall UIs", () => {
    const paywalls = listXappMonetizationPaywalls([
      {
        slug: "workspace_default",
        title: { en: "Workspace plans" },
        placement: "paywall",
        default_package_ref: "creator_unlock_pro",
        packages: [
          {
            id: "pkg_unlock",
            slug: "creator_unlock_pro",
            package_kind: "one_time_unlock",
            offering_id: "off_paywall",
            offering_slug: "creator_feature_paywall",
            offering_placement: "paywall",
            metadata: {
              credits: 25,
            },
            product: {
              id: "prod_unlock",
              slug: "creator_unlock",
              product_family: "one_time_unlock",
              virtual_currency: {
                code: "CREATOR_CREDITS",
                name: "Creator Credits",
              },
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
    ]);

    const paywall = selectXappMonetizationPaywall({
      paywalls,
      placement: "default_paywall",
    });
    const renderModel = buildMonetizationPaywallRenderModel(paywall);

    expect(paywall?.slug).toBe("workspace_default");
    expect(renderModel.paywallLabel).toBe("Workspace plans");
    expect(renderModel.badges).toContain("paywall");
    expect(renderModel.badges).toContain("1 package");
    expect(renderModel.packages[0]?.isDefault).toBe(true);
    expect(renderModel.packages[0]?.moneyLabel).toBe("29 RON / one_time");
    expect(renderModel.packages[0]?.virtualCurrencyCode).toBe("CREATOR_CREDITS");
    expect(renderModel.packages[0]?.signals).toContain("25 Creator Credits");
  });

  it("builds shared paywall preview html for browser consumers", () => {
    const html = buildMonetizationPaywallHtml(
      {
        slug: "workspace_default",
        title: { en: "Workspace plans" },
        placement: "paywall",
        default_package_ref: "creator_unlock_pro",
        packages: [
          {
            id: "pkg_unlock",
            slug: "creator_unlock_pro",
            package_kind: "one_time_unlock",
            offering_id: "off_paywall",
            offering_slug: "creator_feature_paywall",
            offering_placement: "paywall",
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
      {
        compact: true,
        emphasis: "strong",
        themeTokens: {
          surface: "#102131",
          text: "#eff8ff",
          accent_start: "#2563eb",
          accent_end: "#0891b2",
        },
      },
    );

    expect(html).toContain("xapps-paywall");
    expect(html).toContain("is-compact");
    expect(html).toContain("Workspace plans");
    expect(html).toContain("Choose package");
    expect(html).toContain("creator_feature_paywall");
    expect(html).toContain("--xapps-paywall-surface:#102131");
    expect(html).toContain("--xapps-paywall-accent-start:#2563eb");
  });

  it("keeps the shared plans surface focused on access and packages", () => {
    const html = buildMonetizationPlansSurfaceHtml(
      {
        access_projection: {
          entitlement_state: "active",
          has_current_access: true,
          tier: "pro",
        },
        current_subscription: {
          status: "active",
          tier: "pro",
          renews_at: "2026-04-05T12:00:00.000Z",
          current_period_ends_at: "2026-04-05T12:00:00.000Z",
          subscription_management: {
            operator_owner_scope: "gateway",
            management_destination: {
              kind: "gateway_admin",
              href: "/apps/superadmin/xapps/xapp_1",
            },
            subject_actions: {
              refresh_status: { available: true },
              cancel_subscription: { available: true },
            },
          },
        },
        history: {
          timeline: {
            total: 2,
            items: [
              {
                bucket: "transactions",
                id: "txn_1",
                title: "creator_pro_monthly",
                status: "verified",
                occurred_at: "2026-04-05T10:00:00.000Z",
                correlation: "pay_1",
              },
              {
                bucket: "invoices",
                id: "inv_1",
                title: "INV-0001",
                status: "completed",
                occurred_at: "2026-04-05T10:05:00.000Z",
              },
            ],
          },
          transactions: {
            total: 1,
            items: [
              {
                id: "txn_1",
                package_slug: "creator_pro_monthly",
                status: "verified",
                amount: "49.00",
                currency: "RON",
                occurred_at: "2026-04-05T10:00:00.000Z",
              },
            ],
          },
          invoices: {
            total: 1,
            items: [
              {
                id: "inv_1",
                invoice_identifier: "INV-0001",
                status: "completed",
                created_at: "2026-04-05T10:05:00.000Z",
              },
            ],
          },
        },
        paywall: {
          slug: "workspace_default",
          title: { en: "Workspace plans" },
          placement: "paywall",
          packages: [],
        },
      },
      {
        showHeader: false,
        onRefreshSubscription: () => {},
        onCancelSubscription: () => {},
      },
    );

    expect(html).toContain("Current coverage");
    expect(html).toContain("Workspace plans");
    expect(html).toContain("Renews at");
    expect(html).not.toContain("Current period ends");
    expect(html).not.toContain("Operator authority");
    expect(html).not.toContain("Manage in");
    expect(html).not.toContain("Advanced subscription management is handled in Gateway admin.");
    expect(html).not.toContain("Open management");
    expect(html).not.toContain('href="/apps/superadmin/xapps/xapp_1"');
    expect(html).toContain("Refresh status");
    expect(html).toContain("Cancel subscription");
    expect(html).not.toContain("Recent timeline");
    expect(html).not.toContain("History and audit");
  });

  it("renders a recent timeline and history buckets on the shared history surface", () => {
    const html = buildMonetizationHistorySurfaceHtml(
      {
        history: {
          timeline: {
            total: 4,
            items: [
              {
                bucket: "transactions",
                id: "txn_1",
                title: "creator_pro_monthly",
                status: "refunded",
                settlement_effect: "transaction_refunded",
                occurred_at: "2026-04-05T10:00:00.000Z",
                correlation: "pay_1",
              },
              {
                bucket: "transactions",
                id: "txn_2",
                title: "creator_pro_monthly",
                status: "chargeback",
                settlement_effect: "transaction_chargeback",
                settlement_effect_detail: "warning_needs_response",
                occurred_at: "2026-04-05T10:02:00.000Z",
                correlation: "pay_1",
              },
              {
                bucket: "wallet_ledger",
                id: "wl_1",
                title: "refund",
                settlement_effect: "wallet_refund",
                occurred_at: "2026-04-05T10:03:00.000Z",
                amount: "12.00",
                virtual_currency: {
                  code: "CREATOR_CREDITS",
                  name: "Creator Credits",
                },
              },
              {
                bucket: "invoices",
                id: "inv_1",
                title: "INV-0001",
                status: "voided",
                settlement_effect: "invoice_voided",
                settlement_effect_detail: "customer requested reversal",
                occurred_at: "2026-04-05T10:05:00.000Z",
              },
            ],
          },
          transactions: {
            total: 1,
            items: [
              {
                id: "txn_1",
                package_slug: "creator_pro_monthly",
                status: "refunded",
                settlement_effect: "transaction_refunded",
                amount: "49.00",
                currency: "RON",
                occurred_at: "2026-04-05T10:00:00.000Z",
              },
            ],
          },
          wallet_ledger: {
            total: 1,
            items: [
              {
                id: "wl_1",
                event_kind: "refund",
                settlement_effect: "wallet_refund",
                amount: "12.00",
                currency: "RON",
                virtual_currency: {
                  code: "CREATOR_CREDITS",
                  name: "Creator Credits",
                },
                occurred_at: "2026-04-05T10:03:00.000Z",
              },
            ],
          },
          access_snapshots: {
            total: 1,
            items: [
              {
                id: "snap_1",
                tier: "pro",
                entitlement_state: "active",
                balance_state: "available",
                credits_remaining: "12",
                virtual_currency: {
                  code: "CREATOR_CREDITS",
                  name: "Creator Credits",
                },
                updated_at: "2026-04-05T10:04:00.000Z",
              },
            ],
          },
          invoices: {
            total: 1,
            items: [
              {
                id: "inv_1",
                invoice_identifier: "INV-0001",
                status: "completed",
                lifecycle_status: "voided",
                settlement_effect: "invoice_voided",
                settlement_effect_detail: "customer requested reversal",
                created_at: "2026-04-05T10:05:00.000Z",
              },
            ],
          },
        },
      },
      {
        showHeader: false,
      },
    );

    expect(html).toContain("Balances now");
    expect(html).toContain("Recent activity");
    expect(html).toContain("Detailed history");
    expect(html).toContain("Balances now");
    expect(html).toContain("INV-0001");
    expect(html).toContain("transaction refunded");
    expect(html).toContain("transaction chargeback");
    expect(html).toContain("Dispute warning: response needed");
    expect(html).toContain("wallet refund");
    expect(html).toContain("12.00 Creator Credits");
    expect(html).toContain("12 Creator Credits");
    expect(html).toContain("invoice voided");
    expect(html).toContain("customer requested reversal");
    expect(html.indexOf("Current balances")).toBeLessThan(html.indexOf("Recent activity"));
    expect(html.indexOf("Recent activity")).toBeLessThan(html.indexOf("Detailed history"));
  });

  it("hides operator management guidance on subject plans surfaces", () => {
    const html = buildMonetizationPlansSurfaceHtml(
      {
        access_projection: {
          entitlement_state: "active",
          has_current_access: true,
          tier: "pro",
        },
        current_subscription: {
          status: "active",
          tier: "pro",
          renews_at: "2026-04-05T12:00:00.000Z",
          current_period_ends_at: "2026-04-05T12:00:00.000Z",
          subscription_management: {
            operator_owner_scope: "publisher",
            management_destination: {
              kind: "publisher_app",
              href: "/apps/publisher/xapps/xapp_1/monetization",
            },
            subject_actions: {
              refresh_status: { available: true },
              cancel_subscription: { available: false },
            },
          },
        },
        paywall: {
          slug: "workspace_default",
          title: { en: "Workspace plans" },
          placement: "paywall",
          packages: [],
        },
      },
      {
        showHeader: false,
        onRefreshSubscription: () => {},
        onCancelSubscription: () => {},
      },
    );

    expect(html).not.toContain("Publisher app");
    expect(html).not.toContain("Open management");
    expect(html).toContain("Refresh status");
    expect(html).not.toContain("Cancel subscription");
  });

  it("can render operator management guidance when explicitly requested", () => {
    const html = buildMonetizationPlansSurfaceHtml(
      {
        access_projection: {
          entitlement_state: "active",
          has_current_access: true,
          tier: "pro",
        },
        current_subscription: {
          status: "active",
          tier: "pro",
          subscription_management: {
            operator_owner_scope: "gateway",
            management_destination: {
              kind: "gateway_admin",
              href: "/apps/superadmin/xapps/xapp_1",
            },
          },
        },
        paywall: {
          slug: "workspace_default",
          title: { en: "Workspace plans" },
          placement: "paywall",
          packages: [],
        },
      },
      {
        showHeader: false,
        showOperatorManagement: true,
      },
    );

    expect(html).toContain("Operator authority");
    expect(html).toContain("Gateway admin");
    expect(html).toContain("Open management");
    expect(html).toContain('href="/apps/superadmin/xapps/xapp_1"');
  });

  it("disables shared plans checkout actions when the surface is not interactive", () => {
    const html = buildMonetizationPlansSurfaceHtml(
      {
        paywall: {
          slug: "workspace_default",
          title: { en: "Workspace plans" },
          placement: "paywall",
          packages: [
            {
              id: "pkg_1",
              slug: "workspace_pro_monthly",
              package_kind: "subscription",
              offering_id: "off_1",
              product: {
                id: "prod_1",
                slug: "workspace_pro",
                product_family: "subscription_plan",
              },
              prices: [
                {
                  id: "price_1",
                  currency: "USD",
                  amount: "19.00",
                  billing_period: "monthly",
                  billing_period_count: 1,
                },
              ],
            },
          ],
        },
      },
      { interactive: false },
    );

    expect(html).toContain("workspace_pro_monthly");
    expect(html).toContain("xapps-xms-plans__action");
    expect(html).toContain("disabled");
  });

  it("resolves the canonical XMS mode for a package card", () => {
    expect(resolveXmsModeForPackage({ productFamily: "credit_pack" }).key).toBe("credit_wallet");
    expect(resolveXmsModeForPackage({ productFamily: "subscription_plan" }).key).toBe(
      "subscription",
    );
  });

  it("resolves canonical package purchase policy states", () => {
    expect(
      resolveMonetizationPackagePurchasePolicy({
        item: {
          productId: "prod_sub_next",
          productFamily: "subscription_plan",
          packageKind: "subscription",
        },
        currentSubscription: {
          status: "active",
          product_id: "prod_sub_current",
        },
      }),
    ).toMatchObject({
      canPurchase: true,
      status: "available",
      transitionKind: "replace_recurring",
    });

    expect(
      resolveMonetizationPackagePurchasePolicy({
        item: {
          productId: "prod_cert_hybrid_next",
          productSlug: "cert_hybrid_access",
          productFamily: "hybrid_plan",
          packageSlug: "cert_hybrid_monthly",
          productMetadata: {
            access_tier: "cert_hybrid",
          },
        },
        currentSubscription: {
          status: "active",
          product_id: "prod_cert_hybrid_previous",
          tier: "cert_hybrid",
        },
      }),
    ).toMatchObject({
      canPurchase: false,
      status: "current_recurring_plan",
      reason: "current_recurring_plan",
    });

    expect(
      resolveMonetizationPackagePurchasePolicy({
        item: {
          productId: "prod_unlock_1",
          productFamily: "one_time_unlock",
          packageKind: "one_time_unlock",
          productSlug: "creator_starter_unlock_access",
        },
        additiveEntitlements: [
          {
            status: "active",
            product_id: "prod_unlock_1",
            product_slug: "creator_starter_unlock_access",
          },
        ],
      }),
    ).toMatchObject({
      canPurchase: false,
      status: "owned_additive_unlock",
      reason: "owned_additive_unlock",
    });

    expect(
      resolveMonetizationPackagePurchasePolicy({
        item: {
          productId: "prod_unlock_2",
          productFamily: "one_time_unlock",
          packageKind: "one_time_unlock",
          productSlug: "creator_bonus_unlock",
        },
        additiveEntitlements: [
          {
            status: "grace_period",
            product_id: "prod_unlock_2",
            product_slug: "creator_bonus_unlock",
          },
        ],
      }),
    ).toMatchObject({
      canPurchase: false,
      status: "owned_additive_unlock",
      reason: "owned_additive_unlock",
    });

    expect(
      resolveMonetizationPackagePurchasePolicy({
        item: {
          productId: "prod_unlock_3",
          productFamily: "one_time_unlock",
          packageKind: "one_time_unlock",
          purchase_policy: {
            can_purchase: false,
            status: "owned_additive_unlock",
            transition_kind: "none",
            reason: "owned_additive_unlock",
          },
        },
      }),
    ).toMatchObject({
      canPurchase: false,
      status: "owned_additive_unlock",
      transitionKind: "none",
    });

    expect(
      resolveMonetizationPackagePurchasePolicy({
        item: {
          productId: "prod_unlock_4",
          productFamily: "one_time_unlock",
          packageKind: "one_time_unlock",
          productSlug: "cert_single_unlock",
          metadata: {
            included_credits: 2,
          },
        },
        additiveEntitlements: [
          {
            status: "active",
            product_id: "prod_unlock_4",
            product_slug: "cert_single_unlock",
          },
        ],
      }),
    ).toMatchObject({
      canPurchase: true,
      status: "available",
      transitionKind: "buy_additive_unlock",
    });
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

  it("localizes named virtual currency paywall copy", () => {
    const copy = buildFeaturePaywallCopyModel({
      locale: "ro",
      feature: {
        title: "Export premium",
        requirements: {
          credits: 25,
        },
      },
      snapshotSummary: {
        accessCoverage: {
          available: true,
          coverageLabel: "Disponibil",
        },
        wallet: {
          creditsRemaining: "10",
          virtualCurrencyLabel: "Credite Creator (CREATOR_CREDITS)",
        },
      },
      activePackage: {
        packageTitle: "Pachet Credite Creator",
        packageKind: "credit_pack",
        virtualCurrency: {
          code: "CREATOR_CREDITS",
          name: "Credite Creator",
        },
      },
    });

    expect(copy.summary).toContain("25 Credite Creator");
    expect(copy.ctaLabel).toBe("Cumpără Credite Creator prin checkout găzduit");
    expect(copy.openPaywallLabel).toBe("Vezi opțiunile Credite Creator");
    expect(copy.statusLabel).toBe("necesită Credite Creator");
    expect(copy.gapBadges).toContain("lipsește 15 Credite Creator");
    expect(copy.creditsLabel).toBe("10 Credite Creator");
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

    expect(summary.accessCoverage.coverageLabel).toBe("Still covered");
    expect(summary.accessCoverage.tierLabel).toBe("creator team hybrid access");
    expect(summary.currentSubscription.present).toBe(true);
    expect(summary.currentSubscription.coverageLabel).toBe("Still covered");
    expect(summary.wallet.creditsRemaining).toBe("500");
    expect(summary.wallet.currentAccessLabel).toBe("Yes");
  });

  it("deduplicates additive entitlement labels on the shared plans surface", () => {
    const html = buildMonetizationPlansSurfaceHtml(
      {
        access_projection: {
          entitlement_state: "active",
          has_current_access: true,
          tier: "pro",
        },
        additive_entitlements: [
          {
            id: "ent_1",
            status: "active",
            product_id: "prod_unlock_1",
            product_slug: "creator_starter_unlock_access",
          },
          {
            id: "ent_2",
            status: "active",
            product_id: "prod_unlock_1",
            product_slug: "creator_starter_unlock_access",
          },
          {
            id: "ent_3",
            status: "active",
            product_id: "prod_unlock_2",
            product_slug: "creator_team_hybrid_access",
          },
        ],
        paywall: {
          slug: "workspace_default",
          title: { en: "Workspace plans" },
          placement: "paywall",
          packages: [],
        },
      },
      {
        showHeader: false,
      },
    );

    expect(html).toContain("creator_starter_unlock_access");
    expect(html).toContain("creator_team_hybrid_access");
    expect(html).not.toContain("creator_starter_unlock_access x2");
  });

  it("localizes the coverage row on the shared plans surface", () => {
    const html = buildMonetizationPlansSurfaceHtml(
      {
        access_projection: {
          entitlement_state: "active",
          has_current_access: true,
          tier: "pro",
        },
        current_subscription: {
          status: "cancelled",
          tier: "pro",
          current_period_ends_at: "2026-06-05T12:01:00.000Z",
          cancelled_at: "2026-04-09T07:41:00.000Z",
        },
        paywall: {
          slug: "workspace_default",
          title: { en: "Workspace plans" },
          placement: "paywall",
          packages: [],
        },
      },
      {
        showHeader: false,
        locale: "ro",
      },
    );

    expect(html).toContain("Acoperire curentă");
    expect(html).toContain("Acces de membru");
    expect(html).toContain("Încă activ");
    expect(html).not.toContain(">Available<");
  });

  it("builds provider-agnostic lifecycle state from overdue policy and period boundaries", () => {
    const lifecycle = buildXmsSubscriptionLifecycleSummary({
      locale: "en",
      current_subscription: {
        id: "sub_1",
        status: "past_due",
        current_period_ends_at: "2026-05-02T19:45:00.000Z",
        renews_at: null,
        overdue_policy: {
          has_current_access: false,
          effective_status_reason: "past_due_after_period_end",
          overdue_since: "2026-05-03T10:00:00.000Z",
          expiry_boundary_at: "2026-05-10T10:00:00.000Z",
        },
      },
    });

    expect(lifecycle.present).toBe(true);
    expect(lifecycle.status).toBe("past_due");
    expect(lifecycle.coverageLabel).toBe("Not covered");
    expect(lifecycle.reasonCode).toBe("past_due_after_period_end");
    expect(lifecycle.reasonLabel).toBe("Current period ended without successful renewal");
    expect(lifecycle.currentPeriodEndsAt).toBe("2026-05-02T19:45:00.000Z");
    expect(lifecycle.canRefresh).toBe(true);
    expect(lifecycle.canCancel).toBe(true);
  });

  it("deduplicates equivalent lifecycle timestamps before rendering paywall metadata", () => {
    const lifecycle = buildXmsSubscriptionLifecycleSummary({
      locale: "en",
      current_subscription: {
        id: "sub_2",
        status: "active",
        renews_at: "2026-05-16T09:11:00.000Z",
        current_period_ends_at: "2026-05-16T09:11:00.000Z",
        overdue_policy: {
          expiry_boundary_at: "2026-05-16T09:11:00.000Z",
        },
      },
    });

    expect(lifecycle.renewsAt).toBe("2026-05-16T09:11:00.000Z");
    expect(lifecycle.currentPeriodEndsAt).toBeNull();
    expect(lifecycle.expiryBoundaryAt).toBeNull();
  });

  it("marks exhausted included-credit unlock coverage as consumed", () => {
    const summary = summarizeXappMonetizationSnapshot({
      access_projection: {
        entitlement_state: "active",
        has_current_access: true,
        tier: "cert_single_unlock",
        credits_remaining: null,
        balance_state: "empty",
      },
      current_subscription: null,
    });

    expect(summary.accessCoverage.available).toBe(false);
    expect(summary.accessCoverage.coverageLabel).toBe("Consumed");
    expect(summary.wallet.currentAccessLabel).toBe("No");
  });
});
