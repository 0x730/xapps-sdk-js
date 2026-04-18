import { mountSingleXappEmbed } from "../../dist/embed-surface.js";
import {
  BACKEND_BASE_URL,
  DEFAULT_SINGLE_XAPP_ID,
  ENTRY_HREF,
  HOST_BOOTSTRAP_URL,
  DEFAULT_LOCALE,
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
  const locale = readString(currentUrl.searchParams.get("locale")) || DEFAULT_LOCALE;
  const themeKey = readString(currentUrl.searchParams.get("theme")) || DEFAULT_THEME_KEY;
  const xappId = readString(currentUrl.searchParams.get("xappId")) || DEFAULT_SINGLE_XAPP_ID;
  return { locale, themeKey, xappId };
}

function syncPageCopy({ locale, themeKey, xappId }) {
  document.title = `${STARTER_NAME} Single Xapp`;
  const starterName = document.getElementById("starter-name");
  const localeValue = document.getElementById("locale-value");
  const themeValue = document.getElementById("theme-value");
  const xappValue = document.getElementById("xappId");
  if (starterName) starterName.textContent = STARTER_NAME;
  if (localeValue) localeValue.textContent = locale;
  if (themeValue) themeValue.textContent = themeKey || "default";
  if (xappValue instanceof HTMLInputElement) xappValue.value = xappId;
}

function updateUrl(next) {
  const url = new URL(window.location.href);
  url.searchParams.set("xappId", next.xappId);
  url.searchParams.set("locale", next.locale);
  if (next.themeKey) {
    url.searchParams.set("theme", next.themeKey);
  } else {
    url.searchParams.delete("theme");
  }
  window.history.replaceState({}, "", url.toString());
}

function renderFailure(error) {
  const root = document.getElementById("starter-root");
  if (!root) return;
  root.innerHTML = `
    <section class="panel">
      <h1>${STARTER_NAME} single-xapp bootstrap failed</h1>
      <p>${String(error?.message || "Unknown error")}</p>
      <p><a class="button-link secondary" href="${ENTRY_HREF}">Return to launcher</a></p>
    </section>
  `;
}

async function mountCurrentXapp() {
  const options = readPageOptions();
  syncPageCopy(options);
  updateUrl(options);
  controller?.destroy?.();
  controller = await mountSingleXappEmbed({
    backendBaseUrl: BACKEND_BASE_URL,
    entryHref: ENTRY_HREF,
    identityStorageKey: IDENTITY_STORAGE_KEY,
    hostBootstrapUrl: HOST_BOOTSTRAP_URL,
    container: document.getElementById("catalog"),
    xappId: options.xappId,
    locale: options.locale,
    ...(options.themeKey ? { themeKey: options.themeKey } : {}),
  });
}

window.addEventListener("beforeunload", () => {
  controller?.destroy?.();
});

document.getElementById("single-xapp-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("xappId");
  const current = readPageOptions();
  updateUrl({
    ...current,
    xappId:
      input instanceof HTMLInputElement
        ? readString(input.value) || DEFAULT_SINGLE_XAPP_ID
        : current.xappId,
  });
  void mountCurrentXapp();
});

mountCurrentXapp().catch((error) => {
  console.error("[hosted-integrator-starter] single-xapp bootstrap failed", error);
  renderFailure(error);
});
