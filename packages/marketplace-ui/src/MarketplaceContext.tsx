import React, { createContext, useContext, useEffect } from "react";
import { MarketplaceI18nProvider } from "./i18n";
import type { MarketplaceClient, MarketplaceEnv, MarketplaceHostAdapter } from "./types";

export type MarketplaceContextValue = {
  client: MarketplaceClient;
  host: MarketplaceHostAdapter;
  env?: MarketplaceEnv;
};

const Ctx = createContext<MarketplaceContextValue | null>(null);

function applyMarketplaceThemeToDocument(theme: Record<string, unknown> | null | undefined): void {
  if (!theme || typeof document === "undefined") return;
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
    ["shadow", ["--cx-shadow", "--mx-shadow"]],
    ["shadowLg", ["--cx-shadow-lg", "--mx-shadow-lg"]],
    ["radiusSm", ["--cx-radius-sm", "--mx-radius-sm"]],
    ["radiusMd", ["--cx-radius-md", "--mx-radius-md"]],
    ["radius", ["--cx-radius", "--cx-radius-lg", "--mx-radius-md", "--mx-radius-lg"]],
    ["radiusLg", ["--cx-radius-lg", "--mx-radius-lg"]],
    ["fontFamily", ["--mx-font-family"]],
  ];

  for (const [key, cssVars] of map) {
    const rawValue = theme[key];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) continue;
    for (const cssVar of cssVars) root.style.setProperty(cssVar, value);
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
      if (
        !cssVar.startsWith("--mx-") &&
        !cssVar.startsWith("--cx-") &&
        !cssVar.startsWith("--xapps-")
      ) {
        continue;
      }
      root.style.setProperty(cssVar, value);
    }
  }

  const themeMode =
    typeof theme.mode === "string"
      ? theme.mode.trim().toLowerCase()
      : typeof theme.themeMode === "string"
        ? theme.themeMode.trim().toLowerCase()
        : "";
  if (themeMode === "dark" || themeMode === "light") {
    root.dataset.xappsThemeMode = themeMode;
  }
}

function MarketplaceRuntimeBridge(props: {
  host: MarketplaceHostAdapter;
  env?: MarketplaceEnv;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const locale = String(props.env?.locale || props.host.locale || "").trim();
    if (locale && typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [props.env?.locale, props.host.locale]);

  useEffect(() => {
    applyMarketplaceThemeToDocument(props.host.theme || null);
  }, [props.host.theme]);

  return <>{props.children}</>;
}

export function MarketplaceProvider(props: {
  client: MarketplaceClient;
  host: MarketplaceHostAdapter;
  env?: MarketplaceEnv;
  children: React.ReactNode;
}) {
  return (
    <MarketplaceI18nProvider locale={props.env?.locale}>
      <MarketplaceRuntimeBridge host={props.host} env={props.env}>
        <Ctx.Provider value={{ client: props.client, host: props.host, env: props.env }}>
          {props.children}
        </Ctx.Provider>
      </MarketplaceRuntimeBridge>
    </MarketplaceI18nProvider>
  );
}

export function useMarketplace(): MarketplaceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("MarketplaceProvider is missing");
  return v;
}
