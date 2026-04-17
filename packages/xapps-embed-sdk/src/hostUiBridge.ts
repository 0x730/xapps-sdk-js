import {
  normalizeOpenOperationalSurfaceInput,
  readMessageData,
  readMessageRecord,
  readRecordObject,
  readRecordString,
} from "./bridgeUtils";
import type {
  HostUiContextPayload,
  HostUiExpandRequest,
  HostUiExpandResult,
  OpenOperationalSurfaceInput,
} from "./sharedTypes";

export type HostUiGlobalApi = {
  showNotification: (message: string, variant?: string) => void;
  showAlert: (message: string, title?: string) => void;
  openModal: (title?: string, message?: string) => void;
  closeModal: () => void;
  navigate: (path: string) => void;
  refresh: () => void;
  openOperationalSurface: (input: OpenOperationalSurfaceInput) => void;
  openMonetizationPlans: (input: {
    xappId?: string;
    installationId?: string;
    paywallSlug?: string;
    view?: "plans" | "history";
    fallbackPath?: string;
  }) => void;
  openSubjectProfileBilling: (input: {
    xappId?: string;
    installationId?: string;
    widgetId?: string;
    guardUi?: Record<string, unknown> | null;
    hostReturnUrl?: string;
  }) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  updateState: (patch: Record<string, unknown>) => void;
  getContext: () => Promise<HostUiContextPayload>;
  confirm: (input: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
  expandWidget?: (input: HostUiExpandRequest) => Promise<HostUiExpandResult> | HostUiExpandResult;
};

export type HostUiBridgeOptions = {
  target?: Window;
  allowMessage?: (event: MessageEvent) => boolean;
  getContext?: () => HostUiContextPayload | Promise<HostUiContextPayload> | null | undefined;
  showNotification?: (message: string, variant?: string) => void;
  showAlert?: (message: string, title?: string) => void;
  openModal?: (title?: string, message?: string) => void;
  closeModal?: () => void;
  navigate?: (path: string) => void;
  refresh?: () => void;
  openOperationalSurface?: (input: OpenOperationalSurfaceInput) => void;
  openMonetizationPlans?: (input: {
    xappId?: string;
    installationId?: string;
    paywallSlug?: string;
    view?: "plans" | "history";
    fallbackPath?: string;
  }) => void;
  openSubjectProfileBilling?: (input: {
    xappId?: string;
    installationId?: string;
    widgetId?: string;
    guardUi?: Record<string, unknown> | null;
    hostReturnUrl?: string;
  }) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  updateState?: (patch: Record<string, unknown>) => void;
  confirmDialog?: (input: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean> | boolean;
  expandWidget?: (
    input: HostUiExpandRequest,
    event: MessageEvent,
  ) => Promise<HostUiExpandResult | null | undefined> | HostUiExpandResult | null | undefined;
  exposeGlobalApi?: boolean;
  globalApiName?: string;
};

export type HostUiBridgeController = {
  api: HostUiGlobalApi;
  handleMessage: (event: MessageEvent) => Promise<void>;
  detach: () => void;
};

type HostDomUiNodeRef = HTMLElement | null | undefined;

export type HostDomUiControllerOptions = {
  target?: Window;
  toastRoot?: HostDomUiNodeRef;
  toastRootId?: string;
  modalBackdrop?: HostDomUiNodeRef;
  modalBackdropId?: string;
  modalTitle?: HostDomUiNodeRef;
  modalTitleId?: string;
  modalMessage?: HostDomUiNodeRef;
  modalMessageId?: string;
  modalClose?: HostDomUiNodeRef;
  modalCloseId?: string;
  toastDurationMs?: number;
  toastExitDurationMs?: number;
  confirmDialog?: (input: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean> | boolean;
};

export type HostDomUiController = {
  bridgeOptions: Pick<
    HostUiBridgeOptions,
    "showNotification" | "showAlert" | "openModal" | "closeModal" | "confirmDialog"
  >;
  showNotification: (message: string, variant?: string) => void;
  showAlert: (message: string, title?: string) => void;
  openModal: (title?: string, message?: string) => void;
  closeModal: () => void;
  destroy: () => void;
};

function resolveHostDomNode(
  target: Window | undefined,
  node: HostDomUiNodeRef,
  id?: string,
): HTMLElement | null {
  if (node instanceof HTMLElement) return node;
  const resolvedId = String(id || "").trim();
  if (!target?.document || !resolvedId) return null;
  const found = target.document.getElementById(resolvedId);
  return found instanceof HTMLElement ? found : null;
}

function showHostDomModal(backdrop: HTMLElement | null, open: boolean) {
  if (!backdrop) return;
  if (backdrop.hasAttribute("aria-hidden")) {
    backdrop.setAttribute("aria-hidden", open ? "false" : "true");
    return;
  }
  backdrop.style.display = open ? "flex" : "none";
}

function readThemeCssValue(target: Window | undefined, names: string[], fallback: string): string {
  const doc = target?.document;
  if (!target || !doc) return fallback;
  const nodes = [doc.documentElement, doc.body].filter((node): node is HTMLElement =>
    Boolean(node),
  );
  for (const node of nodes) {
    const styles = target.getComputedStyle(node);
    for (const name of names) {
      const value = styles.getPropertyValue(name).trim();
      if (value) return value;
    }
  }
  return fallback;
}

function readHostDialogTheme(target: Window | undefined) {
  return {
    cardBg: readThemeCssValue(
      target,
      ["--xapps-surface-bg", "--cx-card", "--mx-card-bg"],
      "#ffffff",
    ),
    cardBorder: readThemeCssValue(
      target,
      ["--xapps-border-color", "--cx-border", "--mx-border"],
      "#e5e7eb",
    ),
    text: readThemeCssValue(
      target,
      ["--xapps-text-primary", "--cx-text", "--mx-text-main"],
      "#0f172a",
    ),
    muted: readThemeCssValue(
      target,
      ["--xapps-text-secondary", "--cx-muted", "--mx-text-muted"],
      "#334155",
    ),
    primary: readThemeCssValue(
      target,
      ["--xapps-accent", "--cx-primary", "--mx-primary"],
      "#5b6b82",
    ),
    primaryDark: readThemeCssValue(
      target,
      ["--xapps-accent-strong", "--cx-primary-dark", "--mx-primary-hover"],
      "#46566c",
    ),
  };
}

export function createHostConfirmDialog(options?: {
  target?: Window;
  overlayZIndex?: number;
}): (input: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) => Promise<boolean> {
  return async (input) => {
    const target = options?.target || (typeof window !== "undefined" ? window : undefined);
    if (!target || !target.document || !target.document.body) return false;
    const doc = target.document;
    const theme = readHostDialogTheme(target);
    const overlayContainer =
      doc.fullscreenElement instanceof HTMLElement ? doc.fullscreenElement : doc.body;
    return new Promise<boolean>((resolve) => {
      const overlay = doc.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(2, 6, 23, 0.56)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.padding = "16px";
      overlay.style.zIndex = String(options?.overlayZIndex || 2147483000);

      const card = doc.createElement("div");
      card.style.width = "min(560px, 92vw)";
      card.style.background = theme.cardBg;
      card.style.border = `1px solid ${theme.cardBorder}`;
      card.style.borderRadius = "14px";
      card.style.padding = "16px";
      card.style.boxShadow = "0 18px 45px rgba(15, 23, 42, 0.22)";

      const heading = doc.createElement("h3");
      heading.style.margin = "0 0 8px";
      heading.textContent = String(input.title || "Confirmation");

      const body = doc.createElement("div");
      body.style.color = theme.muted;
      body.style.whiteSpace = "pre-wrap";
      body.textContent = String(input.message || "This action requires confirmation.");

      const actions = doc.createElement("div");
      actions.style.display = "flex";
      actions.style.justifyContent = "flex-end";
      actions.style.gap = "8px";
      actions.style.marginTop = "14px";

      const cancelBtn = doc.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.textContent = String(input.cancelLabel || "Cancel");
      cancelBtn.style.padding = "8px 12px";
      cancelBtn.style.border = `1px solid ${theme.cardBorder}`;
      cancelBtn.style.borderRadius = "8px";
      cancelBtn.style.background = theme.cardBg;
      cancelBtn.style.color = theme.text;
      cancelBtn.onclick = () => {
        overlay.remove();
        resolve(false);
      };

      const confirmBtn = doc.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.textContent = String(input.confirmLabel || "Continue");
      confirmBtn.style.padding = "8px 12px";
      confirmBtn.style.border = `1px solid ${theme.primaryDark}`;
      confirmBtn.style.borderRadius = "8px";
      confirmBtn.style.background = theme.primary;
      confirmBtn.style.color = "#fff";
      confirmBtn.onclick = () => {
        overlay.remove();
        resolve(true);
      };

      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      card.appendChild(heading);
      card.appendChild(body);
      card.appendChild(actions);
      overlay.appendChild(card);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
      card.addEventListener("click", (event) => event.stopPropagation());
      overlayContainer.appendChild(overlay);
      confirmBtn.focus();
    });
  };
}

export function createHostUiBridge(options?: HostUiBridgeOptions): HostUiBridgeController {
  const target = options?.target || (typeof window !== "undefined" ? window : undefined);
  const fallbackConfirm =
    options?.confirmDialog || createHostConfirmDialog({ target, overlayZIndex: 2147483000 });
  const globalApiName = String(options?.globalApiName || "XappsHost");

  const api: HostUiGlobalApi = {
    showNotification: (message, variant) => {
      if (typeof options?.showNotification === "function") {
        options.showNotification(String(message || ""), variant);
      }
    },
    showAlert: (message, title) => {
      if (typeof options?.showAlert === "function") {
        options.showAlert(String(message || ""), title);
        return;
      }
      if (target && typeof target.alert === "function") {
        target.alert(`${String(title || "Alert")}\n\n${String(message || "")}`);
      }
    },
    openModal: (title, message) => {
      if (typeof options?.openModal === "function") {
        options.openModal(title, message);
      }
    },
    closeModal: () => {
      if (typeof options?.closeModal === "function") {
        options.closeModal();
      }
    },
    navigate: (path) => {
      if (typeof options?.navigate === "function") {
        options.navigate(path);
        return;
      }
      if (!target || !target.location) return;
      const next = String(path || "").trim();
      if (!next) return;
      if (/^https?:\/\//i.test(next)) {
        target.location.href = next;
      } else {
        target.location.hash = next;
      }
    },
    refresh: () => {
      if (typeof options?.refresh === "function") {
        options.refresh();
        return;
      }
      try {
        target?.location?.reload();
      } catch {}
    },
    openOperationalSurface: (input) => {
      if (typeof options?.openOperationalSurface === "function") {
        options.openOperationalSurface(input);
        return;
      }
      const payload = normalizeOpenOperationalSurfaceInput(input, "requests");
      if (!payload) return;
      const next = new URL(target?.location?.href || window.location.href);
      next.hash = "";
      next.searchParams.set("surface", payload.surface);
      if (payload.xappId) next.searchParams.set("xappId", payload.xappId);
      if (payload.installationId) next.searchParams.set("installationId", payload.installationId);
      target?.location?.assign(next.toString());
    },
    openMonetizationPlans: (input) => {
      if (typeof options?.openMonetizationPlans === "function") {
        options.openMonetizationPlans(input);
        return;
      }
      const fallbackPath = String(input?.fallbackPath || "").trim();
      if (fallbackPath) {
        api.navigate(fallbackPath);
      }
    },
    openSubjectProfileBilling: async (input) => {
      if (typeof options?.openSubjectProfileBilling === "function") {
        return await options.openSubjectProfileBilling(input);
      }
      return null;
    },
    updateState: (patch) => {
      if (typeof options?.updateState === "function") {
        options.updateState(patch);
      }
    },
    getContext: async () => {
      if (typeof options?.getContext === "function") {
        const value = await options.getContext();
        if (value && typeof value === "object" && !Array.isArray(value)) return value;
      }
      return {
        installationId: "",
        widgetId: "",
        devMode: false,
      };
    },
    confirm: async (input) => {
      const title = String(input?.title || "Confirmation");
      const message = String(input?.message || "This action requires confirmation.");
      const confirmLabel = String(input?.confirmLabel || "Continue");
      const cancelLabel = String(input?.cancelLabel || "Cancel");
      try {
        return Boolean(
          await fallbackConfirm({
            title,
            message,
            confirmLabel,
            cancelLabel,
          }),
        );
      } catch {
        if (target && typeof target.confirm === "function") {
          return target.confirm(message);
        }
        return false;
      }
    },
    expandWidget: async () => {
      return {
        hostManaged: false,
        expanded: false,
        stage: "inline",
      };
    },
  };

  const handleMessage = async (event: MessageEvent) => {
    const msg = readMessageRecord(event?.data);
    if (Object.keys(msg).length === 0) return;
    if (typeof options?.allowMessage === "function" && !options.allowMessage(event)) return;
    const type = readRecordString(msg, "type");
    if (!type) return;
    const data = readMessageData(msg);

    if (type === "XAPPS_UI_NOTIFICATION") {
      api.showNotification(
        readRecordString(data, "message") || readRecordString(msg, "message"),
        readRecordString(data, "variant") || readRecordString(msg, "variant") || "info",
      );
      return;
    }
    if (type === "XAPPS_UI_ALERT") {
      api.showAlert(
        readRecordString(data, "message") || readRecordString(msg, "message"),
        readRecordString(data, "title") || readRecordString(msg, "title") || "Alert",
      );
      return;
    }
    if (type === "XAPPS_UI_MODAL_OPEN") {
      api.openModal(
        readRecordString(data, "title") || readRecordString(msg, "title") || "Modal",
        readRecordString(data, "message") || readRecordString(msg, "message"),
      );
      return;
    }
    if (type === "XAPPS_UI_MODAL_CLOSE") {
      api.closeModal();
      return;
    }
    if (type === "XAPPS_UI_NAVIGATE") {
      api.navigate(readRecordString(data, "path") || readRecordString(msg, "path"));
      return;
    }
    if (type === "XAPPS_UI_REFRESH") {
      api.refresh();
      return;
    }
    if (type === "XAPPS_OPEN_OPERATIONAL_SURFACE") {
      const normalized = normalizeOpenOperationalSurfaceInput(data);
      if (!normalized) return;
      api.openOperationalSurface(normalized);
      return;
    }
    if (type === "XAPPS_UI_OPEN_PLANS") {
      const payloadData = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      api.openMonetizationPlans({
        ...(typeof payloadData.xappId === "string" && payloadData.xappId.trim()
          ? { xappId: payloadData.xappId.trim() }
          : {}),
        ...(typeof payloadData.installationId === "string" && payloadData.installationId.trim()
          ? { installationId: payloadData.installationId.trim() }
          : {}),
        ...(typeof payloadData.paywallSlug === "string" && payloadData.paywallSlug.trim()
          ? { paywallSlug: payloadData.paywallSlug.trim() }
          : {}),
        ...(payloadData.view === "plans" || payloadData.view === "history"
          ? { view: payloadData.view }
          : {}),
        ...(typeof payloadData.fallbackPath === "string" && payloadData.fallbackPath.trim()
          ? { fallbackPath: payloadData.fallbackPath.trim() }
          : {}),
      });
      return;
    }
    if (type === "XAPPS_UI_OPEN_BILLING_PROFILE") {
      const source = event.source as Window | null;
      const payloadData = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      try {
        const payload = await api.openSubjectProfileBilling({
          ...(typeof payloadData.xappId === "string" && payloadData.xappId.trim()
            ? { xappId: payloadData.xappId.trim() }
            : {}),
          ...(typeof payloadData.installationId === "string" && payloadData.installationId.trim()
            ? { installationId: payloadData.installationId.trim() }
            : {}),
          ...(typeof payloadData.widgetId === "string" && payloadData.widgetId.trim()
            ? { widgetId: payloadData.widgetId.trim() }
            : {}),
          ...(payloadData.guardUi && typeof payloadData.guardUi === "object"
            ? { guardUi: payloadData.guardUi as Record<string, unknown> }
            : {}),
          ...(typeof payloadData.hostReturnUrl === "string" && payloadData.hostReturnUrl.trim()
            ? { hostReturnUrl: payloadData.hostReturnUrl.trim() }
            : {}),
        });
        source?.postMessage(
          {
            type: "XAPPS_UI_BILLING_PROFILE_RESULT",
            id: readRecordString(msg, "id") || undefined,
            ok: true,
            data: {
              status: payload ? "resolved" : "cancelled",
              payload,
            },
          },
          "*",
        );
      } catch (error: any) {
        source?.postMessage(
          {
            type: "XAPPS_UI_BILLING_PROFILE_RESULT",
            id: readRecordString(msg, "id") || undefined,
            ok: false,
            error: { message: error?.message || String(error) },
          },
          "*",
        );
      }
      return;
    }
    if (type === "XAPPS_UI_EXPAND_REQUEST") {
      const source = event.source as Window | null;
      const payloadData = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      const input: HostUiExpandRequest = {
        expanded: Boolean(payloadData.expanded),
        ...(typeof payloadData.source === "string" ? { source: payloadData.source } : {}),
        ...(typeof payloadData.widgetId === "string" ? { widgetId: payloadData.widgetId } : {}),
        ...(payloadData.mode === "expand" || payloadData.mode === "collapse"
          ? { mode: payloadData.mode }
          : {}),
        ...(payloadData.stage === "inline" ||
        payloadData.stage === "focus" ||
        payloadData.stage === "fullscreen"
          ? { stage: payloadData.stage }
          : {}),
        ...(payloadData.suggested && typeof payloadData.suggested === "object"
          ? { suggested: payloadData.suggested as Record<string, unknown> }
          : {}),
      };
      try {
        let result: HostUiExpandResult | null | undefined = undefined;
        if (typeof options?.expandWidget === "function") {
          result = await options.expandWidget(input, event);
        }
        if (source && typeof source.postMessage === "function") {
          source.postMessage(
            {
              type: "XAPPS_UI_EXPAND_RESULT",
              ok: true,
              data: result || {
                hostManaged: false,
                expanded: false,
                stage: "inline",
              },
            },
            "*",
          );
        }
      } catch (error: any) {
        try {
          source?.postMessage(
            {
              type: "XAPPS_UI_EXPAND_RESULT",
              ok: false,
              error: {
                message: error?.message || "Expand handling failed",
                code: error?.code || "EXPAND_HANDLING_FAILED",
              },
            },
            "*",
          );
        } catch {}
      }
      return;
    }
    if (type === "XAPPS_UI_STATE_UPDATE") {
      const patch = readRecordObject(data, "patch");
      api.updateState(Object.keys(patch).length > 0 ? patch : data);
      return;
    }
    if (type === "XAPPS_UI_GET_CONTEXT") {
      const payload = await api.getContext();
      try {
        (event.source as Window | null)?.postMessage(
          {
            type: "XAPPS_UI_GET_CONTEXT_RESULT",
            id: msg.id,
            payload,
          },
          "*",
        );
      } catch {}
      return;
    }
    if (type === "XAPPS_UI_CONFIRM_REQUEST") {
      const confirmed = await api.confirm({
        title: readRecordString(data, "title") || "Confirmation",
        message: readRecordString(data, "message") || "This action requires confirmation.",
        confirmLabel: readRecordString(data, "confirmLabel") || "Continue",
        cancelLabel: readRecordString(data, "cancelLabel") || "Cancel",
      });
      try {
        (event.source as Window | null)?.postMessage(
          {
            type: "XAPPS_UI_CONFIRM_RESULT",
            id: msg.id,
            ok: true,
            data: { confirmed },
          },
          "*",
        );
      } catch {}
      return;
    }
  };

  let previousGlobal: unknown = undefined;
  let hadPreviousGlobal = false;
  if (target && options?.exposeGlobalApi !== false) {
    const t = target as unknown as Record<string, unknown>;
    hadPreviousGlobal = Object.prototype.hasOwnProperty.call(t, globalApiName);
    previousGlobal = t[globalApiName];
    t[globalApiName] = api;
  }

  const messageListener = (event: Event) => {
    void handleMessage(event as MessageEvent);
  };
  if (target) {
    target.addEventListener("message", messageListener);
  }

  return {
    api,
    handleMessage,
    detach: () => {
      if (target) {
        target.removeEventListener("message", messageListener);
      }
      if (target && options?.exposeGlobalApi !== false) {
        const t = target as unknown as Record<string, unknown>;
        if (hadPreviousGlobal) {
          t[globalApiName] = previousGlobal;
        } else {
          try {
            delete t[globalApiName];
          } catch {
            t[globalApiName] = undefined;
          }
        }
      }
    },
  };
}

export function createHostDomUiController(
  options?: HostDomUiControllerOptions,
): HostDomUiController {
  const target = options?.target || (typeof window !== "undefined" ? window : undefined);
  const toastDurationMs = Math.max(0, Number(options?.toastDurationMs || 3200));
  const toastExitDurationMs = Math.max(0, Number(options?.toastExitDurationMs || 240));
  const toastRoot = resolveHostDomNode(target, options?.toastRoot, options?.toastRootId);
  const modalBackdrop = resolveHostDomNode(
    target,
    options?.modalBackdrop,
    options?.modalBackdropId,
  );
  const modalTitle = resolveHostDomNode(target, options?.modalTitle, options?.modalTitleId);
  const modalMessage = resolveHostDomNode(target, options?.modalMessage, options?.modalMessageId);
  const modalClose = resolveHostDomNode(target, options?.modalClose, options?.modalCloseId);
  const confirmDialog =
    options?.confirmDialog || createHostConfirmDialog({ target, overlayZIndex: 2147483000 });

  const closeModal = () => {
    showHostDomModal(modalBackdrop, false);
  };

  const showNotification = (message: string, variant = "info") => {
    if (!toastRoot || !target?.document) return;
    const node = target.document.createElement("div");
    node.className = `toast ${String(variant || "info")}`;
    node.textContent = String(message || "");
    toastRoot.appendChild(node);
    target.setTimeout(() => {
      node.style.opacity = "0";
      node.style.transform = "translateY(8px)";
      target.setTimeout(() => node.remove(), toastExitDurationMs);
    }, toastDurationMs);
  };

  const openModal = (title?: string, message?: string) => {
    if (!modalBackdrop || !modalTitle || !modalMessage) return;
    modalTitle.textContent = String(title || "Notice");
    modalMessage.textContent = String(message || "");
    showHostDomModal(modalBackdrop, true);
  };

  const showAlert = (message: string, title?: string) => {
    if (modalBackdrop && modalTitle && modalMessage) {
      openModal(title || "Alert", message);
      return;
    }
    if (target && typeof target.alert === "function") {
      target.alert(`${String(title || "Alert")}\n\n${String(message || "")}`);
    }
  };

  const handleBackdropClick = (event: Event) => {
    if (event.target === modalBackdrop) {
      closeModal();
    }
  };
  const handleCloseClick = () => closeModal();

  modalBackdrop?.addEventListener("click", handleBackdropClick);
  modalClose?.addEventListener("click", handleCloseClick);

  return {
    bridgeOptions: {
      showNotification,
      showAlert,
      openModal,
      closeModal,
      confirmDialog: async (input) => Boolean(await confirmDialog(input)),
    },
    showNotification,
    showAlert,
    openModal,
    closeModal,
    destroy: () => {
      modalBackdrop?.removeEventListener("click", handleBackdropClick);
      modalClose?.removeEventListener("click", handleCloseClick);
      closeModal();
    },
  };
}
