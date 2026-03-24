import {
  createHost,
  createMarketplaceMutationEventHandler,
  type CatalogEvent,
  type CatalogOptions,
  type MarketplaceMutationCall,
  type MarketplaceMutationHelperOptions,
  type XappsHost,
} from "./catalogHost";
import {
  createBridgeV2ApiHandlers,
  createHostApiClient,
  type BridgeV2ApiHandlersOptions,
  type HostApiClient,
  type HostApiClientOptions,
} from "./hostApi";
import {
  createHostExpandOverlayController,
  type HostExpandOverlayController,
} from "./hostExpandOverlay";
import { createHostPaymentResumeState } from "./paymentReturn";
import {
  createHostUiBridge,
  type HostUiBridgeController,
  type HostUiBridgeOptions,
} from "./hostUiBridge";

export type EmbedHostBridgeOptions = Omit<BridgeV2ApiHandlersOptions, "callApi"> & {
  enabled?: boolean;
  callApi?: MarketplaceMutationCall;
};

export type EmbedHostMutationOptions = Omit<MarketplaceMutationHelperOptions, "getHost"> & {
  enabled?: boolean;
  callApi?: MarketplaceMutationCall;
};

export type EmbedHostPaymentResumeOptions =
  | false
  | {
      href?: string;
      options?: Parameters<typeof createHostPaymentResumeState>[1];
    };

export type EmbedHostApiBasePath = string;

export type CreateEmbedHostOptions = Omit<CatalogOptions, "bridgeV2" | "onEvent"> & {
  onEvent?: CatalogOptions["onEvent"];
  apiBasePath?: EmbedHostApiBasePath;
  apiClient?: HostApiClient;
  apiClientOptions?: HostApiClientOptions;
  paymentResume?: EmbedHostPaymentResumeOptions;
  bridgeV2?: false | EmbedHostBridgeOptions;
  mutationHandler?: false | EmbedHostMutationOptions;
  uiBridge?: false | HostUiBridgeOptions;
  expandOverlay?: false | HostExpandOverlayController;
};

export type EmbedHostController = {
  host: XappsHost;
  hostApiClient: HostApiClient;
  paymentResumeState: ReturnType<typeof createHostPaymentResumeState> | null;
  bridgeV2Handlers: ReturnType<typeof createBridgeV2ApiHandlers> | null;
  expandOverlay: HostExpandOverlayController | null;
  uiBridge: HostUiBridgeController | null;
  handleEvent: (evt: CatalogEvent) => Promise<boolean>;
  mutationHandler: ((evt: CatalogEvent) => Promise<boolean>) | null;
  mountCatalog: XappsHost["mountCatalog"];
  mountXapp: XappsHost["mountXapp"];
  openWidget: XappsHost["openWidget"];
  emitToCatalog: XappsHost["emitToCatalog"];
  emitSessionExpired: XappsHost["emitSessionExpired"];
  destroy: () => void;
  buildHostReturnUrl: (paymentParamsOverride?: URLSearchParams | null) => string;
  readPendingResumeTarget: () => EmbedHostPendingResumeTarget | null;
  consumePendingResumeTarget: () => EmbedHostPendingResumeTarget | null;
  resumeCatalogWidget: (options?: { delayMs?: number }) => EmbedHostPendingResumeTarget | null;
  resumeWidget: (options?: {
    subjectId?: string | null;
    widgetMount?: HTMLElement | null;
    title?: string;
  }) => Promise<EmbedHostPendingResumeTarget | null>;
};

export type EmbedHostPendingResumeTarget = {
  installationId: string;
  widgetId: string;
  xappId: string | null;
  paymentParams: URLSearchParams;
  hostReturnUrl: string;
};

export type EmbedHostWidgetContext = {
  installationId: string | null;
  widgetId: string | null;
  xappId: string | null;
};

export type EmbedHostWidgetContextController = {
  get: () => EmbedHostWidgetContext;
  set: (next: Partial<EmbedHostWidgetContext> | EmbedHostWidgetContext | null | undefined) => void;
  reset: () => void;
};

export type CreateSplitPanelCatalogEventHandlerOptions = {
  expandOverlay?: HostExpandOverlayController | null;
  getExpandOverlay?: () => HostExpandOverlayController | null;
  widgetMount: HTMLElement | null;
  getWidgetContext: () => EmbedHostWidgetContext;
  setWidgetContext: (next: EmbedHostWidgetContext) => void;
  clearWidget: (message: string) => void;
  emptyCatalogMessage?: string;
  xappDetailMismatchMessage?: string;
  onWidgetOpened?: (context: EmbedHostWidgetContext) => Promise<void> | void;
  onExpandError?: (error: unknown) => Promise<void> | void;
};

