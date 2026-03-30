// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWindowXappsHostAdapter } from "../src/createWindowXappsHostAdapter";
import {
  attachReturnedPaymentEvidence,
  hasReturnedPaidPaymentEvidence,
} from "../src/paymentEvidence";
import { formatRequestErrorMessage } from "../src/errorMessages";
import { WidgetRuntime } from "../src/WidgetRuntime";

function waitForTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("widget-runtime", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, "", "/");
    delete (window as Window & { XappsHost?: unknown }).XappsHost;
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("renders loading state while widget session is being minted", async () => {
    let resolveSession: ((value: any) => void) | null = null;
    const createWidgetSession = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    const host = {
      showNotification: vi.fn(),
      showAlert: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      navigate: vi.fn(),
      refresh: vi.fn(),
    };

    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);

    await act(async () => {
      root.render(
        React.createElement(WidgetRuntime, {
          apiBaseUrl: "http://localhost:3000",
          installationId: "inst_1",
          widgetId: "wid_1",
          createWidgetSession,
          host,
        }),
      );
      await waitForTick();
    });

    expect(el.textContent).toContain("Loading");

    await act(async () => {
      resolveSession?.({
        token: "wid_tok_1",
        embedUrl: "/embed/widgets/wid_1?token=wid_tok_1",
        widget: { id: "wid_1", renderer: "platform" },
        tool: null,
      });
      await waitForTick();
    });

    expect(el.querySelector("iframe")?.getAttribute("src")).toContain("/embed/widgets/wid_1");
    await act(async () => {
      root.unmount();
    });
  });

  it("renders retry UI when initial widget session mint fails and recovers on retry", async () => {
    const createWidgetSession = vi
      .fn()
      .mockRejectedValueOnce(new Error("Session mint failed"))
      .mockResolvedValueOnce({
        token: "wid_tok_retry",
        embedUrl: "/embed/widgets/wid_1?token=wid_tok_retry",
        widget: { id: "wid_1", renderer: "platform" },
        tool: null,
      });
    const host = {
      showNotification: vi.fn(),
      showAlert: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      navigate: vi.fn(),
      refresh: vi.fn(),
    };

    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);

    await act(async () => {
      root.render(
        React.createElement(WidgetRuntime, {
          apiBaseUrl: "http://localhost:3000",
          installationId: "inst_1",
          widgetId: "wid_1",
          createWidgetSession,
          host,
        }),
      );
      await waitForTick();
      await waitForTick();
    });

    expect(el.textContent).toContain("Widget unavailable");
    expect(el.textContent).toContain("Session mint failed");

    const retry = Array.from(el.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Retry"),
    );
    expect(retry).toBeTruthy();

    await act(async () => {
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForTick();
      await waitForTick();
    });

    expect(createWidgetSession).toHaveBeenCalledTimes(2);
    expect(el.querySelector("iframe")?.getAttribute("src")).toContain("wid_tok_retry");
    await act(async () => {
      root.unmount();
    });
  });

  it("recovers from a stuck initial widget-session mint", async () => {
    vi.useFakeTimers();
    const createWidgetSession = vi.fn(
      () =>
        new Promise(() => {
          // intentionally unresolved to trigger timeout
        }),
    );
    const host = {
      showNotification: vi.fn(),
      showAlert: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      navigate: vi.fn(),
      refresh: vi.fn(),
    };

    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);

    await act(async () => {
      root.render(
        React.createElement(WidgetRuntime, {
          apiBaseUrl: "http://localhost:3000",
          installationId: "inst_1",
          widgetId: "wid_1",
          createWidgetSession,
          host,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12050);
      await Promise.resolve();
    });

    expect(el.textContent).toContain("Widget unavailable");
    expect(el.textContent).toContain("taking longer than expected");

    await act(async () => {
      root.unmount();
    });
  });
});
