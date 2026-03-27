import {
  createMarketplaceRuntime,
  resolveTheme,
  type ReferenceTheme,
} from "./marketplace-runtime.js";

export const REFERENCE_THEME_ALIASES: Record<string, string> = {
  slate: "harbor",
  graphite: "atlas",
};

export const REFERENCE_THEMES: Record<string, ReferenceTheme> = {
  harbor: {
    primary: "#0f7284",
    primaryDark: "#0a5663",
    bg: "#e5f1f2",
    bgSubtle: "#f1f8f9",
    card: "#ffffff",
    border: "rgba(44, 76, 84, 0.2)",
    text: "#15232a",
    muted: "#60727a",
    shadowSm: "0 3px 8px rgba(21, 35, 42, 0.05)",
    shadow: "0 18px 40px rgba(21, 35, 42, 0.08)",
    shadowLg: "0 30px 64px rgba(21, 35, 42, 0.12)",
    radiusSm: "14px",
    radiusMd: "18px",
    radiusLg: "24px",
    tokens: {
      "--mx-card-bg": "#ffffff",
      "--mx-bg-subtle": "#f1f8f9",
    },
  },
  atlas: {
    primary: "#305fa7",
    primaryDark: "#234577",
    bg: "#e8eef8",
    bgSubtle: "#f3f6fc",
    card: "#ffffff",
    border: "rgba(56, 79, 114, 0.22)",
    text: "#172235",
    muted: "#5a6a80",
    shadowSm: "0 3px 8px rgba(23, 34, 53, 0.06)",
    shadow: "0 18px 40px rgba(23, 34, 53, 0.09)",
    shadowLg: "0 30px 64px rgba(23, 34, 53, 0.13)",
    radiusSm: "14px",
    radiusMd: "18px",
    radiusLg: "24px",
    tokens: {
      "--mx-card-bg": "#ffffff",
      "--mx-bg-subtle": "#f3f6fc",
    },
  },
  copper: {
    primary: "#bb4a22",
    primaryDark: "#8e3115",
    bg: "#f4e6ce",
    bgSubtle: "#fcf2df",
    card: "#ffffff",
    border: "rgba(86, 60, 47, 0.22)",
    text: "#241613",
    muted: "#725f57",
    shadowSm: "0 3px 8px rgba(60, 39, 29, 0.06)",
    shadow: "0 18px 40px rgba(60, 39, 29, 0.1)",
    shadowLg: "0 32px 68px rgba(60, 39, 29, 0.13)",
    radiusSm: "14px",
    radiusMd: "18px",
    radiusLg: "24px",
    tokens: {
      "--mx-card-bg": "#ffffff",
      "--mx-bg-subtle": "#fcf2df",
    },
  },
  emerald: {
    primary: "#0f8b72",
    primaryDark: "#0a6855",
    bg: "#dff5ed",
    bgSubtle: "#eefcf7",
    card: "#ffffff",
    border: "rgba(33, 97, 82, 0.22)",
    text: "#10211c",
    muted: "#55716a",
    shadowSm: "0 3px 8px rgba(15, 73, 61, 0.06)",
    shadow: "0 18px 40px rgba(15, 73, 61, 0.1)",
    shadowLg: "0 32px 68px rgba(15, 73, 61, 0.13)",
    radiusSm: "14px",
    radiusMd: "18px",
    radiusLg: "24px",
    tokens: {
      "--mx-card-bg": "#ffffff",
      "--mx-bg-subtle": "#eefcf7",
    },
  },
  iris: {
    primary: "#6a55d9",
    primaryDark: "#4c3bb2",
    bg: "#ece8ff",
    bgSubtle: "#f5f2ff",
    card: "#ffffff",
    border: "rgba(84, 70, 157, 0.22)",
    text: "#1d1838",
    muted: "#645f86",
    shadowSm: "0 3px 8px rgba(53, 43, 109, 0.06)",
    shadow: "0 18px 40px rgba(53, 43, 109, 0.1)",
    shadowLg: "0 32px 68px rgba(53, 43, 109, 0.13)",
    radiusSm: "14px",
    radiusMd: "18px",
    radiusLg: "24px",
    tokens: {
      "--mx-card-bg": "#ffffff",
      "--mx-bg-subtle": "#f5f2ff",
    },
  },
};

export const REFERENCE_THEME_KEYS = Object.keys(REFERENCE_THEMES);

type ResolveReferenceThemeOptions = {
  defaultThemeKey?: string | null;
};

type CreateReferenceMarketplaceRuntimeOptions = {
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
  themeKey?: string | null;
  defaultThemeKey?: string | null;
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

export function resolveReferenceTheme(
  themeKey: string | null | undefined,
  options: ResolveReferenceThemeOptions = {},
): ReferenceTheme | undefined {
  return resolveTheme(themeKey, {
    aliases: REFERENCE_THEME_ALIASES,
    themes: REFERENCE_THEMES,
    defaultThemeKey: String(options.defaultThemeKey || "harbor").trim() || "harbor",
  });
}

export function createReferenceMarketplaceRuntime(
  options: CreateReferenceMarketplaceRuntimeOptions,
): unknown {
  return createMarketplaceRuntime({
    createStandardMarketplaceRuntime: options.createStandardMarketplaceRuntime,
    gatewayBaseUrl: options.gatewayBaseUrl,
    currentSubjectId: options.currentSubjectId,
    paymentResumeState: options.paymentResumeState,
    hostDomUi: options.hostDomUi,
    theme:
      resolveReferenceTheme(options.themeKey, {
        defaultThemeKey: options.defaultThemeKey,
      }) || REFERENCE_THEMES.harbor,
    apiBasePath: options.apiBasePath || "/api",
    bridgeV2: {
      ...(options.bridgeV2 || {}),
    },
    getCatalogMount: options.getCatalogMount || (() => document.getElementById("catalog")),
    getWidgetMount: options.getWidgetMount || (() => document.getElementById("widget")),
    onStatePatch: options.onStatePatch,
    singlePanel: {
      resumeDelayMs: 220,
      ...(options.singlePanel || {}),
    },
    splitPanel: {
      widgetTitle: "App Widget",
      placeholderMessage: "Select an app from the marketplace to open its widget in this panel.",
      emptyCatalogMessage: "Select an app from the marketplace to open its widget.",
      xappDetailMismatchMessage: "Select a widget from this app to open it.",
      setWidgetPlaceholder: options.setWidgetPlaceholder,
      onExpandError: options.onExpandError,
      ...(options.splitPanel || {}),
    },
  });
}
