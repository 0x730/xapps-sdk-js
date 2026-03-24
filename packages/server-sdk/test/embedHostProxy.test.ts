import { describe, expect, it, vi } from "vitest";
import {
  createEmbedHostProxyService,
  EmbedHostProxyInputError,
  EmbedHostProxyNotConfiguredError,
} from "../src/embedHostProxy.js";

describe("server-sdk embedHostProxy", () => {
  it("mirrors the xconect-style host contract with validation and host-return rewriting", async () => {
    const gatewayClient = {
      resolveSubject: vi.fn(async () => ({ subjectId: "sub_123" })),
      createCatalogSession: vi.fn(async () => ({
        token: "catalog_token",
        embedUrl: "/embed/catalog?token=catalog_token",
      })),
      createWidgetSession: vi.fn(async () => ({
        token: "widget_token",
        embedUrl: "/embed/widgets/widget_123?token=widget_token",
        context: { installationId: "inst_123" },
      })),
      listInstallations: vi.fn(async () => ({
        items: [{ id: "inst_123", xapp_id: "xapp_123", status: "installed" }],
      })),
      installXapp: vi.fn(async () => ({
        installation: { id: "inst_123", xapp_id: "xapp_123", status: "installed" },
      })),
      updateInstallation: vi.fn(async () => ({
        installation: { id: "inst_123", xapp_id: "xapp_123", status: "updated" },
      })),
      uninstallInstallation: vi.fn(async () => ({ ok: true })),
    };

    const service = createEmbedHostProxyService({
      gatewayClient,
      gatewayUrl: "https://gateway.example.test",
      tokenRefreshTtlSeconds: 1200,
    });

    expect(service.getNoStoreHeaders()).toEqual({
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    expect(service.getHostConfig()).toEqual({
      ok: true,
      gatewayUrl: "https://gateway.example.test",
      hostModes: [
        { key: "single-panel", label: "Single Panel" },
        { key: "split-panel", label: "Split Panel" },
      ],
    });

    await expect(
      service.resolveSubject({ email: " User@Example.Test ", name: "Daniel" }),
    ).resolves.toEqual({
      subjectId: "sub_123",
      email: "user@example.test",
      name: "Daniel",
    });
    expect(gatewayClient.resolveSubject).toHaveBeenCalledWith({
      type: "user",
      identifier: {
        idType: "email",
        value: "user@example.test",
        hint: "user@example.test",
      },
      email: "user@example.test",
    });

    await expect(
      service.createCatalogSession({
        origin: "https://tenant.example.test",
        subjectId: "sub_123",
        xappId: "xapp_123",
        publishers: ["pub_a"],
        tags: ["featured"],
      }),
    ).resolves.toEqual({
      token: "catalog_token",
      embedUrl: "/embed/catalog?token=catalog_token",
    });

    await expect(
      service.createWidgetSession({
        installationId: "inst_123",
        widgetId: "widget_123",
        origin: "https://tenant.example.test",
        subjectId: "sub_123",
        hostReturnUrl: "https://tenant.example.test/return",
      }),
    ).resolves.toMatchObject({
      token: "widget_token",
      embedUrl:
        "/embed/widgets/widget_123?token=widget_token&xapps_host_return_url=https%3A%2F%2Ftenant.example.test%2Freturn",
      context: { installationId: "inst_123" },
    });
    expect(gatewayClient.createWidgetSession).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: "inst_123",
        widgetId: "widget_123",
        origin: "https://tenant.example.test",
        subjectId: "sub_123",
      }),
    );

    await expect(service.listInstallations({ subjectId: "sub_123" })).resolves.toEqual({
      items: [{ id: "inst_123", xapp_id: "xapp_123", status: "installed" }],
    });

    await expect(
      service.installXapp({ xappId: "xapp_123", subjectId: "sub_123", termsAccepted: true }),
    ).resolves.toEqual({
      installation: { id: "inst_123", xapp_id: "xapp_123", status: "installed" },
    });

    await expect(
      service.updateInstallation({
        installationId: "inst_123",
        subjectId: "sub_123",
        termsAccepted: true,
      }),
    ).resolves.toEqual({
      installation: { id: "inst_123", xapp_id: "xapp_123", status: "updated" },
    });

    await expect(
      service.uninstallInstallation({ installationId: "inst_123", subjectId: "sub_123" }),
    ).resolves.toEqual({ ok: true });

    await expect(
      service.refreshWidgetToken({
        installationId: "inst_123",
        widgetId: "widget_123",
        origin: "https://tenant.example.test",
        subjectId: "sub_123",
      }),
    ).resolves.toEqual({ token: "widget_token", expires_in: 1200 });
  });

  it("supports optional bridge handlers and rejects missing required inputs", async () => {
    const service = createEmbedHostProxyService({
      gatewayClient: {
        resolveSubject: vi.fn(),
        createCatalogSession: vi.fn(),
        createWidgetSession: vi.fn(async () => ({
          token: "widget_token",
          embedUrl: "https://gateway.example.test/embed/widgets/widget_123?token=widget_token",
        })),
        listInstallations: vi.fn(),
        installXapp: vi.fn(),
        updateInstallation: vi.fn(),
        uninstallInstallation: vi.fn(),
      },
      bridge: {
        sign: async () => ({ ok: true, envelope: { signed: true } }),
        vendorAssertion: async () => ({
          ok: true,
          vendor_assertion: "assertion_123",
          link_id: "link_123",
        }),
      },
    });

    await expect(service.resolveSubject({ email: "" })).rejects.toBeInstanceOf(
      EmbedHostProxyInputError,
    );
    await expect(
      service.createWidgetSession({
        installationId: "inst_123",
        widgetId: "widget_123",
        origin: "",
      }),
    ).rejects.toBeInstanceOf(EmbedHostProxyInputError);

    await expect(service.bridgeSign({ envelope: { precomputed: true } })).resolves.toEqual({
      ok: true,
      envelope: { precomputed: true },
    });
    await expect(service.bridgeSign({ data: { requestId: "req_123" } })).resolves.toEqual({
      ok: true,
      envelope: { signed: true },
    });
    await expect(
      service.bridgeVendorAssertion({ data: { publisherId: "pub_123" } }),
    ).resolves.toEqual({
      ok: true,
      vendor_assertion: "assertion_123",
      link_id: "link_123",
    });

    const unconfigured = createEmbedHostProxyService({
      gatewayClient: {
        resolveSubject: vi.fn(),
        createCatalogSession: vi.fn(),
        createWidgetSession: vi.fn(),
        listInstallations: vi.fn(),
        installXapp: vi.fn(),
        updateInstallation: vi.fn(),
        uninstallInstallation: vi.fn(),
      },
    });

    await expect(unconfigured.bridgeSign({ data: {} })).rejects.toBeInstanceOf(
      EmbedHostProxyNotConfiguredError,
    );
    await expect(unconfigured.bridgeVendorAssertion({ data: {} })).rejects.toBeInstanceOf(
      EmbedHostProxyNotConfiguredError,
    );
  });
});
