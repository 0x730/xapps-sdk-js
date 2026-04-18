import { describe, expect, it } from "vitest";

describe("@xapps-platform/browser-host root import", () => {
  it("does not execute browser-only page controllers on import", async () => {
    const mod = await import("./src/index.ts");

    expect(typeof mod.bootstrapXappsEmbedSession).toBe("function");
    expect(typeof mod.mountCatalogEmbed).toBe("function");
    expect(typeof mod.mountSingleXappEmbed).toBe("function");
    expect(typeof mod.createModalShell).toBe("function");
    expect(typeof mod.renderHostStatus).toBe("undefined");
    expect(typeof mod.createHostShellApi).toBe("undefined");
    expect(typeof mod.bootMarketplaceHost).toBe("undefined");
  });
});
