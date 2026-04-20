// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapXappsSurfaceSession, mountXappsSurface } from "./src/embed-surface.js";
import { clearStoredHostIdentity, readActiveHostIdentity } from "./src/launcher-core.js";

function mockJsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const status = init.status ?? (init.ok === false ? 500 : 200);
  const ok = init.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return mockJsonResponse(body, { ok: this.ok, status: this.status });
    },
  } as Response;
}

function createSdkStub(overrides: Record<string, unknown> = {}) {
  return {
    createHostDomUiController: () => ({
      bridgeOptions: {},
      showNotification: vi.fn(),
      destroy: vi.fn(),
    }),
    createHostPaymentResumeState: () => ({
      getResume: () => null,
      getPendingPaymentParams: () => new URLSearchParams(),
      buildHostReturnUrl: ({ baseUrl }: { baseUrl: string }) => String(baseUrl || ""),
    }),
    createHostApiClient: ({ fetchImpl }: { fetchImpl: typeof fetch }) => {
      return async (path: string, payload?: unknown, init: RequestInit = {}) => {
        const response = await fetchImpl(path, {
          ...(init || {}),
          method: init.method || (payload !== undefined ? "POST" : "GET"),
          headers: {
            ...((init.headers as Record<string, string>) || {}),
            ...(payload !== undefined &&
            !(init && Object.prototype.hasOwnProperty.call(init, "body"))
              ? { "Content-Type": "application/json" }
              : {}),
          },
          body:
            init && Object.prototype.hasOwnProperty.call(init, "body")
              ? init.body
              : payload !== undefined
                ? JSON.stringify(payload)
                : undefined,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String((data as any)?.message || `${String(path || "")} failed`));
        }
        return data;
      };
    },
    createStandardMarketplaceRuntime: vi.fn(),
    createEmbedHostWidgetContext: () => {
      let current = { installationId: null, widgetId: null, xappId: null };
      return {
        get: () => current,
        set: (next: Record<string, unknown>) => {
          current = { ...current, ...(next || {}) } as any;
        },
        reset: () => {
          current = { installationId: null, widgetId: null, xappId: null };
        },
      };
    },
    createMutationFailureCallbacks: () => ({}),
    createEmbedHost: () => ({
      mountXapp: vi.fn(async () => {}),
      readPendingResumeTarget: () => null,
      resumeCatalogWidget: vi.fn(),
      destroy: vi.fn(),
      emitSessionExpired: vi.fn(),
      emitLocaleChanged: vi.fn(),
      setLocale: vi.fn(),
    }),
    ...overrides,
  };
}

