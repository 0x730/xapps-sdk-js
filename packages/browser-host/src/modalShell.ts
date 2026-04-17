function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function buildModalShellTheme(input?: { themeTokens?: unknown }): {
  overlayBg: string;
  panelBg: string;
  panelBorder: string;
  panelRadius: string;
  panelShadow: string;
  headerBg: string;
  headerBorder: string;
  titleColor: string;
  subtitleColor: string;
  closeBg: string;
  closeBorder: string;
  closeText: string;
  bodyBg: string;
} {
  const theme = readRecord(input?.themeTokens) ?? {};
  const card = readString(theme.card) || "#ffffff";
  const bg = readString(theme.bg) || "#f8fafc";
  const border = readString(theme.border) || "rgba(148, 163, 184, 0.28)";
  const text = readString(theme.text) || "#0f172a";
  const muted = readString(theme.muted) || "#64748b";
  const shadow = readString(theme.shadow) || "0 28px 70px rgba(15, 23, 42, 0.28)";
  const radius = readString(theme.radiusLg) || readString(theme.radius) || "18px";
  return {
    overlayBg: "rgba(2,6,23,0.56)",
    panelBg: card,
    panelBorder: border,
    panelRadius: radius,
    panelShadow: shadow,
    headerBg: `linear-gradient(180deg, ${card} 0%, ${bg} 100%)`,
    headerBorder: "1px solid rgba(226, 232, 240, 0.95)",
    titleColor: text,
    subtitleColor: muted,
    closeBg: card,
    closeBorder: border,
    closeText: text,
    bodyBg: `linear-gradient(180deg, ${bg} 0%, ${card} 22%)`,
  };
}

export function buildModalShellLayout(): {
  overlayPadding: string;
  overlayBlur: string;
  panelWidth: string;
  panelMaxWidth: string;
  panelMaxHeight: string;
  panelGap: string;
  headerGap: string;
  headerPadding: string;
  bodyPadding: string;
  bodyMaxHeight: string;
  titleFont: string;
  titleLetterSpacing: string;
  subtitleMarginTop: string;
  subtitleFont: string;
  closeButtonSize: string;
  closeButtonRadius: string;
  closeButtonFont: string;
  closeButtonLineHeight: string;
  closeButtonShadow: string;
} {
  return {
    overlayPadding: "16px",
    overlayBlur: "3px",
    panelWidth: "min(1100px, 96vw)",
    panelMaxWidth: "1100px",
    panelMaxHeight: "calc(100vh - 32px)",
    panelGap: "0",
    headerGap: "12px",
    headerPadding: "14px 16px",
    bodyPadding: "16px",
    bodyMaxHeight: "min(860px, calc(100vh - 104px))",
    titleFont:
      '700 1rem var(--xapps-display-font, var(--mx-display-font, var(--mx-font-family, "Inter", "Segoe UI", system-ui, -apple-system, sans-serif)))',
    titleLetterSpacing: "-0.01em",
    subtitleMarginTop: "4px",
    subtitleFont: "500 0.8125rem system-ui,sans-serif",
    closeButtonSize: "38px",
    closeButtonRadius: "999px",
    closeButtonFont: "600 0.875rem system-ui,sans-serif",
    closeButtonLineHeight: "1",
    closeButtonShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  };
}

