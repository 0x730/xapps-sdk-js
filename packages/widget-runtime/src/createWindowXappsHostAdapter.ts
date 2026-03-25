import type { GuardDecision, WidgetHostAdapter, WidgetContext } from "./types";
import { asRecord } from "./runtimeReaders";

type WindowXappsHost = {
  showNotification?: (message: string, variant?: string) => void;
  showAlert?: (message: string, title?: string) => void;
  openModal?: (title?: string, message?: string) => void;
  closeModal?: () => void;
  navigate?: (path: string) => void;
  refresh?: () => void;
  openOperationalSurface?: (input: {
    surface: string;
    placement?: "in_router" | "side_panel" | "full_page";
    xappId?: string;
    installationId?: string;
    requestId?: string;
    paymentSessionId?: string;
    invoiceId?: string;
    notificationId?: string;
  }) => void;
  updateState?: (patch: Record<string, unknown>) => void;
  getContext?: () => Promise<WidgetContext>;
  requestGuard?: (input: {
    guardSlug: string;
    trigger?: string;
    context?: Record<string, unknown>;
    config?: Record<string, unknown> | null;
  }) => Promise<GuardDecision> | GuardDecision;
};

type WindowWithXappsHost = Window & { XappsHost?: unknown };

export function createWindowXappsHostAdapter(): WidgetHostAdapter {
  const hostRecord = asRecord((window as WindowWithXappsHost).XappsHost);
  const hostOrNull: WindowXappsHost | null = Object.keys(hostRecord).length
    ? (hostRecord as WindowXappsHost)
    : null;
  if (!hostOrNull) {
    throw new Error("window.XappsHost is not available");
  }
  const host = hostOrNull;
  const openOperationalSurface = host.openOperationalSurface;
  const updateState = host.updateState;
  const getContext = host.getContext;
  const requestGuard = host.requestGuard;

  function required<K extends keyof WindowXappsHost>(key: K): NonNullable<WindowXappsHost[K]> {
    const fn = host[key];
    if (typeof fn !== "function") {
      throw new Error(`window.XappsHost.${String(key)} is not a function`);
    }
    return fn as NonNullable<WindowXappsHost[K]>;
  }

  return {
    showNotification: (message, variant) => required("showNotification")(message, variant),
    showAlert: (message, title) => required("showAlert")(message, title),
    openModal: (title, message) => required("openModal")(title, message),
    closeModal: () => required("closeModal")(),
    navigate: (path) => required("navigate")(path),
    refresh: () => required("refresh")(),
    openOperationalSurface:
      typeof openOperationalSurface === "function"
        ? (input) => openOperationalSurface(input)
        : undefined,
    updateState: typeof updateState === "function" ? (patch) => updateState(patch) : undefined,
    getContext: typeof getContext === "function" ? () => getContext() : undefined,
    requestGuard: typeof requestGuard === "function" ? (input) => requestGuard(input) : undefined,
  };
}
