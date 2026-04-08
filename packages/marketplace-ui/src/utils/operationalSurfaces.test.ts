import { describe, expect, it } from "vitest";
import {
  discoverOperationalSurfaceData,
  getVisibleOperationalSurfaces,
  resolveOperationalSurfacePlacement,
} from "./operationalSurfaces";

describe("operational surface utilities", () => {
  it("exposes all supported portal surfaces in testing_all mode", () => {
    const surfaces = getVisibleOperationalSurfaces({
      detail: {
        xapp: {},
        version: {},
        manifest: {},
        tools: [],
        widgets: [],
        operational_surfaces: {
          requests: {
            enabled: false,
            scope: "xapp",
            visibility: { portal: false, embed: false },
            filters: { xapp_id: "xapp_1" },
            derived_from: [],
          },
          monetization: {
            enabled: false,
            scope: "xapp",
            visibility: { portal: false, embed: false },
            filters: { xapp_id: "xapp_1" },
            derived_from: [],
          },
          payments: {
            enabled: false,
            scope: "xapp",
            visibility: { portal: false, embed: false },
            filters: { xapp_id: "xapp_1" },
            derived_from: [],
          },
          invoices: {
            enabled: false,
            scope: "xapp",
            visibility: { portal: false, embed: false },
            filters: { xapp_id: "xapp_1" },
            derived_from: [],
          },
          notifications: {
            enabled: false,
            scope: "xapp",
            visibility: { portal: false, embed: false },
            filters: { xapp_id: "xapp_1" },
            derived_from: [],
          },
        },
      },
      client: {
        listCatalogXapps: async () => ({ items: [] }),
        getCatalogXapp: async () => ({
          xapp: {},
          version: {},
          manifest: {},
          tools: [],
          widgets: [],
        }),
        getMyXappMonetization: async () => ({ xapp_id: "xapp_1", version_id: "v1", paywalls: [] }),
        listMyRequests: async () => ({ items: [] }),
        getMyRequest: async () => ({}),
        listMyPaymentSessions: async () => ({ items: [] }),
        listMyInvoices: async () => ({ items: [] }),
        listMyNotifications: async () => ({ items: [], unread_count: 0 }),
        getWidgetToken: async () => ({ token: "tok" }),
      },
      env: {
        operationalSurfacesVisibility: {
          portal: "testing_all",
        },
      },
      isEmbedded: false,
    });

    expect(surfaces).toEqual(["requests", "monetization", "payments", "invoices", "notifications"]);
  });

  it("discovers monetization, payment, invoice, and notification surfaces from existing xapp data", async () => {
    const discovered = await discoverOperationalSurfaceData({
      client: {
        listCatalogXapps: async () => ({ items: [] }),
        getCatalogXapp: async () => ({
          xapp: {},
          version: {},
          manifest: {},
          tools: [],
          widgets: [],
        }),
        getMyXappMonetization: async () => ({
          xapp_id: "xapp_1",
          version_id: "v1",
          paywalls: [{ slug: "default" }],
        }),
        listMyRequests: async () => ({ items: [] }),
        getMyRequest: async () => ({}),
        listMyPaymentSessions: async () => ({ items: [{ id: "pay_1" }] }),
        listMyInvoices: async () => ({ items: [{ id: "inv_1" }] }),
        listMyNotifications: async () => ({ items: [], unread_count: 2 }),
        getWidgetToken: async () => ({ token: "tok" }),
      },
      xappId: "xapp_1",
      installationId: "inst_1",
    });

    expect(discovered).toEqual(["monetization", "payments", "invoices", "notifications"]);
  });

  it("defaults operational surface placement to in_router and supports per-surface overrides", () => {
    expect(
      resolveOperationalSurfacePlacement({
        surface: "payments",
        isEmbedded: true,
      }),
    ).toBe("in_router");

    expect(
      resolveOperationalSurfacePlacement({
        surface: "notifications",
        isEmbedded: true,
        env: {
          operationalSurfacePlacement: {
            embed: {
              default: "in_router",
              bySurface: {
                notifications: "side_panel",
              },
            },
          },
        },
      }),
    ).toBe("side_panel");
  });
});
