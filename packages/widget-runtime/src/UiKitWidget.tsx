import { useEffect, useMemo, useRef, useState } from "react";
import type { GuardUiDescriptor, UiKitWidgetProps } from "./types";
import { formatRequestErrorMessage } from "./errorMessages";
import { attachReturnedPaymentEvidence, hasReturnedPaidPaymentEvidence } from "./paymentEvidence";
import { readGuardBlocked, readGuardChallengeToken } from "./guardParsing";
import { asRecord, readFirstString, readString } from "./runtimeReaders";

type UiKitAction =
  | {
      type: "request";
      toolName?: string;
      payload: unknown;
    }
  | {
      type: "navigateView";
      view: string;
      setState?: Record<string, unknown>;
    }
  | {
      type: "setState";
      setState: Record<string, unknown>;
    }
  | {
      type: "bridge";
      bridge:
        | "openModal"
        | "closeModal"
        | "showNotification"
        | "showAlert"
        | "navigate"
        | "refresh";
      args?: unknown[];
    }
  | {
      type: "none";
    };

type UiKitField = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "select" | "hidden";
  placeholder?: string;
  options?: Array<{ label: string; value: unknown }>;
  // For `kind: "hidden"` fields
  value?: unknown;
};

type UiKitConfig = {
  title?: string;
  description?: string;
  fields?: UiKitField[];
  submitLabel?: string;
  onLoad?: UiKitAction;
  onSubmit?: UiKitAction;
  views?: Array<{
    name: string;
    title?: string;
    description?: string;
    fields?: UiKitField[];
    submitLabel?: string;
    onLoad?: UiKitAction;
    onSubmit?: UiKitAction;
    resultView?: UiKitConfig["resultView"];
  }>;
  initialView?: string;
  resultView?: {
    kind: "json" | "kv" | "list";
    title?: string;
    fields?: Array<{ label: string; path: string }>;
    itemsPath?: string;
    titlePath?: string;
    subtitlePath?: string;
    onItemClick?: UiKitAction;
  };
};

function getPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = String(path || "")
    .split(".")
    .filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = asRecord(cur)[p];
  }
  return cur;
}

function interpolate(
  template: unknown,
  ctx: {
    state?: Record<string, unknown>;
    result?: unknown;
    item?: unknown;
  },
): unknown {
  const effectiveState = ctx?.state ?? {};
  const effectiveResult = ctx?.result ?? {};
  const effectiveItem = ctx?.item ?? {};

  if (typeof template === "string") {
    // If the template is exactly a single expression (e.g. "{{state.selectedProjectId}}"),
    // return the raw value instead of a string.
    const exact = template.match(/^\{\{\s*([^}]+)\s*\}\}$/);
    if (exact) {
      const raw = String(exact[1] || "").trim();
      const dotIdx = raw.indexOf(".");
      if (dotIdx > 0) {
        const prefix = raw.substring(0, dotIdx);
        const path = raw.substring(dotIdx + 1);
        if (prefix === "state") {
          const v = getPath(effectiveState, path);
          return v === undefined || v === null ? undefined : v;
        }
        if (prefix === "item") {
          const v = getPath(effectiveItem, path);
          return v === undefined || v === null ? undefined : v;
        }
        if (prefix === "result") {
          const v = getPath(effectiveResult, path);
          return v === undefined || v === null ? undefined : v;
        }
      }
      return undefined;
    }

    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, expr) => {
      const raw = String(expr || "").trim();
      const dotIdx = raw.indexOf(".");
      if (dotIdx > 0) {
        const prefix = raw.substring(0, dotIdx);
        const path = raw.substring(dotIdx + 1);
        if (prefix === "state") {
          const v = getPath(effectiveState, path);
          return v === undefined || v === null ? "" : String(v);
        }
        if (prefix === "item") {
          const v = getPath(effectiveItem, path);
          return v === undefined || v === null ? "" : String(v);
        }
        if (prefix === "result") {
          const v = getPath(effectiveResult, path);
          return v === undefined || v === null ? "" : String(v);
        }
      }
      return "";
    });
  }
  if (Array.isArray(template)) {
    return template.map((x) => interpolate(x, ctx));
  }
  if (template && typeof template === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template)) {
      const val = interpolate(v, ctx);
      if (val !== undefined) {
        out[k] = val;
      }
    }
    return out;
  }
  return template;
}

