import { mountCatalogEmbed } from "../../dist/embed-surface.js";
import {
  BACKEND_BASE_URL,
  ENTRY_HREF,
  HOST_BOOTSTRAP_URL,
  DEFAULT_LOCALE,
  DEFAULT_MODE,
  DEFAULT_THEME_KEY,
  IDENTITY_STORAGE_KEY,
  STARTER_NAME,
} from "./starter-config.js";

let controller = null;

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readPageOptions() {
  const currentUrl = new URL(window.location.href);
  const mode =
    readString(currentUrl.searchParams.get("mode")) === "split-panel"
      ? "split-panel"
      : DEFAULT_MODE;
  const locale = readString(currentUrl.searchParams.get("locale")) || DEFAULT_LOCALE;
  const themeKey = readString(currentUrl.searchParams.get("theme")) || DEFAULT_THEME_KEY;
  return { mode, locale, themeKey };
}

function syncPageCopy({ mode, locale, themeKey }) {
  document.title = `${STARTER_NAME} Marketplace`;
  const starterName = document.getElementById("starter-name");
  const modeValue = document.getElementById("mode-value");
  const localeValue = document.getElementById("locale-value");
  const themeValue = document.getElementById("theme-value");
  const widgetPanel = document.getElementById("widget-panel");
  if (starterName) starterName.textContent = STARTER_NAME;
  if (modeValue) modeValue.textContent = mode;
  if (localeValue) localeValue.textContent = locale;
  if (themeValue) themeValue.textContent = themeKey || "default";
  document.body.dataset.mode = mode;
  if (widgetPanel) widgetPanel.hidden = mode !== "split-panel";
}

function renderFailure(error) {
  const root = document.getElementById("starter-root");
  if (!root) return;
  root.innerHTML = `
    <section class="panel">
      <h1>${STARTER_NAME} marketplace bootstrap failed</h1>
      <p>${String(error?.message || "Unknown error")}</p>
      <p><a class="button-link secondary" href="${ENTRY_HREF}">Return to launcher</a></p>
    </section>
  `;
}

async function mountMarketplace() {
  const options = readPageOptions();
  syncPageCopy(options);
  controller?.destroy?.();
  controller = await mountCatalogEmbed({
    backendBaseUrl: BACKEND_BASE_URL,
    entryHref: ENTRY_HREF,
    identityStorageKey: IDENTITY_STORAGE_KEY,
    hostBootstrapUrl: HOST_BOOTSTRAP_URL,
    container: document.getElementById("catalog"),
    widgetContainer: options.mode === "split-panel" ? document.getElementById("widget") : null,
    mode: options.mode,
    locale: options.locale,
    ...(options.themeKey ? { themeKey: options.themeKey } : {}),
  });
}

window.addEventListener("beforeunload", () => {
  controller?.destroy?.();
});

mountMarketplace().catch((error) => {
  console.error("[hosted-integrator-starter] marketplace bootstrap failed", error);
  renderFailure(error);
});