export type CreateSplitPanelMutationCallbacksOptions = {
  widgetMount: HTMLElement | null;
  getHost: () => XappsHost | null;
  getWidgetContext: () => EmbedHostWidgetContext;
  setWidgetContext: (next: EmbedHostWidgetContext) => void;
  clearWidget: (message: string) => void;
  notify?: (message: string, variant?: string) => Promise<void> | void;
  uninstalledMessage?: string;
};

export type CreateMutationFailureCallbacksOptions = {
  notify?: (message: string, variant?: string) => Promise<void> | void;
  installMessage?: string;
  updateMessage?: string;
  uninstallMessage?: string;
};

export type StandardMarketplaceRuntimeMode = "single-panel" | "split-panel";

export type StandardMarketplaceRuntimeUi = {
  bridgeOptions: Pick<
    HostUiBridgeOptions,
    "showNotification" | "showAlert" | "openModal" | "closeModal" | "confirmDialog"
  >;
  showNotification: (message: string, variant?: string) => void;
};

export type CreateStandardMarketplaceRuntimeOptions = {
  baseUrl: string;
  subjectId?: string | null;
  paymentResumeState: ReturnType<typeof createHostPaymentResumeState>;
  hostUi: StandardMarketplaceRuntimeUi;
  widgetContext?: EmbedHostWidgetContextController;
  theme?: CatalogOptions["theme"];
  apiBasePath?: string;
  hostApiClientOptions?: HostApiClientOptions;
  hostApiHeaders?: Record<string, string>;
  bridgeV2?:
    | false
    | Partial<
        Pick<
          BridgeV2ApiHandlersOptions,
          "getPortalToken" | "clearSession" | "getHostOrigin" | "endpoints"
        >
      >;
  getCatalogMount: () => HTMLElement | null;
  getWidgetMount?: () => HTMLElement | null;
  onStatePatch?: (patch: Record<string, unknown>) => void;
  getContext?: () => Partial<{ installationId: string; widgetId: string; devMode: boolean }>;
  navigate?: (path: string) => void;
  refresh?: () => void;
  singlePanel?: {
    catalogUrl?: string;
    resumeDelayMs?: number;
  };
  splitPanel?: {
    catalogUrl?: string | (() => string | null | undefined);
    widgetTitle?: string;
    placeholderMessage?: string;
    emptyCatalogMessage?: string;
    xappDetailMismatchMessage?: string;
    onExpandError?: (error: unknown) => Promise<void> | void;
    onWidgetOpened?: (context: EmbedHostWidgetContext) => Promise<void> | void;
    setWidgetPlaceholder?: (title: string, message: string) => void;
  };
};

