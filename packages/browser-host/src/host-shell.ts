type HostMode = "single-panel" | "split-panel";

type HostShellModeCopyEntry = {
  title?: string | null;
  subtitle?: string | null;
};

type StoredJsonRecord = Record<string, unknown>;

type HostIdentity = {
  name?: string | null;
  email?: string | null;
  subjectId?: string | null;
};

type ApplyThemePreferenceOptions = {
  persist?: boolean;
};

type ApplyLocalePreferenceOptions = {
  persist?: boolean;
};

export type HostShellConfig = {
  modeCopy?: Record<string, HostShellModeCopyEntry> | null;
  headerCollapseStorageKey?: string | null;
  themeStorageKey?: string | null;
  localeStorageKey?: string | null;
  themeAliases?: Record<string, string> | null;
  defaultTheme?: string | null;
  validThemes?: string[] | null;
  defaultLocale?: string | null;
  validLocales?: string[] | null;
};

export type HostShellApi = {
  applyThemePreference: (
    themeKey: string | null | undefined,
    options?: ApplyThemePreferenceOptions,
  ) => string;
  applyLocalePreference: (
    locale: string | null | undefined,
    options?: ApplyLocalePreferenceOptions,
  ) => string;
  readHeaderCollapsedPreference: () => boolean;
  readLocalePreference: () => string;
  readModeFromUrl: () => HostMode;
  readStoredJson: (storageKey: string | null | undefined) => StoredJsonRecord | null;
  readThemePreference: () => string;
  renderIdentity: (identity: HostIdentity | null | undefined) => void;
  renderMode: (mode: string | null | undefined) => void;
  renderModeShell: (mode: HostMode) => void;
  renderSessionExpiredShell: (input: {
    title?: string | null;
    message?: string | null;
    restartLabel?: string | null;
    backHref?: string | null;
    backLabel?: string | null;
  }) => void;
  renderSingleXappShell: () => void;
  setHeaderCollapsed: (collapsed: boolean) => void;
  setLocaleInUrl: (locale: string | null | undefined) => void;
  setModeInUrl: (mode: HostMode) => void;
  setWidgetPlaceholder: (
    title: string | null | undefined,
    message: string | null | undefined,
  ) => void;
  toggleHeaderCollapsed: () => void;
};

