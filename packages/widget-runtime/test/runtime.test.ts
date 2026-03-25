// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWindowXappsHostAdapter } from "../src/createWindowXappsHostAdapter";
import {
  attachReturnedPaymentEvidence,
  hasReturnedPaidPaymentEvidence,
} from "../src/paymentEvidence";
import { formatRequestErrorMessage } from "../src/errorMessages";

describe("widget-runtime", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    delete (window as Window & { XappsHost?: unknown }).XappsHost;
  });

  it("creates a window host adapter over window.XappsHost", async () => {
    const showNotification = vi.fn();
    const openOperationalSurface = vi.fn();
    const getContext = vi.fn().mockResolvedValue({ installationId: "inst_123" });

    (window as Window & { XappsHost?: unknown }).XappsHost = {
      showNotification,
      showAlert: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      navigate: vi.fn(),
      refresh: vi.fn(),
      openOperationalSurface,
      getContext,
    };

    const adapter = createWindowXappsHostAdapter();
    adapter.showNotification("hello", "success");
    adapter.openOperationalSurface?.({ surface: "payments", paymentSessionId: "pay_123" });

    await expect(adapter.getContext?.()).resolves.toEqual({ installationId: "inst_123" });
    expect(showNotification).toHaveBeenCalledWith("hello", "success");
    expect(openOperationalSurface).toHaveBeenCalledWith({
      surface: "payments",
      paymentSessionId: "pay_123",
    });
  });

  it("attaches returned paid payment evidence for payment guards only", () => {
    window.history.replaceState(
      {},
      "",
      "/?xapps_payment_contract=v1&xapps_payment_session_id=pay_123&xapps_payment_status=paid&xapps_payment_receipt_id=receipt_123&xapps_payment_amount=10.00&xapps_payment_currency=usd&xapps_payment_ts=2026-03-16T12:00:00.000Z&xapps_payment_issuer=gateway&xapps_payment_sig=sig_123",
    );

    expect(hasReturnedPaidPaymentEvidence()).toBe(true);

    const orchestration = attachReturnedPaymentEvidence(
      {},
      {
        guardSlug: "payment-gate",
        action: { kind: "complete_payment" },
      },
    );

    expect(orchestration["payment-gate"]).toMatchObject({
      payment: {
        payment_session_id: "pay_123",
        status: "paid",
        currency: "USD",
      },
    });
  });

  it("formats guard-blocked payment errors with actionable hints", () => {
    const message = formatRequestErrorMessage(
      {
        error: {
          code: "GUARD_BLOCKED",
          message: "Request blocked",
        },
        guard: {
          slug: "payment-gate",
          reason: "payment_required",
          action: {
            kind: "complete_payment",
            url: "https://pay.example.test/checkout",
          },
        },
        details: {
          monetization_state: {
            payment_attempt_state: "requires_action",
          },
        },
      },
      402,
    );

    expect(message).toContain("Request blocked");
    expect(message).toContain("guard=payment-gate");
    expect(message).toContain("reason=payment_required");
    expect(message).toContain("Action: complete payment");
    expect(message).toContain("Payment requires additional action");
  });
});