function resolveOptionalCatalogUrl(
  value: string | (() => string | null | undefined) | null | undefined,
): string | null {
  if (typeof value === "function") {
    const resolved = value();
    return typeof resolved === "string" && resolved.trim() ? resolved.trim() : null;
  }
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export type StandardMarketplaceRuntimeController = {
  widgetContext: EmbedHostWidgetContextController;
  mount: (mode: StandardMarketplaceRuntimeMode) => Promise<void>;
  emitSessionExpired: (...args: Parameters<XappsHost["emitSessionExpired"]>) => void;
  destroy: () => void;
};

type SplitPanelCatalogEvent =
  | CatalogEvent
  | {
      type: "XAPPS_UI_EXPAND_REQUEST";
      data?: Record<string, unknown>;
    };

function createDefaultHostReturnBuilder(
  paymentResumeState: ReturnType<typeof createHostPaymentResumeState> | null,
  defaultBaseHref: string,
) {
  return (paymentParamsOverride?: URLSearchParams | null) => {
    if (!paymentResumeState) {
      return defaultBaseHref;
    }
    return paymentResumeState.buildHostReturnUrl({
      baseUrl: defaultBaseHref,
      paymentParams: paymentParamsOverride || paymentResumeState.getPendingPaymentParams(),
    });
  };
}

function normalizeApiBasePath(basePath?: string | null): string | null {
  const resolved = String(basePath || "").trim();
  if (!resolved) return null;
  return resolved.endsWith("/") ? resolved.slice(0, -1) : resolved;
}

function buildDefaultHostApi(basePath: string | null, input?: CatalogOptions["hostApi"]) {
  if (!basePath) return input;
  const headers =
    input?.headers && typeof input.headers === "object" && !Array.isArray(input.headers)
      ? input.headers
      : undefined;
  return {
    createCatalogSessionUrl: `${basePath}/create-catalog-session`,
    createWidgetSessionUrl: `${basePath}/create-widget-session`,
    installationsUrl: `${basePath}/installations`,
    ...(headers ? { headers } : {}),
    ...(input || {}),
  };
}

function buildDefaultMutationOptions(
  basePath: string | null,
  input: false | EmbedHostMutationOptions | undefined,
): false | EmbedHostMutationOptions | undefined {
  if (!input) return input;
  if (!basePath) return input;
  return {
    endpoints: {
      install: `${basePath}/install`,
      update: `${basePath}/update`,
      uninstall: `${basePath}/uninstall`,
      ...(input.endpoints || {}),
    },
    ...input,
  };
}

function normalizeResumeTarget(
  paymentResumeState: ReturnType<typeof createHostPaymentResumeState> | null,
  buildHostReturnUrl: (paymentParamsOverride?: URLSearchParams | null) => string,
): EmbedHostPendingResumeTarget | null {
  if (!paymentResumeState) return null;
  const resume = paymentResumeState.getResume();
  if (!resume) return null;
  const installationId = String(resume.installationId || "").trim();
  const widgetId = String(resume.widgetId || "").trim();
  if (!installationId || !widgetId) return null;
  const paymentParams = paymentResumeState.getPendingPaymentParams();
  return {
    installationId,
    widgetId,
    xappId: String(resume.xappId || "").trim() || null,
    paymentParams,
    hostReturnUrl: buildHostReturnUrl(paymentParams),
  };
}

function consumeResumeTarget(
  paymentResumeState: ReturnType<typeof createHostPaymentResumeState> | null,
  buildHostReturnUrl: (paymentParamsOverride?: URLSearchParams | null) => string,
): EmbedHostPendingResumeTarget | null {
  const target = normalizeResumeTarget(paymentResumeState, buildHostReturnUrl);
  if (!target || !paymentResumeState) return target;
  paymentResumeState.consumeResume();
  paymentResumeState.consumePaymentParams();
  return target;
}

function resolveEmbedUrl(embedUrlRaw: string, baseUrl: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(embedUrlRaw)
    ? embedUrlRaw
    : new URL(embedUrlRaw, baseUrl).toString();
}

function applyThemeToDocument(theme: CatalogOptions["theme"] | null | undefined) {
  if (!theme || typeof theme !== "object" || typeof document === "undefined") return;
  const root = document.documentElement;
  const map: Array<[string, string[]]> = [
    ["primary", ["--cx-primary", "--mx-primary"]],
    ["primaryDark", ["--cx-primary-dark", "--mx-primary-hover"]],
    ["bg", ["--cx-bg", "--mx-bg"]],
    ["bgSubtle", ["--cx-bg-subtle", "--mx-bg-subtle"]],
    ["card", ["--cx-card", "--mx-card-bg"]],
    ["border", ["--cx-border", "--mx-border"]],
    ["text", ["--cx-text", "--mx-text-main"]],
    ["muted", ["--cx-muted", "--mx-text-muted"]],
    ["shadowSm", ["--cx-shadow-sm", "--mx-shadow-sm"]],
    ["shadow", ["--cx-shadow", "--mx-shadow", "--mx-shadow-lg"]],
    ["shadowLg", ["--cx-shadow-lg", "--mx-shadow-lg"]],
    ["radiusSm", ["--cx-radius-sm", "--mx-radius-sm"]],
    ["radiusMd", ["--cx-radius-md", "--mx-radius-md"]],
    ["radius", ["--cx-radius", "--cx-radius-lg", "--mx-radius-md", "--mx-radius-lg"]],
    ["radiusLg", ["--cx-radius-lg", "--mx-radius-lg"]],
  ];
  for (const [key, cssVars] of map) {
    const value =
      typeof theme[key as keyof typeof theme] === "string" ? theme[key as keyof typeof theme] : "";
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) continue;
    for (const cssVar of cssVars) {
      root.style.setProperty(cssVar, normalized);
    }
  }
  if (
    typeof theme.radius === "string" &&
    theme.radius.trim() &&
    !(typeof theme.radiusSm === "string" && theme.radiusSm.trim())
  ) {
    root.style.setProperty("--cx-radius-sm", theme.radius.trim());
    root.style.setProperty("--mx-radius-sm", theme.radius.trim());
  }
  if (typeof theme.bg === "string" && theme.bg.trim() && !theme.bgSubtle) {
    root.style.setProperty("--cx-bg-subtle", theme.bg.trim());
    root.style.setProperty("--mx-bg-subtle", theme.bg.trim());
  }
  const directTokens =
    theme.tokens && typeof theme.tokens === "object" && !Array.isArray(theme.tokens)
      ? (theme.tokens as Record<string, unknown>)
      : null;
  if (directTokens) {
    for (const [cssVar, rawValue] of Object.entries(directTokens)) {
      const value = typeof rawValue === "string" ? rawValue.trim() : "";
      if (!value) continue;
      if (!cssVar.startsWith("--mx-") && !cssVar.startsWith("--cx-")) continue;
      root.style.setProperty(cssVar, value);
    }
  }
}