export function createHostShellApi(config?: HostShellConfig | null): HostShellApi {
  const modeCopy = config?.modeCopy && typeof config.modeCopy === "object" ? config.modeCopy : {};
  const headerCollapseStorageKey = String(config?.headerCollapseStorageKey || "").trim();
  const themeStorageKey = String(config?.themeStorageKey || "").trim();
  const localeStorageKey = String(config?.localeStorageKey || "").trim();
  const legacyThemeAliases =
    config?.themeAliases && typeof config.themeAliases === "object" ? config.themeAliases : {};
  const defaultTheme = String(config?.defaultTheme || "default").trim() || "default";
  const validThemes = new Set(Array.isArray(config?.validThemes) ? config.validThemes : []);
  const defaultLocale = String(config?.defaultLocale || "en").trim() || "en";
  const validLocales = new Set(
    Array.isArray(config?.validLocales) ? config.validLocales : ["en", "ro"],
  );

  function normalizeThemeKey(themeKey: string | null | undefined): string {
    const raw = String(themeKey || "").trim();
    const aliased = legacyThemeAliases[raw] || raw;
    return validThemes.has(aliased) ? aliased : defaultTheme;
  }

  function normalizeLocale(locale: string | null | undefined): string {
    const raw = String(locale || "")
      .trim()
      .replace(/_/g, "-")
      .toLowerCase();
    if (!raw) return defaultLocale;
    if (raw === "ro" || raw.startsWith("ro-")) return validLocales.has("ro") ? "ro" : defaultLocale;
    if (raw === "en" || raw.startsWith("en-")) return validLocales.has("en") ? "en" : defaultLocale;
    return validLocales.has(raw) ? raw : defaultLocale;
  }

  function setText(id: string, value: string | null | undefined): void {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value || "");
  }

  function shortenSubjectId(value: string | null | undefined): string {
    const text = String(value || "").trim();
    if (!text) return "-";
    return text.length <= 14 ? text : `${text.slice(0, 8)}...${text.slice(-4)}`;
  }

  function readStoredJson(storageKey: string | null | undefined): StoredJsonRecord | null {
    try {
      const raw = window.localStorage.getItem(String(storageKey || "")) || "";
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as StoredJsonRecord) : null;
    } catch {
      return null;
    }
  }

  function readModeFromUrl(): HostMode {
    const params = new URLSearchParams(window.location.search || "");
    const raw = String(params.get("mode") || "").trim();
    return raw === "split-panel" ? "split-panel" : "single-panel";
  }

  function setModeInUrl(mode: HostMode): void {
    const next = new URL(window.location.href);
    next.searchParams.set("mode", mode);
    window.history.replaceState({ mode }, "", next.toString());
  }

  function setLocaleInUrl(locale: string | null | undefined): void {
    const next = new URL(window.location.href);
    next.searchParams.set("locale", normalizeLocale(locale));
    window.history.replaceState({ locale: next.searchParams.get("locale") }, "", next.toString());
  }

  function readThemePreference(): string {
    try {
      const stored = String(window.localStorage.getItem(themeStorageKey) || "").trim();
      return normalizeThemeKey(stored);
    } catch {
      return defaultTheme;
    }
  }

  function applyThemePreference(
    themeKey: string | null | undefined,
    options: ApplyThemePreferenceOptions = {},
  ): string {
    const resolved = normalizeThemeKey(themeKey);
    document.body.dataset.theme = resolved;
    const select = document.getElementById("host-theme-select");
    if (select instanceof HTMLSelectElement) select.value = resolved;
    if (options.persist === false) return resolved;
    try {
      window.localStorage.setItem(themeStorageKey, resolved);
    } catch {
      // ignore localStorage failures
    }
    return resolved;
  }

  function readLocalePreference(): string {
    const currentUrl = new URL(window.location.href);
    const queryLocale = String(currentUrl.searchParams.get("locale") || "").trim();
    if (queryLocale) return normalizeLocale(queryLocale);
    try {
      const stored = String(window.localStorage.getItem(localeStorageKey) || "").trim();
      if (stored) return normalizeLocale(stored);
    } catch {
      // ignore localStorage failures
    }
    const browserLocale =
      typeof navigator !== "undefined"
        ? String((navigator.languages && navigator.languages[0]) || navigator.language || "").trim()
        : "";
    return normalizeLocale(browserLocale || defaultLocale);
  }

  function applyLocalePreference(
    locale: string | null | undefined,
    options: ApplyLocalePreferenceOptions = {},
  ): string {
    const resolved = normalizeLocale(locale);
    document.documentElement.lang = resolved;
    const select = document.getElementById("host-locale-select");
    if (select instanceof HTMLSelectElement) select.value = resolved;
    if (options.persist === false) return resolved;
    try {
      window.localStorage.setItem(localeStorageKey, resolved);
    } catch {
      // ignore localStorage failures
    }
    return resolved;
  }

  function readHeaderCollapsedPreference(): boolean {
    const isNarrow = window.matchMedia?.("(max-width: 900px)")?.matches ?? false;
    try {
      const stored = window.localStorage.getItem(headerCollapseStorageKey);
      if (stored == null) return isNarrow;
      return isNarrow ? stored === "1" : false;
    } catch {
      return isNarrow;
    }
  }

  function setHeaderCollapsed(collapsed: boolean): void {
    const isCollapsed = Boolean(collapsed);
    document.body.dataset.hostHeaderCollapsed = isCollapsed ? "true" : "false";
    const toggle = document.getElementById("host-header-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      toggle.textContent = isCollapsed ? "Show header" : "Hide header";
    }
    try {
      window.localStorage.setItem(headerCollapseStorageKey, isCollapsed ? "1" : "0");
    } catch {
      // ignore localStorage failures
    }
  }

  function toggleHeaderCollapsed(): void {
    const current = document.body.dataset.hostHeaderCollapsed === "true";
    setHeaderCollapsed(!current);
  }

  function renderIdentity(identity: HostIdentity | null | undefined): void {
    setText("identity-name", identity?.name || "Unknown");
    setText("identity-email", identity?.email || "-");
    setText("identity-subject", shortenSubjectId(identity?.subjectId));
  }

  function renderMode(mode: string | null | undefined): void {
    const resolved = modeCopy[mode || ""] ? String(mode) : "single-panel";
    document.body.dataset.mode = resolved;
    setText("mode-title", modeCopy[resolved]?.title || "");
    setText("mode-subtitle", modeCopy[resolved]?.subtitle || "");
    document.querySelectorAll<HTMLElement>(".mode-btn").forEach((node) => {
      node.classList.toggle("is-active", String(node.dataset.mode || "") === resolved);
    });
  }

  function renderModeShell(mode: HostMode): void {
    const root = document.getElementById("mode-shell");
    if (!root) return;
    if (mode === "split-panel") {
      root.innerHTML = `
        <main class="main-layout">
          <aside class="sidebar">
            <div class="sidebar-scroll">
              <div class="title">Catalog</div>
              <div id="catalog"></div>
            </div>
          </aside>
          <section class="content">
            <div class="title">App Widget</div>
            <div id="widget">
              <div class="placeholder">
                <div>Select an app from the marketplace to open its widget in this panel.</div>
              </div>
            </div>
          </section>
        </main>
      `;
      return;
    }
    root.innerHTML = `
      <main class="main-content">
        <section class="panel">
          <div id="catalog"></div>
        </section>
      </main>
    `;
  }

  function renderSingleXappShell(): void {
    const root = document.getElementById("mode-shell");
    if (!root) return;
    root.innerHTML = `
      <main class="main-content">
        <section class="panel">
          <div id="catalog"></div>
        </section>
      </main>
    `;
  }

  function renderSessionExpiredShell(input: {
    title?: string | null;
    message?: string | null;
    restartLabel?: string | null;
    backHref?: string | null;
    backLabel?: string | null;
  }): void {
    const root = document.getElementById("mode-shell");
    if (!root) return;
    const title = String(input?.title || "Session expired").trim() || "Session expired";
    const message =
      String(input?.message || "This hosted session expired and could not be renewed.").trim() ||
      "This hosted session expired and could not be renewed.";
    const restartLabel =
      String(input?.restartLabel || "Restart Session").trim() || "Restart Session";
    const backHref = String(input?.backHref || "/").trim() || "/";
    const backLabel = String(input?.backLabel || "Back to launcher").trim() || "Back to launcher";

    root.innerHTML = `
      <main class="main-content">
        <section class="panel session-expired-panel">
          <div class="session-expired-card">
            <span class="session-expired-kicker">Hosted session</span>
            <h2>${title}</h2>
            <p>${message}</p>
            <div class="actions">
              <button id="host-session-restart" type="button">${restartLabel}</button>
              <a class="ghost-link" href="${backHref}">${backLabel}</a>
            </div>
          </div>
        </section>
      </main>
    `;

    const restartButton = document.getElementById("host-session-restart");
    restartButton?.addEventListener("click", () => {
      window.location.reload();
    });
  }

  function setWidgetPlaceholder(
    title: string | null | undefined,
    message: string | null | undefined,
  ): void {
    const widget = document.getElementById("widget");
    if (!widget) return;
    const safeTitle = String(title || "").trim();
    const safeMessage = String(message || "").trim();
    widget.innerHTML = `
      <div class="placeholder">
        <div>
          ${safeTitle ? `<strong>${safeTitle}</strong>` : ""}
          ${safeMessage}
        </div>
      </div>
    `;
  }

  return {
    applyThemePreference,
    applyLocalePreference,
    readHeaderCollapsedPreference,
    readLocalePreference,
    readModeFromUrl,
    readStoredJson,
    readThemePreference,
    renderIdentity,
    renderMode,
    renderModeShell,
    renderSessionExpiredShell,
    renderSingleXappShell,
    setHeaderCollapsed,
    setLocaleInUrl,
    setModeInUrl,
    setWidgetPlaceholder,
    toggleHeaderCollapsed,
  };
}
