import { describe, expect, it } from "vitest";
import {
  buildPaymentGuardAction,
  hasUpstreamPaymentVerified,
  normalizePaymentAllowedIssuers,
  resolveMergedPaymentGuardContext,
  resolvePaymentGuardPriceAmount,
} from "../src/index.js";

describe("server-sdk payment policy support helpers", () => {
  it("merges payload, context, and resume token into a canonical payment guard context", () => {
    const context = resolveMergedPaymentGuardContext({
      context: {
        client_id: "client_123",
      },
      xapps_resume: Buffer.from(
        JSON.stringify({
          xapp_id: "xapp_demo",
          tool_name: "submit_demo",
          subject_id: "sub_123",
          installation_id: "inst_123",
          return_url: "https://tenant.example.test/return",
        }),
        "utf8",
      ).toString("base64url"),
    });

    expect(context.xapp_id).toBe("xapp_demo");
    expect(context.tool_name).toBe("submit_demo");
    expect(context.client_id).toBe("client_123");
    expect(context.return_url).toBe("https://tenant.example.test/return");
  });

  it("normalizes allowed issuers and falls back when guard config omits them", () => {
    expect(
      normalizePaymentAllowedIssuers(
        { payment_allowed_issuers: ["Gateway", "tenant_delegated", "bad"] },
        "tenant",
      ),
    ).toEqual(["gateway", "tenant_delegated"]);
    expect(normalizePaymentAllowedIssuers({}, "tenant")).toEqual(["tenant"]);
  });

  it("resolves price amounts from tool overrides and xapp defaults", () => {
    expect(
      resolvePaymentGuardPriceAmount(
        {
          pricing: {
            default_amount: 3,
            tool_overrides: { "xapp_demo:submit_demo": 7.5 },
            xapp_prices: { xapp_demo: 5 },
          },
        },
        { xapp_id: "xapp_demo", tool_name: "submit_demo" },
      ),
    ).toBe(7.5);
    expect(
      resolvePaymentGuardPriceAmount(
        { pricing: { default_amount: 3, xapp_prices: { xapp_demo: 5 } } },
        { xapp_id: "xapp_demo" },
      ),
    ).toBe(5);
  });

  it("detects upstream payment verification hints and builds canonical payment actions", () => {
    expect(hasUpstreamPaymentVerified(true)).toBe(true);
    expect(hasUpstreamPaymentVerified({ receipt_id: "rcpt_1" })).toBe(true);
    expect(hasUpstreamPaymentVerified("yes")).toBe(true);
    expect(hasUpstreamPaymentVerified("")).toBe(false);

    expect(
      buildPaymentGuardAction({
        url: "https://tenant.example.test/pay",
        label: "Pay now",
        title: "Complete payment",
        target: "_blank",
      }),
    ).toEqual({
      kind: "complete_payment",
      url: "https://tenant.example.test/pay",
      label: "Pay now",
      title: "Complete payment",
      target: "_blank",
    });
  });

  it("preserves localized payment action text additively", () => {
    expect(
      buildPaymentGuardAction({
        url: "https://tenant.example.test/pay",
        label: { en: "Pay now", ro: "Plătește acum" },
        title: { en: "Complete payment", ro: "Finalizează plata" },
      }),
    ).toEqual({
      kind: "complete_payment",
      url: "https://tenant.example.test/pay",
      label: { en: "Pay now", ro: "Plătește acum" },
      title: { en: "Complete payment", ro: "Finalizează plata" },
    });
  });
});
