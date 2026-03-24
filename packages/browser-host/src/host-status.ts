// @ts-nocheck
function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shortenId(value, prefix = 8, suffix = 4) {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= prefix + suffix + 3) return text;
  return `${text.slice(0, prefix)}...${text.slice(-suffix)}`;
}

function normalizeSurfaceLabel(surface) {
  const key = String(surface || "").trim();
  if (key === "split-panel") return "Split panel";
  if (key === "single-xapp") return "Single xapp";
  return "Single panel";
}

function normalizeStackLabel(stack) {
  const key = String(stack || "")
    .trim()
    .toLowerCase();
  if (key === "node-fastify") return "Node + Fastify";
  if (key === "plain-php") return "Plain PHP";
  return String(stack || "").trim() || "-";
}

function normalizePaymentModeLabels(reference) {
  const rawModes = Array.isArray(reference?.payment_modes) ? reference.payment_modes : [];
  return rawModes
    .map((item) => {
      if (item && typeof item === "object") {
        return String(item.label || item.key || "").trim();
      }
      return String(item || "").trim();
    })
    .filter(Boolean);
}

function normalizeGuardSlugs(reference) {
  const values = Array.isArray(reference?.tenant_policy_slugs) ? reference.tenant_policy_slugs : [];
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

function normalizeInstalledXappIds(installationsPayload) {
  const items = Array.isArray(installationsPayload?.items) ? installationsPayload.items : [];
  return [...new Set(items.map((item) => String(item?.xapp_id || "").trim()).filter(Boolean))];
}

async function fetchJson(path) {
  const response = await fetch(path, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.message || `${path} failed`));
  }
  return payload;
}

function renderChips(items, emptyLabel) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) {
    return `<span class="proof-empty">${escapeHtml(emptyLabel)}</span>`;
  }
  return safeItems
    .map(
      (item) =>
        `<span class="proof-chip" title="${escapeHtml(item)}">${escapeHtml(shortenId(item, 12, 4))}</span>`,
    )
    .join("");
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value || "");
}

function setReferenceWorkspace(workspace) {
  document.body.dataset.referenceTenant = String(workspace || "").trim() || "reference";
}

