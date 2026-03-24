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
}): Promise<Record<string, unknown> | null> {
  if (typeof document === "undefined" || !document.body) {
    throw new Error("Guard widget overlay requires a browser document");
  }

  return await new Promise<Record<string, unknown> | null>((resolve, reject) => {
    let settled = false;
    const overlay = document.createElement("div");
    overlay.className = "xapps-guard-overlay-root";
    const frameWrap = document.createElement("div");
    frameWrap.className = "xapps-guard-frame-wrap";
    const iframe = document.createElement("iframe");

    const finish = (value: Record<string, unknown> | null, error?: Error) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      try {
        overlay.remove();
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
          frameWrap.style.height = `${Math.min(Math.max(height + 45, 420), Math.min(900, viewportMax))}px`;
        }
      }
    };

    // Inject keyframe animation once
    if (!document.getElementById("xapps-guard-overlay-style")) {
      const style = document.createElement("style");
      style.id = "xapps-guard-overlay-style";
      style.textContent = `
        @keyframes xapps-overlay-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes xapps-panel-in { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes xapps-spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .xapps-guard-overlay-root { padding: 10px !important; }
          .xapps-guard-frame-wrap { border-radius: 14px !important; }
        }
        @media (max-width: 480px) {
          .xapps-guard-overlay-root { padding: 6px !important; }
          .xapps-guard-frame-wrap { border-radius: 12px !important; }
        }
      `;
      document.head.appendChild(style);
    }

    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(2,6,23,0.52);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto;z-index:2147483200;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:xapps-overlay-in 0.2s ease-out";

    frameWrap.style.cssText =
      "width:min(1080px,96vw);max-height:calc(100vh - 32px);margin:auto 0;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 25px 60px rgba(15,23,42,0.22),0 0 0 1px rgba(15,23,42,0.04);overflow:hidden;display:flex;flex-direction:column;animation:xapps-panel-in 0.25s ease-out";

    // Header bar
    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #f1f5f9;flex-shrink:0;background:#fafbfc";
    header.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    const headerTitle = document.createElement("span");
    headerTitle.style.cssText =
      "flex:1;font:600 0.8125rem/1 system-ui,sans-serif;color:#334155;letter-spacing:-0.01em";
    headerTitle.textContent = "Complete required step";
    header.appendChild(headerTitle);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.style.cssText =
      "appearance:none;border:none;background:none;cursor:pointer;padding:4px;border-radius:6px;color:#94a3b8;display:flex;align-items:center;justify-content:center;transition:color 0.15s,background 0.15s";
    closeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.color = "#334155";
      closeBtn.style.background = "#f1f5f9";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.color = "#94a3b8";
      closeBtn.style.background = "none";
    });
    closeBtn.addEventListener("click", () => finish(null));
    header.appendChild(closeBtn);

    // Iframe container (with loading state)
    const iframeWrap = document.createElement("div");
    iframeWrap.style.cssText = "flex:1;position:relative;overflow:hidden;min-height:380px";

    const loader = document.createElement("div");
    loader.style.cssText =
      "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:10px;background:#fafbfc;z-index:1;transition:opacity 0.3s ease";
    loader.innerHTML = `<div style="width:20px;height:20px;border:2.5px solid #e2e8f0;border-top-color:#3b82f6;border-radius:50%;animation:xapps-spin 0.7s linear infinite"></div><span style="font:500 0.8125rem system-ui,sans-serif;color:#64748b">Loading...</span>`;

    iframe.style.cssText = "border:0;width:100%;height:100%";
    iframe.allow =
      "clipboard-read; clipboard-write; publickey-credentials-get *; publickey-credentials-create *";
    iframe.addEventListener("load", () => {
      loader.style.opacity = "0";
      setTimeout(() => loader.remove(), 300);
    });
    iframe.src = input.embedUrl;

    // ESC key handler
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(null);
    };
    window.addEventListener("keydown", onKeyDown);
    const originalFinish = finish;
    const wrappedFinish = (value: Record<string, unknown> | null, error?: Error) => {
      window.removeEventListener("keydown", onKeyDown);
      originalFinish(value, error);
    };
    // Patch finish reference for event handlers already bound
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) wrappedFinish(null);
    });
    frameWrap.addEventListener("click", (event) => event.stopPropagation());

    iframeWrap.appendChild(loader);
    iframeWrap.appendChild(iframe);
    frameWrap.appendChild(header);
    frameWrap.appendChild(iframeWrap);
    overlay.appendChild(frameWrap);
    window.addEventListener("message", onMessage);
    document.body.appendChild(overlay);
  });
}
