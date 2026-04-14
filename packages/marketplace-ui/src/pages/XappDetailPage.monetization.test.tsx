// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MarketplaceProvider } from "../MarketplaceContext";
import { XappDetailPage, XappPlansPage } from "./XappDetailPage";

const cleanupFns: Array<() => void> = [];
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).React = React;

afterEach(() => {
  while (cleanupFns.length > 0) {
    cleanupFns.pop()?.();
  }
  document.body.innerHTML = "";
});

describe("XappDetailPage monetization", () => {
  it("renders current access details when the host client exposes monetization reads", async () => {
    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_1",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_1",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetizationHistory: async () => ({
        history: {
          wallet_accounts: {
            total: 1,
            items: [
              {
                id: "wallet_1",
                balance_remaining: "25",
                currency: "credits",
                virtual_currency: {
                  code: "PRO_CREDITS",
                  name: "Pro Credits",
                },
              },
            ],
          },
          access_snapshots: {
            total: 0,
            items: [],
          },
          timeline: { total: 0, items: [] },
        },
      }),
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_1",
        version_id: "ver_1",
        subject_id: "subject_1",
        access_projection: {
          entitlement_state: "active",
          tier: "pro",
          credits_remaining: "25",
          virtual_currency: {
            code: "PRO_CREDITS",
            name: "Pro Credits",
          },
        },
        current_subscription: {
          id: "sub_1",
          status: "active",
          tier: "pro",
          renews_at: "2026-04-30T10:00:00.000Z",
        },
        additive_entitlements: [
          {
            id: "ent_1",
            status: "active",
            tier: "starter",
            product_id: "prod_unlock_1",
            product_slug: "creator_starter_unlock_access",
            source_ref: "starter_unlock",
          },
        ],
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({
        xapp_lifecycle: { installationId: "inst_lifecycle", xappId: "xapp_lifecycle" },
      }),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/xapps/xapp_1"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Current access");
    expect(text).toContain("Current plan");
    expect(text).toContain("pro");
    expect(text).toContain("Subscription state");
    expect(text).toContain("active");
    expect(text).toContain("Currency");
    expect(text).toContain("Pro Credits (PRO_CREDITS)");
    expect(text).toContain("Balances now");
    expect(text).toContain("25 Pro Credits");
    expect(text).toContain("Balance");
    expect(text).toContain("25 Pro Credits");
    expect(text).toContain("Add-on unlocks");
    expect(text).toContain("starter");
  });

  it("shows provider-agnostic lifecycle details and subject-side subscription actions", async () => {
    const refreshState = vi.fn(async () => ({
      xapp_id: "xapp_lifecycle",
      version_id: "ver_lifecycle",
      current_subscription: { id: "sub_lifecycle", status: "active" },
      access_projection: { entitlement_state: "active" },
    }));
    const cancelSubscription = vi.fn(async () => ({
      xapp_id: "xapp_lifecycle",
      version_id: "ver_lifecycle",
      current_subscription: { id: "sub_lifecycle", status: "cancelled" },
      access_projection: { entitlement_state: "active" },
    }));
    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_lifecycle",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_lifecycle",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetizationHistory: async () => ({
        history: { timeline: { total: 0, items: [] } },
      }),
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_lifecycle",
        version_id: "ver_lifecycle",
        subject_id: "subject_lifecycle",
        access_projection: {
          entitlement_state: "active",
          tier: "pro",
          credits_remaining: "19",
        },
        current_subscription: {
          id: "sub_lifecycle",
          status: "active",
          tier: "pro",
          renews_at: "2026-06-07T21:27:00.000Z",
          current_period_ends_at: "2026-06-07T21:27:00.000Z",
          subscription_management: {
            authority_lane: "gateway_managed",
            operator_owner_scope: "gateway",
            management_destination: {
              kind: "gateway_admin",
              href: "/apps/superadmin/xapps/xapp_lifecycle#monetization-subscriptions",
            },
            subject_actions: {
              refresh_status: { available: true },
              cancel_subscription: { available: true },
            },
          },
        },
      }),
      refreshMyXappSubscriptionContractState: refreshState,
      cancelMyXappSubscriptionContract: cancelSubscription,
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/marketplace/xapps/xapp_lifecycle?installationId=inst_lifecycle"]}
        >
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Renews at");
    expect(text).toContain("Current period ends");
    expect(text).toContain("Refresh status");
    expect(text).toContain("Cancel subscription");

    const refreshButton = Array.from(host.querySelectorAll("button")).find(
      (item) => item.textContent === "Refresh status",
    );
    expect(refreshButton).toBeTruthy();
    await act(async () => {
      refreshButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(refreshState).toHaveBeenCalledWith({
      xappId: "xapp_lifecycle",
      contractId: "sub_lifecycle",
    });
  });

  it("shows direct cancel for delegated lifecycle lanes and keeps management guidance", async () => {
    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_delegated",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_delegated",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetizationHistory: async () => ({
        history: { timeline: { total: 0, items: [] } },
      }),
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_delegated",
        version_id: "ver_delegated",
        subject_id: "subject_delegated",
        access_projection: {
          entitlement_state: "active",
          tier: "pro",
        },
        current_subscription: {
          id: "sub_delegated",
          status: "active",
          tier: "pro",
          renews_at: "2026-06-07T21:27:00.000Z",
          current_period_ends_at: "2026-06-07T21:27:00.000Z",
          subscription_management: {
            authority_lane: "publisher_delegated",
            operator_owner_scope: "publisher",
            management_destination: {
              kind: "publisher_app",
              href: "/apps/publisher/xapps/xapp_delegated/monetization",
            },
            subject_actions: {
              refresh_status: { available: true },
              cancel_subscription: { available: true },
            },
          },
        },
      }),
      refreshMyXappSubscriptionContractState: vi.fn(async () => ({
        xapp_id: "xapp_delegated",
        version_id: "ver_delegated",
        current_subscription: { id: "sub_delegated", status: "active" },
        access_projection: { entitlement_state: "active" },
      })),
      cancelMyXappSubscriptionContract: vi.fn(async () => ({
        xapp_id: "xapp_delegated",
        version_id: "ver_delegated",
        current_subscription: { id: "sub_delegated", status: "cancelled" },
        access_projection: { entitlement_state: "active" },
      })),
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/xapps/xapp_delegated"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Refresh status");
    expect(text).toContain("Cancel subscription");
  });

  it("forwards lifecycle preview query and shows preview state in current access", async () => {
    const getMyXappMonetization = vi.fn(async () => ({
      xapp_id: "xapp_preview",
      version_id: "ver_preview",
      subject_id: "subject_preview",
      access_projection: {
        entitlement_state: "suspended",
        tier: "pro",
        credits_remaining: "11",
      },
      current_subscription: {
        id: "sub_preview",
        status: "past_due",
        tier: "pro",
        renews_at: null,
        current_period_ends_at: "2026-07-01T12:00:00.000Z",
        overdue_policy: {
          has_current_access: false,
          effective_status_reason: "past_due_after_period_end",
          overdue_since: "2026-07-01T12:00:00.000Z",
        },
      },
    }));
    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_preview",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_preview",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetization,
      getMyXappMonetizationHistory: async () => ({
        history: { timeline: { total: 0, items: [] } },
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/marketplace/xapps/xapp_preview?previewAt=2026-07-02T12:00:00.000Z"]}
        >
          <MarketplaceProvider client={client} host={hostAdapter} env={{ devMode: true }}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    expect(getMyXappMonetization).toHaveBeenCalledWith("xapp_preview", {
      installationId: null,
      locale: "en",
      previewAt: "2026-07-02T12:00:00.000Z",
    });

    const text = host.textContent || "";
    expect(text).toContain("Preview as of");
    expect(text).toContain("Subscription state is being previewed for the selected time.");
    expect(text).toContain("Current access");
  });

  it("preserves marketplace breadcrumbs on the plans route", async () => {
    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_breadcrumbs",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_breadcrumbs",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
          monetization: {},
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_breadcrumbs",
        version_id: "ver_breadcrumbs",
        subject_id: "subject_1",
        access_projection: {
          entitlement_state: "active",
          tier: "pro",
          credits_remaining: "25",
        },
        current_subscription: null,
        additive_entitlements: [],
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({
        xapp_breadcrumbs: {
          installationId: "inst_1",
          xappId: "xapp_breadcrumbs",
        },
      }),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/marketplace/xapps/xapp_breadcrumbs/plans?installationId=inst_1"]}
        >
          <MarketplaceProvider
            client={client}
            host={hostAdapter}
            env={{ apiBaseUrl: "http://localhost:3000" }}
          >
            <Routes>
              <Route path="/marketplace/xapps/:xappId/plans" element={<XappPlansPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const links = Array.from(host.querySelectorAll(".mx-breadcrumb a"));
    expect(host.textContent || "").toContain("Marketplace");
    expect(host.textContent || "").toContain("Demo App");
    expect(host.textContent || "").toContain("Plans");
    expect(links.map((item) => item.textContent)).toEqual(["Marketplace", "Demo App"]);
  });

  it("renders explicit overdue-policy details for non-renewing subscription states", async () => {
    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_2",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_2",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_2",
        version_id: "ver_2",
        subject_id: "subject_2",
        access_projection: {
          entitlement_state: "suspended",
          tier: "workspace_pro",
        },
        current_subscription: {
          id: "sub_2",
          status: "past_due",
          tier: "workspace_pro",
          renews_at: null,
          overdue_policy: {
            has_current_access: false,
            effective_status_reason: "past_due_after_period_end",
            overdue_since: "2026-03-01T10:00:00.000Z",
            expiry_boundary_at: "2026-03-15T10:00:00.000Z",
            expiry_boundary_source: "current_period_end",
          },
        },
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/xapps/xapp_2"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Subscription state");
    expect(text).toContain("past due");
    expect(text).toContain("Coverage");
    expect(text).toContain("Not covered");
    expect(text).toContain("Status reason");
    expect(text).toContain("Current period ended without successful renewal");
    expect(text).toContain("Overdue since");
    expect(text).toContain("Expiry boundary");
  });

  it("shows access as available when credits remain even if entitlement state is inactive", async () => {
    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_3",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_3",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_3",
        version_id: "ver_3",
        subject_id: "subject_3",
        access_projection: {
          entitlement_state: "inactive",
          balance_state: "sufficient",
          credits_remaining: "1",
        },
        current_subscription: null,
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/xapps/xapp_3"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Current access");
    expect(text).toContain("Access state");
    expect(text).toContain("available");
    expect(text).toContain("Balance");
    expect(text).toContain("1");
    expect(text).not.toContain("Access stateinactive");
  });

  it("shows access as available by default when no xms catalog is configured", async () => {
    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_4",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_4",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_4",
        version_id: "ver_4",
        subject_id: "subject_4",
        access_projection: {
          entitlement_state: "inactive",
          balance_state: "unknown",
          has_current_access: false,
        },
        current_subscription: null,
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/xapps/xapp_4"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Current access");
    expect(text).toContain("Access state");
    expect(text).toContain("available");
    expect(text).not.toContain("Access stateinactive");
  });

  it("renders shared paywall options when monetization paywalls are returned", async () => {
    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_5",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_5",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_5",
        version_id: "ver_5",
        subject_id: "subject_5",
        access_projection: {
          entitlement_state: "inactive",
          balance_state: "unknown",
          has_current_access: false,
        },
        current_subscription: null,
        paywalls: [
          {
            slug: "creator_default_paywall",
            title: { en: "Creator plans" },
            description: { en: "Choose the package that fits this app." },
            placement: "default_paywall",
            default_package_ref: "creator_pro_monthly",
            packages: [
              {
                id: "pkg_1",
                slug: "creator_pro_monthly",
                package_kind: "subscription",
                offering_id: "off_1",
                offering_slug: "creator_membership",
                offering_placement: "paywall",
                product: {
                  id: "prod_1",
                  slug: "creator_pro",
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
              {
                id: "pkg_2",
                slug: "creator_credit_pack",
                package_kind: "credit_pack",
                offering_id: "off_1",
                offering_slug: "creator_membership",
                offering_placement: "paywall",
                metadata: {
                  credits: 25,
                },
                product: {
                  id: "prod_2",
                  slug: "creator_credits",
                  product_family: "credit_pack",
                  virtual_currency: {
                    code: "CREATOR_CREDITS",
                    name: "Creator Credits",
                  },
                },
                prices: [
                  {
                    id: "price_2",
                    currency: "USD",
                    amount: "9.00",
                    billing_period: "one_time",
                    billing_period_count: null,
                  },
                ],
              },
            ],
          },
        ],
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/xapps/xapp_5"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Plans");
    expect(text).toContain("Creator plans");
    expect(text).toContain("creator_pro_monthly");
    expect(text).toContain("19.00 USD / monthly");
    expect(text).toContain("Subscription");
    expect(text).toContain("25 Creator Credits");
    expect(text).toContain("Default");
  });

  it("highlights the package selected from widget paywall handoff", async () => {
    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_6",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_6",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_6",
        version_id: "ver_6",
        subject_id: "subject_6",
        access_projection: {
          entitlement_state: "inactive",
          balance_state: "unknown",
          has_current_access: false,
        },
        current_subscription: null,
        paywalls: [
          {
            slug: "creator_default_paywall",
            title: { en: "Creator plans" },
            description: { en: "Choose the package that fits this app." },
            placement: "default_paywall",
            default_package_ref: "creator_pro_monthly",
            packages: [
              {
                id: "pkg_1",
                slug: "creator_pro_monthly",
                package_kind: "subscription",
                offering_id: "off_1",
                offering_slug: "creator_membership",
                offering_placement: "paywall",
                product: {
                  id: "prod_1",
                  slug: "creator_pro",
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
              {
                id: "pkg_2",
                slug: "creator_credit_pack",
                package_kind: "credit_pack",
                offering_id: "off_1",
                offering_slug: "creator_membership",
                offering_placement: "paywall",
                product: {
                  id: "prod_2",
                  slug: "creator_credits",
                  product_family: "credit_pack",
                },
                prices: [
                  {
                    id: "price_2",
                    currency: "USD",
                    amount: "9.00",
                    billing_period: "one_time",
                    billing_period_count: null,
                  },
                ],
              },
            ],
          },
        ],
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            "/marketplace/xapps/xapp_6?focus=plans&paywallPackage=creator_credit_pack",
          ]}
        >
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Creator plans");
    expect(text).toContain("creator_credit_pack");
    expect(text).toContain("Selected");
  });

  it("finalizes checkout inline when no hosted payment page is required", async () => {
    let checkoutCompleted = false;
    const prepareMyXappPurchaseIntent = vi.fn(async () => ({
      xapp_id: "xapp_7",
      version_id: "ver_7",
      prepared_intent: {
        purchase_intent_id: "intent_7",
        package_id: "pkg_2",
        price_id: "price_2",
        status: "created",
      },
    }));
    const createMyXappPurchasePaymentSession = vi.fn(async () => ({
      xapp_id: "xapp_7",
      version_id: "ver_7",
      payment_session: {
        payment_session_id: null,
        status: "paid",
        amount: "0.00",
        currency: "USD",
        issuer: "xms_internal",
        return_url: "http://localhost/marketplace/xapps/xapp_7?focus=plans",
        cancel_url: null,
        xapps_resume: "http://localhost/marketplace/xapps/xapp_7?focus=plans",
      },
      payment_page_url: null,
    }));
    const finalizeMyXappPurchasePaymentSession = vi.fn(async () => {
      checkoutCompleted = true;
      return {
        xapp_id: "xapp_7",
        version_id: "ver_7",
        payment_session: {
          payment_session_id: null,
          status: "paid",
          amount: "0.00",
          currency: "USD",
          issuer: "xms_internal",
          return_url: null,
          cancel_url: null,
          xapps_resume: null,
        },
        prepared_intent: {
          purchase_intent_id: "intent_7",
          package: { id: "pkg_2", slug: "creator_credit_pack", product_id: "prod_2" },
          price: {
            id: "price_2",
            currency: "USD",
            amount: "0.00",
            catalog_amount: "9.00",
            billing_period: "one_time",
            billing_period_count: null,
            trial_policy: null,
            intro_policy: null,
            applied_trial_policy: null,
            applied_intro_policy: {
              kind: "discount",
              amount_off: "9.00",
              percent_off: null,
              cycles: 1,
            },
            checkout_mode: "no_payment_required",
          },
          offering: { id: "off_1", slug: "creator_membership" },
          status: "paid",
        },
        access_projection: {
          entitlement_state: "active",
          balance_state: "sufficient",
          has_current_access: true,
        },
      };
    });
    const getMyXappMonetization = vi.fn(async () =>
      checkoutCompleted
        ? {
            xapp_id: "xapp_7",
            version_id: "ver_7",
            subject_id: "subject_7",
            access_projection: {
              entitlement_state: "active",
              balance_state: "sufficient",
              has_current_access: true,
              tier: "creator_credits",
            },
            current_subscription: null,
            paywalls: [],
          }
        : {
            xapp_id: "xapp_7",
            version_id: "ver_7",
            subject_id: "subject_7",
            access_projection: {
              entitlement_state: "inactive",
              balance_state: "unknown",
              has_current_access: false,
            },
            current_subscription: null,
            paywalls: [
              {
                slug: "creator_default_paywall",
                title: { en: "Creator plans" },
                description: { en: "Choose the package that fits this app." },
                placement: "default_paywall",
                default_package_ref: "creator_pro_monthly",
                packages: [
                  {
                    id: "pkg_1",
                    slug: "creator_pro_monthly",
                    package_kind: "subscription",
                    offering_id: "off_1",
                    offering_slug: "creator_membership",
                    offering_placement: "paywall",
                    product: {
                      id: "prod_1",
                      slug: "creator_pro",
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
                  {
                    id: "pkg_2",
                    slug: "creator_credit_pack",
                    package_kind: "credit_pack",
                    offering_id: "off_1",
                    offering_slug: "creator_membership",
                    offering_placement: "paywall",
                    product: {
                      id: "prod_2",
                      slug: "creator_credits",
                      product_family: "credit_pack",
                    },
                    prices: [
                      {
                        id: "price_2",
                        currency: "USD",
                        amount: "9.00",
                        billing_period: "one_time",
                        billing_period_count: null,
                      },
                    ],
                  },
                ],
              },
            ],
          },
    );

    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_7",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_7",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      prepareMyXappPurchaseIntent,
      createMyXappPurchasePaymentSession,
      finalizeMyXappPurchasePaymentSession,
      getMyXappMonetization,
    };

    const hostAdapter: any = {
      subjectId: "self",
      canMutate: () => true,
      getInstallationsByXappId: () => ({
        xapp_7: {
          installationId: "inst_7",
          xappId: "xapp_7",
          status: "installed",
        },
      }),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            "/marketplace/xapps/xapp_7/plans?installationId=inst_7&paywallPackage=creator_credit_pack",
          ]}
        >
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId/plans" element={<XappPlansPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const selectedPackageCard = Array.from(host.querySelectorAll(".mx-paywall-card-package")).find(
      (node) =>
        node.classList.contains("is-selected") &&
        String(node.textContent || "").includes("creator_credit_pack"),
    );
    const checkoutButton = selectedPackageCard?.querySelector("button") as HTMLButtonElement | null;
    expect(checkoutButton).toBeTruthy();

    await act(async () => {
      checkoutButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(prepareMyXappPurchaseIntent).toHaveBeenCalledWith({
      xappId: "xapp_7",
      offeringId: "off_1",
      packageId: "pkg_2",
      priceId: "price_2",
      installationId: "inst_7",
    });
    expect(createMyXappPurchasePaymentSession).toHaveBeenCalledWith({
      xappId: "xapp_7",
      intentId: "intent_7",
      pageUrl: "http://localhost:3000/v1/gateway-payment.html",
      returnUrl: expect.stringContaining("xapps_monetization_intent_id=intent_7"),
      cancelUrl: expect.stringContaining("xapps_monetization_intent_id=intent_7"),
      xappsResume: expect.stringContaining("xapps_monetization_intent_id=intent_7"),
      locale: "en",
    });
    const paymentSessionCalls = createMyXappPurchasePaymentSession.mock.calls as Array<
      Array<{ returnUrl?: string | null }>
    >;
    const paymentSessionInput = paymentSessionCalls.at(0)?.[0] ?? null;
    expect(paymentSessionInput).toBeTruthy();
    expect(String(paymentSessionInput?.returnUrl || "")).toContain(
      "paywallPackage=creator_credit_pack",
    );
    expect(String(paymentSessionInput?.returnUrl || "")).toContain("focus=plans");
    expect(finalizeMyXappPurchasePaymentSession).toHaveBeenCalledWith({
      xappId: "xapp_7",
      intentId: "intent_7",
    });
    expect(getMyXappMonetization.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(host.textContent || "").toContain("creator_credits");
    expect(host.textContent || "").toContain("active");
  });

  it("finalizes a paid monetization return and refreshes current access automatically", async () => {
    const getMyXappMonetization = vi
      .fn()
      .mockResolvedValueOnce({
        xapp_id: "xapp_9",
        version_id: "ver_9",
        subject_id: "subject_9",
        access_projection: {
          entitlement_state: "inactive",
          balance_state: "unknown",
          has_current_access: false,
        },
        current_subscription: null,
        paywalls: [],
      })
      .mockResolvedValueOnce({
        xapp_id: "xapp_9",
        version_id: "ver_9",
        subject_id: "subject_9",
        access_projection: {
          entitlement_state: "active",
          tier: "creator_pro",
          balance_state: "unknown",
          has_current_access: true,
        },
        current_subscription: {
          id: "sub_9",
          status: "active",
          tier: "creator_pro",
        },
        additive_entitlements: [],
        paywalls: [],
      });
    const finalizeMyXappPurchasePaymentSession = vi.fn(async () => ({
      xapp_id: "xapp_9",
      version_id: "ver_9",
      payment_session: {
        payment_session_id: "pay_9",
        status: "completed",
        amount: "19.00",
        currency: "USD",
        issuer: "gateway",
        return_url: "http://localhost/marketplace/xapps/xapp_9",
        cancel_url: null,
        xapps_resume: "http://localhost/marketplace/xapps/xapp_9",
      },
      prepared_intent: {
        purchase_intent_id: "intent_9",
        status: "paid",
        package: { id: "pkg_9", slug: "creator_pro_monthly", product_id: "prod_9" },
        price: { id: "price_9", currency: "USD", amount: "19.00", billing_period: "monthly" },
        offering: { id: "off_9", slug: "creator_membership" },
      },
      access_projection: {
        entitlement_state: "active",
        tier: "creator_pro",
        has_current_access: true,
      },
    }));

    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_9",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_9",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetization,
      finalizeMyXappPurchasePaymentSession,
    };

    const hostAdapter: any = {
      subjectId: "self",
      canMutate: () => true,
      getInstallationsByXappId: () => ({
        xapp_9: {
          installationId: "inst_9",
          xappId: "xapp_9",
          status: "installed",
        },
      }),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            "/marketplace/xapps/xapp_9?focus=plans&xapps_monetization_intent_id=intent_9&xapps_payment_session_id=pay_9&xapps_payment_status=paid",
          ]}
        >
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    expect(finalizeMyXappPurchasePaymentSession).toHaveBeenCalledWith({
      xappId: "xapp_9",
      intentId: "intent_9",
    });
    expect(getMyXappMonetization.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("marks the already active subscription package as current and blocks checkout for it", async () => {
    const prepareMyXappPurchaseIntent = vi.fn(async () => ({
      xapp_id: "xapp_8",
      version_id: "ver_8",
      prepared_intent: {
        purchase_intent_id: "intent_8",
        package_id: "pkg_8a",
        price_id: "price_8a",
        status: "created",
      },
    }));
    const createMyXappPurchasePaymentSession = vi.fn(async () => ({
      xapp_id: "xapp_8",
      version_id: "ver_8",
      payment_session: {
        payment_session_id: "pay_8",
        status: "pending",
        amount: "19.00",
        currency: "USD",
        issuer: "gateway",
        return_url: "http://localhost/marketplace/xapps/xapp_8",
        cancel_url: null,
        xapps_resume: "http://localhost/marketplace/xapps/xapp_8",
      },
      payment_page_url: "http://localhost/checkout",
    }));

    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_8",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_8",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      prepareMyXappPurchaseIntent,
      createMyXappPurchasePaymentSession,
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_8",
        version_id: "ver_8",
        subject_id: "subject_8",
        access_projection: {
          entitlement_state: "active",
          balance_state: "unknown",
          has_current_access: true,
          tier: "creator_pro",
        },
        current_subscription: {
          id: "sub_8",
          status: "active",
          tier: "creator_pro",
          product_id: "prod_8a",
          renews_at: "2026-05-01T00:00:00.000Z",
        },
        paywalls: [
          {
            slug: "creator_default_paywall",
            title: { en: "Creator plans" },
            placement: "default_paywall",
            default_package_ref: "creator_pro_monthly",
            packages: [
              {
                id: "pkg_8a",
                slug: "creator_pro_monthly",
                package_kind: "subscription",
                offering_id: "off_8",
                offering_slug: "creator_membership",
                offering_placement: "paywall",
                product: {
                  id: "prod_8a",
                  slug: "creator_pro",
                  product_family: "subscription_plan",
                },
                prices: [
                  {
                    id: "price_8a",
                    currency: "USD",
                    amount: "19.00",
                    billing_period: "monthly",
                    billing_period_count: 1,
                  },
                ],
              },
            ],
          },
        ],
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      canMutate: () => true,
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/xapps/xapp_8?focus=plans"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Current plan");
    expect(text).toContain("Current plan active");
    expect(prepareMyXappPurchaseIntent).not.toHaveBeenCalled();
    expect(createMyXappPurchasePaymentSession).not.toHaveBeenCalled();
  });

  it("shows owned additive unlocks and blocks rebuy for the same unlock package", async () => {
    const prepareMyXappPurchaseIntent = vi.fn(async () => ({
      xapp_id: "xapp_8",
      version_id: "ver_8",
      prepared_intent: {
        purchase_intent_id: "intent_8",
        package_id: "pkg_8",
        price_id: "price_8",
        status: "created",
      },
    }));
    const createMyXappPurchasePaymentSession = vi.fn(async () => ({
      xapp_id: "xapp_8",
      version_id: "ver_8",
      payment_session: {
        payment_session_id: "pay_8",
        status: "pending",
        amount: "9.00",
        currency: "USD",
        issuer: "gateway",
        return_url: "http://localhost/marketplace/xapps/xapp_8",
        cancel_url: null,
        xapps_resume: "http://localhost/marketplace/xapps/xapp_8",
      },
      payment_page_url: null,
    }));

    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_8",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_8",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      prepareMyXappPurchaseIntent,
      createMyXappPurchasePaymentSession,
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_8",
        version_id: "ver_8",
        subject_id: "subject_8",
        access_projection: {
          entitlement_state: "active",
          balance_state: "unknown",
          has_current_access: true,
          tier: "pro",
        },
        current_subscription: {
          id: "sub_8",
          status: "active",
          tier: "pro",
          product_id: "prod_sub_8",
        },
        additive_entitlements: [
          {
            id: "ent_unlock_8",
            status: "active",
            tier: "starter",
            product_id: "prod_unlock_8",
            product_slug: "creator_starter_unlock_access",
            source_ref: "starter_unlock",
          },
        ],
        paywalls: [
          {
            slug: "creator_default_paywall",
            title: { en: "Creator plans" },
            placement: "default_paywall",
            packages: [
              {
                id: "pkg_8",
                slug: "creator_starter_unlock",
                package_kind: "one_time_unlock",
                offering_id: "off_8",
                offering_slug: "creator_membership",
                offering_placement: "paywall",
                product: {
                  id: "prod_unlock_8",
                  slug: "creator_starter_unlock_access",
                  product_family: "one_time_unlock",
                },
                prices: [
                  {
                    id: "price_8",
                    currency: "USD",
                    amount: "9.00",
                    billing_period: "one_time",
                    billing_period_count: null,
                  },
                ],
              },
            ],
          },
        ],
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      canMutate: () => true,
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/xapps/xapp_8?focus=plans"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Add-on unlocks");
    expect(text).toContain("starter");
    expect(text).toContain("Owned unlock");
    expect(text).toContain("Owned unlock active");
    const ownedUnlockButton = Array.from(host.querySelectorAll("button")).find((node) =>
      String(node.textContent || "").includes("Owned unlock active"),
    ) as HTMLButtonElement | undefined;
    expect(ownedUnlockButton).toBeTruthy();
    expect(ownedUnlockButton?.disabled).toBe(true);
    expect(prepareMyXappPurchaseIntent).not.toHaveBeenCalled();
    expect(createMyXappPurchasePaymentSession).not.toHaveBeenCalled();
  });

  it("keeps additive unlock checkout available while a recurring membership is active", async () => {
    const prepareMyXappPurchaseIntent = vi.fn(async () => ({
      xapp_id: "xapp_10",
      version_id: "ver_10",
      prepared_intent: {
        purchase_intent_id: "intent_10",
        package_id: "pkg_10_unlock",
        price_id: "price_10_unlock",
        status: "created",
      },
    }));
    const createMyXappPurchasePaymentSession = vi.fn(async () => ({
      xapp_id: "xapp_10",
      version_id: "ver_10",
      payment_session: {
        payment_session_id: "pay_10",
        status: "pending",
        amount: "9.00",
        currency: "USD",
        issuer: "gateway",
        return_url: "http://localhost/marketplace/xapps/xapp_10",
        cancel_url: null,
        xapps_resume: "http://localhost/marketplace/xapps/xapp_10",
      },
      payment_page_url: null,
    }));

    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_10",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Demo App",
        },
        version: {
          id: "ver_10",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      prepareMyXappPurchaseIntent,
      createMyXappPurchasePaymentSession,
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_10",
        version_id: "ver_10",
        subject_id: "subject_10",
        access_projection: {
          entitlement_state: "active",
          balance_state: "unknown",
          has_current_access: true,
          tier: "creator_pro",
        },
        current_subscription: {
          id: "sub_10",
          status: "active",
          tier: "creator_pro",
          product_id: "prod_sub_10",
        },
        additive_entitlements: [],
        paywalls: [
          {
            slug: "creator_default_paywall",
            title: { en: "Creator plans" },
            placement: "default_paywall",
            packages: [
              {
                id: "pkg_10_unlock",
                slug: "creator_starter_unlock",
                package_kind: "one_time_unlock",
                offering_id: "off_10",
                offering_slug: "creator_membership",
                offering_placement: "paywall",
                product: {
                  id: "prod_unlock_10",
                  slug: "creator_starter_unlock_access",
                  product_family: "one_time_unlock",
                },
                prices: [
                  {
                    id: "price_10_unlock",
                    currency: "USD",
                    amount: "9.00",
                    billing_period: "one_time",
                    billing_period_count: null,
                  },
                ],
              },
            ],
          },
        ],
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      canMutate: () => true,
      getInstallationsByXappId: () => ({
        xapp_10: {
          installationId: "inst_10",
          xappId: "xapp_10",
          status: "installed",
        },
      }),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            "/marketplace/xapps/xapp_10?focus=plans&paywallPackage=creator_starter_unlock",
          ]}
        >
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Add-on with membership");
    expect(text).toContain("Purchase add-on unlock");

    const additiveButton = Array.from(host.querySelectorAll("button")).find((node) =>
      String(node.textContent || "").includes("Purchase add-on unlock"),
    ) as HTMLButtonElement | undefined;
    expect(additiveButton).toBeTruthy();
    expect(additiveButton?.disabled).toBe(false);

    await act(async () => {
      additiveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(prepareMyXappPurchaseIntent).toHaveBeenCalledWith({
      xappId: "xapp_10",
      offeringId: "off_10",
      packageId: "pkg_10_unlock",
      priceId: "price_10_unlock",
      installationId: "inst_10",
    });
    expect(createMyXappPurchasePaymentSession).toHaveBeenCalledTimes(1);
  });
});
