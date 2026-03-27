export type ReferenceTheme = {
  primary: string;
  primaryDark: string;
  bg: string;
  bgSubtle: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  shadowSm: string;
  shadow: string;
  shadowLg: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  tokens?: Record<string, string>;
};

type ResolveThemeOptions = {
  aliases?: Record<string, string> | null;
  themes?: Record<string, ReferenceTheme> | null;
  defaultThemeKey?: string | null;
};

type MarketplaceRuntimeOptions = {
  createStandardMarketplaceRuntime: (input: {
    baseUrl: string;
    subjectId: string;
    paymentResumeState: unknown;
    hostUi: unknown;
    theme: ReferenceTheme;
    apiBasePath: string;
    bridgeV2: Record<string, unknown>;
    getCatalogMount: () => HTMLElement | null;
    getWidgetMount: () => HTMLElement | null;
    onStatePatch?: ((patch: unknown) => void) | undefined;
    singlePanel: Record<string, unknown>;
    splitPanel: Record<string, unknown>;
  }) => unknown;
  gatewayBaseUrl: string;
  currentSubjectId: string;
  paymentResumeState: unknown;
  hostDomUi: unknown;
  theme: ReferenceTheme;
  apiBasePath?: string | null;
  bridgeV2?: Record<string, unknown> | null;
  getCatalogMount?: (() => HTMLElement | null) | null;
  getWidgetMount?: (() => HTMLElement | null) | null;
  onStatePatch?: ((patch: unknown) => void) | undefined;
  singlePanel?: Record<string, unknown> | null;
  splitPanel?: Record<string, unknown> | null;
  setWidgetPlaceholder?: unknown;
  onExpandError?: unknown;
};

export function resolveTheme(
  themeKey: string | null | undefined,
  options: ResolveThemeOptions,
): ReferenceTheme | undefined {
  const aliases = options?.aliases && typeof options.aliases === "object" ? options.aliases : {};
  const themes = options?.themes && typeof options.themes === "object" ? options.themes : {};
  const defaultThemeKey = String(options?.defaultThemeKey || "").trim();
  const raw = String(themeKey || "").trim();
  const resolvedKey = aliases[raw] || raw || defaultThemeKey;
  return themes[resolvedKey] || themes[defaultThemeKey];
}

export function createMarketplaceRuntime(options: MarketplaceRuntimeOptions): unknown {
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
