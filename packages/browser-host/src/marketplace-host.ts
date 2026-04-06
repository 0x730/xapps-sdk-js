// @ts-nocheck
import {
  resolveBridgeEndpoints,
  resolveHostApiBasePath,
  resolveHostConfigUrl,
} from "./backend-base.js";
export async function bootMarketplaceHost(config) {
  let currentIdentity = null;
  let refreshInFlight = null;
  let sessionExpiredShown = false;
  const initialLocale =
    typeof config.locale === "string" && config.locale.trim()
      ? config.locale.trim()
      : typeof config.readLocalePreference === "function"
        ? String(config.readLocalePreference() || "").trim() || null
        : null;

  async function tryRefreshIdentity() {
    if (typeof config.refreshStoredJson !== "function") return null;
    if (!refreshInFlight) {
      refreshInFlight = Promise.resolve(config.refreshStoredJson(config.identityStorageKey))
        .catch(() => null)
        .finally(() => {
          refreshInFlight = null;
        });
    }
    const refreshed = await refreshInFlight;
    if (refreshed?.email && refreshed?.subjectId) {
      currentIdentity = refreshed;
      try {
        config.renderIdentity?.(currentIdentity);
      } catch {}
      return currentIdentity;
    }
    return null;
  }

  async function ensureIdentity() {
    currentIdentity = config.readStoredJson(config.identityStorageKey);
    if (currentIdentity?.email && currentIdentity?.subjectId) return currentIdentity;
    const refreshed = await tryRefreshIdentity();
    if (refreshed?.email && refreshed?.subjectId) return refreshed;
    const entryUrl = new URL(config.entryHref || "/", window.location.href);
    entryUrl.searchParams.set("hostError", "missing_identity");
    entryUrl.searchParams.set("next", window.location.pathname + window.location.search);
    window.location.replace(entryUrl.toString());
    return null;
  }

  function getHostApiHeaders() {
    const bootstrapToken = String(currentIdentity?.bootstrapToken || "").trim();
    return bootstrapToken ? { "X-Xapps-Host-Bootstrap": bootstrapToken } : undefined;
  }

  function isBootstrapRetryableMessage(message) {
    const normalized = String(message || "")
      .trim()
      .toLowerCase();
    return (
      normalized.includes("host bootstrap token expired") ||
      normalized.includes("missing bootstrap")
    );
  }

  const identity = await ensureIdentity();
  if (!identity) return;

  const themeKey = config.applyThemePreference(config.readThemePreference(), { persist: false });
  config.renderIdentity(identity);
  config.setHeaderCollapsed(config.readHeaderCollapsedPreference());

  function showSessionExpired(reason) {
    if (sessionExpiredShown) return;
    sessionExpiredShown = true;
    try {
      runtime?.destroy?.();
    } catch {}
    const normalizedReason = String(reason || "")
      .trim()
      .toLowerCase();
    const copy =
      normalizedReason === "logout"
        ? {
            title: "Session ended",
            message: "The hosted widget session ended. Start again from the launcher.",
          }
        : {
            title: "Widget session expired",
            message:
              "The hosted widget session could not be renewed. Restart the session to continue.",
          };
    config.renderSessionExpiredShell?.({
      ...copy,
      backHref: config.entryHref || "/",
    });
  }

  const hostApiClient = async (path, payload, init = {}) => {
    const exec = async () =>
      fetch(String(path || ""), {
        method: init.method || (payload !== undefined ? "POST" : "GET"),
        ...init,
        headers: {
          ...(getHostApiHeaders() || {}),
          ...((init && init.headers) || {}),
          ...(payload !== undefined && !(init && Object.prototype.hasOwnProperty.call(init, "body"))
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body:
          init && Object.prototype.hasOwnProperty.call(init, "body")
            ? init.body
            : payload !== undefined
              ? JSON.stringify(payload || {})
              : undefined,
      });

    let response = await exec();
    let data = await response.json().catch(() => ({}));
    const message = String(data?.message || "");
    if (!response.ok && response.status === 401 && isBootstrapRetryableMessage(message)) {
      const refreshed = await tryRefreshIdentity();
      if (refreshed) {
        response = await exec();
        data = await response.json().catch(() => ({}));
      }
    }
    if (!response.ok) {
      throw new Error(String(data?.message || `${String(path || "")} failed`));
    }
    return data;
  };

  const hostConfig = await hostApiClient(resolveHostConfigUrl(config), undefined, {
    method: "GET",
  });
  const hostStatus = await config.renderHostStatus?.({
    hostConfig,
    identity,
    surface: config.readModeFromUrl(),
  });
  const gatewayBaseUrl = String(hostConfig.gatewayUrl || "http://localhost:3000")
    .trim()
    .replace(/\/+$/, "");

  const sdk = await import(
    `${config.sdkPath || "/embed/sdk/xapps-embed-sdk.esm.js"}${config.sdkVersionQuery || ""}`
  );
  const {
    createStandardMarketplaceRuntime,
    createHostDomUiController,
    createHostPaymentResumeState,
    createHostApiClient,
  } = sdk;

  function readDeepLinkQuery() {
    const params = new URLSearchParams(window.location.search || "");
    const xappId = String(params.get("xappId") || params.get("xapp_id") || "").trim();
    const toolName = String(params.get("toolName") || params.get("tool_name") || "").trim();
    return {
      xappId: xappId || null,
      toolName: toolName || null,
    };
  }

  function buildMarketplaceCatalogUrl(mode) {
    const resolvedMode = mode === "split-panel" ? "split-panel" : "single-panel";
    const query = readDeepLinkQuery();
    if (resolvedMode !== "split-panel" || !query.xappId) {
      return undefined;
    }
    const catalogUrl = new URL(
      `${gatewayBaseUrl}/embed/catalog/xapps/${encodeURIComponent(query.xappId)}`,
    );
    catalogUrl.searchParams.set("embedMode", "false");
    if (query.toolName) {
      catalogUrl.searchParams.set("toolName", query.toolName);
      catalogUrl.searchParams.set("action", "open-widget");
    }
    return catalogUrl.toString();
  }

  const runtime = config.createMarketplaceRuntime({
    createStandardMarketplaceRuntime,
    gatewayBaseUrl,
    currentSubjectId: String(identity.subjectId || "").trim() || null,
    locale: initialLocale,
    installationPolicy: hostConfig.installationPolicy || null,
    themeKey,
    paymentResumeState: createHostPaymentResumeState(window.location.href, {
      autoCleanUrl: true,
    }),
    hostDomUi: createHostDomUiController({
      toastRootId: "toast-root",
      modalBackdropId: "host-modal",
      modalTitleId: "host-modal-title",
      modalMessageId: "host-modal-message",
      modalCloseId: "host-modal-close",
    }),
    apiBasePath: resolveHostApiBasePath(config),
    apiClient:
      typeof createHostApiClient === "function"
        ? createHostApiClient({
            fetchImpl: async (path, init) => {
              const response = await fetch(String(path || ""), {
                ...(init || {}),
                headers: {
                  ...(getHostApiHeaders() || {}),
                  ...(((init && init.headers) || {}) as Record<string, string>),
                },
              });
              if (
                !response.ok &&
                response.status === 401 &&
                isBootstrapRetryableMessage(
                  String(
                    await response
                      .clone()
                      .json()
                      .then((value) => value?.message || "")
                      .catch(() => ""),
                  ),
                )
              ) {
                const refreshed = await tryRefreshIdentity();
                if (refreshed) {
                  return fetch(String(path || ""), {
                    ...(init || {}),
                    headers: {
                      ...(getHostApiHeaders() || {}),
                      ...(((init && init.headers) || {}) as Record<string, string>),
                    },
                  });
                }
              }
              return response;
            },
            timeoutMs: 15000,
          })
        : undefined,
    hostApiHeaders: getHostApiHeaders(),
    hostApiHeadersProvider: getHostApiHeaders,
    bridgeV2: {
      clearSession: ({ reason } = {}) => {
        showSessionExpired(reason);
      },
      endpoints: resolveBridgeEndpoints(config),
    },
    splitPanel: {
      catalogUrl: () => buildMarketplaceCatalogUrl("split-panel"),
    },
  });

  async function mountMarketplace(mode) {
    const resolvedMode = mode === "split-panel" ? "split-panel" : "single-panel";
    config.setModeInUrl(resolvedMode);
    config.renderMode(resolvedMode);
    config.renderModeShell(resolvedMode);
    hostStatus?.update({ surface: resolvedMode });
    await runtime.mount(resolvedMode);
  }

  document.querySelectorAll(".mode-btn").forEach((node) => {
    node.addEventListener("click", () => {
      const mode = String(node.dataset.mode || "").trim();
      void mountMarketplace(mode);
    });
  });

  document.getElementById("host-header-toggle")?.addEventListener("click", () => {
    config.toggleHeaderCollapsed();
  });

  document.getElementById("host-theme-select")?.addEventListener("change", (event) => {
    const nextTheme = String(event?.target?.value || "").trim();
    config.applyThemePreference(nextTheme);
    window.location.reload();
  });

  const localeSelect = document.getElementById(config.localeSelectId || "host-locale-select");
  if (localeSelect instanceof HTMLSelectElement) {
    if (typeof config.applyLocalePreference === "function") {
      config.applyLocalePreference(initialLocale, { persist: false });
    } else if (initialLocale) {
      localeSelect.value = initialLocale;
    }
    localeSelect.addEventListener("change", () => {
      const nextLocale =
        typeof config.applyLocalePreference === "function"
          ? config.applyLocalePreference(localeSelect.value)
          : String(localeSelect.value || "").trim();
      if (typeof config.setLocaleInUrl === "function") {
        config.setLocaleInUrl(nextLocale);
      }
      runtime?.setLocale?.(nextLocale);
      runtime?.emitLocaleChanged?.(nextLocale);
    });
  }

  window.addEventListener("beforeunload", () => {
    runtime.destroy();
  });

  await mountMarketplace(config.readModeFromUrl());
}
