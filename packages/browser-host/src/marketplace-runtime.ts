export type CatalogEmbedTheme = {
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
  themes?: Record<string, CatalogEmbedTheme> | null;
  defaultThemeKey?: string | null;
};

type MarketplaceRuntimeOptions = {
  createStandardMarketplaceRuntime: (input: {
    baseUrl: string;
    subjectId: string;
    getCustomerProfile?:
      | ((input: {
          xappId?: string | null;
        }) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null)
      | undefined;
    locale?: string | null;
    installationPolicy?: {
      mode?: "manual" | "auto_available";
      update_mode?: "manual" | "auto_update_compatible";
    } | null;
    paymentResumeState: unknown;
    hostUi: unknown;
    theme: ReferenceTheme;
    apiBasePath: string;
    apiClient?: unknown;
    hostApiHeadersProvider?: (() => Record<string, string> | null | undefined) | undefined;
    bridgeV2: Record<string, unknown>;
    getCatalogMount: () => HTMLElement | null;
    getWidgetMount: () => HTMLElement | null;
    onStatePatch?: ((patch: unknown) => void) | undefined;
    singlePanel: Record<string, unknown>;
    splitPanel: Record<string, unknown>;
  }) => unknown;
  gatewayBaseUrl: string;
  currentSubjectId: string;
  getCustomerProfile?:
    | ((input: {
        xappId?: string | null;
      }) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null)
    | undefined;
  locale?: string | null;
  installationPolicy?: {
    mode?: "manual" | "auto_available";
    update_mode?: "manual" | "auto_update_compatible";
  } | null;
  paymentResumeState: unknown;
  hostDomUi: unknown;
  theme: CatalogEmbedTheme;
  apiBasePath?: string | null;
  apiClient?: unknown;
  hostApiHeadersProvider?: (() => Record<string, string> | null | undefined) | null;
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
): CatalogEmbedTheme | undefined {
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
    getCustomerProfile: options.getCustomerProfile,
    locale: options.locale || null,
    installationPolicy: options.installationPolicy || null,
    paymentResumeState: options.paymentResumeState,
    hostUi: options.hostDomUi,
    theme: options.theme,
    apiBasePath: options.apiBasePath || "/api",
    apiClient: options.apiClient,
    hostApiHeadersProvider: options.hostApiHeadersProvider || undefined,
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

export type ReferenceTheme = CatalogEmbedTheme;
