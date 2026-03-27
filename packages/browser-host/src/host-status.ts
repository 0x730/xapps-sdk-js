type HostStatusSurface = "single-panel" | "split-panel" | "single-xapp";

type HostStatusIdentity = {
  subjectId?: string | null;
};

type HostStatusHostConfig = {
  gatewayUrl?: string | null;
};

type HostStatusReferenceItem = {
  key?: string | null;
  label?: string | null;
};

type HostStatusReferencePayload = {
  workspace?: string | null;
  tenant?: string | null;
  stack?: string | null;
  gateway_url?: string | null;
  payment_modes?: Array<string | HostStatusReferenceItem> | null;
  tenant_policy_slugs?: string[] | null;
};

type HostStatusInstallationsPayload = {
  items?: Array<{
    xapp_id?: string | null;
  }> | null;
};

export type RenderHostStatusConfig = {
  rootId?: string | null;
  identity?: HostStatusIdentity | null;
  hostConfig?: HostStatusHostConfig | null;
  referencePath?: string | null;
  installationsPath?: string | null;
  currentXappId?: string | null;
  surface?: HostStatusSurface | null;
  workspaceKey?: string | null;
  stackLabel?: string | null;
  gatewayUrl?: string | null;
};

export type RenderHostStatusHandle = {
  update: (next?: { surface?: HostStatusSurface | null; currentXappId?: string | null }) => void;
};

type HostStatusState = {
  currentXappId: string;
  open: boolean;
  hostConfig: HostStatusHostConfig;
  identity: HostStatusIdentity;
  installations: HostStatusInstallationsPayload | null;
  installationsError: string;
  reference: HostStatusReferencePayload | null;
  referenceError: string;
  surface: HostStatusSurface;
  workspaceKey: string;
};

function escapeHtml(value: string | null | undefined): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shortenId(value: string | null | undefined, prefix = 8, suffix = 4): string {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= prefix + suffix + 3) return text;
  return `${text.slice(0, prefix)}...${text.slice(-suffix)}`;
}

function normalizeSurfaceLabel(surface: string | null | undefined): string {
  const key = String(surface || "").trim();
  if (key === "split-panel") return "Split panel";
  if (key === "single-xapp") return "Single xapp";
  return "Single panel";
}

function normalizeStackLabel(stack: string | null | undefined): string {
  const key = String(stack || "")
    .trim()
    .toLowerCase();
  if (key === "node-fastify") return "Node + Fastify";
  if (key === "plain-php") return "Plain PHP";
  return String(stack || "").trim() || "-";
}

function normalizePaymentModeLabels(reference: HostStatusReferencePayload | null): string[] {
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

function normalizeGuardSlugs(reference: HostStatusReferencePayload | null): string[] {
  const values = Array.isArray(reference?.tenant_policy_slugs) ? reference.tenant_policy_slugs : [];
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

function normalizeInstalledXappIds(
  installationsPayload: HostStatusInstallationsPayload | null,
): string[] {
  const items = Array.isArray(installationsPayload?.items) ? installationsPayload.items : [];
  return [...new Set(items.map((item) => String(item?.xapp_id || "").trim()).filter(Boolean))];
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message || `${path} failed`)
        : `${path} failed`;
    throw new Error(message);
  }
  return payload as T;
}

function renderChips(items: string[] | null | undefined, emptyLabel: string): string {
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

function setText(id: string, value: string | null | undefined): void {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value || "");
}

function setReferenceWorkspace(workspace: string | null | undefined): void {
  document.body.dataset.referenceTenant = String(workspace || "").trim() || "reference";
}

export async function renderHostStatus(
  config: RenderHostStatusConfig,
): Promise<RenderHostStatusHandle> {
  const rootId = String(config?.rootId || "host-proof-panel").trim();
  const root = document.getElementById(rootId);
  const identity = config?.identity && typeof config.identity === "object" ? config.identity : {};
  const hostConfig =
    config?.hostConfig && typeof config.hostConfig === "object" ? config.hostConfig : {};
  const referencePath = String(config?.referencePath || "/api/reference").trim();
  const installationsPath = String(config?.installationsPath || "/api/installations").trim();
  const state: HostStatusState = {
    currentXappId: String(config?.currentXappId || "").trim(),
    open: false,
    hostConfig,
    identity,
    installations: null,
    installationsError: "",
    reference: null,
    referenceError: "",
    surface: (String(config?.surface || "single-panel").trim() ||
      "single-panel") as HostStatusSurface,
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

  function persistOpenPreference(): void {
    try {
      window.localStorage.setItem(openStorageKey, state.open ? "1" : "0");
    } catch {
      // ignore localStorage failures
    }
  }

  function render(): void {
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
    state.reference = await fetchJson<HostStatusReferencePayload>(referencePath);
  } catch (error) {
    state.referenceError = error instanceof Error ? error.message : "reference unavailable";
  }

  if (String(identity?.subjectId || "").trim()) {
    try {
      state.installations = await fetchJson<HostStatusInstallationsPayload>(
        `${installationsPath}?subjectId=${encodeURIComponent(String(identity.subjectId || "").trim())}`,
      );
    } catch (error) {
      state.installationsError =
        error instanceof Error ? error.message : "installations unavailable";
    }
  }

  render();

  return {
    update(next = {}) {
      if (next && typeof next === "object") {
        if ("surface" in next) {
          state.surface = (String(next.surface || "").trim() as HostStatusSurface) || state.surface;
        }
        if ("currentXappId" in next) {
          state.currentXappId = String(next.currentXappId || "").trim();
        }
      }
      render();
    },
  };
}
