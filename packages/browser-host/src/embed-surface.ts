import {
  resolveBridgeEndpoints,
  resolveHostApiBasePath,
  resolveHostConfigUrl,
  type BrowserHostBackendBaseInput,
} from "./backend-base.js";
import {
  DEFAULT_HOST_BOOTSTRAP_URL,
  DEFAULT_IDENTITY_STORAGE_KEY,
  buildStoredHostIdentity,
  clearStoredHostIdentity,
  executeHostBootstrap,
  normalizeHostIdentityInput,
  readActiveHostIdentity,
  readStoredHostIdentity,
  refreshStoredHostIdentity,
  writeStoredHostIdentity,
  type HostIdentityInput,
  type StoredHostIdentity,
} from "./launcher-core.js";
import {
  STANDARD_HOST_THEMES,
  createStandardHostMarketplaceRuntime,
  resolveStandardTheme,
} from "./standard-runtime.js";
import type { CatalogEmbedTheme } from "./marketplace-runtime.js";

type FetchLike = typeof fetch;
type SurfaceKind = "marketplace" | "single-xapp";
type MarketplaceMode = "single-panel" | "split-panel";

type EmbedSdkModule = {
  createHostDomUiController: (input?: Record<string, unknown>) => {
    bridgeOptions: Record<string, unknown>;
    showNotification?: (message: string, variant?: string) => void;
    destroy?: () => void;
  };
  createHostPaymentResumeState: (
    href: string,
    options?: Record<string, unknown>,
  ) => {
    getResume: () => { xappId?: string | null } | null;
    getPendingPaymentParams: () => URLSearchParams;
    buildHostReturnUrl: (input: {
      baseUrl: string;
      paymentParams?: URLSearchParams | null;
    }) => string;
  };
  createHostApiClient?: (input: {
    fetchImpl: FetchLike;
    timeoutMs?: number;
  }) => (path: string, payload?: unknown, init?: RequestInit) => Promise<any>;
  createStandardMarketplaceRuntime?: (...args: any[]) => any;
  createEmbedHost: (input: Record<string, unknown>) => {
    mountXapp: (xappId: string) => Promise<void>;
    readPendingResumeTarget: () => { xappId?: string | null } | null;
    resumeCatalogWidget: (input?: { delayMs?: number }) => void;
    destroy: () => void;
    emitSessionExpired?: (reason?: string) => void;
    emitLocaleChanged?: (locale: string) => void;
    setLocale?: (locale: string) => void;
  };
  createEmbedHostWidgetContext: () => {
    get: () => { installationId: string | null; widgetId: string | null; xappId: string | null };
    set: (next: Record<string, unknown>) => void;
    reset: () => void;
  };
  createMutationFailureCallbacks?: (input?: Record<string, unknown>) => Record<string, unknown>;
};

export type BootstrapXappsSurfaceSessionOptions = {
  hostBootstrapUrl?: string;
  identityStorageKey?: string;
  fetchImpl?: FetchLike;
};

export type MountXappsSurfaceOptions = BrowserHostBackendBaseInput & {
  surface: SurfaceKind;
  container: HTMLElement;
  widgetContainer?: HTMLElement | null;
  mode?: MarketplaceMode;
  xappId?: string | null;
  locale?: string | null;
  themeKey?: string | null;
  defaultThemeKey?: string | null;
  entryHref?: string | null;
  hostBootstrapUrl?: string;
  identityStorageKey?: string;
  identity?: HostIdentityInput | StoredHostIdentity | null;
  refreshIdentity?: (storageKey: string) => Promise<StoredHostIdentity | null>;
  fetchImpl?: FetchLike;
  sdkLoader?: () => Promise<EmbedSdkModule>;
  sdkPath?: string;
  createMarketplaceRuntime?: (options: Record<string, unknown>) => {
    mount: (mode: MarketplaceMode) => Promise<void>;
    destroy: () => void;
    emitSessionExpired?: (reason?: string) => void;
    emitLocaleChanged?: (locale: string) => void;
    setLocale?: (locale: string) => void;
  };
  resolveTheme?: (themeKey: string | null | undefined) => CatalogEmbedTheme | undefined;
  onSessionExpired?: (input: {
    reason?: string;
    surface: SurfaceKind;
    container: HTMLElement;
    widgetContainer?: HTMLElement | null;
    entryHref?: string | null;
  }) => void;
  hostSessionExchangePath?: string;
  hostSessionLogoutPath?: string;
};

