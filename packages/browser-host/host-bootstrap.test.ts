import { afterEach, describe, expect, it, vi } from "vitest";
import { bootMarketplaceHost } from "./src/marketplace-host.js";
import { bootSingleXappHost } from "./src/single-xapp-host.js";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;

function setMockWindow(href: string) {
  const url = new URL(href);
  const replace = vi.fn();
  globalThis.window = {
    location: {
      href: url.toString(),
      pathname: url.pathname,
      search: url.search,
      replace,
    },
    addEventListener: vi.fn(),
    document: {},
  } as any;
  return { replace, url };
}

afterEach(() => {
  vi.restoreAllMocks();
  if (typeof originalWindow === "undefined") {
    delete (globalThis as any).window;
  } else {
    globalThis.window = originalWindow;
  }
  if (typeof originalFetch === "undefined") {
    delete (globalThis as any).fetch;
  } else {
    globalThis.fetch = originalFetch;
  }
});

describe("@xapps-platform/browser-host bootstrap helpers", () => {
  it("redirects marketplace hosts back to entryHref when identity is missing", async () => {
    const { replace } = setMockWindow("http://localhost:8001/marketplace.html?mode=split-panel");

    await bootMarketplaceHost({
      identityStorageKey: "xconectc-proof-identity",
      entryHref: "/catalog",
      readStoredJson: () => null,
    } as any);

    expect(replace).toHaveBeenCalledTimes(1);
    const redirected = new URL(String(replace.mock.calls[0][0]));
    expect(redirected.pathname).toBe("/catalog");
    expect(redirected.searchParams.get("hostError")).toBe("missing_identity");
    expect(redirected.searchParams.get("next")).toBe("/marketplace.html?mode=split-panel");
  });

  it("redirects single-xapp hosts back to entryHref when identity is missing", async () => {
    const { replace } = setMockWindow("http://localhost:8001/single-xapp.html?xappId=xapp_123");

    await bootSingleXappHost({
      identityStorageKey: "xconectc-proof-identity",
      entryHref: "/catalog",
      readStoredJson: () => null,
    } as any);

    expect(replace).toHaveBeenCalledTimes(1);
    const redirected = new URL(String(replace.mock.calls[0][0]));
    expect(redirected.pathname).toBe("/catalog");
    expect(redirected.searchParams.get("hostError")).toBe("missing_identity");
    expect(redirected.searchParams.get("next")).toBe("/single-xapp.html?xappId=xapp_123");
  });

  it("forwards the bootstrap token to host-config requests", async () => {
    setMockWindow("http://localhost:3412/marketplace.html?mode=single-panel");
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ message: "stop" }),
    }));
    globalThis.fetch = fetchMock as any;

    await expect(
      bootMarketplaceHost({
        identityStorageKey: "xconect_reference_host_identity_v1",
        readStoredJson: () => ({
          email: "daniel@example.com",
          subjectId: "sub_123",
          bootstrapToken: "token_123",
        }),
        applyThemePreference: () => "harbor",
        readThemePreference: () => "harbor",
        renderIdentity: () => {},
        setHeaderCollapsed: () => {},
        readHeaderCollapsedPreference: () => false,
        readModeFromUrl: () => "single-panel",
        renderMode: () => {},
        renderModeShell: () => {},
        setModeInUrl: () => {},
        toggleHeaderCollapsed: () => {},
        createMarketplaceRuntime: () => ({
          mount: async () => {},
          destroy: () => {},
        }),
      } as any),
    ).rejects.toThrow("stop");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/host-config",
      expect.objectContaining({
        method: "GET",
        headers: { "X-Xapps-Host-Bootstrap": "token_123" },
      }),
    );
  });
});
