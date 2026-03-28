import type * as React from "react";
import type { JSX } from "react";
export type LocalizedText = string | Record<string, string | null | undefined> | null | undefined;
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;
export type TranslationCatalog = Record<string, string>;
export type TranslationCatalogs = Record<string, TranslationCatalog>;
export type TranslateFunction = (
  key: string,
  params?: TranslationParams,
  fallback?: string,
) => string;
export declare function normalizeLocale(input: unknown, fallbackLocale?: string): string;
export declare function getLocaleCandidates(input: unknown, fallbackLocale?: string): string[];
export declare function pickSupportedLocale(
  input: unknown,
  supportedLocales: readonly string[],
  fallbackLocale?: string,
): string;
export declare function detectBrowserLocale(
  supportedLocales: readonly string[],
  fallbackLocale?: string,
): string;
export declare function interpolateTranslation(
  template: string,
  params: TranslationParams | undefined,
): string;
export declare function resolveLocalizedText(
  value: LocalizedText,
  locale: string,
  fallbackLocale?: string,
): string;
export declare function translateFromCatalogs(input: {
  catalogs: TranslationCatalogs;
  locale: string;
  key: string;
  params?: TranslationParams;
  fallback?: string;
  fallbackLocale?: string;
}): string;
type I18nContextValue = {
  locale: string;
  fallbackLocale: string;
  supportedLocales: readonly string[];
  setLocale: (nextLocale: string) => void;
  t: TranslateFunction;
  resolveText: (value: LocalizedText) => string;
};
export declare function I18nProvider(props: {
  locale: string;
  catalogs: TranslationCatalogs;
  supportedLocales?: readonly string[];
  fallbackLocale?: string;
  setLocale?: (nextLocale: string) => void;
  children: React.ReactNode;
}): JSX.Element;
export declare function useI18n(): I18nContextValue;
export {};
//# sourceMappingURL=index.d.ts.map