function getMountedWidgetSourceWindow(widgetMount: HTMLElement | null): Window | null {
  const widgetIframe =
    widgetMount && "querySelector" in widgetMount ? widgetMount.querySelector("iframe") : null;
  return widgetIframe instanceof HTMLIFrameElement && widgetIframe.contentWindow
    ? widgetIframe.contentWindow
    : null;
}

export function createEmbedHostWidgetContext(
  initial?: Partial<EmbedHostWidgetContext> | null,
): EmbedHostWidgetContextController {
  let current: EmbedHostWidgetContext = {
    installationId: String(initial?.installationId || "").trim() || null,
    widgetId: String(initial?.widgetId || "").trim() || null,
    xappId: String(initial?.xappId || "").trim() || null,
  };
  return {
    get: () => ({ ...current }),
    set: (next) => {
      const value = next && typeof next === "object" ? next : {};
      current = {
        installationId: String(value.installationId || "").trim() || null,
        widgetId: String(value.widgetId || "").trim() || null,
        xappId: String(value.xappId || "").trim() || null,
      };
    },
    reset: () => {
      current = {
        installationId: null,
        widgetId: null,
        xappId: null,
      };
    },
  };
}

export function createMutationFailureCallbacks(
  options?: CreateMutationFailureCallbacksOptions,
): Pick<EmbedHostMutationOptions, "onInstallFailure" | "onUpdateFailure" | "onUninstallFailure"> {
  const installMessage = String(options?.installMessage || "Install failed").trim();
  const updateMessage = String(options?.updateMessage || "Update failed").trim();
  const uninstallMessage = String(options?.uninstallMessage || "Uninstall failed").trim();
  return {
    onInstallFailure: async ({ error }) => {
      await options?.notify?.(
        `${installMessage}: ${String(error?.message || error || "Unknown error")}`,
        "error",
      );
    },
    onUpdateFailure: async ({ error }) => {
      await options?.notify?.(
        `${updateMessage}: ${String(error?.message || error || "Unknown error")}`,
        "error",
      );
    },
    onUninstallFailure: async ({ error }) => {
      await options?.notify?.(
        `${uninstallMessage}: ${String(error?.message || error || "Unknown error")}`,
        "error",
      );
    },
  };
}