export function computeHiddenFieldPatchForTest(
  fields: UiKitField[] | undefined,
  ctx: { state?: Record<string, unknown>; result?: unknown; item?: unknown },
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const list = Array.isArray(fields) ? fields : [];
  for (const f of list) {
    if (!f || String(f.kind) !== "hidden" || !f.key) continue;
    if (!Object.prototype.hasOwnProperty.call(f, "value")) continue;

    const val = interpolate(f.value, ctx);
    if (val === undefined) continue;
    out[f.key] = val;
  }
  return out;
}

async function fetchJson(path: string, init: RequestInit) {
  const resp = await fetch(path, init);
  const contentType = resp.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await resp.json() : await resp.text();
  if (!resp.ok) {
    const err = new Error(formatRequestErrorMessage(data, resp.status)) as Error & {
      status?: number;
      data?: unknown;
      code?: string;
    };
    err.status = resp.status;
    err.data = data;
    err.code = readFirstString(asRecord(data).code) || undefined;
    throw err;
  }
  return data;
}

export function UiKitWidget(props: UiKitWidgetProps) {
  const guardIframeRef = useRef<HTMLIFrameElement>(null);
  const guardResolutionRef = useRef<{
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [guardOverlay, setGuardOverlay] = useState<{
    token: string;
    embedUrl: string;
    widget?: unknown;
  } | null>(null);

  async function confirmGuardAction(input: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    action?: Record<string, unknown>;
  }): Promise<boolean> {
    const action = asRecord(input.action);
    const actionKind = String(action.kind || "")
      .trim()
      .toLowerCase();
    const actionUrl = String(action.url || "").trim();
    const isSafeScheme = /^https?:\/\//i.test(actionUrl);
    if (actionKind === "complete_payment" && hasReturnedPaidPaymentEvidence()) {
      return true;
    }
    if (
      actionUrl &&
      isSafeScheme &&
      (actionKind === "complete_payment" || actionKind === "open_guard")
    ) {
      if (typeof props.host.navigate === "function") props.host.navigate(actionUrl);
      else if (typeof window.open === "function") window.open(actionUrl, "_blank", "noopener");
    }
    if (typeof props.host.confirmDialog === "function") {
      return Boolean(await props.host.confirmDialog(input));
    }
    if (typeof window.confirm === "function") {
      return window.confirm(input.message || "Continue?");
    }
    return false;
  }

  async function requestSubjectProfileGuardResolution(input: {
    installationId: string;
    widgetId: string;
    guardUi: GuardUiDescriptor;
  }): Promise<unknown> {
    if (typeof props.createWidgetSession !== "function") {
      throw new Error("Guard UI is not available for this widget host.");
    }
    const session = await props.createWidgetSession({
      installationId: input.installationId,
      widgetId: input.widgetId,
      guardUi: input.guardUi,
    });
    return new Promise((resolve, reject) => {
      guardResolutionRef.current = { resolve, reject };
      setGuardOverlay({
        token: session.token,
        embedUrl: session.embedUrl,
        widget: session.widget ?? null,
      });
    });
  }

  const cfg: UiKitConfig | null = useMemo(() => {
    const raw = props.widget?.config?.ui_kit;
    return raw && typeof raw === "object" ? (raw as UiKitConfig) : null;
  }, [props.widget]);

  const [state, setState] = useState<Record<string, unknown>>({});

  useEffect(() => {
    window.postMessage({ type: "XAPPS_UI_STATE_UPDATE", widgetId: props.widget?.id, state }, "*");
  }, [state, props.widget?.id]);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const data = asRecord(e.data);
      if (
        readString(data.type) === "XAPPS_UI_STATE_UPDATE" &&
        readString(data.widgetId) === readString(props.widget?.id)
      ) {
        const patch = asRecord(data.state);
        setState((s) => {
          if (JSON.stringify(s) === JSON.stringify(patch)) return s;
          return { ...s, ...patch };
        });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [props.widget?.id]);

  useEffect(() => {
    function handleGuardResult(event: MessageEvent) {
      const message = asRecord(event.data);
      if (
        readString(message.type) !== "XAPPS_SUBJECT_PROFILE_GUARD_RESULT" ||
        !guardIframeRef.current?.contentWindow ||
        event.source !== guardIframeRef.current.contentWindow
      ) {
        return;
      }
      const pending = guardResolutionRef.current;
      guardResolutionRef.current = null;
      setGuardOverlay(null);
      if (!pending) return;
      const data = asRecord(message.data);
      if (readString(data.status) === "resolved") {
        pending.resolve(data);
      } else {
        pending.reject(new Error("Subject profile completion canceled."));
      }
    }

    window.addEventListener("message", handleGuardResult);
    return () => window.removeEventListener("message", handleGuardResult);
  }, []);

  const [view, setView] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const skipNextOnLoadRef = useRef<string | null>(null);
  const effectiveCfgRef = useRef<UiKitConfig | null>(null);

  async function runAction(
    action: UiKitAction | undefined,
    ctx?: { item?: unknown; state?: Record<string, unknown>; result?: unknown },
  ) {
    if (!action || action.type === "none") return;

    let effectiveState = { ...state, ...(ctx?.state ?? {}) };
    const effectiveResult = ctx?.hasOwnProperty("result") ? ctx.result : (result ?? {});
    const effectiveItem = ctx?.item ?? {};

    const cfgNow = effectiveCfgRef.current;
    if (cfgNow?.fields?.length) {
      const patch = computeHiddenFieldPatchForTest(cfgNow.fields, {
        state: { ...effectiveState },
        result: effectiveResult,
        item: effectiveItem,
      });
      const keys = Object.keys(patch);
      if (keys.length) {
        let changed = false;
        for (const k of keys) {
          if (effectiveState[k] !== patch[k]) {
            changed = true;
            break;
          }
        }
        if (changed) {
          effectiveState = { ...effectiveState, ...patch };
          if (ctx?.state) Object.assign(ctx.state, patch);
          setState((s) => ({ ...s, ...patch }));
          props.host.updateState?.(patch);
        }
      }
    }

    const effectiveCtx = { state: effectiveState, result: effectiveResult, item: effectiveItem };

    if (action.type === "setState") {
      const next = interpolate(action.setState, effectiveCtx);
      const nextPatch = asRecord(next);
      setState((s) => {
        const newState = { ...s, ...nextPatch };
        if (ctx?.state) Object.assign(ctx.state, nextPatch);
        return newState;
      });
      return;
    }

    if (action.type === "navigateView") {
      const nextView = String(interpolate(action.view, effectiveCtx) || "");
      const nextStateValues = action.setState ? interpolate(action.setState, effectiveCtx) : null;

      const stateAfterUpdate = { ...effectiveState };
      const nextStatePatch = asRecord(nextStateValues);
      if (Object.keys(nextStatePatch).length) {
        setState((s) => ({ ...s, ...nextStatePatch }));
        Object.assign(stateAfterUpdate, nextStatePatch);
      }

      setView(nextView);
      skipNextOnLoadRef.current = nextView;
      setResult(null);
      setError(null);
      setBusy(true);

      const targetView = cfg?.views?.find((v) => v.name === nextView);
      if (targetView?.onLoad) {
        const chainState = { ...stateAfterUpdate, __view: nextView };
        void (async () => {
          try {
            await runAction(targetView.onLoad, { state: chainState, result: null });
          } catch (e) {
            setError(readFirstString(asRecord(e).message) || String(e));
          } finally {
            setBusy(false);
          }
        })();
      } else {
        setBusy(false);
      }
      return;
    }

    if (action.type === "bridge") {
      const rawArgs = Array.isArray(action.args) ? action.args : [];
      const args = rawArgs.map((a) => interpolate(a, effectiveCtx));

      const bridge = action.bridge;
      if (bridge === "showNotification") {
        const variant = readString(args[1]);
        props.host.showNotification(
          String(args[0] ?? ""),
          variant === "info" ||
            variant === "success" ||
            variant === "warning" ||
            variant === "error"
            ? variant
            : undefined,
        );
        return;
      }
      if (bridge === "showAlert") {
        props.host.showAlert(String(args[0] ?? ""), args[1] ? String(args[1]) : undefined);
        return;
      }
      if (bridge === "openModal") {
        props.host.openModal(
          args[0] ? String(args[0]) : undefined,
          args[1] ? String(args[1]) : undefined,
        );
        return;
      }
      if (bridge === "closeModal") {
        props.host.closeModal();
        return;
      }
      if (bridge === "navigate") {
        props.host.navigate(String(args[0] ?? ""));
        return;
      }
      if (bridge === "refresh") {
        props.host.refresh();
        return;
      }
      return;
    }

    if (action.type !== "request") return;
    const toolName = String(action.toolName || props.tool?.tool_name || "");
    if (!toolName) throw new Error("Missing tool name");

    const payload = interpolate(action.payload, effectiveCtx);

    const createRequestWithGuardRetry = async (
      requestedPayload: unknown,
      attemptedOrchestration: boolean,
      currentOrchestration?: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => {
      try {
        return asRecord(
          await fetchJson(props.apiBaseUrl + "/v1/requests", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + props.widgetToken,
            },
            body: JSON.stringify({
              installationId: props.installationId,
              toolName,
              payload: requestedPayload,
              ...(currentOrchestration && Object.keys(currentOrchestration).length
                ? { guardOrchestration: currentOrchestration }
                : {}),
            }),
          }),
        );
      } catch (err) {
        const guard = readGuardBlocked(err);
        if (guard?.uiRequired && !attemptedOrchestration) {
          const action = asRecord(guard.action);
          const actionKind = String(action.kind || "")
            .trim()
            .toLowerCase();
          if (actionKind === "open_guard" && guard.guardUi && props.widget?.id) {
            const resolved = await requestSubjectProfileGuardResolution({
              installationId: props.installationId,
              widgetId: String(props.widget.id),
              guardUi: guard.guardUi,
            });
            const resolutionPayload = asRecord(asRecord(resolved).payload);
            return createRequestWithGuardRetry(
              {
                ...(requestedPayload && typeof requestedPayload === "object"
                  ? (requestedPayload as Record<string, unknown>)
                  : {}),
                ...resolutionPayload,
              },
              false,
              currentOrchestration,
            );
          }
          const approved = await confirmGuardAction({
            title:
              (typeof action.title === "string" ? action.title : "") ||
              (typeof action.label === "string" ? action.label : "") ||
              "Guard Action Required",
            message: guard.message,
            confirmLabel: (typeof action.label === "string" ? action.label : "") || "Continue",
            cancelLabel: "Cancel",
            action,
          });
          if (approved) {
            const challengeToken = readGuardChallengeToken(err);
            const nextOrchestration = {
              ...(currentOrchestration && typeof currentOrchestration === "object"
                ? currentOrchestration
                : {}),
              [guard.guardSlug]: {
                approved: true,
                trigger: guard.trigger || "before:tool_run",
                approvedAt: new Date().toISOString(),
                ...(challengeToken ? { challenge: challengeToken } : {}),
              },
            };
            return createRequestWithGuardRetry(
              requestedPayload,
              true,
              attachReturnedPaymentEvidence(nextOrchestration, guard),
            );
          }
        }
        throw err;
      }
    };

    const created = await createRequestWithGuardRetry(payload, false);

    const requestId = readFirstString(asRecord(created.request).id) || undefined;
    if (!requestId) throw new Error("Request id missing from response");

    const started = Date.now();
    while (Date.now() - started < 20_000) {
      const detail = await fetchJson(
        props.apiBaseUrl + "/v1/requests/" + encodeURIComponent(requestId),
        {
          method: "GET",
          headers: { Authorization: "Bearer " + props.widgetToken },
        },
      );
      const status = readFirstString(asRecord(asRecord(detail).request).status);
      if (status === "COMPLETED") break;
      if (status === "FAILED") throw new Error("Request failed");
      await new Promise((r) => setTimeout(r, 600));
    }

    const resp = await fetchJson(
      props.apiBaseUrl + "/v1/requests/" + encodeURIComponent(requestId) + "/response",
      {
        method: "GET",
        headers: { Authorization: "Bearer " + props.widgetToken },
      },
    );
    const output = asRecord(asRecord(resp).response).result ?? null;
    const actionResult = asRecord(asRecord(output)._action);
    if (readString(actionResult.type)) {
      window.postMessage(actionResult, "*");
    }
    if (ctx && ctx.hasOwnProperty("result")) {
      ctx.result = output;
    }
    setResult(output);
  }

  const effectiveCfg = useMemo(() => {
    if (cfg?.views && cfg.views.length) {
      const initial = view || cfg.initialView || cfg.views[0]?.name || "";
      const v = cfg.views.find((x) => x && x.name === initial) ?? cfg.views[0];
      return v ? { ...cfg, ...v } : cfg;
    }
    return cfg;
  }, [cfg, view]);

  useEffect(() => {
    effectiveCfgRef.current = effectiveCfg;
  }, [effectiveCfg]);

  useEffect(() => {
    if (!cfg) return;
    if (cfg.views && cfg.views.length) {
      const initial = cfg.initialView || cfg.views[0]?.name || "";
      setView((v) => v || initial);
    }
  }, [cfg]);

  useEffect(() => {
    if (!effectiveCfg?.onLoad) return;
    if (skipNextOnLoadRef.current === view) {
      skipNextOnLoadRef.current = null;
      return;
    }

    setBusy(true);
    setError(null);
    let alive = true;
    void (async () => {
      try {
        await runAction(effectiveCfg.onLoad, { state: { ...state } });
      } catch (e) {
        if (alive) setError(readFirstString(asRecord(e).message) || String(e));
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCfg?.onLoad, view]);

  if (!cfg) {
    return (
      <div className="portal-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700 }}>UI Kit widget</div>
        <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
          Missing `widget.config.ui_kit`.
        </div>
      </div>
    );
  }

  return (
    <div className="portal-card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 16 }}>
          {effectiveCfg?.title ?? cfg.title ?? props.tool?.title ?? "Widget"}
        </div>
        {effectiveCfg?.description ? (
          <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>
            {effectiveCfg.description}
          </div>
        ) : null}

        {cfg.views && cfg.views.length ? (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {cfg.views.map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => setView(v.name)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: v.name === view ? "rgba(59,130,246,0.12)" : "transparent",
                  color: v.name === view ? "var(--cx-primary)" : "inherit",
                  boxShadow: "none",
                }}
              >
                {v.title ?? v.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {effectiveCfg?.fields && effectiveCfg.fields.length ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            void (async () => {
              try {
                await runAction(effectiveCfg?.onSubmit);
              } catch (err) {
                setError(readFirstString(asRecord(err).message) || String(err));
              } finally {
                setBusy(false);
              }
            })();
          }}
          style={{ display: "grid", gap: 10 }}
        >
          {effectiveCfg.fields.map((f) => {
            if (f.kind === "hidden") return null;
            return (
              <label key={f.key} style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>{f.label}</div>
                {f.kind === "textarea" ? (
                  <textarea
                    value={readString(state[f.key])}
                    placeholder={f.placeholder}
                    onChange={(e) => setState((s) => ({ ...s, [f.key]: e.target.value }))}
                    style={{ minHeight: 90 }}
                  />
                ) : f.kind === "select" ? (
                  <select
                    value={readString(state[f.key])}
                    onChange={(e) => setState((s) => ({ ...s, [f.key]: e.target.value }))}
                  >
                    <option value="" disabled>
                      {f.placeholder ?? "-- Select --"}
                    </option>
                    {f.options?.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={readString(state[f.key])}
                    placeholder={f.placeholder}
                    onChange={(e) => setState((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                )}
              </label>
            );
          })}
          <button disabled={busy} type="submit">
            {busy ? "Working…" : (effectiveCfg?.submitLabel ?? cfg.submitLabel ?? "Submit")}
          </button>
        </form>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void (async () => {
                try {
                  await runAction(effectiveCfg?.onSubmit);
                } catch (err) {
                  setError(readFirstString(asRecord(err).message) || String(err));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? "Working…" : (effectiveCfg?.submitLabel ?? cfg.submitLabel ?? "Run")}
          </button>
        </div>
      )}

      {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>Error: {error}</div> : null}

      {effectiveCfg?.resultView ? (
        <div style={{ display: "grid", gap: 8 }}>
          {(() => {
            const rv = effectiveCfg.resultView;
            if (!rv) return null;
            return rv.title ? <div style={{ fontWeight: 700 }}>{rv.title}</div> : null;
          })()}
          {(() => {
            const rv = effectiveCfg.resultView;
            if (!rv) return null;
            if (rv.kind === "kv" && rv.fields?.length) {
              return (
                <div
                  style={{ border: "1px solid var(--cx-border)", borderRadius: 12, padding: 12 }}
                >
                  {rv.fields.map((f) => (
                    <div
                      key={f.path}
                      style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}
                    >
                      <div style={{ color: "#6b7280", fontSize: 12 }}>{f.label}</div>
                      <div style={{ fontWeight: 600, fontSize: 13, wordBreak: "break-word" }}>
                        {String(getPath(result, f.path) ?? "—")}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            if (rv.kind === "list") {
              const items = getPath(result, rv.itemsPath || "items");
              if (!Array.isArray(items) || items.length === 0) {
                return <div style={{ color: "#6b7280", fontSize: 13 }}>No items.</div>;
              }
              return (
                <div
                  style={{
                    border: "1px solid var(--cx-border)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {items.slice(0, 50).map((it, idx) => {
                    const itemRecord = asRecord(it);
                    const title = rv.titlePath ? getPath(it, rv.titlePath) : undefined;
                    const subtitle = rv.subtitlePath ? getPath(it, rv.subtitlePath) : undefined;
                    return (
                      <div
                        key={String(itemRecord.id ?? itemRecord.key ?? idx)}
                        style={{
                          padding: "10px 12px",
                          borderTop: idx === 0 ? undefined : "1px solid var(--cx-border)",
                          display: "grid",
                          gap: 2,
                          cursor: rv.onItemClick ? "pointer" : "default",
                        }}
                        onClick={() => {
                          if (!rv.onItemClick) return;
                          void runAction(rv.onItemClick, { item: it });
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          {String(title ?? "(untitled)")}
                        </div>
                        {subtitle !== undefined && subtitle !== null ? (
                          <div style={{ color: "#6b7280", fontSize: 12 }}>{String(subtitle)}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            }
            return (
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  background: "#0b1020",
                  color: "#e5e7eb",
                  padding: 12,
                  borderRadius: 12,
                  overflow: "auto",
                  maxHeight: 320,
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            );
          })()}
        </div>
      ) : null}

      {guardOverlay ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "grid",
            placeItems: "center",
            padding: 24,
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: "min(920px, 100%)",
              height: "min(85vh, 860px)",
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 24px 64px rgba(15, 23, 42, 0.28)",
            }}
          >
            <iframe
              ref={guardIframeRef}
              src={
                guardOverlay.embedUrl.startsWith("http")
                  ? guardOverlay.embedUrl
                  : window.location.origin + guardOverlay.embedUrl
              }
              style={{ width: "100%", height: "100%", border: 0 }}
              allow="clipboard-read; clipboard-write; publickey-credentials-get; publickey-credentials-create"
              title="Subject profile guard"
            />
          </div>
        </div>
      ) : null}

      <details style={{ marginTop: 20, borderTop: "1px dashed #e5e7eb", paddingTop: 10 }}>
        <summary style={{ fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
          Debug: Widget State
        </summary>
        <pre
          style={{
            fontSize: 11,
            background: "#f8fafc",
            padding: 8,
            marginTop: 8,
            borderRadius: 6,
            overflow: "auto",
          }}
        >
          {JSON.stringify(
            {
              view,
              state,
              busy,
              installationId: props.installationId,
              widgetId: props.widget?.id,
              hasResult: !!result,
              hasError: !!error,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}
