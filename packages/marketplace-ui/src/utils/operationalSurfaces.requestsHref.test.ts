import { describe, expect, it } from "vitest";
import { buildOperationalSurfaceHref } from "./operationalSurfaces";

describe("buildOperationalSurfaceHref", () => {
  it("builds the sibling requests route for portal activity links", () => {
    expect(
      buildOperationalSurfaceHref({
        surface: "requests",
        xappId: "01TESTXAPP",
        isEmbedded: false,
      }),
    ).toBe("/marketplace/requests?xappId=01TESTXAPP");
  });

  it("preserves the embed/portal token query when present", () => {
    expect(
      buildOperationalSurfaceHref({
        surface: "requests",
        xappId: "01TESTXAPP",
        token: "tok123",
        isEmbedded: false,
      }),
    ).toBe("/marketplace/requests?xappId=01TESTXAPP&token=tok123");
  });

  it("builds the shared monetization route for portal activity links", () => {
    expect(
      buildOperationalSurfaceHref({
        surface: "monetization",
        xappId: "01TESTXAPP",
        token: "tok123",
        isEmbedded: false,
      }),
    ).toBe("/marketplace/monetization?xappId=01TESTXAPP&token=tok123");
  });
});
