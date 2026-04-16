import { createModalShell } from "@xapps-platform/browser-host/modal-shell";

export type GuardBlockedPayload = {
  message: string;
  trigger: string;
  reason: string;
  actionKind: string;
  action: Record<string, unknown>;
  details: Record<string, unknown>;
  guardUi: Record<string, unknown> | null;
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function toMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && typeof (value as any).message === "string") {
    const message = String((value as any).message || "").trim();
    if (message) return message;
  }
  return fallback;
}

export function readGuardBlockedPayload(error: unknown): GuardBlockedPayload | null {
  const errorRecord = asRecord(error);
  const payload = Object.keys(asRecord(errorRecord.payload)).length
    ? asRecord(errorRecord.payload)
    : Object.keys(asRecord(errorRecord.data)).length
      ? asRecord(errorRecord.data)
      : errorRecord;
  const envelope = asRecord(payload.error);
  const guard = asRecord(payload.guard);
  const details = Object.keys(asRecord(payload.details)).length
    ? asRecord(payload.details)
    : asRecord(guard.details);
  const action = Object.keys(asRecord(payload.action)).length
    ? asRecord(payload.action)
    : Object.keys(asRecord(guard.action)).length
      ? asRecord(guard.action)
      : asRecord(details.action);
  const code = String(payload.code ?? envelope.code ?? "")
    .trim()
    .toUpperCase();
  if (code !== "GUARD_BLOCKED") return null;
  const guardUi = Object.keys(asRecord(details.guard_ui)).length
    ? asRecord(details.guard_ui)
    : Object.keys(asRecord(details.guardUi)).length
      ? asRecord(details.guardUi)
      : null;
  return {
    message: toMessage(payload.message ?? envelope.message, "Guard action required"),
    trigger:
      String(payload.trigger ?? guard.trigger ?? "before:tool_run").trim() || "before:tool_run",
    reason: String(payload.reason ?? guard.reason ?? "").trim(),
    actionKind: String(action.kind ?? payload.reason ?? "")
      .trim()
      .toLowerCase(),
    action,
    details,
    guardUi,
  };
}

export function mergeGuardResolutionPayload(
  base: Record<string, unknown>,
  patch: Record<string, unknown> | null | undefined,
) {
  if (!patch || Object.keys(patch).length === 0) return base;
  return {
    ...base,
    ...patch,
  };
}

export async function openGuardWidgetOverlay(input: {
  embedUrl: string;
  theme?: Record<string, unknown> | null;
  locale?: string | null;
}): Promise<Record<string, unknown> | null> {
  if (typeof document === "undefined" || !document.body) {
    throw new Error("Guard widget overlay requires a browser document");
  }

  return await new Promise<Record<string, unknown> | null>((resolve, reject) => {
    const normalizeLocale = (value: unknown) =>
      String(value || "")
        .trim()
        .replace(/_/g, "-")
        .toLowerCase();
    const localeTag = normalizeLocale(input.locale);
    const overlayCatalog =
      localeTag === "ro" || localeTag.startsWith("ro-")
        ? {
            title: "Completează pasul necesar",
            close: "Închide",
            loading: "Se încarcă...",
          }
        : {
            title: "Complete required step",
            close: "Close",
            loading: "Loading...",
          };
    let settled = false;
    const iframe = document.createElement("iframe");

    const finish = (value: Record<string, unknown> | null, error?: Error) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      try {
        shell.destroy();
      } catch {
        // no-op
      }
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const message = asRecord(event.data);
      const type = String(message.type || "").trim();
      if (type === "XAPPS_SUBJECT_PROFILE_GUARD_RESULT") {
        const data = asRecord(message.data);
        const status = String(data.status || "")
          .trim()
          .toLowerCase();
        if (status === "resolved") {
          finish(asRecord(data.payload));
        } else {
          finish(null);
        }
        return;
      }
      if (type === "XAPPS_WIDGET_CONTEXT_REQUEST") {
        try {
          iframe.contentWindow?.postMessage(
            {
              type: "XAPPS_WIDGET_CONTEXT",
              theme: input.theme && typeof input.theme === "object" ? input.theme : null,
              locale: typeof input.locale === "string" ? input.locale : null,
            },
            "*",
          );
        } catch {
          // ignore
        }
        return;
      }
      if (type === "XAPPS_IFRAME_RESIZE") {
        const height = Number(asRecord(message.data).height ?? 0);
        if (Number.isFinite(height) && height > 0) {
          const viewportMax = Math.max(320, window.innerHeight - 80);
          panel.style.height = `${Math.min(Math.max(height + 45, 420), Math.min(900, viewportMax))}px`;
        }
      }
    };

    // Inject spinner animation once
    if (!document.getElementById("xapps-guard-overlay-style")) {
      const style = document.createElement("style");
      style.id = "xapps-guard-overlay-style";
      style.textContent = `
        @keyframes xapps-spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .xapps-guard-shell-root { padding: 10px !important; }
          .xapps-guard-shell-panel { border-radius: 14px !important; }
        }
        @media (max-width: 480px) {
          .xapps-guard-shell-root { padding: 6px !important; }
          .xapps-guard-shell-panel { border-radius: 12px !important; }
        }
      `;
      document.head.appendChild(style);
    }

    const shell = createModalShell({
      title: overlayCatalog.title,
      closeLabel: overlayCatalog.close,
      themeTokens: input.theme && typeof input.theme === "object" ? input.theme : null,
      onClose: () => finish(null),
      zIndex: "2147483200",
      bodyPadding: "0",
    });
    const overlay = shell.overlay;
    const panel = shell.panel;
    overlay.classList.add("xapps-guard-shell-root");
    panel.classList.add("xapps-guard-shell-panel");
    panel.style.width = "min(1100px, 96vw)";
    panel.style.maxWidth = "1100px";

    // Iframe container (with loading state)
    const iframeWrap = document.createElement("div");
    iframeWrap.style.cssText = "flex:1;position:relative;overflow:hidden;min-height:380px";

    const loader = document.createElement("div");
    loader.style.cssText =
      "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:10px;background:inherit;z-index:1;transition:opacity 0.3s ease";
    loader.innerHTML = `<div style="width:20px;height:20px;border:2.5px solid #e2e8f0;border-top-color:#3b82f6;border-radius:50%;animation:xapps-spin 0.7s linear infinite"></div><span style="font:500 0.8125rem system-ui,sans-serif;color:#64748b">${overlayCatalog.loading}</span>`;

    iframe.style.cssText = "border:0;width:100%;height:100%";
    iframe.allow =
      "clipboard-read; clipboard-write; publickey-credentials-get *; publickey-credentials-create *";
    iframe.addEventListener("load", () => {
      loader.style.opacity = "0";
      setTimeout(() => loader.remove(), 300);
    });
    iframe.src = input.embedUrl;

    iframeWrap.appendChild(loader);
    iframeWrap.appendChild(iframe);
    shell.body.style.padding = "0";
    shell.body.style.overflow = "hidden";
    shell.body.appendChild(iframeWrap);
    window.addEventListener("message", onMessage);
  });
}