export function createModalShell(options?: {
  title?: unknown;
  subtitle?: unknown;
  closeLabel?: unknown;
  themeTokens?: unknown;
  onClose?: (() => void) | null;
  container?: HTMLElement | null;
  panelWidth?: unknown;
  panelMaxWidth?: unknown;
  panelMaxHeight?: unknown;
  bodyPadding?: unknown;
  bodyMaxHeight?: unknown;
  zIndex?: unknown;
}): {
  overlay: HTMLElement;
  panel: HTMLElement;
  header: HTMLElement;
  titleWrap: HTMLElement;
  titleEl: HTMLElement;
  subtitleEl: HTMLElement;
  actions: HTMLElement;
  closeButton: HTMLButtonElement;
  body: HTMLElement;
  destroy: () => void;
} {
  if (typeof document === "undefined") {
    throw new Error("Modal shell requires a browser document");
  }
  const container =
    options?.container instanceof HTMLElement ? options.container : document.body || null;
  if (!container) {
    throw new Error("Modal shell requires a host container");
  }

  const theme = buildModalShellTheme({ themeTokens: options?.themeTokens });
  const layout = buildModalShellLayout();
  const onClose = typeof options?.onClose === "function" ? options.onClose : null;

  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: theme.overlayBg,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: layout.overlayPadding,
    overflow: "auto",
    zIndex: readString(options?.zIndex) || "2147483000",
    backdropFilter: `blur(${layout.overlayBlur})`,
  });
  (overlay.style as any).webkitBackdropFilter = `blur(${layout.overlayBlur})`;

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    width: readString(options?.panelWidth) || layout.panelWidth,
    maxWidth: readString(options?.panelMaxWidth) || layout.panelMaxWidth,
    maxHeight: readString(options?.panelMaxHeight) || layout.panelMaxHeight,
    margin: "auto 0",
    background: theme.panelBg,
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: theme.panelRadius,
    boxShadow: theme.panelShadow,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: layout.panelGap,
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: layout.headerGap,
    padding: layout.headerPadding,
    borderBottom: theme.headerBorder,
    background: theme.headerBg,
    flexShrink: "0",
  });

  const titleWrap = document.createElement("div");
  titleWrap.style.minWidth = "0";

  const titleEl = document.createElement("div");
  titleEl.textContent = readString(options?.title);
  Object.assign(titleEl.style, {
    font: layout.titleFont,
    letterSpacing: layout.titleLetterSpacing,
    color: theme.titleColor,
  });

  const subtitleEl = document.createElement("div");
  subtitleEl.textContent = readString(options?.subtitle);
  Object.assign(subtitleEl.style, {
    marginTop: layout.subtitleMarginTop,
    font: layout.subtitleFont,
    color: theme.subtitleColor,
    display: subtitleEl.textContent ? "block" : "none",
  });

  titleWrap.appendChild(titleEl);
  titleWrap.appendChild(subtitleEl);

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  });

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", readString(options?.closeLabel) || "Close");
  closeButton.setAttribute("title", readString(options?.closeLabel) || "Close");
  Object.assign(closeButton.style, {
    width: layout.closeButtonSize,
    height: layout.closeButtonSize,
    display: "inline-grid",
    placeItems: "center",
    padding: "0",
    border: `1px solid ${theme.closeBorder}`,
    borderRadius: layout.closeButtonRadius,
    background: theme.closeBg,
    cursor: "pointer",
    font: layout.closeButtonFont,
    lineHeight: layout.closeButtonLineHeight,
    color: theme.closeText,
    boxShadow: layout.closeButtonShadow,
    flexShrink: "0",
  });

  const body = document.createElement("div");
  Object.assign(body.style, {
    flex: "1 1 auto",
    minHeight: "0",
    padding: readString(options?.bodyPadding) || layout.bodyPadding,
    maxHeight: readString(options?.bodyMaxHeight) || layout.bodyMaxHeight,
    overflow: "auto",
    background: theme.bodyBg,
  });

  closeButton.addEventListener("click", () => onClose?.());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) onClose?.();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") onClose?.();
  };
  document.addEventListener("keydown", onKeyDown);

  header.appendChild(titleWrap);
  header.appendChild(actions);
  header.appendChild(closeButton);
  panel.appendChild(header);
  panel.appendChild(body);
  overlay.appendChild(panel);
  container.appendChild(overlay);

  return {
    overlay,
    panel,
    header,
    titleWrap,
    titleEl,
    subtitleEl,
    actions,
    closeButton,
    body,
    destroy() {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    },
  };
}
