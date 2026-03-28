import React, { createContext, useContext, useMemo } from "react";

export type LocalizedText = string | Record<string, string | null | undefined> | null | undefined;
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;
export type TranslationCatalog = Record<string, string>;
export type TranslationCatalogs = Record<string, TranslationCatalog>;

export type TranslateFunction = (
  key: string,
  params?: TranslationParams,
  fallback?: string,
) => string;

export function normalizeLocale(input: unknown, fallbackLocale = "en"): string {
  const raw = String(input || "")
    .trim()
    .replace(/_/g, "-");
  if (!raw) return fallbackLocale;
  const parts = raw
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return fallbackLocale;
  const [language, ...rest] = parts;
  return [language.toLowerCase(), ...rest.map((part) => part.toUpperCase())].join("-");
}

export function getLocaleCandidates(input: unknown, fallbackLocale = "en"): string[] {
  const normalized = normalizeLocale(input, fallbackLocale);
  const out = new Set<string>();
  if (normalized) out.add(normalized);
  const dash = normalized.indexOf("-");
  if (dash > 0) out.add(normalized.slice(0, dash));
  const fallback = normalizeLocale(fallbackLocale, "en");
  if (fallback) out.add(fallback);
  const fallbackDash = fallback.indexOf("-");
  if (fallbackDash > 0) out.add(fallback.slice(0, fallbackDash));
  out.add("en");
  return Array.from(out);
}

export function pickSupportedLocale(
  input: unknown,
  supportedLocales: readonly string[],
  fallbackLocale = "en",
): string {
  const normalizedSupported = Array.from(
    new Set(
      supportedLocales.map((locale) => normalizeLocale(locale, fallbackLocale)).filter(Boolean),
    ),
  );
  const candidates = getLocaleCandidates(input, fallbackLocale);
  for (const candidate of candidates) {
    if (normalizedSupported.includes(candidate)) return candidate;
  }
  return normalizedSupported[0] || normalizeLocale(fallbackLocale, "en");
}

export function detectBrowserLocale(
  supportedLocales: readonly string[],
  fallbackLocale = "en",
): string {
  if (typeof navigator === "undefined") {
    return pickSupportedLocale(fallbackLocale, supportedLocales, fallbackLocale);
  }
  const candidates = [
    navigator.language,
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
  ];
  for (const candidate of candidates) {
    const resolved = pickSupportedLocale(candidate, supportedLocales, fallbackLocale);
    if (resolved) return resolved;
  }
  return pickSupportedLocale(fallbackLocale, supportedLocales, fallbackLocale);
}

export function interpolateTranslation(
  template: string,
  params: TranslationParams | undefined,
): string {
  if (!params || Object.keys(params).length === 0) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = params[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function resolveLocalizedText(
  value: LocalizedText,
  locale: string,
  fallbackLocale = "en",
): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const candidates = getLocaleCandidates(locale, fallbackLocale);
  for (const candidate of candidates) {
    const localized = value[candidate];
    if (typeof localized === "string" && localized.trim()) return localized;
  }
  for (const localized of Object.values(value)) {
    if (typeof localized === "string" && localized.trim()) return localized;
  }
  return "";
}

export function translateFromCatalogs(input: {
  catalogs: TranslationCatalogs;
  locale: string;
  key: string;
  params?: TranslationParams;
  fallback?: string;
  fallbackLocale?: string;
}): string {
  const fallbackLocale = input.fallbackLocale || "en";
  const candidates = getLocaleCandidates(input.locale, fallbackLocale);
  for (const candidate of candidates) {
    const catalog = input.catalogs[candidate];
    const template = catalog?.[input.key];
    if (typeof template === "string" && template.trim()) {
      return interpolateTranslation(template, input.params);
    }
  }
  return interpolateTranslation(input.fallback || input.key, input.params);
}

type I18nContextValue = {
  locale: string;
  fallbackLocale: string;
  supportedLocales: readonly string[];
  setLocale: (nextLocale: string) => void;
  t: TranslateFunction;
  resolveText: (value: LocalizedText) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider(props: {
  locale: string;
  catalogs: TranslationCatalogs;
  supportedLocales?: readonly string[];
  fallbackLocale?: string;
  setLocale?: (nextLocale: string) => void;
  children: React.ReactNode;
}) {
  const fallbackLocale = props.fallbackLocale || "en";
  const supportedLocales = props.supportedLocales || Object.keys(props.catalogs);
  const locale = pickSupportedLocale(props.locale, supportedLocales, fallbackLocale);
  const setLocale = props.setLocale || (() => {});

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      fallbackLocale,
      supportedLocales,
      setLocale,
      t: (key, params, fallback) =>
        translateFromCatalogs({
          catalogs: props.catalogs,
          locale,
          key,
          params,
          fallback,
          fallbackLocale,
        }),
      resolveText: (value) => resolveLocalizedText(value, locale, fallbackLocale),
    }),
    [fallbackLocale, locale, props.catalogs, setLocale, supportedLocales],
  );

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("I18nProvider is missing");
  }
  return value;
}
