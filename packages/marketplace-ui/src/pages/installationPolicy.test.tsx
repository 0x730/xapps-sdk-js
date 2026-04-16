// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MarketplaceProvider } from "../MarketplaceContext";
import { shouldHideMarketplaceVersions } from "../utils/installationPolicy";
import { CatalogPage } from "./CatalogPage";
import { RequestDetailPage } from "./RequestDetailPage";
import { RequestsPage } from "./RequestsPage";
import { XappDetailPage } from "./XappDetailPage";

const cleanupFns: Array<() => void> = [];
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).React = React;

function findButtonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => (button.textContent || "").trim() === text,
  ) as HTMLButtonElement | null;
}

async function flushUi() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  while (cleanupFns.length > 0) {
    cleanupFns.pop()?.();
  }
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
});

describe("marketplace installation policy", () => {
  it("hides Added only and opens through auto-update in catalog auto-available mode", async () => {
    const requestUpdate = vi.fn();
    const openWidget = vi.fn();
    const client: any = {
      listCatalogXapps: async () => ({
        items: [
          {
            id: "xapp_1",
            slug: "demo-app",
            name: "Demo App",
            description: "Demo description",
            publisher: { slug: "demo-publisher", name: "Demo Publisher" },
            latest_version: { version: "1.1.0" },
            manifest: {
              title: { en: "Demo App" },
              description: { en: "Demo description" },
              widgets: [
                {
                  id: "widget_default",
                  default: true,
                  title: { en: "Main widget" },
                },
              ],
            },
          },
        ],
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      installationPolicy: {
        mode: "auto_available",
        update_mode: "auto_update_compatible",
      },
      canMutate: () => true,
      getInstallationsByXappId: () => ({
        xapp_1: {
          installationId: "inst_1",
          xappId: "xapp_1",
          updateAvailable: true,
        },
      }),
      refreshInstallations: () => {},
      requestInstall: vi.fn(),
      requestUpdate,
      requestUninstall: vi.fn(),
      openWidget,
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace" element={<CatalogPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await flushUi();

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    expect(host.textContent || "").not.toContain("Added only");

    const openButton = host.querySelector(
      ".mx-card-footer .mx-btn-primary",
    ) as HTMLButtonElement | null;
    expect(openButton).toBeTruthy();

    await act(async () => {
      openButton?.click();
    });

    expect(requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: "inst_1",
        xappId: "xapp_1",
        widgetId: "widget_default",
      }),
    );
    expect(openWidget).not.toHaveBeenCalled();
  });

  it("installs or updates the selected widget from xapp detail in auto-available mode", async () => {
    const requestInstall = vi.fn();
    const requestUpdate = vi.fn();
    const openWidget = vi.fn();
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
          version: "1.1.0",
        },
        manifest: {
          title: { en: "Demo App" },
          description: { en: "Demo description" },
        },
        tools: [],
        widgets: [
          {
            id: "widget_default",
            default: true,
            title: { en: "Main widget" },
            bind_tool_name: "main_tool",
          },
          {
            id: "widget_secondary",
            title: { en: "Secondary widget" },
            bind_tool_name: "secondary_tool",
          },
        ],
      }),
      getMyRequest: async () => ({}),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetization: async () => null,
    };

    const hostAdapter: any = {
      subjectId: "self",
      installationPolicy: {
        mode: "auto_available",
        update_mode: "auto_update_compatible",
      },
      canMutate: () => true,
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      requestInstall,
      requestUpdate,
      openWidget,
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
    await flushUi();

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const widgetCard = Array.from(host.querySelectorAll("button")).find((button) =>
      (button.textContent || "").includes("Secondary widget"),
    ) as HTMLButtonElement | null;
    expect(widgetCard).toBeTruthy();

    await act(async () => {
      widgetCard?.click();
    });

    expect(requestInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        xappId: "xapp_1",
        defaultWidgetId: "widget_secondary",
        openAfterInstall: true,
        subjectId: "self",
      }),
    );

    requestInstall.mockClear();
    requestUpdate.mockClear();

    const installedHostAdapter: any = {
      ...hostAdapter,
      getInstallationsByXappId: () => ({
        xapp_1: {
          installationId: "inst_1",
          xappId: "xapp_1",
          updateAvailable: true,
        },
      }),
    };

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/xapps/xapp_1"]}>
          <MarketplaceProvider client={client} host={installedHostAdapter}>
            <Routes>
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await flushUi();

    const secondaryWidgetCard = Array.from(host.querySelectorAll("button")).find((button) =>
      (button.textContent || "").includes("Secondary widget"),
    ) as HTMLButtonElement | null;
    expect(secondaryWidgetCard).toBeTruthy();

    await act(async () => {
      secondaryWidgetCard?.click();
    });

    expect(requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: "inst_1",
        xappId: "xapp_1",
        widgetId: "widget_secondary",
      }),
    );
    expect(openWidget).not.toHaveBeenCalled();
  });

  it("keeps manual catalog installs as install-only", async () => {
    const requestInstall = vi.fn();
    const client: any = {
      listCatalogXapps: async () => ({
        items: [
          {
            id: "xapp_1",
            slug: "demo-app",
            name: "Demo App",
            description: "Demo description",
            publisher: { slug: "demo-publisher", name: "Demo Publisher" },
            latest_version: { version: "1.0.0" },
            manifest: {
              title: { en: "Demo App" },
              description: { en: "Demo description" },
              terms: {},
              widgets: [{ id: "widget_default", default: true, title: { en: "Main widget" } }],
            },
          },
        ],
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      installationPolicy: {
        mode: "manual",
        update_mode: "manual",
      },
      canMutate: () => true,
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      requestInstall,
      requestUninstall: vi.fn(),
      openWidget: vi.fn(),
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace" element={<CatalogPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await flushUi();

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const addButton = findButtonByText(host, "Add app");
    expect(addButton).toBeTruthy();

    await act(async () => {
      addButton?.click();
    });

    expect(requestInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        xappId: "xapp_1",
        defaultWidgetId: "widget_default",
        openAfterInstall: false,
        subjectId: "self",
      }),
    );
  });

  it("suppresses mutation controls while installation policy is unresolved", async () => {
    const requestInstall = vi.fn();
    const client: any = {
      listCatalogXapps: async () => ({
        items: [
          {
            id: "xapp_1",
            slug: "demo-app",
            name: "Demo App",
            description: "Demo description",
            publisher: { slug: "demo-publisher", name: "Demo Publisher" },
            latest_version: { version: "1.0.0" },
            manifest: {
              title: { en: "Demo App" },
              description: { en: "Demo description" },
              widgets: [{ id: "widget_default", default: true, title: { en: "Main widget" } }],
            },
          },
        ],
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      installationPolicy: null,
      canMutate: () => true,
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      requestInstall,
      requestUninstall: vi.fn(),
      openWidget: vi.fn(),
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace"]}>
          <MarketplaceProvider
            client={client}
            host={hostAdapter}
            env={{ installationPolicyResolved: false }}
          >
            <Routes>
              <Route path="/marketplace" element={<CatalogPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await flushUi();

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    expect(host.textContent || "").not.toContain("Added only");
    expect(findButtonByText(host, "Add app")).toBeFalsy();
    expect(requestInstall).not.toHaveBeenCalled();
  });

  it("hides versions in catalog and xapp detail when auto-install and auto-update are enabled", async () => {
    const client: any = {
      listCatalogXapps: async () => ({
        items: [
          {
            id: "xapp_1",
            slug: "demo-app",
            name: "Demo App",
            description: "Demo description",
            publisher: { slug: "demo-publisher", name: "Demo Publisher" },
            latest_version: { version: "1.1.0" },
            manifest: {
              title: { en: "Demo App" },
              description: { en: "Demo description" },
              widgets: [{ id: "widget_default", default: true, title: { en: "Main widget" } }],
            },
          },
        ],
      }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_1",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          name: "Demo App",
        },
        version: { id: "ver_1", version: "1.1.0" },
        manifest: { title: { en: "Demo App" }, description: { en: "Demo description" } },
        tools: [],
        widgets: [],
      }),
      listMyRequests: async () => ({ items: [] }),
      getWidgetToken: async () => ({ token: "widget-token" }),
      getMyXappMonetization: async () => null,
    };

    const hostAdapter: any = {
      subjectId: "self",
      installationPolicy: {
        mode: "auto_available",
        update_mode: "auto_update_compatible",
      },
      canMutate: () => true,
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      requestInstall: vi.fn(),
      requestUninstall: vi.fn(),
      openWidget: vi.fn(),
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace" element={<CatalogPage />} />
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await flushUi();
    expect(host.textContent || "").not.toContain("v1.1.0");

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/xapps/xapp_1"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace" element={<CatalogPage />} />
              <Route path="/marketplace/xapps/:xappId" element={<XappDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await flushUi();
    expect(host.textContent || "").not.toContain("v1.1.0");
  });

  it("hides versions in requests and request detail when auto-install and auto-update are enabled", async () => {
    const client: any = {
      listMyRequests: async () => ({
        items: [
          {
            id: "req_1",
            xapp_id: "xapp_1",
            xapp_name: "Demo App",
            xapp_version: "1.1.0",
            status: "COMPLETED",
            created_at: "2026-01-01T10:00:00.000Z",
          },
        ],
        pagination: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
      }),
      getCatalogXapp: async () => ({
        xapp: { id: "xapp_1", name: "Demo App" },
        version: { id: "ver_1", version: "1.1.0" },
        manifest: { title: { en: "Demo App" } },
        tools: [],
        widgets: [],
      }),
      getMyRequest: async () => ({
        request: {
          id: "req_1",
          xapp_id: "xapp_1",
          xapp_name: "Demo App",
          xapp_version: "1.1.0",
          status: "COMPLETED",
        },
        manifest: { title: { en: "Demo App" } },
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      installationPolicy: {
        mode: "auto_available",
        update_mode: "auto_update_compatible",
      },
      canMutate: () => true,
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      notifyNavigation: vi.fn(),
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/requests?xappId=xapp_1"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/requests" element={<RequestsPage />} />
              <Route path="/marketplace/requests/:id" element={<RequestDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await flushUi();
    expect(host.textContent || "").not.toContain("Version");
    expect(host.textContent || "").not.toContain("v1.1.0");

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/requests/req_1?xappId=xapp_1"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/requests" element={<RequestsPage />} />
              <Route path="/marketplace/requests/:id" element={<RequestDetailPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await flushUi();
    expect(host.textContent || "").not.toContain("v1.1.0");
  });

  it("hides versions even when the host does not expose a subject id yet", async () => {
    expect(
      shouldHideMarketplaceVersions({
        installationPolicy: {
          mode: "auto_available",
          update_mode: "auto_update_compatible",
        } as any,
        installationPolicyResolved: true,
        subjectId: "",
      }),
    ).toBe(true);
  });
});
