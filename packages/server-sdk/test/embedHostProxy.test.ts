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
      getEmbedMyXappMonetizationHistory: vi.fn(async () => ({
        xapp_id: "xapp_123",
        version_id: "ver_123",
        history: {
          purchase_intents: { total: 1, items: [{ id: "intent_123" }] },
        },
      })),
      cancelEmbedMyXappSubscriptionContract: vi.fn(async () => ({
        subscription_contract: { id: "contract_123", status: "cancelled" },
      })),
      refreshEmbedMyXappSubscriptionContractState: vi.fn(async () => ({
        subscription_contract: { id: "contract_123", status: "active" },
        current_subscription: { id: "contract_123", status: "active" },
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
      runWidgetToolRequest: vi.fn(async () => ({
        profile_id: "profile_123",
        source: "subject_self_profile",
      })),
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

    const dynamicService = createEmbedHostProxyService({
      gatewayClient,
      gatewayUrl: "https://gateway.example.test",
      resolveInstallationPolicy: async () => ({
        mode: "auto_available",
        update_mode: "auto_update_compatible",
      }),
    });
    await expect(dynamicService.getHostConfigForRequest()).resolves.toEqual({
      ok: true,
      gatewayUrl: "https://gateway.example.test",
      hostModes: [
        { key: "single-panel", label: "Single Panel" },
        { key: "split-panel", label: "Split Panel" },
      ],
      installationPolicy: {
        mode: "auto_available",
        update_mode: "auto_update_compatible",
      },
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
      },
      email: "user@example.test",
    });

    await expect(
      service.resolveSubject({
        type: "business_member",
        identifier: {
          idType: "tenant_member_id",
          value: "acct-123",
          hint: "Account 123",
        },
        email: "billing@example.test",
        metadata: { company_ref: "company_a" },
        linkId: "tenant-link-123",
      }),
    ).resolves.toEqual({
      subjectId: "sub_123",
      email: "billing@example.test",
      name: null,
    });
    expect(gatewayClient.resolveSubject).toHaveBeenCalledWith({
      type: "business_member",
      identifier: {
        idType: "tenant_member_id",
        value: "acct-123",
        hint: "Account 123",
      },
      email: "billing@example.test",
      metadata: { company_ref: "company_a" },
      linkId: "tenant-link-123",
    });

    gatewayClient.resolveSubject.mockResolvedValueOnce({ subjectId: "sub_direct" });
    await expect(
      service.resolveSubject({
        subjectId: "sub_direct",
        email: "billing@example.test",
      }),
    ).resolves.toEqual({
      subjectId: "sub_direct",
      email: "billing@example.test",
      name: null,
    });
    expect(gatewayClient.resolveSubject).toHaveBeenCalledWith({
      type: "user",
      identifier: {
        idType: "email",
        value: "billing@example.test",
      },
      email: "billing@example.test",
    });

    await expect(
      service.createCatalogSession({
        origin: "https://tenant.example.test",
        subjectId: "sub_123",
        xappId: "xapp_123",
        publishers: ["pub_a"],
        tags: ["featured"],
        customerProfile: {
          profile_family: "billing_business",
          country_code: "RO",
        },
      }),
    ).resolves.toEqual({
      token: "catalog_token",
      embedUrl: "/embed/catalog?token=catalog_token",
    });
    expect(gatewayClient.createCatalogSession).toHaveBeenCalledWith({
      origin: "https://tenant.example.test",
      subjectId: "sub_123",
      xappId: "xapp_123",
      publishers: ["pub_a"],
      tags: ["featured"],
      customerProfile: {
        profile_family: "billing_business",
        country_code: "RO",
      },
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

    await expect(
      service.runWidgetToolRequest({
        token: "widget_token",
        installationId: "inst_123",
        toolName: "complete_subject_profile",
        payload: { source: "subject_self_profile" },
      }),
    ).resolves.toEqual({
      profile_id: "profile_123",
      source: "subject_self_profile",
    });

    await expect(
      service.getMyXappMonetizationHistory({
        xappId: "xapp_123",
        token: "widget_token",
        installationId: "inst_123",
        limit: 8,
      }),
    ).resolves.toEqual({
      xapp_id: "xapp_123",
      version_id: "ver_123",
      history: {
        purchase_intents: { total: 1, items: [{ id: "intent_123" }] },
      },
    });
    expect(gatewayClient.getEmbedMyXappMonetizationHistory).toHaveBeenCalledWith({
      xappId: "xapp_123",
      token: "widget_token",
      limit: 8,
    });

    await expect(
      service.refreshMyXappSubscriptionContractState({
        xappId: "xapp_123",
        contractId: "contract_123",
        token: "widget_token",
      }),
    ).resolves.toEqual({
      subscription_contract: { id: "contract_123", status: "active" },
      current_subscription: { id: "contract_123", status: "active" },
    });
    expect(gatewayClient.refreshEmbedMyXappSubscriptionContractState).toHaveBeenCalledWith({
      xappId: "xapp_123",
      contractId: "contract_123",
      token: "widget_token",
    });

    await expect(
      service.cancelMyXappSubscriptionContract({
        xappId: "xapp_123",
        contractId: "contract_123",
        token: "widget_token",
      }),
    ).resolves.toEqual({
      subscription_contract: { id: "contract_123", status: "cancelled" },
    });
    expect(gatewayClient.cancelEmbedMyXappSubscriptionContract).toHaveBeenCalledWith({
      xappId: "xapp_123",
      contractId: "contract_123",
      token: "widget_token",
    });
  });

  it("supports optional bridge handlers and rejects missing required inputs", async () => {
    const mismatchGatewayClient = {
      resolveSubject: vi.fn(async () => ({ subjectId: "sub_other" })),
      createCatalogSession: vi.fn(),
      createWidgetSession: vi.fn(async () => ({
        token: "widget_token",
        embedUrl: "https://gateway.example.test/embed/widgets/widget_123?token=widget_token",
      })),
      getEmbedMyXappMonetizationHistory: vi.fn(),
      cancelEmbedMyXappSubscriptionContract: vi.fn(),
      refreshEmbedMyXappSubscriptionContractState: vi.fn(),
      listInstallations: vi.fn(),
      installXapp: vi.fn(),
      updateInstallation: vi.fn(),
      uninstallInstallation: vi.fn(),
      runWidgetToolRequest: vi.fn(),
    };
    const service = createEmbedHostProxyService({
      gatewayClient: {
        resolveSubject: vi.fn(),
        createCatalogSession: vi.fn(),
        createWidgetSession: vi.fn(async () => ({
          token: "widget_token",
          embedUrl: "https://gateway.example.test/embed/widgets/widget_123?token=widget_token",
        })),
        getEmbedMyXappMonetizationHistory: vi.fn(),
        cancelEmbedMyXappSubscriptionContract: vi.fn(),
        refreshEmbedMyXappSubscriptionContractState: vi.fn(),
        listInstallations: vi.fn(),
        installXapp: vi.fn(),
        updateInstallation: vi.fn(),
        uninstallInstallation: vi.fn(),
        runWidgetToolRequest: vi.fn(),
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
    await expect(service.resolveSubject({ subjectId: "sub_direct" })).rejects.toBeInstanceOf(
      EmbedHostProxyInputError,
    );
    const mismatchService = createEmbedHostProxyService({
      gatewayClient: mismatchGatewayClient,
    });
    await expect(
      mismatchService.resolveSubject({
        subjectId: "sub_direct",
        email: "billing@example.test",
      }),
    ).rejects.toMatchObject({
      name: "EmbedHostProxyInputError",
      status: 403,
    });
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
        getEmbedMyXappMonetizationHistory: vi.fn(),
        cancelEmbedMyXappSubscriptionContract: vi.fn(),
        refreshEmbedMyXappSubscriptionContractState: vi.fn(),
        listInstallations: vi.fn(),
        installXapp: vi.fn(),
        updateInstallation: vi.fn(),
        uninstallInstallation: vi.fn(),
        runWidgetToolRequest: vi.fn(),
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
