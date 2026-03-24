const MODE_COPY = {
  "single-panel": {
    title: "Single-panel marketplace host",
    subtitle:
      "Catalog and widget navigation stay in one embedded surface. This is the leanest marketplace host shape.",
  },
  "split-panel": {
    title: "Split-panel marketplace host",
    subtitle:
      "Catalog stays on the left and widgets open in a dedicated panel. Use this when the host wants stronger framing.",
  },
};

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value || "");
}

function shortenSubjectId(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length <= 18 ? text : `${text.slice(0, 10)}...${text.slice(-4)}`;
}

export function readModeFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  const raw = String(params.get("mode") || "").trim();
  return raw === "split-panel" ? "split-panel" : "single-panel";
}

export function setModeInUrl(mode) {
  const next = new URL(window.location.href);
  next.searchParams.set("mode", mode);
  window.history.replaceState({ mode }, "", next.toString());
}

export function renderIdentity(identity) {
  setText("identity-name", identity?.name || "Unknown");
  setText("identity-email", identity?.email || "-");
  setText("identity-subject", shortenSubjectId(identity?.subjectId));
}

export function renderMode(mode) {
  const resolved = MODE_COPY[mode] ? mode : "single-panel";
  document.body.dataset.mode = resolved;
  setText("mode-title", MODE_COPY[resolved].title);
  setText("mode-subtitle", MODE_COPY[resolved].subtitle);
  document.querySelectorAll(".mode-btn").forEach((node) => {
    node.classList.toggle("is-active", String(node.getAttribute("data-mode") || "") === resolved);
  });
}

export function renderModeShell(mode) {
  const root = document.getElementById("mode-shell");
  if (!root) return;
  if (mode === "split-panel") {
    root.innerHTML = `
      <main class="main-layout">
        <section class="panel sidebar">
          <div class="panel-title">Catalog</div>
          <div class="panel-body">
            <div id="catalog"></div>
          </div>
        </section>
        <section class="panel content">
          <div class="panel-title">App Widget</div>
          <div class="panel-body">
            <div id="widget">
              <div class="placeholder">
                <div>Select an app from the marketplace to open its widget in this panel.</div>
              </div>
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
        <div class="panel-body">
          <div id="catalog"></div>
        </div>
      </section>
    </main>
  `;
}

export function setWidgetPlaceholder(title, message) {
  const widget = document.getElementById("widget");
  if (!widget) return;
  const safeTitle = String(title || "").trim();
  const safeMessage = String(message || "").trim();
  widget.innerHTML = `
    <div class="placeholder">
      <div>
        ${safeTitle ? `<strong>${safeTitle}</strong><br />` : ""}
        ${safeMessage}
      </div>
    </div>
  `;
}
