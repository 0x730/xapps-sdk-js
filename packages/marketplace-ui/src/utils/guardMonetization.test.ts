import { describe, expect, it } from "vitest";
import { describeGuardCurrentAccess, readGuardHasCurrentAccess } from "./guardMonetization";

describe("marketplace-ui guard monetization utilities", () => {
  it("reads has_current_access from nested guard details", () => {
    expect(
      readGuardHasCurrentAccess({
        details: {
          monetization_state: {
            has_current_access: true,
          },
        },
      }),
    ).toBe(true);
  });

  it("formats current access labels", () => {
    expect(
      describeGuardCurrentAccess(
        {
          monetization_state: {
            has_current_access: false,
          },
        },
        {
          available: "Available",
          unavailable: "Not covered",
        },
      ),
    ).toBe("Not covered");
  });
});
