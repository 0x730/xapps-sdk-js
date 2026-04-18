import { bootstrapXappsEmbedSession } from "../../dist/embed-surface.js";
import { clearStoredHostIdentity, readActiveHostIdentity } from "../../dist/launcher-core.js";
import {
  DEFAULT_LOCALE,
  DEFAULT_MODE,
  DEFAULT_SINGLE_XAPP_ID,
  DEFAULT_THEME_KEY,
  HOST_BOOTSTRAP_URL,
  IDENTITY_STORAGE_KEY,
  STARTER_NAME,
} from "./starter-config.js";

function $(id) {
  return document.getElementById(id);
}

function setStatus(message, variant = "") {
  const node = $("status");
  if (!node) return;
  node.className = variant ? `status ${variant}` : "status";
  node.textContent = String(message || "");
}

function readOptionalString(id) {
  const node = $(id);
  return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
    ? String(node.value || "").trim()
    : node instanceof HTMLSelectElement
      ? String(node.value || "").trim()
      : "";
}

function readMetadata() {
  const raw = readOptionalString("metadata");
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Metadata JSON must be an object");
  }
  return parsed;
}

function readIdentityInput() {
  const subjectId = readOptionalString("subjectId");
  const type = readOptionalString("subjectType");
  const identifierType = readOptionalString("identifierType");
  const identifierValue = readOptionalString("identifierValue");
  const identifierHint = readOptionalString("identifierHint");
  const email = readOptionalString("email");
  const name = readOptionalString("name");
  const metadata = readMetadata();

  return {
    ...(subjectId ? { subjectId } : {}),
    ...(type ? { type } : {}),
    ...(identifierType && identifierValue
      ? {
          identifier: {
            idType: identifierType,
            value: identifierValue,
            ...(identifierHint ? { hint: identifierHint } : {}),
          },
        }
      : {}),
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function ensureIdentityInput(input) {
  if (input.subjectId || input.identifier || input.email) return;
  throw new Error(
    "Provide identifier or email for first bootstrap, or subjectId if you already stored one from a previous bootstrap",
  );
}

function buildTargetUrl(surface) {
  const locale = readOptionalString("locale") || DEFAULT_LOCALE;
  const mode = readOptionalString("mode") || DEFAULT_MODE;
  const theme = readOptionalString("theme") || DEFAULT_THEME_KEY;
  const xappId = readOptionalString("xappId") || DEFAULT_SINGLE_XAPP_ID;
  if (surface === "single-xapp") {
    const target = new URL("./single-xapp.html", window.location.href);
    target.searchParams.set("locale", locale);
    if (theme) target.searchParams.set("theme", theme);
    if (xappId) target.searchParams.set("xappId", xappId);
    return target;
  }
  const target = new URL("./marketplace.html", window.location.href);
  target.searchParams.set("locale", locale);
  target.searchParams.set("mode", mode === "split-panel" ? "split-panel" : "single-panel");
  if (theme) target.searchParams.set("theme", theme);
  return target;
}

function renderStoredSession() {
  const activeIdentity = readActiveHostIdentity(IDENTITY_STORAGE_KEY);
  const sessionCard = $("stored-session");
  const sessionCopy = $("stored-session-copy");
  const emptyCopy = $("stored-session-empty");
  const continueMarketplace = $("continue-marketplace");
  const continueSingleXapp = $("continue-single-xapp");
  if (!sessionCard || !sessionCopy || !emptyCopy || !continueMarketplace || !continueSingleXapp) {
    return;
  }
  if (!activeIdentity?.bootstrapToken) {
    sessionCard.hidden = true;
    emptyCopy.hidden = false;
    sessionCopy.textContent = "";
    return;
  }
  sessionCard.hidden = false;
  emptyCopy.hidden = true;
  const parts = [activeIdentity.name, activeIdentity.email].filter(
    (value) => typeof value === "string" && value.trim(),
  );
  sessionCopy.innerHTML = `
    <strong>${parts.length ? parts.join(" · ") : "Stored host identity"}</strong><br />
    subject <code>${String(activeIdentity.subjectId || "")}</code><br />
    token expires <code>${String(activeIdentity.bootstrapExpiresAt || "")}</code>
  `;
  continueMarketplace.href = buildTargetUrl("marketplace").toString();
  continueSingleXapp.href = buildTargetUrl("single-xapp").toString();
}

async function handleSubmit(event) {
  event.preventDefault();
  const submitter =
    event instanceof SubmitEvent && event.submitter instanceof HTMLElement ? event.submitter : null;
  const surface = String(submitter?.dataset.surface || "marketplace").trim();
  try {
    setStatus("Bootstrapping hosted session...");
    const input = readIdentityInput();
    ensureIdentityInput(input);
    await bootstrapXappsEmbedSession(input, {
      hostBootstrapUrl: HOST_BOOTSTRAP_URL,
      identityStorageKey: IDENTITY_STORAGE_KEY,
    });
    setStatus("Hosted session ready. Redirecting...", "success");
    window.location.assign(buildTargetUrl(surface).toString());
  } catch (error) {
    setStatus(String(error?.message || "host bootstrap failed"), "error");
  }
}

function main() {
  document.title = STARTER_NAME;
  const starterName = $("starter-name");
  if (starterName) starterName.textContent = STARTER_NAME;
  renderStoredSession();
  $("identity-form")?.addEventListener("submit", (event) => {
    void handleSubmit(event);
  });
  $("clear-session")?.addEventListener("click", () => {
    clearStoredHostIdentity(IDENTITY_STORAGE_KEY);
    renderStoredSession();
    setStatus("Stored bootstrap state cleared.", "success");
  });
}

main();
