import { describe, expect, it, vi } from "vitest";
import {
  buildHostedGatewayPaymentUrlFromGuardContext,
  extractHostedPaymentSessionId,
} from "../src/index.js";

describe("server-sdk hosted gateway session helper", () => {
  it("creates a hosted payment page URL from guard context and persists the session", async () => {
    const createPaymentSession = vi.fn(async () => ({
      session: {
        payment_session_id: "pay_guard_123",
        status: "pending",
      },
      paymentPageUrl: "https://pay.example.test/session/pay_guard_123",
    }));
    const upsertSession = vi.fn(async () => undefined);

    const result = await buildHostedGatewayPaymentUrlFromGuardContext({
      deps: { createPaymentSession, upsertSession },
      payload: {
        xapps_resume: Buffer.from(
          JSON.stringify({
            xapp_id: "xapp_demo",
            tool_name: "submit_demo",
            subject_id: "sub_123",
            installation_id: "inst_123",
            client_id: "client_123",
            return_url: "https://tenant.example.test/return",
          }),
          "utf8",
        ).toString("base64url"),
      },
      guard: { slug: "tenant-payment-policy" },
      guardConfig: {
        payment_scheme: "stripe",
        payment_allowed_issuers: ["gateway"],
      },
      amount: "4.20",
      currency: "USD",
      defaultPaymentUrl: "https://tenant.example.test/tenant-payment.html",
      fallbackIssuer: "gateway",
      storedIssuer: "gateway",
    });

    expect(result.paymentUrl).toBe("https://pay.example.test/session/pay_guard_123");
    expect(result.paymentSessionId).toBe("pay_guard_123");
    expect(createPaymentSession).toHaveBeenCalledTimes(1);
    expect(upsertSession).not.toHaveBeenCalled();
  });

  it("falls back to the tenant page URL when gateway returns only a payment_session_id", async () => {
    const createPaymentSession = vi.fn(async () => ({
      session: {
        payment_session_id: "pay_guard_456",
        status: "pending",
      },
    }));
    const upsertSession = vi.fn(async () => undefined);

    const result = await buildHostedGatewayPaymentUrlFromGuardContext({
      deps: { createPaymentSession, upsertSession },
      payload: {
        xapp_id: "xapp_demo",
        tool_name: "submit_demo",
        subject_id: "sub_123",
        installation_id: "inst_123",
        client_id: "client_123",
        return_url: "https://tenant.example.test/return",
      },
      guard: { slug: "tenant-payment-policy" },
      guardConfig: {
        payment_scheme: "stripe",
      },
      amount: "6.50",
      currency: "USD",
      defaultPaymentUrl: "https://tenant.example.test/tenant-payment.html",
      fallbackIssuer: "tenant",
      storedIssuer: "tenant",
      allowDefaultSecretFallback: true,
      defaultSecret: "tenant-secret",
    });

    expect(result.paymentUrl).toContain("https://tenant.example.test/tenant-payment.html");
    expect(extractHostedPaymentSessionId(result.paymentUrl)).toBe("pay_guard_456");
    expect(upsertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_session_id: "pay_guard_456",
        xapp_id: "xapp_demo",
        tool_name: "submit_demo",
        issuer: "tenant",
      }),
    );
    expect(createPaymentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        xappId: "xapp_demo",
        toolName: "submit_demo",
        paymentScheme: "stripe",
        issuer: "tenant",
      }),
    );
  });
});
