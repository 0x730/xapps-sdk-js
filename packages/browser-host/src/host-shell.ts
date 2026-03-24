// @ts-nocheck
export function createHostShellApi(config) {
  const modeCopy = config?.modeCopy && typeof config.modeCopy === "object" ? config.modeCopy : {};
  const headerCollapseStorageKey = String(config?.headerCollapseStorageKey || "").trim();
  const themeStorageKey = String(config?.themeStorageKey || "").trim();
  const legacyThemeAliases =
    config?.themeAliases && typeof config.themeAliases === "object" ? config.themeAliases : {};
  const defaultTheme = String(config?.defaultTheme || "default").trim() || "default";
  const validThemes = new Set(Array.isArray(config?.validThemes) ? config.validThemes : []);

  function normalizeThemeKey(themeKey) {
    const raw = String(themeKey || "").trim();
    const aliased = legacyThemeAliases[raw] || raw;
    return validThemes.has(aliased) ? aliased : defaultTheme;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value || "");
  }

  function shortenSubjectId(value) {
    const text = String(value || "").trim();
    if (!text) return "-";
    return text.length <= 14 ? text : `${text.slice(0, 8)}...${text.slice(-4)}`;
  }

  function readStoredJson(storageKey) {
    try {
      const raw = window.localStorage.getItem(String(storageKey || "")) || "";
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function readModeFromUrl() {
    const params = new URLSearchParams(window.location.search || "");
    const raw = String(params.get("mode") || "").trim();
    return raw === "split-panel" ? "split-panel" : "single-panel";
  }

  function setModeInUrl(mode) {
    const next = new URL(window.location.href);
    next.searchParams.set("mode", mode);
    window.history.replaceState({ mode }, "", next.toString());
  }

  function readThemePreference() {
    try {
      const stored = String(window.localStorage.getItem(themeStorageKey) || "").trim();
      return normalizeThemeKey(stored);
    } catch {
      return defaultTheme;
    }
  }

  function applyThemePreference(themeKey, options = {}) {
    const resolved = normalizeThemeKey(themeKey);
    document.body.dataset.theme = resolved;
    const select = document.getElementById("host-theme-select");
    if (select) select.value = resolved;
    if (options.persist === false) return resolved;
    try {
      window.localStorage.setItem(themeStorageKey, resolved);
    } catch {
      // ignore localStorage failures
    }
    return resolved;
  }

  function readHeaderCollapsedPreference() {
    const isNarrow = window.matchMedia?.("(max-width: 900px)")?.matches ?? false;
    try {
      const stored = window.localStorage.getItem(headerCollapseStorageKey);
      if (stored == null) return isNarrow;
      return isNarrow ? stored === "1" : false;
    } catch {
      return isNarrow;
    }
  }

  function setHeaderCollapsed(collapsed) {
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

  function toggleHeaderCollapsed() {
    const current = document.body.dataset.hostHeaderCollapsed === "true";
    setHeaderCollapsed(!current);
  }

  function renderIdentity(identity) {
    setText("identity-name", identity?.name || "Unknown");
    setText("identity-email", identity?.email || "-");
    setText("identity-subject", shortenSubjectId(identity?.subjectId));
  }

  function renderMode(mode) {
    const resolved = modeCopy[mode] ? mode : "single-panel";
    document.body.dataset.mode = resolved;
    setText("mode-title", modeCopy[resolved]?.title || "");
    setText("mode-subtitle", modeCopy[resolved]?.subtitle || "");
    document.querySelectorAll(".mode-btn").forEach((node) => {
      node.classList.toggle("is-active", String(node.dataset.mode || "") === resolved);
    });
  }

  function renderModeShell(mode) {
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

  function renderSingleXappShell() {
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

  function setWidgetPlaceholder(title, message) {
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
    readHeaderCollapsedPreference,
    readModeFromUrl,
    readStoredJson,
    readThemePreference,
    renderIdentity,
    renderMode,
    renderModeShell,
    renderSingleXappShell,
    setHeaderCollapsed,
    setModeInUrl,
    setWidgetPlaceholder,
    toggleHeaderCollapsed,
  };
}
