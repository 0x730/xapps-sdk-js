// @ts-nocheck
export function resolveTheme(themeKey, options) {
  const aliases = options?.aliases && typeof options.aliases === "object" ? options.aliases : {};
  const themes = options?.themes && typeof options.themes === "object" ? options.themes : {};
  const defaultThemeKey = String(options?.defaultThemeKey || "").trim();
  const raw = String(themeKey || "").trim();
  const resolvedKey = aliases[raw] || raw || defaultThemeKey;
  return themes[resolvedKey] || themes[defaultThemeKey];
}

export function createMarketplaceRuntime(options) {
  return options.createStandardMarketplaceRuntime({
    baseUrl: options.gatewayBaseUrl,
    subjectId: options.currentSubjectId,
    paymentResumeState: options.paymentResumeState,
    hostUi: options.hostDomUi,
    theme: options.theme,
    apiBasePath: options.apiBasePath || "/api",
    bridgeV2: {
      ...(options.bridgeV2 || {}),
    },
    getCatalogMount: options.getCatalogMount || (() => document.getElementById("catalog")),
    getWidgetMount: options.getWidgetMount || (() => document.getElementById("widget")),
    onStatePatch: options.onStatePatch,
    singlePanel: options.singlePanel || {
      resumeDelayMs: 220,
    },
    splitPanel: options.splitPanel || {
      widgetTitle: "App Widget",
      placeholderMessage: "Select an app from the marketplace to open its widget in this panel.",
      emptyCatalogMessage: "Select an app from the marketplace to open its widget.",
      xappDetailMismatchMessage: "Select a widget from this app to open it.",
      setWidgetPlaceholder: options.setWidgetPlaceholder,
      onExpandError: options.onExpandError,
    },
  });
}
