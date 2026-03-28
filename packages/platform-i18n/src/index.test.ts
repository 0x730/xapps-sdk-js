import { describe, expect, it } from "vitest";
import {
  getLocaleCandidates,
  normalizeLocale,
  pickSupportedLocale,
  resolveLocalizedText,
  translateFromCatalogs,
} from "./index";

describe("platform-i18n", () => {
  it("normalizes locales and keeps region segments", () => {
    expect(normalizeLocale("ro_ro")).toBe("ro-RO");
    expect(normalizeLocale("EN-us")).toBe("en-US");
  });

  it("picks a supported base language when region locale is not explicitly present", () => {
    expect(pickSupportedLocale("ro-RO", ["en", "ro"])).toBe("ro");
    expect(pickSupportedLocale("en-US", ["en", "ro"])).toBe("en");
  });

  it("resolves localized objects with fallback", () => {
    expect(resolveLocalizedText({ ro: "Cerere", en: "Request" }, "ro-RO")).toBe("Cerere");
    expect(resolveLocalizedText({ en: "Request" }, "fr-FR")).toBe("Request");
  });

  it("translates catalog keys with interpolation", () => {
    expect(
      translateFromCatalogs({
        catalogs: {
          en: { "notifications.unread": "{count} unread notifications" },
          ro: { "notifications.unread": "{count} notificari necitite" },
        },
        locale: "ro-RO",
        key: "notifications.unread",
        params: { count: 3 },
      }),
    ).toBe("3 notificari necitite");
  });

  it("generates fallback candidates from exact locale to base language", () => {
    expect(getLocaleCandidates("ro-RO")).toEqual(["ro-RO", "ro", "en"]);
  });
});
