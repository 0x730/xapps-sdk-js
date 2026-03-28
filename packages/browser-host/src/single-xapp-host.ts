// @ts-nocheck
import {
  resolveBridgeEndpoints,
  resolveHostApiBasePath,
  resolveHostConfigUrl,
} from "./backend-base.js";
export async function bootSingleXappHost(config) {
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

  const identity = await ensureIdentity();
  if (!identity) return;

  const params = new URLSearchParams(window.location.search || "");
  const themeKey = config.applyThemePreference(config.readThemePreference(), { persist: false });
  const sdk = await import(
    `${config.sdkPath || "/embed/sdk/xapps-embed-sdk.esm.js"}${config.sdkVersionQuery || ""}`
  );
  const {
    createEmbedHost,
    createHostDomUiController,
    createHostPaymentResumeState,
    createEmbedHostWidgetContext,
    createHostApiClient,
    createMutationFailureCallbacks,
  } = sdk;

  config.renderIdentity(identity);
  config.setHeaderCollapsed(config.readHeaderCollapsedPreference());
  config.renderSingleXappShell();

  const hostUi = createHostDomUiController({
    toastRootId: "toast-root",
    modalBackdropId: "host-modal",
    modalTitleId: "host-modal-title",
    modalMessageId: "host-modal-message",
    modalCloseId: "host-modal-close",
  });
  const hostApiClient = createHostApiClient({
    timeoutMs: 15000,
    fetchImpl: async (path, init) => {
      const exec = () =>
        fetch(String(path || ""), {
          ...(init || {}),
          headers: {
            ...(getHostApiHeaders() || {}),
            ...(((init && init.headers) || {}) as Record<string, string>),
          },
        });
      let response = await exec();
      const message = String(
        await response
          .clone()
          .json()
          .then((value) => value?.message || "")
          .catch(() => ""),
      )
        .trim()
        .toLowerCase();
      if (
        !response.ok &&
        response.status === 401 &&
        (message.includes("host bootstrap token expired") || message.includes("missing bootstrap"))
      ) {
        const refreshed = await tryRefreshIdentity();
        if (refreshed) {
          response = await exec();
        }
      }
      return response;
    },
  });
  const hostConfig = await hostApiClient(resolveHostConfigUrl(config), undefined, {
    method: "GET",
  });
  const xappInput = document.getElementById("xappId");
  const hostStatus = await config.renderHostStatus?.({
    hostConfig,
    identity,
    surface: "single-xapp",
    currentXappId: xappInput instanceof HTMLInputElement ? xappInput.value : "",
  });
  const gatewayBaseUrl = String(hostConfig?.gatewayUrl || "")
    .trim()
    .replace(/\/+$/, "");
  const paymentResumeState = createHostPaymentResumeState(window.location.href, {
    autoCleanUrl: true,
  });
  const widgetContext = createEmbedHostWidgetContext();
  const theme = config.resolveTheme(themeKey);
  let controller = null;

  function showSessionExpired(reason) {
    if (sessionExpiredShown) return;
    sessionExpiredShown = true;
    try {
      controller?.destroy?.();
    } catch {}
    try {
      widgetContext.reset?.();
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

  async function mountXapp(xappId) {
    const safeXappId = String(xappId || "").trim();
    if (!safeXappId) return;
    hostStatus?.update({ surface: "single-xapp", currentXappId: safeXappId });
    controller?.destroy?.();

    const pendingResume = paymentResumeState.getResume();
    const paymentParams = pendingResume
      ? paymentResumeState.getPendingPaymentParams()
      : new URLSearchParams();
    const failureCallbacks = createMutationFailureCallbacks({
      notify: (message, variant) => hostUi.showNotification?.(message, variant || "error"),
    });

    controller = createEmbedHost({
      container: document.getElementById("catalog"),
      baseUrl: gatewayBaseUrl,
      catalogUrl: `${gatewayBaseUrl}/embed/catalog?embedMode=true`,
      subjectId: String(identity.subjectId || "").trim() || undefined,
      locale: initialLocale || undefined,
      theme,
      apiBasePath: resolveHostApiBasePath(config),
      apiClient: hostApiClient,
      hostApiHeaders: getHostApiHeaders(),
      hostApiHeadersProvider: getHostApiHeaders,
      paymentResume: false,
      embedContext: {
        getHostReturnUrl: () =>
          paymentResumeState.buildHostReturnUrl({
            baseUrl: window.location.href,
            paymentParams,
          }),
        getPaymentParams: () => paymentParams,
      },
      bridgeV2: {
        getWidgetContext: () => ({
          installationId: widgetContext.get().installationId || "",
          widgetId: widgetContext.get().widgetId || "",
        }),
        getSubjectId: () => String(identity.subjectId || "").trim() || undefined,
        getHostOrigin: () => window.location.origin,
        getHostReturnUrl: () =>
          paymentResumeState.buildHostReturnUrl({
            baseUrl: window.location.href,
            paymentParams: paymentResumeState.getPendingPaymentParams(),
          }),
        clearSession: ({ reason } = {}) => {
          showSessionExpired(reason);
        },
        endpoints: resolveBridgeEndpoints(config),
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
        getSubjectId: () => String(identity.subjectId || "").trim() || undefined,
        ...failureCallbacks,
      },
      onEvent: async (evt) => {
        if (evt.type === "XAPPS_OPEN_WIDGET") {
          widgetContext.set({
            installationId: evt.data?.installationId || null,
            widgetId: evt.data?.widgetId || null,
            xappId: evt.data?.xappId || safeXappId,
          });
        }
      },
    });

    await controller.mountXapp(safeXappId);
    const resumeTarget = controller.readPendingResumeTarget();
    if (!resumeTarget) return;
    if (resumeTarget.xappId && String(resumeTarget.xappId || "").trim() !== safeXappId) return;
    controller.resumeCatalogWidget({ delayMs: config.resumeDelayMs || 220 });
  }

  if (xappInput instanceof HTMLInputElement) {
    const queryXappId = String(params.get("xappId") || params.get("xapp_id") || "").trim();
    const pendingResume = paymentResumeState.getResume();
    const resumeXappId = pendingResume ? String(pendingResume.xappId || "").trim() : "";
    if (!queryXappId && resumeXappId) xappInput.value = resumeXappId;
    if (queryXappId) xappInput.value = queryXappId;
  }

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
      controller?.setLocale?.(nextLocale);
      controller?.emitLocaleChanged?.(nextLocale);
    });
  }

  document.getElementById("host-header-toggle")?.addEventListener("click", () => {
    config.toggleHeaderCollapsed();
  });

  document.getElementById("loadXapp")?.addEventListener("click", async () => {
    const value = xappInput instanceof HTMLInputElement ? xappInput.value : "";
    await mountXapp(value);
  });

  await mountXapp(xappInput instanceof HTMLInputElement ? xappInput.value : "");

  window.addEventListener("beforeunload", () => {
    controller?.destroy?.();
    hostUi.destroy?.();
  });
}