afterEach(() => {
  clearStoredHostIdentity("xapps_test_embed_surface");
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("@xapps-platform/browser-host embed surface", () => {
  it("bootstraps and stores a host session from identity input", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/browser/host-bootstrap");
      return mockJsonResponse({
        subjectId: "sub_123",
        bootstrapToken: "token_123",
        expiresIn: 300,
        email: "alex@example.com",
      });
    });

    const identity = await bootstrapXappsSurfaceSession(
      {
        identifier: {
          idType: "tenant_member_id",
          value: "acct-company-a-user-42",
        },
        email: "alex@example.com",
      },
      {
        hostBootstrapUrl: "/api/browser/host-bootstrap",
        identityStorageKey: "xapps_test_embed_surface",
        fetchImpl: fetchMock as unknown as typeof fetch,
      },
    );

    expect(identity.subjectId).toBe("sub_123");
    expect(identity.bootstrapToken).toBe("token_123");
    expect(readActiveHostIdentity("xapps_test_embed_surface")?.subjectId).toBe("sub_123");
  });

  it("mounts marketplace surfaces into caller-provided DOM nodes", async () => {
    const container = document.createElement("div");
    const widgetContainer = document.createElement("div");
    document.body.appendChild(container);
    document.body.appendChild(widgetContainer);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/browser/host-bootstrap") {
        return mockJsonResponse({
          subjectId: "sub_marketplace",
          bootstrapToken: "token_marketplace",
          expiresIn: 300,
        });
      }
      if (url === "https://tenant.example/api/host-session/exchange") {
        expect(init?.credentials).toBe("include");
        expect((init?.headers as Record<string, string>)?.["X-Xapps-Host-Bootstrap"]).toBe(
          "token_marketplace",
        );
        return mockJsonResponse({
          ok: true,
          subjectId: "sub_marketplace",
          expiresIn: 1800,
          sessionMode: "host_session",
        });
      }
      if (url === "https://tenant.example/api/host-config") {
        expect(init?.credentials).toBe("include");
        expect((init?.headers as Record<string, string>)?.["X-Xapps-Host-Bootstrap"]).toBeFalsy();
        return mockJsonResponse({
          gatewayUrl: "https://gateway.example",
          installationPolicy: { mode: "manual" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const runtime = {
      mount: vi.fn(async () => {}),
      destroy: vi.fn(),
      setLocale: vi.fn(),
      emitLocaleChanged: vi.fn(),
      emitSessionExpired: vi.fn(),
    };
    const createMarketplaceRuntime = vi.fn(() => runtime);

    const controller = await mountXappsSurface({
      surface: "marketplace",
      backendBaseUrl: "https://tenant.example",
      container,
      widgetContainer,
      mode: "split-panel",
      identityStorageKey: "xapps_test_embed_surface",
      hostBootstrapUrl: "/api/browser/host-bootstrap",
      identity: {
        identifier: {
          idType: "tenant_member_id",
          value: "acct-company-a-user-42",
        },
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
      sdkLoader: async () => createSdkStub(),
      createMarketplaceRuntime,
    });

    expect(createMarketplaceRuntime).toHaveBeenCalledTimes(1);
    const runtimeOptions = createMarketplaceRuntime.mock.calls[0]?.[0];
    expect(runtimeOptions.currentSubjectId).toBe("sub_marketplace");
    expect(runtimeOptions.gatewayBaseUrl).toBe("https://gateway.example");
    expect(runtimeOptions.hostApiCredentials).toBe("include");
    expect(runtimeOptions.getCatalogMount()).toBe(container);
    expect(runtimeOptions.getWidgetMount()).toBe(widgetContainer);
    expect(runtime.mount).toHaveBeenCalledWith("split-panel");
    expect(controller.getIdentity()?.subjectId).toBe("sub_marketplace");
    controller.destroy();
    expect(runtime.destroy).toHaveBeenCalledTimes(1);
  });

  it("logs out host-session surfaces through the backend and clears local identity", async () => {
    const container = document.createElement("div");
    const widgetContainer = document.createElement("div");
    document.body.appendChild(container);
    document.body.appendChild(widgetContainer);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/browser/host-bootstrap") {
        return mockJsonResponse({
          subjectId: "sub_marketplace",
          bootstrapToken: "token_marketplace",
          expiresIn: 300,
        });
      }
      if (url === "https://tenant.example/api/host-session/exchange") {
        return mockJsonResponse({
          ok: true,
          subjectId: "sub_marketplace",
          expiresIn: 1800,
          sessionMode: "host_session",
        });
      }
      if (url === "https://tenant.example/api/host-session/logout") {
        expect(init?.credentials).toBe("include");
        return mockJsonResponse({
          ok: true,
          status: "revoked",
          sessionMode: "host_session",
        });
      }
      if (url === "https://tenant.example/api/host-config") {
        return mockJsonResponse({
          gatewayUrl: "https://gateway.example",
          installationPolicy: { mode: "manual" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const runtime = {
      mount: vi.fn(async () => {}),
      destroy: vi.fn(),
      setLocale: vi.fn(),
      emitLocaleChanged: vi.fn(),
      emitSessionExpired: vi.fn(),
    };
    const createMarketplaceRuntime = vi.fn(() => runtime);

    const controller = await mountXappsSurface({
      surface: "marketplace",
      backendBaseUrl: "https://tenant.example",
      container,
      widgetContainer,
      mode: "single-panel",
      identityStorageKey: "xapps_test_embed_surface",
      hostBootstrapUrl: "/api/browser/host-bootstrap",
      identity: {
        identifier: {
          idType: "tenant_member_id",
          value: "acct-company-a-user-42",
        },
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
      sdkLoader: async () => createSdkStub(),
      createMarketplaceRuntime,
    });

    expect(controller.getIdentity()?.subjectId).toBe("sub_marketplace");
    await controller.logout();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tenant.example/api/host-session/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(controller.getIdentity()).toBeNull();
    expect(readActiveHostIdentity("xapps_test_embed_surface")).toBeNull();
    expect(runtime.emitSessionExpired).toHaveBeenCalledWith("logout");
    expect(container.textContent).toContain("Session ended");
  });

  it("logs out through an explicit host-session logout path even without local exchange state", async () => {
    const container = document.createElement("div");
    const widgetContainer = document.createElement("div");
    document.body.appendChild(container);
    document.body.appendChild(widgetContainer);

    window.localStorage.setItem(
      "xapps_test_embed_surface",
      JSON.stringify({
        subjectId: "sub_same_origin",
        email: "user@xconect-demo.test",
        resolvedAt: new Date().toISOString(),
      }),
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "http://localhost:3312/api/host-config") {
        return mockJsonResponse({
          gatewayUrl: "http://localhost:3000",
          installationPolicy: { mode: "manual" },
        });
      }
      if (url === "http://localhost:3312/api/host-session/logout") {
        expect(init?.credentials).toBe("include");
        return mockJsonResponse({
          ok: true,
          status: "revoked",
          sessionMode: "host_session",
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const runtime = {
      mount: vi.fn(async () => {}),
      destroy: vi.fn(),
      setLocale: vi.fn(),
      emitLocaleChanged: vi.fn(),
      emitSessionExpired: vi.fn(),
    };
    const createMarketplaceRuntime = vi.fn(() => runtime);

    const controller = await mountXappsSurface({
      surface: "marketplace",
      backendBaseUrl: "http://localhost:3312",
      container,
      widgetContainer,
      mode: "single-panel",
      identityStorageKey: "xapps_test_embed_surface",
      hostSessionLogoutPath: "http://localhost:3312/api/host-session/logout",
      fetchImpl: fetchMock as unknown as typeof fetch,
      sdkLoader: async () => createSdkStub(),
      createMarketplaceRuntime,
    });

    await controller.logout();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3312/api/host-session/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(controller.getIdentity()).toBeNull();
    expect(readActiveHostIdentity("xapps_test_embed_surface")).toBeNull();
  });

  it("mounts single-xapp surfaces from direct bootstrap state", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const mountXapp = vi.fn(async () => {});
    const createEmbedHost = vi.fn(() => ({
      mountXapp,
      readPendingResumeTarget: () => null,
      resumeCatalogWidget: vi.fn(),
      destroy: vi.fn(),
      emitSessionExpired: vi.fn(),
      emitLocaleChanged: vi.fn(),
      setLocale: vi.fn(),
    }));

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://tenant.example/api/host-config") {
        expect((init?.headers as Record<string, string>)?.["X-Xapps-Host-Bootstrap"]).toBe(
          "token_single_xapp",
        );
        return mockJsonResponse({
          gatewayUrl: "https://gateway.example",
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const controller = await mountXappsSurface({
      surface: "single-xapp",
      backendBaseUrl: "https://tenant.example",
      container,
      xappId: "xapp_123",
      identityStorageKey: "xapps_test_embed_surface",
      identity: {
        subjectId: "sub_single_xapp",
        bootstrapToken: "token_single_xapp",
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
      sdkLoader: async () =>
        createSdkStub({
          createEmbedHost,
        }),
    });

    expect(createEmbedHost).toHaveBeenCalledTimes(1);
    const hostOptions = createEmbedHost.mock.calls[0]?.[0];
    expect(hostOptions.container).toBe(container);
    expect(hostOptions.subjectId).toBe("sub_single_xapp");
    expect(hostOptions.apiBasePath).toBe("https://tenant.example/api");
    expect(mountXapp).toHaveBeenCalledWith("xapp_123");
    controller.destroy();
  });

  it("mounts same-origin marketplace surfaces from stored resolved subject identity without bootstrap state", async () => {
    const container = document.createElement("div");
    const widgetContainer = document.createElement("div");
    document.body.appendChild(container);
    document.body.appendChild(widgetContainer);

    window.localStorage.setItem(
      "xapps_test_embed_surface",
      JSON.stringify({
        subjectId: "sub_same_origin",
        email: "user@xconect-demo.test",
        resolvedAt: new Date().toISOString(),
      }),
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "http://localhost:3312/api/host-config") {
        expect((init?.headers as Record<string, string>)?.["X-Xapps-Host-Bootstrap"]).toBeFalsy();
        return mockJsonResponse({
          gatewayUrl: "http://localhost:3000",
          installationPolicy: { mode: "manual" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const runtime = {
      mount: vi.fn(async () => {}),
      destroy: vi.fn(),
      setLocale: vi.fn(),
      emitLocaleChanged: vi.fn(),
      emitSessionExpired: vi.fn(),
    };
    const createMarketplaceRuntime = vi.fn(() => runtime);

    const controller = await mountXappsSurface({
      surface: "marketplace",
      backendBaseUrl: "http://localhost:3312",
      container,
      widgetContainer,
      mode: "single-panel",
      identityStorageKey: "xapps_test_embed_surface",
      fetchImpl: fetchMock as unknown as typeof fetch,
      sdkLoader: async () => createSdkStub(),
      createMarketplaceRuntime,
    });

    expect(createMarketplaceRuntime).toHaveBeenCalledTimes(1);
    expect(controller.getIdentity()?.subjectId).toBe("sub_same_origin");
    expect(runtime.mount).toHaveBeenCalledWith("single-panel");
    controller.destroy();
  });

  it("requires host-session exchange for hosted-mode surfaces", async () => {
    const container = document.createElement("div");
    const widgetContainer = document.createElement("div");
    document.body.appendChild(container);
    document.body.appendChild(widgetContainer);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/browser/host-bootstrap") {
        return mockJsonResponse({
          subjectId: "sub_marketplace",
          bootstrapToken: "token_marketplace",
          expiresIn: 300,
        });
      }
      if (url === "https://tenant.example/api/host-session/exchange") {
        return mockJsonResponse({ message: "not found" }, { status: 404, ok: false });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    await expect(
      mountXappsSurface({
        surface: "marketplace",
        backendBaseUrl: "https://tenant.example",
        container,
        widgetContainer,
        mode: "single-panel",
        identityStorageKey: "xapps_test_embed_surface",
        hostBootstrapUrl: "/api/browser/host-bootstrap",
        identity: {
          identifier: {
            idType: "tenant_member_id",
            value: "acct-company-a-user-42",
          },
        },
        fetchImpl: fetchMock as unknown as typeof fetch,
        sdkLoader: async () => createSdkStub(),
        createMarketplaceRuntime: vi.fn(),
      }),
    ).rejects.toThrow("host session exchange is required but not available");
  });
});
