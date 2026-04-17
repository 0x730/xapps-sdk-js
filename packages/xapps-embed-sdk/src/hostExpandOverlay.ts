// @ts-nocheck
import type { HostUiExpandRequest, HostUiExpandResult } from "./index";

export type HostExpandOverlayController = {
  handleExpandRequest: (
    input: HostUiExpandRequest,
    event: Pick<MessageEvent, "source" | "data">,
  ) => Promise<HostUiExpandResult>;
  handleNestedExpandRequest: (
    input: Pick<HostUiExpandRequest, "expanded" | "stage">,
    event: Pick<MessageEvent, "source" | "data">,
  ) => Promise<HostUiExpandResult>;
  close: () => Promise<void>;
  destroy: () => void;
};

const STYLE_ID = "xapps-host-expand-overlay-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --xapps-overlay-primary: var(--cx-primary, #46566c);
      --xapps-overlay-primary-dark: var(--cx-primary-dark, #1e40af);
      --xapps-overlay-card: var(--cx-card, #ffffff);
      --xapps-overlay-bg-subtle: var(--cx-bg-subtle, var(--mx-bg-subtle, #eff6ff));
      --xapps-overlay-border: var(--cx-border, rgba(148, 163, 184, 0.35));
      --xapps-overlay-text: var(--cx-text, #334155);
      --xapps-overlay-shadow: var(--cx-shadow-lg, var(--cx-shadow, 0 28px 70px rgba(15, 23, 42, 0.32)));
      --xapps-overlay-shadow-sm: var(--cx-shadow-sm, 0 6px 16px rgba(15, 23, 42, 0.12));
      --xapps-overlay-radius: var(--cx-radius-lg, var(--cx-radius, 18px));
      --xapps-overlay-backdrop: rgba(15, 23, 42, 0.42);
      --xapps-overlay-backdrop-fullscreen: rgba(15, 23, 42, 0.25);
    }
    .xapps-expand-overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: var(--xapps-overlay-backdrop);
      backdrop-filter: blur(6px);
      z-index: 2147482000;
    }
    .xapps-expand-overlay[data-open="true"] {
      display: flex;
    }
    .xapps-expand-overlay[data-stage="fullscreen"] {
      background: var(--xapps-overlay-backdrop-fullscreen);
      padding: 12px;
    }
    .xapps-expand-overlay[data-mode="inplace"] .xapps-expand-panel {
      width: 0;
      height: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
      overflow: visible;
    }
    .xapps-expand-overlay[data-mode="inplace"] .xapps-expand-slot {
      display: none;
    }
    .xapps-expand-overlay[data-mode="inplace"] .xapps-expand-controls {
      position: fixed;
    }
    .xapps-expand-panel {
      position: relative;
      width: min(1320px, calc(100vw - 36px));
      height: min(88vh, calc(100vh - 36px));
      background: var(--xapps-overlay-card);
      border: 1px solid var(--xapps-overlay-border);
      border-radius: var(--xapps-overlay-radius);
      box-shadow: var(--xapps-overlay-shadow);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .xapps-expand-overlay[data-stage="fullscreen"] .xapps-expand-panel {
      width: calc(100vw - 24px);
      height: calc(100vh - 24px);
      border-radius: 14px;
    }
    .xapps-expand-slot {
      flex: 1;
      min-height: 0;
      background: var(--xapps-overlay-card);
      display: flex;
    }
    .xapps-expand-slot > iframe {
      width: 100% !important;
      height: 100% !important;
      border: 0 !important;
      display: block;
      flex: 1;
      background: var(--xapps-overlay-card);
    }
    .xapps-expand-controls {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 8px;
      z-index: 3;
      pointer-events: none;
    }
    .xapps-expand-controls > button,
    .xapps-expand-controls > .xapps-expand-chip {
      pointer-events: auto;
    }
    .xapps-expand-icon-btn {
      appearance: none;
      border: 1px solid var(--xapps-overlay-border);
      background: color-mix(in srgb, var(--xapps-overlay-card) 94%, white);
      color: var(--xapps-overlay-text);
      width: 34px;
      height: 34px;
      border-radius: 999px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      box-shadow: var(--xapps-overlay-shadow-sm);
    }
    .xapps-expand-icon-btn:hover {
      background: var(--xapps-overlay-bg-subtle);
      border-color: color-mix(in srgb, var(--xapps-overlay-primary) 32%, var(--xapps-overlay-border));
      color: var(--xapps-overlay-primary);
    }
    .xapps-expand-icon-btn:active {
      transform: translateY(1px);
    }
    .xapps-expand-chip {
      display: inline-flex;
      align-items: center;
      height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--xapps-overlay-primary) 28%, var(--xapps-overlay-border));
      background: color-mix(in srgb, var(--xapps-overlay-bg-subtle) 92%, white);
      color: var(--xapps-overlay-primary);
      font: 700 11px/1 system-ui, sans-serif;
      letter-spacing: 0.01em;
      box-shadow: var(--xapps-overlay-shadow-sm);
    }
    .xapps-expand-icon-btn[data-role="stage"] {
      border-color: color-mix(in srgb, var(--xapps-overlay-primary) 28%, var(--xapps-overlay-border));
      background: color-mix(in srgb, var(--xapps-overlay-bg-subtle) 96%, white);
      color: var(--xapps-overlay-primary);
    }
    .xapps-expand-icon-btn[data-role="stage"]:hover {
      background: color-mix(in srgb, var(--xapps-overlay-primary) 10%, var(--xapps-overlay-bg-subtle));
      color: var(--xapps-overlay-primary-dark);
    }
    .xapps-expand-icon-btn[data-role="close"]::before {
      content: "×";
      font-size: 18px;
      line-height: 1;
      color: var(--xapps-overlay-text);
    }
    .xapps-expand-icon-btn[data-role="close"] {
      font-size: 0;
    }
    .xapps-expand-overlay[data-native-fullscreen="true"] .xapps-expand-chip,
    .xapps-expand-overlay[data-native-fullscreen="true"] .xapps-expand-icon-btn[data-role="stage"] {
      display: none;
    }
    .xapps-expand-overlay[data-native-fullscreen="true"] .xapps-expand-panel {
      width: 100vw;
      height: 100vh;
      border-radius: 0;
      border: 0;
    }
    @media (max-width: 1024px) {
      .xapps-expand-overlay {
        padding: 14px;
      }
      .xapps-expand-panel {
        width: min(1320px, calc(100vw - 28px));
      }
    }
    @media (max-width: 768px) {
      .xapps-expand-overlay {
        padding: 10px;
      }
      .xapps-expand-overlay[data-stage="fullscreen"] {
        padding: 6px;
      }
      .xapps-expand-panel {
        width: calc(100vw - 20px);
        height: calc(100vh - 20px);
        border-radius: var(--xapps-overlay-radius);
      }
      .xapps-expand-controls {
        top: 8px;
        right: 8px;
      }
      .xapps-expand-icon-btn {
        width: 32px;
        height: 32px;
        border-radius: 9px;
      }
      .xapps-expand-chip {
        height: 24px;
        font-size: 10px;
      }
    }
    @media (max-width: 480px) {
      .xapps-expand-overlay {
        padding: 6px;
      }
      .xapps-expand-overlay[data-stage="fullscreen"] {
        padding: 4px;
      }
      .xapps-expand-panel {
        width: calc(100vw - 12px);
        height: calc(100vh - 12px);
        border-radius: 12px;
      }
      .xapps-expand-overlay[data-stage="fullscreen"] .xapps-expand-panel {
        border-radius: 10px;
      }
      .xapps-expand-controls {
        top: 6px;
        right: 6px;
      }
      .xapps-expand-chip {
        display: none;
      }
      .xapps-expand-icon-btn[data-role="stage"] {
        display: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function createOverlayDom() {
  ensureStyles();
  const overlay = document.createElement("div");
  overlay.className = "xapps-expand-overlay";
  overlay.setAttribute("data-open", "false");
  overlay.setAttribute("data-stage", "inline");
  overlay.setAttribute("data-native-fullscreen", "false");
  overlay.setAttribute("data-mode", "slot");

  const panel = document.createElement("div");
  panel.className = "xapps-expand-panel";

  const controls = document.createElement("div");
  controls.className = "xapps-expand-controls";

  const chip = document.createElement("div");
  chip.className = "xapps-expand-chip";
  chip.textContent = "Focus";

  const stageBtn = document.createElement("button");
  stageBtn.type = "button";
  stageBtn.className = "xapps-expand-icon-btn";
  stageBtn.setAttribute("data-role", "stage");
  stageBtn.setAttribute("aria-label", "Toggle fullscreen");
  stageBtn.title = "Toggle fullscreen";
  stageBtn.textContent = "⤢";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "xapps-expand-icon-btn";
  closeBtn.setAttribute("data-role", "close");
  closeBtn.setAttribute("aria-label", "Close expanded view");
  closeBtn.title = "Close";
  closeBtn.textContent = "✕";

  const slot = document.createElement("div");
  slot.className = "xapps-expand-slot";

  controls.appendChild(chip);
  controls.appendChild(stageBtn);
  controls.appendChild(closeBtn);
  panel.appendChild(controls);
  panel.appendChild(slot);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  return { overlay, panel, slot, chip, stageBtn, closeBtn };
}

function findIframeByWindow(targetWindow) {
  if (!targetWindow) return null;
  const iframes = Array.from(document.querySelectorAll("iframe"));
  for (const iframe of iframes) {
    try {
      if (iframe.contentWindow === targetWindow) return iframe;
    } catch {}
  }
  return null;
}

function isMarketplaceShellIframe(iframe) {
  if (!iframe) return false;
  try {
    if (iframe.closest && iframe.closest("#catalog")) return true;
    const src = String(iframe.getAttribute("src") || iframe.src || "");
    return src.includes("/embed/catalog");
  } catch {
    return false;
  }
}

function getMarketplaceShellHostContainer(iframe) {
  if (!iframe) return null;
  try {
    return iframe.closest ? iframe.closest("#catalog") : null;
  } catch {
    return null;
  }
}

function getInPlaceHostContainer(iframe) {
  if (!iframe) return null;
  try {
    if (!iframe.closest) return null;
    return iframe.closest("#widget, #catalog");
  } catch {
    return null;
  }
}

function captureFrameStates(targetEl) {
  if (!targetEl) return [];
  try {
    return Array.from(targetEl.querySelectorAll("iframe")).map((frame) => ({
      frame,
      style: frame.getAttribute("style"),
      className: frame.className,
    }));
  } catch {
    return [];
  }
}

function applyMarketplaceShellFrameStyles(targetEl) {
  if (!targetEl) return;
  try {
    const frames = Array.from(targetEl.querySelectorAll("iframe"));
    for (const frame of frames) {
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.display = "block";
      frame.style.minHeight = "0";
      frame.style.maxWidth = "";
      frame.style.maxHeight = "";
      frame.style.transform = "";
    }
  } catch {}
}

function restoreFrameStates(frameStates) {
  for (const item of Array.isArray(frameStates) ? frameStates : []) {
    const frame = item && item.frame;
    if (!frame) continue;
    try {
      if (item.style == null) frame.removeAttribute("style");
      else frame.setAttribute("style", item.style);
      frame.className = item.className || "";
    } catch {}
  }
}

function sourceWindowContainsNestedWidgetFrame(sourceWindow, widgetId) {
  if (!sourceWindow) return false;
  try {
    const doc = sourceWindow.document;
    if (!doc) return false;
    const frames = Array.from(doc.querySelectorAll("iframe"));
    if (frames.length === 0) return false;
    const wanted = typeof widgetId === "string" && widgetId ? widgetId : "";
    return frames.some((frame) => {
      const src = String(frame.getAttribute("src") || frame.src || "");
      if (!src) return true;
      if (wanted && src.includes(encodeURIComponent(wanted))) return true;
      return src.includes("/widget/") || src.includes("/marketplace/widget/");
    });
  } catch {
    return false;
  }
}

function requestFullscreenSafe(el) {
  if (!el || typeof el.requestFullscreen !== "function") return Promise.resolve(false);
  return Promise.resolve()
    .then(() => el.requestFullscreen())
    .then(() => true)
    .catch(() => false);
}

function exitFullscreenSafe() {
  if (!document.fullscreenElement || typeof document.exitFullscreen !== "function") {
    return Promise.resolve(false);
  }
  return Promise.resolve()
    .then(() => document.exitFullscreen())
    .then(() => true)
    .catch(() => false);
}

export function createHostExpandOverlayController(): HostExpandOverlayController {
  const dom = createOverlayDom();
  let active = null;
  let stage = "inline";
  let nativeFullscreen = false;

  function updateChrome() {
    dom.overlay.setAttribute("data-open", active ? "true" : "false");
    dom.overlay.setAttribute("data-stage", stage);
    dom.overlay.setAttribute("data-native-fullscreen", nativeFullscreen ? "true" : "false");
    dom.overlay.setAttribute("data-mode", active?.mode === "inplace" ? "inplace" : "slot");
    dom.chip.textContent = stage === "fullscreen" ? "Fullscreen" : "Focus";
    dom.stageBtn.textContent = stage === "fullscreen" ? "⤡" : "⤢";
    dom.stageBtn.title = stage === "fullscreen" ? "Exit fullscreen" : "Enter fullscreen";
    dom.stageBtn.setAttribute("aria-label", dom.stageBtn.title);
    document.body.style.overflow = active ? "hidden" : "";
  }

  function postResult(result) {
    if (!active?.sourceWindow || typeof active.sourceWindow.postMessage !== "function") return;
    try {
      active.sourceWindow.postMessage(
        {
          type: "XAPPS_UI_EXPAND_RESULT",
          ok: true,
          data: result,
        },
        "*",
      );
    } catch {}
  }

  function postResultToSourceWindow(sourceWindow, result) {
    if (!sourceWindow || typeof sourceWindow.postMessage !== "function") return;
    try {
      sourceWindow.postMessage(
        {
          type: "XAPPS_UI_EXPAND_RESULT",
          ok: true,
          data: result,
        },
        "*",
      );
    } catch {}
  }

  async function setStage(nextStage, { notify = true } = {}) {
    if (!active) return;
    const normalized =
      nextStage === "fullscreen" ? "fullscreen" : nextStage === "focus" ? "focus" : "inline";

    if (normalized === "inline") {
      const sourceWindow = active?.sourceWindow || null;
      const fullscreenTarget = active?.mode === "inplace" ? active.targetEl : dom.panel;
      if (document.fullscreenElement === fullscreenTarget) {
        await exitFullscreenSafe();
      }
      restoreInline();
      if (notify) {
        postResultToSourceWindow(sourceWindow, {
          hostManaged: true,
          expanded: false,
          stage: "inline",
          nativeFullscreen: false,
        });
      }
      return;
    }

    stage = normalized;
    nativeFullscreen = false;
    if (active?.mode === "inplace") applyInPlaceTargetStyles(active.targetEl);
    updateChrome();

    if (normalized === "fullscreen") {
      const fullscreenTarget = active?.mode === "inplace" ? active.targetEl : dom.panel;
      const ok = await requestFullscreenSafe(fullscreenTarget);
      nativeFullscreen = ok && document.fullscreenElement === fullscreenTarget;
      if (active?.mode === "inplace") applyInPlaceTargetStyles(active.targetEl);
      updateChrome();
    } else if (
      document.fullscreenElement &&
      (document.fullscreenElement === dom.panel ||
        (active?.mode === "inplace" && document.fullscreenElement === active.targetEl))
    ) {
      await exitFullscreenSafe();
      nativeFullscreen = false;
      if (active?.mode === "inplace") applyInPlaceTargetStyles(active.targetEl);
      updateChrome();
    }

    if (notify) {
      postResult({
        hostManaged: true,
        expanded: true,
        stage,
        nativeFullscreen,
      });
    }
  }

  function moveToOverlay(iframe, sourceWindow) {
    if (active?.iframe === iframe) return;
    if (active) {
      restoreInline();
    }
    active = {
      mode: "slot",
      iframe,
      sourceWindow,
      parent: iframe.parentNode,
      nextSibling: iframe.nextSibling,
      style: iframe.getAttribute("style"),
      className: iframe.className,
    };
    dom.slot.appendChild(iframe);
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    stage = "focus";
    nativeFullscreen = false;
    updateChrome();
  }

  function applyInPlaceTargetStyles(targetEl) {
    const focus = stage !== "fullscreen";
    targetEl.style.position = "fixed";
    targetEl.style.zIndex = "2147482001";
    targetEl.style.background = "var(--xapps-overlay-card)";
    targetEl.style.border = "1px solid var(--xapps-overlay-border)";
    targetEl.style.boxShadow = "var(--xapps-overlay-shadow)";
    targetEl.style.overflow = "hidden";
    if (focus) {
      targetEl.style.inset = "auto";
      targetEl.style.top = "50%";
      targetEl.style.left = "50%";
      targetEl.style.transform = "translate(-50%, -50%)";
      targetEl.style.width = "min(1280px, calc(100vw - 40px))";
      targetEl.style.height = "min(80vh, calc(100vh - 40px))";
      targetEl.style.maxWidth = "calc(100vw - 40px)";
      targetEl.style.maxHeight = "calc(100vh - 40px)";
      targetEl.style.borderRadius = "18px";
    } else {
      targetEl.style.inset = "12px";
      targetEl.style.top = "";
      targetEl.style.left = "";
      targetEl.style.transform = "";
      targetEl.style.width = "";
      targetEl.style.height = "";
      targetEl.style.maxWidth = "";
      targetEl.style.maxHeight = "";
      targetEl.style.borderRadius = "14px";
    }
  }

  function activateInPlaceTarget(targetEl, sourceWindow) {
    if (active?.mode === "inplace" && active.targetEl === targetEl) return;
    if (active) restoreInline();
    active = {
      mode: "inplace",
      targetEl,
      sourceWindow,
      style: targetEl.getAttribute("style"),
      className: targetEl.className,
      frameStates: captureFrameStates(targetEl),
    };
    stage = "focus";
    nativeFullscreen = false;
    applyInPlaceTargetStyles(targetEl);
    applyMarketplaceShellFrameStyles(targetEl);
    try {
      window.dispatchEvent(new Event("resize"));
    } catch {}
    updateChrome();
  }

  function restoreInline() {
    if (!active) return;
    if (active.mode === "inplace") {
      const { targetEl, style, className, frameStates } = active;
      if (style === null) targetEl.removeAttribute("style");
      else targetEl.setAttribute("style", style);
      targetEl.className = className || "";
      restoreFrameStates(frameStates);
      try {
        window.dispatchEvent(new Event("resize"));
      } catch {}
    } else {
      const { iframe, parent, nextSibling, style, className } = active;
      try {
        if (parent) {
          if (nextSibling && nextSibling.parentNode === parent)
            parent.insertBefore(iframe, nextSibling);
          else parent.appendChild(iframe);
        }
      } catch {}
      if (style === null) iframe.removeAttribute("style");
      else iframe.setAttribute("style", style);
      iframe.className = className || "";
    }
    active = null;
    stage = "inline";
    nativeFullscreen = false;
    updateChrome();
  }

  async function handleExpandRequest(input, event) {
    const sourceWindow = event && event.source ? event.source : null;
    if (input?.widgetId && sourceWindowContainsNestedWidgetFrame(sourceWindow, input.widgetId)) {
      // Embedded catalog shell case: let the widget/catalog handle local expansion instead of
      // expanding the entire marketplace iframe in the outer host.
      return {
        hostManaged: false,
        expanded: false,
        stage: "inline",
      };
    }
    const iframe = findIframeByWindow(sourceWindow);
    if (!iframe) {
      return {
        hostManaged: false,
        expanded: false,
        stage: "inline",
      };
    }
    if (isMarketplaceShellIframe(iframe)) {
      // Marketplace shell embeds the actual widget iframe. In that topology we require the
      // nested bridge path so the shell can reduce chrome and correlate nested widget state.
      return {
        hostManaged: false,
        expanded: false,
        stage: "inline",
      };
    }
    const requestedStage =
      input && (input.stage === "focus" || input.stage === "fullscreen" || input.stage === "inline")
        ? input.stage
        : input && input.expanded
          ? "focus"
          : "inline";

    if (!input || !input.expanded || requestedStage === "inline") {
      if (active && sourceWindow && active.sourceWindow !== sourceWindow) {
        return { hostManaged: false, expanded: false, stage: "inline" };
      }
      await setStage("inline", { notify: false });
      return { hostManaged: true, expanded: false, stage: "inline", nativeFullscreen: false };
    }

    const inPlaceContainer = getInPlaceHostContainer(iframe);
    if (inPlaceContainer) {
      activateInPlaceTarget(inPlaceContainer, sourceWindow);
    } else {
      moveToOverlay(iframe, sourceWindow);
    }
    await setStage(requestedStage, { notify: false });
    return {
      hostManaged: true,
      expanded: true,
      stage,
      ...(nativeFullscreen ? { nativeFullscreen: true } : {}),
    };
  }

  async function handleNestedExpandRequest(input, event) {
    const sourceWindow = event && event.source ? event.source : null;
    const iframe = findIframeByWindow(sourceWindow);
    if (!iframe) {
      return {
        hostManaged: false,
        expanded: false,
        stage: "inline",
      };
    }
    const requestedStage =
      input && (input.stage === "focus" || input.stage === "fullscreen" || input.stage === "inline")
        ? input.stage
        : input && input.expanded
          ? "focus"
          : "inline";

    if (!input || !input.expanded || requestedStage === "inline") {
      if (active && sourceWindow && active.sourceWindow !== sourceWindow) {
        return { hostManaged: false, expanded: false, stage: "inline" };
      }
      await setStage("inline", { notify: false });
      return { hostManaged: true, expanded: false, stage: "inline", nativeFullscreen: false };
    }

    const marketplaceHostContainer = getMarketplaceShellHostContainer(iframe);
    if (marketplaceHostContainer) {
      activateInPlaceTarget(marketplaceHostContainer, sourceWindow);
    } else {
      moveToOverlay(iframe, sourceWindow);
    }
    if (active?.mode === "inplace") {
      applyInPlaceTargetStyles(active.targetEl);
    }
    await setStage(requestedStage, { notify: false });
    return {
      hostManaged: true,
      expanded: true,
      stage,
      ...(nativeFullscreen ? { nativeFullscreen: true } : {}),
    };
  }

  async function toggleStage() {
    if (!active) return;
    await setStage(stage === "fullscreen" ? "focus" : "fullscreen");
  }

  async function closeOverlay() {
    if (!active) return;
    await setStage("inline");
  }

  dom.overlay.addEventListener("click", (event) => {
    if (event.target === dom.overlay) {
      void closeOverlay();
    }
  });
  dom.closeBtn.addEventListener("click", () => void closeOverlay());
  dom.stageBtn.addEventListener("click", () => void toggleStage());
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!active) return;
    if (document.fullscreenElement === dom.panel) {
      return; // fullscreenchange handler will downgrade/close
    }
    void closeOverlay();
  });
  document.addEventListener("fullscreenchange", () => {
    if (!active) return;
    const panelIsFullscreen =
      document.fullscreenElement === dom.panel ||
      (active?.mode === "inplace" && document.fullscreenElement === active.targetEl);
    if (panelIsFullscreen) {
      nativeFullscreen = true;
      stage = "fullscreen";
      updateChrome();
      if (active?.mode === "inplace") applyInPlaceTargetStyles(active.targetEl);
      postResult({
        hostManaged: true,
        expanded: true,
        stage: "fullscreen",
        nativeFullscreen: true,
      });
      return;
    }
    if (stage === "fullscreen") {
      nativeFullscreen = false;
      stage = "focus";
      if (active?.mode === "inplace") applyInPlaceTargetStyles(active.targetEl);
      updateChrome();
      postResult({ hostManaged: true, expanded: true, stage: "focus", nativeFullscreen: false });
    }
  });

  const nestedMessageListener = (event) => {
    const msg = event && event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type !== "XAPPS_UI_NESTED_EXPAND_REQUEST") return;
    const sourceWindow = event && event.source ? event.source : null;
    const sourceIframe = findIframeByWindow(sourceWindow);
    if (!sourceIframe) return; // source validation: only known embedded frames may request nested expand

    const data = msg && typeof msg.data === "object" && msg.data ? msg.data : {};
    const requestId = typeof data.requestId === "string" ? data.requestId : "";
    if (!requestId) return;

    const input = {
      expanded: Boolean(data.expanded),
      stage:
        data.stage === "focus" || data.stage === "fullscreen" || data.stage === "inline"
          ? data.stage
          : undefined,
    };

    Promise.resolve(handleNestedExpandRequest(input, event))
      .then((result) => {
        try {
          sourceWindow?.postMessage(
            {
              type: "XAPPS_UI_NESTED_EXPAND_RESULT",
              ok: true,
              data: {
                requestId,
                ...(result || { hostManaged: false, expanded: false, stage: "inline" }),
              },
            },
            "*",
          );
        } catch {}
      })
      .catch((error) => {
        try {
          sourceWindow?.postMessage(
            {
              type: "XAPPS_UI_NESTED_EXPAND_RESULT",
              ok: false,
              data: { requestId },
              error: {
                message: (error && error.message) || "Nested expand handling failed",
                code: (error && error.code) || "NESTED_EXPAND_FAILED",
              },
            },
            "*",
          );
        } catch {}
      });
  };
  window.addEventListener("message", nestedMessageListener);

  updateChrome();

  return {
    handleExpandRequest,
    handleNestedExpandRequest,
    close: closeOverlay,
    destroy() {
      if (active) {
        restoreInline();
      }
      try {
        window.removeEventListener("message", nestedMessageListener);
      } catch {}
      try {
        dom.overlay.remove();
      } catch {}
      document.body.style.overflow = "";
    },
  };
}