export type XappsSurfaceController = {
  surface: SurfaceKind;
  mode: MarketplaceMode | null;
  getIdentity: () => StoredHostIdentity | null;
  getHostConfig: () => Record<string, unknown> | null;
  setLocale: (locale: string) => void;
  emitSessionExpired: (reason?: string) => void;
  logout: () => Promise<void>;
  remount: (next?: { mode?: MarketplaceMode; xappId?: string | null }) => Promise<void>;
  destroy: () => void;
};

type MarketplaceRuntimeController = {
  mount: (mode: MarketplaceMode) => Promise<void>;
  destroy: () => void;
  emitSessionExpired?: (reason?: string) => void;
  emitLocaleChanged?: (locale: string) => void;
  setLocale?: (locale: string) => void;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readCurrentHref() {
  if (typeof window === "undefined" || !window.location) return "http://localhost/";
  return String(window.location.href || "http://localhost/");
}

function readCurrentOrigin() {
  if (typeof window === "undefined" || !window.location) return "";
  return String(window.location.origin || "").trim();
}

function normalizeProvidedStoredIdentity(
  input: StoredHostIdentity | HostIdentityInput | null | undefined,
): StoredHostIdentity | null {
  if (!input || typeof input !== "object") return null;
  const normalized = normalizeHostIdentityInput(input);
  const subjectId = readString((input as StoredHostIdentity).subjectId || normalized.subjectId);
  const bootstrapToken = readString((input as StoredHostIdentity).bootstrapToken);
  if (!subjectId || !bootstrapToken) return null;
  const bootstrapExpiresAt = readString((input as StoredHostIdentity).bootstrapExpiresAt);
  const resolvedAt =
    readString((input as StoredHostIdentity).resolvedAt) || new Date().toISOString();
  return {
    ...(normalized || {}),
    subjectId,
    bootstrapToken,
    ...(bootstrapExpiresAt ? { bootstrapExpiresAt } : {}),
    resolvedAt,
  };
}

function isBootstrapRetryableMessage(message: string) {
  const normalized = readString(message).toLowerCase();
  return (
    normalized === "invalid or expired token" ||
    normalized.includes("host bootstrap token expired") ||
    normalized.includes("missing bootstrap")
  );
}

function normalizeMarketplaceMode(mode: unknown): MarketplaceMode {
  return readString(mode) === "split-panel" ? "split-panel" : "single-panel";
}

function stripBootstrapState(identity: StoredHostIdentity | null) {
  if (!identity || typeof identity !== "object") return null;
  const nextIdentity = { ...(identity as Record<string, unknown>) };
  delete nextIdentity.bootstrapToken;
  delete nextIdentity.bootstrapExpiresAt;
  return nextIdentity as StoredHostIdentity;
}

function ensureHostUiNodes(container: HTMLElement) {
  const doc = container.ownerDocument;
  const mountRoot = doc.createElement("div");
  mountRoot.setAttribute("data-xapps-host-ui", "true");

  const toastRoot = doc.createElement("div");
  toastRoot.style.position = "fixed";
  toastRoot.style.right = "20px";
  toastRoot.style.bottom = "20px";
  toastRoot.style.zIndex = "2147483000";
  toastRoot.style.display = "flex";
  toastRoot.style.flexDirection = "column";
  toastRoot.style.gap = "8px";

  const modalBackdrop = doc.createElement("div");
  modalBackdrop.setAttribute("aria-hidden", "true");
  modalBackdrop.style.position = "fixed";
  modalBackdrop.style.inset = "0";
  modalBackdrop.style.zIndex = "2147482999";
  modalBackdrop.style.background = "rgba(15, 23, 42, 0.55)";
  modalBackdrop.style.display = "none";
  modalBackdrop.style.alignItems = "center";
  modalBackdrop.style.justifyContent = "center";
  modalBackdrop.style.padding = "24px";

  const modalCard = doc.createElement("div");
  modalCard.style.maxWidth = "520px";
  modalCard.style.width = "100%";
  modalCard.style.background = "#ffffff";
  modalCard.style.borderRadius = "16px";
  modalCard.style.padding = "20px";
  modalCard.style.boxShadow = "0 28px 56px rgba(15, 23, 42, 0.24)";

  const modalTitle = doc.createElement("h2");
  modalTitle.style.margin = "0 0 8px";
  modalTitle.style.fontSize = "20px";

  const modalMessage = doc.createElement("p");
  modalMessage.style.margin = "0 0 16px";
  modalMessage.style.color = "#475569";

  const modalClose = doc.createElement("button");
  modalClose.type = "button";
  modalClose.textContent = "Close";
  modalClose.style.border = "0";
  modalClose.style.borderRadius = "10px";
  modalClose.style.padding = "10px 14px";
  modalClose.style.cursor = "pointer";
  modalClose.style.background = "#0f172a";
  modalClose.style.color = "#ffffff";

  modalCard.appendChild(modalTitle);
  modalCard.appendChild(modalMessage);
  modalCard.appendChild(modalClose);
  modalBackdrop.appendChild(modalCard);

  mountRoot.appendChild(toastRoot);
  mountRoot.appendChild(modalBackdrop);
  (doc.body || container).appendChild(mountRoot);

  return {
    toastRoot,
    modalBackdrop,
    modalTitle,
    modalMessage,
    modalClose,
    destroy: () => mountRoot.remove(),
  };
}

function defaultSessionExpiredRenderer({
  reason,
  surface,
  container,
  widgetContainer,
  entryHref,
}: {
  reason?: string;
  surface: SurfaceKind;
  container: HTMLElement;
  widgetContainer?: HTMLElement | null;
  entryHref?: string | null;
}) {
  const title = readString(reason).toLowerCase() === "logout" ? "Session ended" : "Session expired";
  const message =
    surface === "single-xapp"
      ? "The hosted xapp session is no longer valid. Start again from the launcher."
      : "The hosted marketplace session is no longer valid. Start again from the launcher.";
  container.innerHTML = `
    <section style="padding:24px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;">
      <h1 style="margin:0 0 8px;font-size:22px;">${title}</h1>
      <p style="margin:0;color:#475569;">${message}</p>
      ${
        entryHref
          ? `<p style="margin:16px 0 0;"><a href="${String(entryHref)}">Return to launcher</a></p>`
          : ""
      }
    </section>
  `;
  if (widgetContainer) widgetContainer.innerHTML = "";
}

async function loadEmbedSdk(options: {
  sdkLoader?: () => Promise<EmbedSdkModule>;
  sdkPath?: string;
}) {
  if (typeof options.sdkLoader === "function") {
    return options.sdkLoader();
  }
  const path = readString(options.sdkPath) || "/embed/sdk/xapps-embed-sdk.esm.js";
  return import(/* @vite-ignore */ path) as Promise<EmbedSdkModule>;
}

export async function bootstrapXappsSurfaceSession(
  input: HostIdentityInput,
  options: BootstrapXappsSurfaceSessionOptions = {},
) {
  const storageKey = readString(options.identityStorageKey) || DEFAULT_IDENTITY_STORAGE_KEY;
  const result = await executeHostBootstrap(input, {
    hostBootstrapUrl: readString(options.hostBootstrapUrl) || DEFAULT_HOST_BOOTSTRAP_URL,
    fetchImpl: options.fetchImpl,
  });
  const nextIdentity = buildStoredHostIdentity(readStoredHostIdentity(storageKey), result, input);
  writeStoredHostIdentity(storageKey, nextIdentity);
  return nextIdentity;
}

async function resolveIdentityForMount(options: MountXappsSurfaceOptions) {
  const storageKey = readString(options.identityStorageKey) || DEFAULT_IDENTITY_STORAGE_KEY;
  const hostBootstrapUrl = readString(options.hostBootstrapUrl);
  const directIdentity = normalizeProvidedStoredIdentity(options.identity || null);
  if (directIdentity) {
    writeStoredHostIdentity(storageKey, directIdentity);
    return directIdentity;
  }

  const directResolvedIdentity =
    options.identity && typeof options.identity === "object"
      ? normalizeHostIdentityInput(options.identity)
      : null;
  if (!hostBootstrapUrl && directResolvedIdentity?.subjectId) {
    const nextIdentity = {
      ...(readStoredHostIdentity(storageKey) || {}),
      ...directResolvedIdentity,
      resolvedAt: new Date().toISOString(),
    };
    writeStoredHostIdentity(storageKey, nextIdentity);
    return nextIdentity;
  }

  let activeIdentity = readActiveHostIdentity(storageKey);
  if (activeIdentity?.subjectId && (activeIdentity?.bootstrapToken || !hostBootstrapUrl)) {
    return activeIdentity;
  }

  const bootstrapInput =
    options.identity && typeof options.identity === "object"
      ? normalizeHostIdentityInput(options.identity)
      : null;
  if (
    hostBootstrapUrl &&
    bootstrapInput &&
    (bootstrapInput.subjectId || bootstrapInput.identifier || bootstrapInput.email)
  ) {
    return bootstrapXappsSurfaceSession(bootstrapInput, {
      hostBootstrapUrl,
      identityStorageKey: storageKey,
      fetchImpl: options.fetchImpl,
    });
  }

  if (hostBootstrapUrl && typeof options.refreshIdentity === "function") {
    activeIdentity = await options.refreshIdentity(storageKey);
    if (activeIdentity?.subjectId && activeIdentity?.bootstrapToken) {
      return activeIdentity;
    }
  } else if (hostBootstrapUrl) {
    const storedIdentity = readStoredHostIdentity(storageKey);
    const normalizedStored = normalizeHostIdentityInput(storedIdentity || {});
    if (normalizedStored.subjectId || normalizedStored.identifier || normalizedStored.email) {
      try {
        return await refreshStoredHostIdentity(storageKey, hostBootstrapUrl, options.fetchImpl);
      } catch {
        // ignore refresh failure here and fall through to a clear mount error
      }
    }
  }

  throw new Error(
    "Missing host identity. Bootstrap first or pass identity input/bootstrap state into mountXappsSurface.",
  );
}

export async function mountXappsSurface(
  options: MountXappsSurfaceOptions,
): Promise<XappsSurfaceController> {
  const surface = options.surface;
  const storageKey = readString(options.identityStorageKey) || DEFAULT_IDENTITY_STORAGE_KEY;
  const backendInput: BrowserHostBackendBaseInput = {
    backendBaseUrl: options.backendBaseUrl,
    hostConfigPath: options.hostConfigPath,
    apiBasePath: options.apiBasePath,
    bridgeEndpoints: options.bridgeEndpoints,
  };
  const sdk = await loadEmbedSdk({ sdkLoader: options.sdkLoader, sdkPath: options.sdkPath });
  const uiNodes = ensureHostUiNodes(options.container);
  const hostUi = sdk.createHostDomUiController({
    toastRoot: uiNodes.toastRoot,
    modalBackdrop: uiNodes.modalBackdrop,
    modalTitle: uiNodes.modalTitle,
    modalMessage: uiNodes.modalMessage,
    modalClose: uiNodes.modalClose,
  });

  let currentIdentity = await resolveIdentityForMount(options);
  let refreshInFlight: Promise<StoredHostIdentity | null> | null = null;
  let hostConfig: Record<string, unknown> | null = null;
  let destroyed = false;
  let currentMode = normalizeMarketplaceMode(options.mode);
  let useHostSession = false;
  let sessionEnded = false;

  const tryRefreshIdentity = async () => {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        if (typeof options.refreshIdentity === "function") {
          return options.refreshIdentity(storageKey);
        }
        return refreshStoredHostIdentity(
          storageKey,
          readString(options.hostBootstrapUrl) || DEFAULT_HOST_BOOTSTRAP_URL,
          options.fetchImpl,
        );
      })()
        .then((nextIdentity) => {
          if (nextIdentity?.subjectId && nextIdentity?.bootstrapToken) {
            currentIdentity = nextIdentity;
            return nextIdentity;
          }
          return null;
        })
        .catch(() => null)
        .finally(() => {
          refreshInFlight = null;
        });
    }
    return refreshInFlight;
  };

  const getHostApiHeaders = () => {
    if (useHostSession) return undefined;
    const bootstrapToken = readString(currentIdentity?.bootstrapToken);
    return bootstrapToken ? { "X-Xapps-Host-Bootstrap": bootstrapToken } : undefined;
  };

  const isHostSessionRetryableMessage = (message: string) => {
    const normalized = readString(message).toLowerCase();
    return (
      normalized.includes("host session token expired") ||
      normalized.includes("host session token is invalid") ||
      normalized.includes("host session token is malformed") ||
      normalized.includes("missing host session") ||
      normalized.includes("invalid or expired host session")
    );
  };

  const fetchWithBootstrap: FetchLike = async (input, init) => {
    const exec = () =>
      (options.fetchImpl || fetch)(input, {
        ...(init || {}),
        credentials: init?.credentials || "include",
        headers: {
          ...(getHostApiHeaders() || {}),
          ...(((init && init.headers) || {}) as Record<string, string>),
        },
      });

    let response = await exec();
    if (!response.ok && response.status === 401) {
      const message = String(
        await response
          .clone()
          .json()
          .then((value: any) => value?.message || "")
          .catch(() => ""),
      );
      if (isBootstrapRetryableMessage(message)) {
        const refreshed = await tryRefreshIdentity();
        if (refreshed) {
          response = await exec();
        }
      } else if (useHostSession && isHostSessionRetryableMessage(message)) {
        const refreshed = await tryRefreshIdentity();
        if (refreshed) {
          useHostSession = false;
          const exchanged = await exchangeHostSession().catch(() => false);
          if (exchanged) {
            response = await exec();
          }
        }
      }
    }
    return response;
  };

  const exchangeHostSession = async () => {
    if (!readString(currentIdentity?.bootstrapToken)) return false;
    const exchangePath =
      readString(options.hostSessionExchangePath) ||
      `${resolveHostApiBasePath(backendInput)}/host-session/exchange`;
    const exec = async () =>
      (options.fetchImpl || fetch)(exchangePath, {
        method: "POST",
        credentials: "include",
        headers: {
          ...(useHostSession ? {} : getHostApiHeaders() || {}),
        },
      });
    let response = await exec();
    if (!response.ok && response.status === 401) {
      const message = String(
        await response
          .clone()
          .json()
          .then((value: any) => value?.message || "")
          .catch(() => ""),
      );
      if (isBootstrapRetryableMessage(message)) {
        const refreshed = await tryRefreshIdentity();
        if (refreshed) {
          response = await exec();
        }
      }
    }
    if ([404, 405, 501].includes(response.status)) {
      throw new Error("host session exchange is required but not available");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String((data as any)?.message || "host session exchange failed"));
    }
    useHostSession = true;
    currentIdentity = stripBootstrapState(currentIdentity);
    if (currentIdentity) {
      writeStoredHostIdentity(storageKey, currentIdentity);
    }
    return true;
  };

  const logoutHostSession = async () => {
    if (sessionEnded) return;
    const logoutPath =
      readString(options.hostSessionLogoutPath) ||
      `${resolveHostApiBasePath(backendInput)}/host-session/logout`;
    const shouldAttemptHostSessionLogout = Boolean(
      useHostSession ||
      readString(options.hostSessionLogoutPath) ||
      readString(options.hostBootstrapUrl),
    );
    if (shouldAttemptHostSessionLogout) {
      const response = await (options.fetchImpl || fetch)(logoutPath, {
        method: "POST",
        credentials: "include",
      });
      if (![200, 204, 404, 405, 501].includes(response.status)) {
        const data = await response.json().catch(() => ({}));
        throw new Error(String((data as any)?.message || "host session logout failed"));
      }
    }
    sessionEnded = true;
    useHostSession = false;
    currentIdentity = null;
    clearStoredHostIdentity(storageKey);
  };

  const hostApiClient =
    typeof sdk.createHostApiClient === "function"
      ? sdk.createHostApiClient({
          fetchImpl: fetchWithBootstrap,
          timeoutMs: 15000,
        })
      : async (path: string, payload?: unknown, init?: RequestInit) => {
          const response = await fetchWithBootstrap(String(path || ""), {
            method: init?.method || (payload !== undefined ? "POST" : "GET"),
            ...(init || {}),
            headers: {
              ...((init?.headers as Record<string, string>) || {}),
              ...(payload !== undefined && !init?.body
                ? { "Content-Type": "application/json" }
                : {}),
            },
            body:
              init && Object.prototype.hasOwnProperty.call(init, "body")
                ? init.body
                : payload !== undefined
                  ? JSON.stringify(payload)
                  : undefined,
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(String((data as any)?.message || `${String(path || "")} failed`));
          }
          return data;
        };

  if (readString(options.hostBootstrapUrl) && readString(currentIdentity?.bootstrapToken)) {
    await exchangeHostSession();
  }

  const showSessionExpired = (reason?: string) => {
    options.onSessionExpired?.({
      reason,
      surface,
      container: options.container,
      widgetContainer: options.widgetContainer || null,
      entryHref: options.entryHref,
    });
    if (!options.onSessionExpired) {
      defaultSessionExpiredRenderer({
        reason,
        surface,
        container: options.container,
        widgetContainer: options.widgetContainer || null,
        entryHref: options.entryHref,
      });
    }
  };

  const hostConfigResponse = await hostApiClient(resolveHostConfigUrl(backendInput), undefined, {
    method: "GET",
  });
  hostConfig =
    hostConfigResponse &&
    typeof hostConfigResponse === "object" &&
    !Array.isArray(hostConfigResponse)
      ? hostConfigResponse
      : {};
  const gatewayBaseUrl = readString(
    (hostConfig as any).gatewayUrl || "http://localhost:3000",
  ).replace(/\/+$/, "");
  const apiBasePath = resolveHostApiBasePath(backendInput);
  const bridgeEndpoints = resolveBridgeEndpoints(backendInput);
  const paymentResumeState = sdk.createHostPaymentResumeState(readCurrentHref(), {
    autoCleanUrl: true,
  });
  const hostApiCredentials: RequestCredentials | undefined = options.hostBootstrapUrl
    ? "include"
    : undefined;

  const resolveCatalogCustomerProfile = async (input: { xappId?: string | null } = {}) => {
    const xappId = readString(input?.xappId);
    if (!xappId) return null;
    const response = await hostApiClient(`${apiBasePath}/catalog-customer-profile`, {
      subjectId: readString(currentIdentity?.subjectId) || undefined,
      xappId,
    });
    const profile = (response as any)?.customerProfile;
    return profile && typeof profile === "object" && !Array.isArray(profile) ? profile : null;
  };

  if (surface === "marketplace") {
    if (currentMode === "split-panel" && !options.widgetContainer) {
      throw new Error("widgetContainer is required when mounting marketplace in split-panel mode");
    }

    const runtime: MarketplaceRuntimeController =
      typeof options.createMarketplaceRuntime === "function"
        ? options.createMarketplaceRuntime({
            createStandardMarketplaceRuntime: sdk.createStandardMarketplaceRuntime,
            gatewayBaseUrl,
            currentSubjectId: readString(currentIdentity?.subjectId),
            getCustomerProfile: resolveCatalogCustomerProfile,
            locale: readString(options.locale) || null,
            installationPolicy: (hostConfig as any).installationPolicy || null,
            paymentResumeState,
            hostDomUi: hostUi,
            themeKey: readString(options.themeKey) || null,
            defaultThemeKey: readString(options.defaultThemeKey) || "harbor",
            apiBasePath,
            apiClient: hostApiClient,
            hostApiHeadersProvider: getHostApiHeaders,
            hostApiCredentials,
            bridgeV2: {
              clearSession: ({ reason }: { reason?: string } = {}) => showSessionExpired(reason),
              endpoints: bridgeEndpoints,
            },
            getCatalogMount: () => options.container,
            getWidgetMount: () => options.widgetContainer || null,
          })
        : (createStandardHostMarketplaceRuntime({
            createStandardMarketplaceRuntime: sdk.createStandardMarketplaceRuntime,
            gatewayBaseUrl,
            currentSubjectId: readString(currentIdentity?.subjectId),
            getCustomerProfile: resolveCatalogCustomerProfile,
            locale: readString(options.locale) || null,
            installationPolicy: (hostConfig as any).installationPolicy || null,
            paymentResumeState,
            hostDomUi: hostUi,
            themeKey: readString(options.themeKey) || null,
            defaultThemeKey: readString(options.defaultThemeKey) || "harbor",
            apiBasePath,
            apiClient: hostApiClient,
            hostApiHeadersProvider: getHostApiHeaders,
            hostApiCredentials,
            bridgeV2: {
              clearSession: ({ reason }: { reason?: string } = {}) => showSessionExpired(reason),
              endpoints: bridgeEndpoints,
            },
            getCatalogMount: () => options.container,
            getWidgetMount: () => options.widgetContainer || null,
          }) as MarketplaceRuntimeController);

    await runtime.mount(currentMode);

    return {
      surface,
      mode: currentMode,
      getIdentity: () => currentIdentity,
      getHostConfig: () => hostConfig,
      setLocale: (locale: string) => {
        runtime?.setLocale?.(locale);
        runtime?.emitLocaleChanged?.(locale);
      },
      emitSessionExpired: (reason?: string) => {
        runtime?.emitSessionExpired?.(reason);
        showSessionExpired(reason);
      },
      logout: async () => {
        await logoutHostSession();
        runtime?.emitSessionExpired?.("logout");
        showSessionExpired("logout");
      },
      remount: async (next = {}) => {
        currentMode = normalizeMarketplaceMode(next.mode || currentMode);
        await runtime.mount(currentMode);
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        runtime?.destroy?.();
        hostUi?.destroy?.();
        uiNodes.destroy();
      },
    };
  }

  const safeXappId = readString(options.xappId);
  if (!safeXappId) {
    throw new Error("xappId is required when mounting a single-xapp surface");
  }

  const widgetContext = sdk.createEmbedHostWidgetContext();
  const failureCallbacks =
    typeof sdk.createMutationFailureCallbacks === "function"
      ? sdk.createMutationFailureCallbacks({
          notify: (message: string, variant?: string) =>
            hostUi.showNotification?.(message, variant),
        })
      : {};
  const theme =
    (typeof options.resolveTheme === "function"
      ? options.resolveTheme(options.themeKey)
      : resolveStandardTheme(options.themeKey, {
          defaultThemeKey: readString(options.defaultThemeKey) || "harbor",
        })) || STANDARD_HOST_THEMES.harbor;
  const pendingResume = paymentResumeState.getResume();
  const paymentParams = pendingResume
    ? paymentResumeState.getPendingPaymentParams()
    : new URLSearchParams();

  let controller = sdk.createEmbedHost({
    container: options.container,
    baseUrl: gatewayBaseUrl,
    catalogUrl: `${gatewayBaseUrl}/embed/catalog?embedMode=true`,
    subjectId: readString(currentIdentity?.subjectId) || undefined,
    getCustomerProfile: () => resolveCatalogCustomerProfile({ xappId: safeXappId }),
    locale: readString(options.locale) || undefined,
    theme,
    apiBasePath,
    apiClient: hostApiClient,
    hostApiHeaders: getHostApiHeaders(),
    hostApiHeadersProvider: getHostApiHeaders,
    hostApiCredentials,
    paymentResume: false,
    embedContext: {
      getHostReturnUrl: () =>
        paymentResumeState.buildHostReturnUrl({
          baseUrl: readCurrentHref(),
          paymentParams,
        }),
      getPaymentParams: () => paymentParams,
    },
    bridgeV2: {
      getWidgetContext: () => ({
        installationId: widgetContext.get().installationId || "",
        widgetId: widgetContext.get().widgetId || "",
      }),
      getSubjectId: () => readString(currentIdentity?.subjectId) || undefined,
      getHostOrigin: () => readCurrentOrigin(),
      getHostReturnUrl: () =>
        paymentResumeState.buildHostReturnUrl({
          baseUrl: readCurrentHref(),
          paymentParams: paymentResumeState.getPendingPaymentParams(),
        }),
      clearSession: ({ reason }: { reason?: string } = {}) => showSessionExpired(reason),
      endpoints: bridgeEndpoints,
    },
    uiBridge: {
      ...hostUi.bridgeOptions,
      getContext: () => ({
        installationId: widgetContext.get().installationId || "",
        widgetId: widgetContext.get().widgetId || "",
        devMode: false,
      }),
    },
    mutationHandler: {
      getSubjectId: () => readString(currentIdentity?.subjectId) || undefined,
      ...failureCallbacks,
    },
    onEvent: async (evt: any) => {
      if (evt?.type === "XAPPS_OPEN_WIDGET") {
        widgetContext.set({
          installationId: evt?.data?.installationId || null,
          widgetId: evt?.data?.widgetId || null,
          xappId: evt?.data?.xappId || safeXappId,
        });
      }
    },
  });

  await controller.mountXapp(safeXappId);
  const resumeTarget = controller.readPendingResumeTarget();
  if (resumeTarget && (!resumeTarget.xappId || readString(resumeTarget.xappId) === safeXappId)) {
    controller.resumeCatalogWidget({ delayMs: 220 });
  }

  return {
    surface,
    mode: null,
    getIdentity: () => currentIdentity,
    getHostConfig: () => hostConfig,
    setLocale: (locale: string) => {
      controller?.setLocale?.(locale);
      controller?.emitLocaleChanged?.(locale);
    },
    emitSessionExpired: (reason?: string) => {
      controller?.emitSessionExpired?.(reason);
      showSessionExpired(reason);
    },
    logout: async () => {
      await logoutHostSession();
      controller?.emitSessionExpired?.("logout");
      showSessionExpired("logout");
    },
    remount: async (next = {}) => {
      const nextXappId = readString(next.xappId || safeXappId);
      await controller.mountXapp(nextXappId);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      controller?.destroy?.();
      hostUi?.destroy?.();
      uiNodes.destroy();
    },
  };
}

export const bootstrapXappsEmbedSession = bootstrapXappsSurfaceSession;

export async function mountCatalogEmbed(
  options: Omit<MountXappsSurfaceOptions, "surface">,
): Promise<XappsSurfaceController> {
  return mountXappsSurface({
    ...options,
    surface: "marketplace",
  });
}

export async function mountSingleXappEmbed(
  options: Omit<MountXappsSurfaceOptions, "surface">,
): Promise<XappsSurfaceController> {
  return mountXappsSurface({
    ...options,
    surface: "single-xapp",
  });
}
