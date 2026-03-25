import { describe, expect, it } from "vitest";
import { formatDateTime, parseDateValue } from "./readers";

describe("marketplace-ui readers date parsing", () => {
  it("parses SQL-style timestamps without rendering Invalid Date", () => {
    const parsed = parseDateValue("2026-03-17 12:34:56");
    expect(parsed).not.toBeNull();
    expect(Number.isNaN(parsed?.getTime() ?? Number.NaN)).toBe(false);
    expect(formatDateTime("2026-03-17 12:34:56")).not.toBe("");
  });

  it("parses firestore-like seconds payloads", () => {
    const parsed = parseDateValue({ seconds: 1_773_715_200, nanoseconds: 0 });
    expect(parsed).not.toBeNull();
    expect(Number.isNaN(parsed?.getTime() ?? Number.NaN)).toBe(false);
  });

  it("returns empty output for invalid values", () => {
    expect(parseDateValue("not-a-date")).toBeNull();
    expect(formatDateTime("not-a-date")).toBe("");
  });
});
