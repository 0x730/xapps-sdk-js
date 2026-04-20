import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildStoredHostIdentity,
  clearStoredHostIdentity,
  createHostIdentityAdapters,
  DEFAULT_IDENTITY_STORAGE_KEY,
  executeHostBootstrap,
  normalizeHostIdentityInput,
  readActiveHostIdentity,
  readRecoverableHostIdentity,
  refreshStoredHostIdentity,
  writeStoredHostIdentity,
} from "./src/launcher-core.js";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? String(store.get(key)) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  if (typeof originalWindow === "undefined") {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
  if (typeof originalFetch === "undefined") {
    delete globalThis.fetch;
  } else {
    globalThis.fetch = originalFetch;
  }
});

describe("@xapps-platform/browser-host launcher core", () => {
  it("uses a generic default storage key", () => {
    expect(DEFAULT_IDENTITY_STORAGE_KEY).toBe("xapps_host_identity_v1");
  });

  it("normalizes host identity input", () => {
    expect(
      normalizeHostIdentityInput({
        subjectId: " sub_1 ",
        type: " business_member ",
        identifier: {
          idType: " tenant_member_id ",
          value: " acct-a ",
          hint: " Company A ",
        },
        email: " USER@Example.com ",
        name: " Alex Example ",
        metadata: { company: "A" },
      }),
    ).toEqual({
      subjectId: "sub_1",
      type: "business_member",
      identifier: {
        idType: "tenant_member_id",
        value: "acct-a",
        hint: "Company A",
      },
      email: "user@example.com",
      name: "Alex Example",
      metadata: { company: "A" },
    });
  });

  it("reads active host identity and ignores expired tokens", () => {
    globalThis.window = {
      localStorage: createStorage(),
    } as any;
    writeStoredHostIdentity("host_identity", {
      subjectId: "sub_1",
      bootstrapToken: "token_1",
      bootstrapExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    expect(readActiveHostIdentity("host_identity")).toBeNull();
  });

  it("recovers host identity from storage or current url subject id", () => {
    globalThis.window = {
      localStorage: createStorage(),
      location: { href: "http://localhost/marketplace.html?subjectId=sub_url" },
    } as any;

    expect(readRecoverableHostIdentity("host_identity")?.subjectId).toBe("sub_url");

    writeStoredHostIdentity("host_identity", {
      subjectId: "sub_stored",
      bootstrapToken: "token_1",
    });

    expect(readRecoverableHostIdentity("host_identity")?.subjectId).toBe("sub_stored");
  });

  it("executes host bootstrap and normalizes the response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          subjectId: "sub_2",
          bootstrapToken: "token_2",
          expiresIn: 120,
          email: "user@example.com",
        }),
    }));

    await expect(
      executeHostBootstrap(
        {
          identifier: {
            idType: "tenant_member_id",
            value: "acct-b",
          },
          email: "USER@example.com",
        },
        { fetchImpl: fetchMock as any, hostBootstrapUrl: "/api/browser/host-bootstrap" },
      ),
    ).resolves.toEqual({
      subjectId: "sub_2",
      bootstrapToken: "token_2",
      expiresIn: 120,
      email: "user@example.com",
      name: null,
    });
  });

  it("refreshes stored host identity through host bootstrap", async () => {
    globalThis.window = {
      localStorage: createStorage(),
    } as any;
    writeStoredHostIdentity(
      "host_identity",
      buildStoredHostIdentity(
        null,
        {
          subjectId: "sub_3",
          bootstrapToken: "token_old",
          expiresIn: 60,
          email: "user@example.com",
          name: "Alex",
        },
        {
          type: "business_member",
          identifier: {
            idType: "tenant_member_id",
            value: "acct-c",
          },
          email: "user@example.com",
          name: "Alex",
        },
      ),
    );

    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          subjectId: "sub_3",
          bootstrapToken: "token_new",
          expiresIn: 300,
        }),
    }));

    const next = await refreshStoredHostIdentity(
      "host_identity",
      "/api/browser/host-bootstrap",
      fetchMock as any,
    );

    expect(next.subjectId).toBe("sub_3");
    expect(next.bootstrapToken).toBe("token_new");
    expect(next.identifier).toEqual({
      idType: "tenant_member_id",
      value: "acct-c",
    });
    expect(readActiveHostIdentity("host_identity")?.bootstrapToken).toBe("token_new");
    clearStoredHostIdentity("host_identity");
    expect(readActiveHostIdentity("host_identity")).toBeNull();
  });

  it("builds wrapper identity adapters", async () => {
    const readIdentity = vi.fn(() => ({ subjectId: "sub_adapter" }));
    const refreshIdentity = vi.fn(async () => ({ subjectId: "sub_refreshed" }));
    const adapters = createHostIdentityAdapters("host_identity", {
      readIdentity,
      refreshIdentity,
    });

    expect(adapters.readStoredJson("ignored")).toEqual({ subjectId: "sub_adapter" });
    await expect(adapters.refreshStoredJson?.("ignored")).resolves.toEqual({
      subjectId: "sub_refreshed",
    });
    expect(readIdentity).toHaveBeenCalledWith("host_identity");
    expect(refreshIdentity).toHaveBeenCalledWith("host_identity");
  });
});