export function createStandardMarketplaceRuntime(
  options: CreateStandardMarketplaceRuntimeOptions,
): StandardMarketplaceRuntimeController {
  let currentEmbedHost: EmbedHostController | null = null;
  let resumeHandled = false;
  let resumeOpenInFlight = false;
  let splitPanelPaymentParams = new URLSearchParams();
  const widgetContext = options.widgetContext || createEmbedHostWidgetContext();
  const apiBasePath = String(options.apiBasePath || "/api").trim() || "/api";
  const failureCallbacks = createMutationFailureCallbacks({
    notify: (message, variant) => options.hostUi.showNotification(message, variant || "error"),
  });

  function clearWidgetPanel(message: string) {
    widgetContext.reset();
    options.splitPanel?.setWidgetPlaceholder?.("", message);
  }

  function buildHostReturnUrl(paymentParamsOverride: URLSearchParams | null = null) {
    return options.paymentResumeState.buildHostReturnUrl({
      baseUrl: window.location.href,
      paymentParams:
        paymentParamsOverride instanceof URLSearchParams
          ? paymentParamsOverride
          : options.paymentResumeState.getPendingPaymentParams(),
    });
  }

  function getCurrentHostApiClient() {
    const client = currentEmbedHost?.hostApiClient;
    if (typeof client !== "function") {
      throw new Error("Host API client is not initialized");
    }
    return client;
  }

  async function callBridgeApi(path: string, payload?: Record<string, unknown>) {
    return getCurrentHostApiClient()(path, payload, { method: "POST" });
  }

  function createController(
    mode: StandardMarketplaceRuntimeMode,
    catalogMount: HTMLElement | null,
    widgetMount: HTMLElement | null,
    overrides: Partial<CreateEmbedHostOptions> = {},
  ) {
    if (!catalogMount) {
      throw new Error("Catalog mount container is not available");
    }
    return createEmbedHost({
      container: catalogMount,
      baseUrl: options.baseUrl,
      subjectId: String(options.subjectId || "").trim() || undefined,
      theme: options.theme,
      ...(mode === "split-panel" && widgetMount ? { widgetMount: { container: widgetMount } } : {}),
      apiBasePath,
      apiClientOptions: {
        timeoutMs: 15000,
        defaultHeaders: {
          ...(options.hostApiHeaders || {}),
          ...((options.hostApiClientOptions && options.hostApiClientOptions.defaultHeaders) || {}),
        },
        ...(options.hostApiClientOptions || {}),
      },
      hostApi: {
        headers: options.hostApiHeaders || {},
      },
      paymentResume: false,
      bridgeV2:
        options.bridgeV2 === false
          ? false
          : {
              callApi: callBridgeApi,
              getWidgetContext: () => ({
                installationId: widgetContext.get().installationId || "",
                widgetId: widgetContext.get().widgetId || "",
              }),
              getSubjectId: () => String(options.subjectId || "").trim() || undefined,
              getHostOrigin: options.bridgeV2?.getHostOrigin || (() => window.location.origin),
              getHostReturnUrl: () => buildHostReturnUrl(),
              getPortalToken: options.bridgeV2?.getPortalToken,
              clearSession: options.bridgeV2?.clearSession || (() => {}),
              endpoints: options.bridgeV2?.endpoints,
            },
      uiBridge: {
        ...options.hostUi.bridgeOptions,
        navigate:
          options.navigate ||
          ((path) => {
            const next = String(path || "").trim();
            if (!next) return;
            if (/^https?:\/\//i.test(next)) window.location.href = next;
            else window.location.hash = next;
          }),
        refresh: options.refresh || (() => window.location.reload()),
        updateState: (patch) => {
          if (patch && typeof patch === "object" && Object.keys(patch).length > 0) {
            options.onStatePatch?.(patch);
          }
        },
        getContext: () => ({
          installationId: widgetContext.get().installationId || "",
          widgetId: widgetContext.get().widgetId || "",
          devMode: false,
          ...(options.getContext?.() || {}),
        }),
      },
      ...overrides,
    });
  }

  async function resumeSplitPanelWidget() {
    if (resumeHandled || resumeOpenInFlight || !currentEmbedHost) return;
    resumeOpenInFlight = true;
    try {
      const resumed = await currentEmbedHost.resumeWidget({
        subjectId: String(options.subjectId || "").trim() || null,
        widgetMount: options.getWidgetMount?.() || null,
        title: String(options.splitPanel?.widgetTitle || "App Widget"),
      });
      if (resumed) {
        resumeHandled = true;
        splitPanelPaymentParams = new URLSearchParams();
        widgetContext.set({
          installationId: resumed.installationId,
          widgetId: resumed.widgetId,
          xappId: resumed.xappId,
        });
      }
    } finally {
      resumeOpenInFlight = false;
    }
  }

  async function mountSinglePanel() {
    const catalogMount = options.getCatalogMount();
    const widgetMount = options.getWidgetMount?.() || null;
    if (widgetMount) widgetMount.innerHTML = "";

    const pendingResume = options.paymentResumeState.getResume();
    const resumeInstallationId = pendingResume
      ? String(pendingResume.installationId || "").trim()
      : "";
    const resumeWidgetId = pendingResume ? String(pendingResume.widgetId || "").trim() : "";
    const catalogPath =
      resumeInstallationId && resumeWidgetId
        ? `/embed/catalog/widget/${encodeURIComponent(resumeInstallationId)}/${encodeURIComponent(resumeWidgetId)}`
        : "/embed/catalog";
    const paymentParams = pendingResume
      ? options.paymentResumeState.getPendingPaymentParams()
      : new URLSearchParams();
    const catalogParams = new URLSearchParams();
    catalogParams.set("embedMode", "true");
    currentEmbedHost = createController("single-panel", catalogMount, null, {
      catalogUrl:
        options.singlePanel?.catalogUrl ||
        `${options.baseUrl}${catalogPath}?${catalogParams.toString()}`,
      embedContext: {
        getHostReturnUrl: () => buildHostReturnUrl(paymentParams),
        getPaymentParams: () => paymentParams,
      },
      mutationHandler: {
        getSubjectId: () => String(options.subjectId || "").trim() || undefined,
        callApi: callBridgeApi,
        ...failureCallbacks,
      },
      onEvent: async (evt) => {
        if (evt.type === "XAPPS_OPEN_WIDGET") {
          const data = evt.data as Record<string, unknown> | undefined;
          widgetContext.set({
            installationId: evt.data?.installationId || null,
            widgetId: evt.data?.widgetId || null,
            xappId: String(data?.xappId || "").trim() || null,
          });
        }
      },
    });
    await currentEmbedHost.mountCatalog();
    const resumed = !resumeHandled
      ? currentEmbedHost.resumeCatalogWidget({
          delayMs: Math.max(0, Number(options.singlePanel?.resumeDelayMs || 220)),
        })
      : null;
    if (resumed) {
      resumeHandled = true;
      widgetContext.set({
        installationId: resumed.installationId,
        widgetId: resumed.widgetId,
        xappId: resumed.xappId,
      });
    }
  }

  async function mountSplitPanel() {
    const catalogMount = options.getCatalogMount();
    const widgetMount = options.getWidgetMount?.() || null;
    if (widgetMount) {
      widgetMount.innerHTML = "";
      options.splitPanel?.setWidgetPlaceholder?.(
        "",
        String(
          options.splitPanel?.placeholderMessage ||
            "Select an app from the marketplace to open its widget in this panel.",
        ),
      );
    }
    widgetContext.reset();
    const pendingResume = options.paymentResumeState.getResume();
    splitPanelPaymentParams = pendingResume
      ? options.paymentResumeState.getPendingPaymentParams()
      : new URLSearchParams();
    const splitPanelEvents = createSplitPanelCatalogEventHandler({
      getExpandOverlay: () => currentEmbedHost?.expandOverlay || null,
      widgetMount,
      getWidgetContext: () => widgetContext.get(),
      setWidgetContext: (next) => widgetContext.set(next),
      clearWidget: (message) => clearWidgetPanel(message),
      emptyCatalogMessage:
        options.splitPanel?.emptyCatalogMessage ||
        "Select an app from the marketplace to open its widget.",
      xappDetailMismatchMessage:
        options.splitPanel?.xappDetailMismatchMessage ||
        "Select a widget from this app to open it.",
      onWidgetOpened: async (context) => {
        options.hostUi.showNotification("Widget opened.", "success");
        await options.splitPanel?.onWidgetOpened?.(context);
      },
      onExpandError: options.splitPanel?.onExpandError,
    });
    const splitPanelMutations = createSplitPanelMutationCallbacks({
      widgetMount,
      getHost: () => currentEmbedHost?.host || null,
      getWidgetContext: () => widgetContext.get(),
      setWidgetContext: (next) => widgetContext.set(next),
      clearWidget: (message) => clearWidgetPanel(message),
      notify: (message, variant) => options.hostUi.showNotification(message, variant || "info"),
    });
    const splitPanelCatalogUrl =
      resolveOptionalCatalogUrl(options.splitPanel?.catalogUrl) ||
      `${options.baseUrl}/embed/catalog?embedMode=false`;
    currentEmbedHost = createController("split-panel", catalogMount, widgetMount, {
      catalogUrl: splitPanelCatalogUrl,
      embedContext: {
        getHostReturnUrl: () => buildHostReturnUrl(splitPanelPaymentParams),
        getPaymentParams: () => new URLSearchParams(splitPanelPaymentParams.toString()),
      },
      mutationHandler: {
        getSubjectId: () => String(options.subjectId || "").trim() || undefined,
        callApi: callBridgeApi,
        ...splitPanelMutations,
        ...failureCallbacks,
      },
      onEvent: async (evt) => {
        await splitPanelEvents(evt);
      },
    });
    await currentEmbedHost.mountCatalog();
    await resumeSplitPanelWidget();
  }

  return {
    widgetContext,
    async mount(mode) {
      const resolvedMode = mode === "split-panel" ? "split-panel" : "single-panel";
      if (currentEmbedHost) currentEmbedHost.destroy();
      currentEmbedHost = null;
      widgetContext.reset();
      resumeHandled = false;
      resumeOpenInFlight = false;

      if (resolvedMode === "split-panel") await mountSplitPanel();
      else await mountSinglePanel();
    },
    emitSessionExpired(...args) {
      currentEmbedHost?.emitSessionExpired(...args);
    },
    destroy() {
      try {
        currentEmbedHost?.destroy();
      } catch {}
    },
  };
}

export function createSplitPanelCatalogEventHandler(
  options: CreateSplitPanelCatalogEventHandlerOptions,
) {
  const emptyCatalogMessage =
    String(options.emptyCatalogMessage || "").trim() ||
    "Select an app from the marketplace to open its widget.";
  const xappDetailMismatchMessage =
    String(options.xappDetailMismatchMessage || "").trim() ||
    "Select a widget from this app to open it.";

  return async (evt: SplitPanelCatalogEvent): Promise<boolean> => {
    if (evt.type === "XAPPS_UI_EXPAND_REQUEST") {
      try {
        const expandOverlay =
          (typeof options.getExpandOverlay === "function" ? options.getExpandOverlay() : null) ||
          options.expandOverlay ||
          null;
        const sourceWindow = getMountedWidgetSourceWindow(options.widgetMount);
        const result = await expandOverlay?.handleExpandRequest((evt.data || {}) as any, {
          source: sourceWindow,
          data: evt,
        });
        try {
          sourceWindow?.postMessage(
            {
              type: "XAPPS_UI_EXPAND_RESULT",
              ok: true,
              data: result || { hostManaged: false, expanded: false, stage: "inline" },
            },
            "*",
          );
        } catch {}
      } catch (error) {
        if (typeof options.onExpandError === "function") {
          await options.onExpandError(error);
        }
      }
      return true;
    }

    if (evt.type === "XAPPS_OPEN_WIDGET") {
      const data = evt.data as Record<string, unknown> | undefined;
      const installationId = String(evt.data?.installationId || "").trim();
      if (!installationId) return false;
      const next = {
        installationId,
        widgetId: String(evt.data?.widgetId || "").trim() || null,
        xappId: String(data?.xappId || "").trim() || null,
      };
      options.setWidgetContext(next);
      if (typeof options.onWidgetOpened === "function") {
        await options.onWidgetOpened(next);
      }
      return true;
    }

    if (evt.type === "XAPPS_IFRAME_NAVIGATED") {
      const page = evt.data?.page;
      const params = evt.data?.params || {};
      if (page === "catalog" || page === "requests") {
        options.clearWidget(emptyCatalogMessage);
        return true;
      }
      if (page === "xapp-detail") {
        const navXappId = String(params.xappId || "").trim() || null;
        const current = options.getWidgetContext();
        if (current.xappId && current.xappId !== navXappId) {
          options.clearWidget(xappDetailMismatchMessage);
          return true;
        }
      }
    }

    return false;
  };
}

export function createSplitPanelMutationCallbacks(
  options: CreateSplitPanelMutationCallbacksOptions,
): Pick<EmbedHostMutationOptions, "onInstallSuccess" | "onUpdateSuccess" | "onUninstallSuccess"> {
  const uninstalledMessage =
    String(options.uninstalledMessage || "").trim() ||
    "This app was uninstalled. Select another app to open its widget.";

  return {
    onInstallSuccess: async ({ event, installation }) => {
      options.setWidgetContext({
        installationId: installation.installationId || null,
        widgetId: event.data?.defaultWidgetId || null,
        xappId:
          installation.xappId || (event.data as Record<string, unknown> | undefined)?.xappId
            ? String(
                installation.xappId ||
                  (event.data as Record<string, unknown> | undefined)?.xappId ||
                  "",
              ).trim() || null
            : null,
      });
      if (typeof options.notify === "function") {
        await options.notify("App installed.", "success");
      }
    },
    onUpdateSuccess: async ({ event }) => {
      if (typeof options.notify === "function") {
        await options.notify("App updated.", "success");
      }
      try {
        if (!options.widgetMount) return;
        const current = options.getWidgetContext();
        if (!current.installationId || !current.widgetId) return;
        if (options.widgetMount.offsetParent === null) return;
        if (current.installationId !== event.data?.installationId) return;
        const host = options.getHost();
        if (!host) return;
        await host.openWidget({
          installationId: current.installationId,
          widgetId: current.widgetId,
        });
      } catch {}
    },
    onUninstallSuccess: async ({ event }) => {
      if (typeof options.notify === "function") {
        await options.notify("App uninstalled.", "success");
      }
      const current = options.getWidgetContext();
      if (String(event.data.installationId || "") !== String(current.installationId || "")) {
        return;
      }
      options.clearWidget(uninstalledMessage);
    },
  };
}

/**
 * Composes the current host-side embed SDK primitives into a single reusable controller.
 *
 * This intentionally stays thin: it does not replace host-specific event logic, but it removes
 * the repetitive wiring for API client creation, bridge v2 handlers, payment resume state,
 * expand overlay, host UI bridge, and marketplace mutation handling.
 */
export function createEmbedHost(options: CreateEmbedHostOptions): EmbedHostController {
  const {
    onEvent: userOnEvent,
    apiBasePath: _apiBasePath,
    apiClient: _apiClient,
    apiClientOptions: _apiClientOptions,
    paymentResume: _paymentResume,
    bridgeV2: _bridgeV2,
    mutationHandler: _mutationHandler,
    uiBridge: _uiBridge,
    expandOverlay: _expandOverlay,
    ...catalogOptions
  } = options;
  const apiBasePath = normalizeApiBasePath(options.apiBasePath);
  applyThemeToDocument(options.theme);

  const hostApiClient = options.apiClient || createHostApiClient(options.apiClientOptions);

  const paymentResumeHref = String(
    options.paymentResume && typeof options.paymentResume === "object"
      ? options.paymentResume.href || (typeof window !== "undefined" ? window.location.href : "")
      : typeof window !== "undefined"
        ? window.location.href
        : "",
  );
  const paymentResumeState =
    options.paymentResume === false
      ? null
      : createHostPaymentResumeState(
          paymentResumeHref,
          options.paymentResume && typeof options.paymentResume === "object"
            ? options.paymentResume.options
            : undefined,
        );

  const buildHostReturnUrl = createDefaultHostReturnBuilder(paymentResumeState, paymentResumeHref);

  const bridgeV2Config =
    options.bridgeV2 === false || options.bridgeV2?.enabled === false
      ? null
      : options.bridgeV2 || {};
  const bridgeV2Handlers = bridgeV2Config
    ? createBridgeV2ApiHandlers({
        callApi: bridgeV2Config.callApi || hostApiClient,
        ...bridgeV2Config,
        getHostOrigin:
          bridgeV2Config.getHostOrigin ||
          (() =>
            typeof window !== "undefined" && window.location
              ? String(window.location.origin || "")
              : ""),
        getHostReturnUrl: bridgeV2Config.getHostReturnUrl || (() => buildHostReturnUrl()),
      })
    : null;

  const ownsExpandOverlay = options.expandOverlay !== false && !options.expandOverlay;
  const expandOverlay =
    options.expandOverlay === false
      ? null
      : options.expandOverlay || createHostExpandOverlayController();

  const uiBridgeOptions = options.uiBridge === false ? null : options.uiBridge || {};
  const uiBridge = uiBridgeOptions
    ? createHostUiBridge({
        ...uiBridgeOptions,
        expandWidget:
          uiBridgeOptions.expandWidget ||
          (expandOverlay
            ? (input, event) => expandOverlay.handleExpandRequest(input, event)
            : undefined),
      })
    : null;

  let hostRef: XappsHost | null = null;
  const mutationOptions =
    options.mutationHandler === false || options.mutationHandler?.enabled === false
      ? null
      : buildDefaultMutationOptions(apiBasePath, options.mutationHandler || {});
  const mutationHandler = mutationOptions
    ? createMarketplaceMutationEventHandler({
        ...mutationOptions,
        callApi: mutationOptions.callApi || hostApiClient,
        getHost: () => hostRef,
      })
    : null;

  const hostApiConfig = buildDefaultHostApi(apiBasePath, catalogOptions.hostApi);

  const handleEvent = async (evt: CatalogEvent) => {
    if (mutationHandler && (await mutationHandler(evt))) return true;
    if (typeof userOnEvent === "function") {
      await userOnEvent(evt);
    }
    return false;
  };

  const host = createHost({
    ...catalogOptions,
    hostApi: hostApiConfig,
    bridgeV2: bridgeV2Handlers || undefined,
    onEvent: handleEvent,
  });
  hostRef = host;

  return {
    host,
    hostApiClient,
    paymentResumeState,
    bridgeV2Handlers,
    expandOverlay,
    uiBridge,
    handleEvent,
    mutationHandler,
    mountCatalog: host.mountCatalog.bind(host),
    mountXapp: host.mountXapp.bind(host),
    openWidget: host.openWidget.bind(host),
    emitToCatalog: host.emitToCatalog.bind(host),
    emitSessionExpired: host.emitSessionExpired.bind(host),
    buildHostReturnUrl,
    readPendingResumeTarget: () => normalizeResumeTarget(paymentResumeState, buildHostReturnUrl),
    consumePendingResumeTarget: () => consumeResumeTarget(paymentResumeState, buildHostReturnUrl),
    resumeCatalogWidget: (options) => {
      const target = consumeResumeTarget(paymentResumeState, buildHostReturnUrl);
      if (!target) return null;
      window.setTimeout(
        () => {
          try {
            host.emitToCatalog({
              type: "XAPPS_OPEN_WIDGET",
              data: {
                installationId: target.installationId,
                widgetId: target.widgetId,
              },
            });
          } catch {}
        },
        Math.max(0, Number(options?.delayMs || 0)),
      );
      return target;
    },
    resumeWidget: async (options) => {
      const target = normalizeResumeTarget(paymentResumeState, buildHostReturnUrl);
      if (!target) return null;
      try {
        await host.openWidget({
          installationId: target.installationId,
          widgetId: target.widgetId,
          hostReturnUrl: target.hostReturnUrl,
        });
        consumeResumeTarget(paymentResumeState, buildHostReturnUrl);
        return target;
      } catch {
        const widgetMount = options?.widgetMount || null;
        const widgetSessionUrl = String(hostApiConfig?.createWidgetSessionUrl || "").trim();
        if (!widgetMount || !widgetSessionUrl) {
          return null;
        }
        const session = await hostApiClient(
          widgetSessionUrl,
          {
            installationId: target.installationId,
            widgetId: target.widgetId,
            origin: typeof window !== "undefined" && window.location ? window.location.origin : "",
            ...(options?.subjectId ? { subjectId: options.subjectId } : {}),
            ...(target.hostReturnUrl ? { hostReturnUrl: target.hostReturnUrl } : {}),
          },
          { method: "POST" },
        );
        const embedUrlRaw = String((session && session.embedUrl) || "").trim();
        if (!embedUrlRaw) {
          return null;
        }
        const iframe = document.createElement("iframe");
        iframe.src = resolveEmbedUrl(embedUrlRaw, catalogOptions.baseUrl);
        iframe.setAttribute("title", String(options?.title || "App Widget"));
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "0";
        widgetMount.innerHTML = "";
        widgetMount.appendChild(iframe);
        consumeResumeTarget(paymentResumeState, buildHostReturnUrl);
        return target;
      }
    },
    destroy: () => {
      host.destroy();
      try {
        uiBridge?.detach();
      } catch {}
      if (ownsExpandOverlay) {
        try {
          expandOverlay?.destroy();
        } catch {}
      }
    },
  };
}
