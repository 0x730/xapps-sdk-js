// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSubjectProfileOverlayMock } = vi.hoisted(() => ({
  createSubjectProfileOverlayMock: vi.fn((options?: { container?: HTMLElement | null }) => {
    const container = options?.container instanceof HTMLElement ? options.container : document.body;
    const overlay = document.createElement("div");
    overlay.dataset.testid = "subject-profile-overlay";
    const root = document.createElement("div");
    overlay.appendChild(root);
    container.appendChild(overlay);
    return {
      root,
      overlay,
      destroy: () => overlay.remove(),
    };
  }),
}));

vi.mock("@xapps-platform/browser-host/xms", () => ({
  buildXmsSurfaceCopy: () => ({
    plansTitle: "Plans",
    plansSubtitle: "Current access and plans",
    tabsAriaLabel: "Plans tabs",
    plansLabel: "Plans",
    historyLabel: "History",
    closeLabel: "Close",
    loadingLabel: "Loading",
    subjectRequiredNotice: "Sign in required",
    paymentCompletedNotice: "Payment completed",
    checkoutCancelledNotice: "Checkout cancelled",
    paymentFailedNotice: "Payment failed",
    missingPackageMetadataMessage: "Missing package metadata",
    missingIntentMessage: "Missing intent",
    missingPaymentPageMessage: "Missing payment page",
    startCheckoutFailedMessage: "Checkout failed",
    subscriptionRefreshCompletedNotice: "Subscription refreshed",
    subscriptionRefreshFailedNotice: "Subscription refresh failed",
    subscriptionCancelCompletedNotice: "Subscription cancelled",
    subscriptionCancelFailedNotice: "Subscription cancel failed",
  }),
  buildXmsSurfaceShellLayout: () => ({
    overlayPadding: "16px",
    overlayBlur: "3px",
    panelWidth: "min(1100px, 96vw)",
    panelMaxWidth: "1100px",
    panelMaxHeight: "calc(100vh - 32px)",
    panelGap: "0",
    headerGap: "12px",
    headerPadding: "14px 16px",
    bodyPadding: "16px",
    bodyMaxHeight: "min(860px, calc(100vh - 104px))",
    titleFont: "700 1rem system-ui,sans-serif",
    titleLetterSpacing: "-0.01em",
    subtitleMarginTop: "4px",
    subtitleFont: "500 0.8125rem system-ui,sans-serif",
    tabsGap: "8px",
    tabRailGap: "4px",
    tabRailPadding: "4px",
    tabRadius: "999px",
    tabPadding: "6px 10px",
    tabFont: "700 0.75rem system-ui,sans-serif",
    closeButtonSize: "38px",
    closeButtonRadius: "999px",
    closeButtonFont: "600 0.875rem system-ui,sans-serif",
    closeButtonLineHeight: "1",
    closeButtonShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  }),
  buildXmsSurfaceShellModel: ({ view }: { view?: "plans" | "history" }) => ({
    title: view === "history" ? "History" : "Plans",
    subtitle: "Current access and plans",
    tabs: [
      { label: "Plans", active: view !== "history" },
      { label: "History", active: view === "history" },
    ],
    closeLabel: "Close",
  }),
  buildXmsSurfaceShellTheme: () => ({
    overlayBg: "rgba(2,6,23,0.56)",
    panelBg: "#fff",
    panelBorder: "#e5e7eb",
    panelRadius: "18px",
    panelShadow: "0 18px 45px rgba(15,23,42,0.22)",
    headerBg: "#fff",
    headerBorder: "1px solid #e5e7eb",
    titleColor: "#111827",
    subtitleColor: "#6b7280",
    tabRailBg: "#f8fafc",
    tabRailBorder: "1px solid #e5e7eb",
    tabActiveBg: "#fff",
    tabActiveText: "#111827",
    tabInactiveText: "#6b7280",
    closeBg: "#fff",
    closeBorder: "#e5e7eb",
    closeText: "#111827",
    bodyBg: "#fff",
  }),
  renderMonetizationHistorySurface: () => ({ destroy: () => {} }),
  renderMonetizationPlansSurface: () => ({ destroy: () => {} }),
  resolveXmsSurfaceView: (view?: "plans" | "history") => (view === "history" ? "history" : "plans"),
  selectXappMonetizationPaywall: () => null,
}));

vi.mock("@xapps-platform/browser-host/subject-profile", () => ({
  createSubjectProfileOverlay: createSubjectProfileOverlayMock,
  renderSubjectProfileGuardSurface: () => ({ destroy: () => {} }),
}));

import { XappsHost } from "./catalogHost";

describe("XappsHost fullscreen overlays", () => {
  let container: HTMLDivElement;
  let fullscreenRoot: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    fullscreenRoot = document.createElement("div");
    document.body.appendChild(container);
    document.body.appendChild(fullscreenRoot);
    createSubjectProfileOverlayMock.mockClear();
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: fullscreenRoot,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    document.body.innerHTML = "";
  });

  it("mounts monetization plans overlay inside the active fullscreen root", () => {
    const host = new XappsHost({
      container,
      baseUrl: "https://example.test",
    });
    vi.spyOn(host as any, "fetchMyXappHostApiJson").mockImplementation(
      async (...args: unknown[]) => {
        const suffix = String(args[1] ?? "");
        return suffix.includes("/history") ? { history: {} } : { paywalls: [] };
      },
    );

    host.openMonetizationPlans({ xappId: "xapp_123" });

    const overlay = fullscreenRoot.firstElementChild as HTMLElement | null;
    expect(overlay).toBeTruthy();
    expect(overlay?.parentElement).toBe(fullscreenRoot);
    expect(document.body.children).toHaveLength(2);

    (host as any).activePlansOverlayCleanup?.();
  });

  it("mounts subject-profile billing overlay inside the active fullscreen root", async () => {
    const host = new XappsHost({
      container,
      baseUrl: "https://example.test",
    });

    const resultPromise = host.openSubjectProfileBilling({
      xappId: "xapp_123",
      installationId: "inst_123",
      widgetId: "widget_123",
      guardUi: { remediation: {} },
    });

    const overlay = fullscreenRoot.querySelector('[data-testid="subject-profile-overlay"]');
    expect(overlay).toBeTruthy();
    expect(createSubjectProfileOverlayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        container: fullscreenRoot,
      }),
    );

    (host as any).activeSubjectProfileOverlayCleanup?.();
    await expect(resultPromise).resolves.toBeNull();
  });

  it("mounts the default confirm dialog inside the active fullscreen root", async () => {
    const host = new XappsHost({
      container,
      baseUrl: "https://example.test",
    });

    const confirmPromise = (host as any).showDefaultConfirmDialog({
      title: "Confirm action",
      message: "Proceed?",
      confirmLabel: "Continue",
      cancelLabel: "Cancel",
    });

    const overlay = fullscreenRoot.firstElementChild as HTMLElement | null;
    expect(overlay).toBeTruthy();
    expect(overlay?.parentElement).toBe(fullscreenRoot);

    const cancelButton = Array.from(overlay?.querySelectorAll("button") || []).find(
      (el) => el.textContent === "Cancel",
    ) as HTMLButtonElement | undefined;
    expect(cancelButton).toBeTruthy();
    cancelButton?.click();

    await expect(confirmPromise).resolves.toBe(false);
  });
});