export async function renderHostStatus(config) {
  const rootId = String(config?.rootId || "host-proof-panel").trim();
  const root = document.getElementById(rootId);
  const identity = config?.identity && typeof config.identity === "object" ? config.identity : {};
  const hostConfig =
    config?.hostConfig && typeof config.hostConfig === "object" ? config.hostConfig : {};
  const referencePath = String(config?.referencePath || "/api/reference").trim();
  const installationsPath = String(config?.installationsPath || "/api/installations").trim();
  const state = {
    currentXappId: String(config?.currentXappId || "").trim(),
    open: false,
    hostConfig,
    identity,
    installations: null,
    installationsError: "",
    reference: null,
    referenceError: "",
    surface: String(config?.surface || "single-panel").trim() || "single-panel",
    workspaceKey: String(config?.workspaceKey || "").trim() || "reference",
  };
  const openStorageKey = `reference_host_proof_open_v1_${state.workspaceKey}`;

  try {
    const stored = window.localStorage.getItem(openStorageKey);
    if (stored == null) {
      state.open = false;
    } else {
      state.open = stored === "1";
    }
  } catch {
    state.open = false;
  }

  function persistOpenPreference() {
    try {
      window.localStorage.setItem(openStorageKey, state.open ? "1" : "0");
    } catch {
      // ignore localStorage failures
    }
  }

  function render() {
    const reference = state.reference || {};
    const workspace =
      String(reference.workspace || reference.tenant || state.workspaceKey || "-").trim() || "-";
    const stack = normalizeStackLabel(reference.stack || config?.stackLabel || "-");
    const gatewayUrl = String(
      state.hostConfig?.gatewayUrl || reference.gateway_url || config?.gatewayUrl || "",
    ).trim();
    const guardSlugs = normalizeGuardSlugs(reference);
    const installedXappIds = normalizeInstalledXappIds(state.installations);
    const paymentModes = normalizePaymentModeLabels(reference);
    const installationCount = Array.isArray(state.installations?.items)
      ? state.installations.items.length
      : 0;
    const evidenceLabel =
      state.surface === "single-xapp" && state.currentXappId
        ? shortenId(state.currentXappId, 10, 4)
        : normalizeSurfaceLabel(state.surface);
    const proofMeta = [state.referenceError, state.installationsError].filter(Boolean);

    setReferenceWorkspace(workspace);
    setText("host-reference-badge", workspace);
    setText("host-stack-badge", stack);
    const trigger = document.getElementById("host-proof-button");
    if (trigger) {
      trigger.setAttribute("aria-expanded", state.open ? "true" : "false");
      trigger.textContent = state.open ? "Hide info" : "Info";
    }

    if (!root) return;
    root.hidden = !state.open;
    root.dataset.open = state.open ? "true" : "false";

    root.innerHTML = `
      <section class="proof-card">
        <div class="proof-card-header">
          <div>
            <span class="proof-kicker">Reference proof</span>
            <h2>Backend truth</h2>
          </div>
          <span class="proof-state">${escapeHtml(workspace)}</span>
        </div>
        <div class="proof-grid">
          <div class="proof-row">
            <span class="proof-label">Workspace</span>
            <strong>${escapeHtml(workspace)}</strong>
          </div>
          <div class="proof-row">
            <span class="proof-label">Stack</span>
            <strong>${escapeHtml(stack)}</strong>
          </div>
          <div class="proof-row">
            <span class="proof-label">Surface</span>
            <strong>${escapeHtml(evidenceLabel)}</strong>
          </div>
          <div class="proof-row">
            <span class="proof-label">Subject</span>
            <strong title="${escapeHtml(String(state.identity?.subjectId || ""))}">${escapeHtml(shortenId(state.identity?.subjectId || ""))}</strong>
          </div>
          <div class="proof-row proof-row--wide">
            <span class="proof-label">Gateway</span>
            <strong title="${escapeHtml(gatewayUrl || "-")}">${escapeHtml(gatewayUrl || "-")}</strong>
          </div>
        </div>
        <div class="proof-section">
          <span class="proof-label">Installed for subject</span>
          <div class="proof-section-header">
            <strong>${installationCount}</strong>
            <span>${installationCount === 1 ? "subject installation" : "subject installations"}</span>
          </div>
          <div class="proof-chip-row">
            ${renderChips(installedXappIds.slice(0, 6), "No installations yet")}
          </div>
        </div>
        <div class="proof-section">
          <span class="proof-label">Guard family</span>
          <div class="proof-chip-row">
            ${renderChips(guardSlugs, "Reference guard family unavailable")}
          </div>
        </div>
        <div class="proof-section">
          <span class="proof-label">Payment modes</span>
          <div class="proof-chip-row">
            ${renderChips(paymentModes, "No payment modes reported")}
          </div>
        </div>
        <p class="proof-note">
          Data from <code>/api/reference</code>, <code>/api/host-config</code>, and
          <code>/api/installations?subjectId=...</code>. This panel shows current-subject installs,
          not total published xapps in the workspace.
        </p>
        ${proofMeta.length ? `<p class="proof-warning">${escapeHtml(proofMeta.join(" • "))}</p>` : ""}
      </section>
    `;
  }

  render();

  document.getElementById("host-proof-button")?.addEventListener("click", () => {
    state.open = !state.open;
    persistOpenPreference();
    render();
  });

  try {
    state.reference = await fetchJson(referencePath);
  } catch (error) {
    state.referenceError = String(error?.message || "reference unavailable");
  }

  if (String(identity?.subjectId || "").trim()) {
    try {
      state.installations = await fetchJson(
        `${installationsPath}?subjectId=${encodeURIComponent(String(identity.subjectId || "").trim())}`,
      );
    } catch (error) {
      state.installationsError = String(error?.message || "installations unavailable");
    }
  }

  render();

  return {
    update(next = {}) {
      if (next && typeof next === "object") {
        if ("surface" in next) state.surface = String(next.surface || "").trim() || state.surface;
        if ("currentXappId" in next) state.currentXappId = String(next.currentXappId || "").trim();
      }
      render();
    },
  };
}
