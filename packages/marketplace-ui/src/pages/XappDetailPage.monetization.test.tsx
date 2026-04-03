// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MarketplaceProvider } from "../MarketplaceContext";
import { XappDetailPage } from "./XappDetailPage";

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
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_1",
        version_id: "ver_1",
        subject_id: "subject_1",
        access_projection: {
          entitlement_state: "active",
          tier: "pro",
          credits_remaining: "25",
        },
        current_subscription: {
          id: "sub_1",
          status: "active",
          tier: "pro",
          renews_at: "2026-04-30T10:00:00.000Z",
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
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Current Access");
    expect(text).toContain("Current plan");
    expect(text).toContain("pro");
    expect(text).toContain("Subscription status");
    expect(text).toContain("active");
    expect(text).toContain("Credits remaining");
    expect(text).toContain("25");
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
    expect(text).toContain("Subscription status");
    expect(text).toContain("past_due");
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
    expect(text).toContain("Current Access");
    expect(text).toContain("Access state");
    expect(text).toContain("available");
    expect(text).toContain("Credits remaining");
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
    expect(text).toContain("Current Access");
    expect(text).toContain("Access state");
    expect(text).toContain("available");
    expect(text).not.toContain("Access stateinactive");
  });
});
