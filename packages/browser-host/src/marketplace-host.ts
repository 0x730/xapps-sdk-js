// @ts-nocheck
import {
  resolveBridgeEndpoints,
  resolveHostApiBasePath,
  resolveHostConfigUrl,
} from "./backend-base.js";
export async function bootMarketplaceHost(config) {
  const identity = config.readStoredJson(config.identityStorageKey);
  if (!identity?.email || !identity?.subjectId) {
    const entryUrl = new URL(config.entryHref || "/", window.location.href);
    entryUrl.searchParams.set("hostError", "missing_identity");
    entryUrl.searchParams.set("next", window.location.pathname + window.location.search);
    window.location.replace(entryUrl.toString());
    return;
  }

  const themeKey = config.applyThemePreference(config.readThemePreference(), { persist: false });
  config.renderIdentity(identity);
  config.setHeaderCollapsed(config.readHeaderCollapsedPreference());
  const bootstrapToken = String(identity.bootstrapToken || "").trim();
  const hostApiHeaders = bootstrapToken ? { "X-Xapps-Host-Bootstrap": bootstrapToken } : undefined;

  const configResponse = await fetch(resolveHostConfigUrl(config), {
    method: "GET",
    headers: hostApiHeaders,
  });
  const hostConfig = await configResponse.json().catch(() => ({}));
  if (!configResponse.ok) {
    throw new Error(String(hostConfig?.message || "host config failed"));
  }
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
    hostApiHeaders,
    bridgeV2: {
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

  window.addEventListener("beforeunload", () => {
    runtime.destroy();
  });

  await mountMarketplace(config.readModeFromUrl());
}
