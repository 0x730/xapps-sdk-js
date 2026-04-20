import { bootstrapXappsEmbedSession } from "../../dist/embed-surface.js";
import {
  clearStoredHostIdentity,
  readActiveHostIdentity,
  readStoredHostIdentity,
} from "../../dist/launcher-core.js";

function getNode(id) {
  return document.getElementById(id);
}

function setStatus(message, variant = "") {
  const node = getNode("status");
  if (!node) return;
  node.className = variant ? `status ${variant}` : "status";
  node.textContent = String(message || "");
}

function readOptionalString(id) {
  const node = getNode(id);
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

function normalizeSurface(value) {
  return value === "single-xapp" ? "single-xapp" : "marketplace";
}

function buildTargetUrl(surface, identity, config) {
  const locale = readOptionalString("locale") || config.defaultLocale;
  const mode = readOptionalString("mode") || config.defaultMode;
  const theme = readOptionalString("theme") || config.defaultThemeKey;
  const xappId = readOptionalString("xappId") || config.defaultSingleXappId;
  const subjectId =
    identity && typeof identity === "object" && typeof identity.subjectId === "string"
      ? String(identity.subjectId || "").trim()
      : "";
  if (surface === "single-xapp") {
    const target = new URL(config.singleXappHref || "/single-xapp.html", window.location.href);
    target.searchParams.set("locale", locale);
    if (theme) target.searchParams.set("theme", theme);
    if (xappId) target.searchParams.set("xappId", xappId);
    if (subjectId) target.searchParams.set("subjectId", subjectId);
    return target;
  }
  const target = new URL(config.marketplaceHref || "/marketplace.html", window.location.href);
  target.searchParams.set("locale", locale);
  target.searchParams.set("mode", mode === "split-panel" ? "split-panel" : "single-panel");
  if (theme) target.searchParams.set("theme", theme);
  if (subjectId) target.searchParams.set("subjectId", subjectId);
  return target;
}

function createBreak() {
  return document.createElement("br");
}

function renderStoredSessionCopy(sessionCopy, displayIdentity) {
  const parts = [displayIdentity.name, displayIdentity.email].filter(
    (value) => typeof value === "string" && value.trim(),
  );
  const title = document.createElement("strong");
  title.textContent = parts.length ? parts.join(" · ") : "Stored host identity";
  const subject = document.createElement("code");
  subject.textContent = String(displayIdentity.subjectId || "");
  const expires = document.createElement("code");
  expires.textContent = String(displayIdentity.bootstrapExpiresAt || "host-session active");
  sessionCopy.replaceChildren(
    title,
    createBreak(),
    document.createTextNode("subject "),
    subject,
    createBreak(),
    document.createTextNode("token expires "),
    expires,
  );
}

function renderStoredSession(config) {
  const activeIdentity = readActiveHostIdentity(config.identityStorageKey);
  const storedIdentity = readStoredHostIdentity(config.identityStorageKey);
  const displayIdentity = activeIdentity || storedIdentity;
  const sessionCard = getNode("stored-session");
  const sessionCopy = getNode("stored-session-copy");
  const emptyCopy = getNode("stored-session-empty");
  const continueMarketplace = getNode("continue-marketplace");
  const continueSingleXapp = getNode("continue-single-xapp");
  if (!sessionCard || !sessionCopy || !emptyCopy || !continueMarketplace || !continueSingleXapp) {
    return;
  }
  if (!displayIdentity?.subjectId) {
    sessionCard.hidden = true;
    emptyCopy.hidden = false;
    sessionCopy.textContent = "";
    return;
  }
  sessionCard.hidden = false;
  emptyCopy.hidden = true;
  renderStoredSessionCopy(sessionCopy, displayIdentity);
  if (continueMarketplace instanceof HTMLAnchorElement) {
    continueMarketplace.href = buildTargetUrl("marketplace", displayIdentity, config).toString();
  }
  if (continueSingleXapp instanceof HTMLAnchorElement) {
    continueSingleXapp.href = buildTargetUrl("single-xapp", displayIdentity, config).toString();
  }
}

async function handleSubmit(event, config) {
  event.preventDefault();
  const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
  const surface = normalizeSurface(String(submitter?.dataset.surface || "marketplace").trim());
  try {
    setStatus("Bootstrapping hosted session...");
    const input = readIdentityInput();
    ensureIdentityInput(input);
    const identity = await bootstrapXappsEmbedSession(input, {
      hostBootstrapUrl: config.hostBootstrapUrl,
      identityStorageKey: config.identityStorageKey,
    });
    setStatus("Hosted session ready. Redirecting...", "success");
    window.location.assign(buildTargetUrl(surface, identity, config).toString());
  } catch (error) {
    setStatus(String(error?.message || "host bootstrap failed"), "error");
  }
}

export function mountHostedStarterLauncher(config) {
  document.title = config.starterName;
  const starterName = getNode("starter-name");
  if (starterName) starterName.textContent = config.starterName;
  renderStoredSession(config);
  getNode("identity-form")?.addEventListener("submit", (event) => {
    if (event instanceof SubmitEvent) {
      void handleSubmit(event, config);
    }
  });
  getNode("clear-session")?.addEventListener("click", () => {
    clearStoredHostIdentity(config.identityStorageKey);
    renderStoredSession(config);
    setStatus("Stored bootstrap state cleared.", "success");
  });
}
