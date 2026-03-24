import {
  readModeFromUrl,
  renderIdentity,
  renderMode,
  renderModeShell,
  setModeInUrl,
} from "./marketplace-host-starter-shell.js";
import { createMarketplaceHostStarterRuntime } from "./runtime.js";

const STARTER_IDENTITY = {
  name: "Starter User",
  email: "starter@example.com",
  subjectId: "subject_demo",
};

async function main() {
  renderIdentity(STARTER_IDENTITY);

  const runtime = createMarketplaceHostStarterRuntime({
    gatewayBaseUrl: "http://localhost:3000",
    subjectId: STARTER_IDENTITY.subjectId,
  });

  async function mount(mode) {
    const resolvedMode = mode === "split-panel" ? "split-panel" : "single-panel";
    setModeInUrl(resolvedMode);
    renderMode(resolvedMode);
    renderModeShell(resolvedMode);
    await runtime.mount(resolvedMode);
  }

  document.querySelectorAll(".mode-btn").forEach((node) => {
    node.addEventListener("click", () => {
      const mode = String(node.getAttribute("data-mode") || "").trim();
      void mount(mode);
    });
  });

  window.addEventListener("beforeunload", () => {
    runtime.destroy();
  });

  await mount(readModeFromUrl());
}

main().catch((error) => {
  console.error("[marketplace-host-starter] bootstrap failed", error);
  document.body.innerHTML = `
    <div style="padding:2rem;font-family:Segoe UI,system-ui,sans-serif;color:#132033;">
      <h1>Marketplace host starter failed</h1>
      <p>${String(error?.message || "Unknown error")}</p>
    </div>
  `;
});
