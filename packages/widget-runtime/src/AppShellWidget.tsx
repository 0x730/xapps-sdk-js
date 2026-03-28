import { useEffect, useMemo, useRef, useState } from "react";
import type { AppShellWidgetProps, GuardUiDescriptor } from "./types";
import { formatRequestErrorMessage } from "./errorMessages";
import { getDefaultWidgetRuntimeLocale, translateWidgetRuntime } from "./i18n";
import { UiKitWidget } from "./UiKitWidget";
import { attachReturnedPaymentEvidence, hasReturnedPaidPaymentEvidence } from "./paymentEvidence";
import { ed25519 } from "@noble/curves/ed25519.js";
import { readGuardBlocked, readGuardChallengeToken } from "./guardParsing";
import {
  asRecord,
  readFirstString,
  readObjectArray,
  readString,
  readTrimmedString,
} from "./runtimeReaders";

type AppShellTab = {
  title: string;
  widget_name?: string;
  widgetId?: string;
  // For UI Kit tabs: render host or in iframe.
  render_mode?: "host" | "iframe" | "publisher";
};

export function AppShellWidget(props: AppShellWidgetProps) {
  const [runtimeLocale, setRuntimeLocale] = useState(getDefaultWidgetRuntimeLocale());
  const tabs: AppShellTab[] = useMemo(() => {
    const cfg = props.shellWidget?.config?.app_shell;
    const rawTabs = asRecord(cfg).tabs;
    if (!Array.isArray(rawTabs)) return [];
    return readObjectArray(rawTabs).map((tab) => ({
      title: readFirstString(tab.title) || translateWidgetRuntime("tab_fallback", runtimeLocale),
      widget_name: readTrimmedString(tab.widget_name) || undefined,
      widgetId: readTrimmedString(tab.widgetId) || undefined,
      render_mode:
        tab.render_mode === "iframe" || tab.render_mode === "publisher" ? tab.render_mode : "host",
    }));
  }, [props.shellWidget, runtimeLocale]);

  const [activeIdx, setActiveIdx] = useState(0);
  const active = tabs[activeIdx] ?? null;

  const [child, setChild] = useState<{
    token: string;
    embedUrl: string;
    context?: {
      clientId: string;
      installationId: string;
      xappId: string;
      subjectId: string | null;
      requestId?: string | null;
      resultPresentation?: "runtime_default" | "inline" | "publisher_managed";
    } | null;
    widget: unknown;
    tool: unknown;
  } | null>(null);
  const childRef = useRef(child);
  useEffect(() => {
    childRef.current = child;
  }, [child]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const guardIframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guardOverlay, setGuardOverlay] = useState<{
    token: string;
    embedUrl: string;
    widget?: unknown;
  } | null>(null);
  const guardResolutionRef = useRef<{
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const themeRef = useRef<Record<string, unknown> | null>(null);
  const localeRef = useRef<string | null>(null);

  async function confirmGuardAction(input: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    action?: Record<string, unknown>;
  }): Promise<boolean> {
    const action = asRecord(input.action);
    const actionKind = readTrimmedString(action.kind).toLowerCase();
    const actionUrl = readTrimmedString(action.url);
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
      return window.confirm(
        input.message || translateWidgetRuntime("continue_prompt", runtimeLocale),
      );
    }
    return false;
  }

  async function requestSubjectProfileGuardResolution(input: {
    installationId: string;
    widgetId: string;
    guardUi: GuardUiDescriptor;
  }): Promise<unknown> {
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

  function canonicalize(obj: unknown): string {
    if (obj === null || typeof obj !== "object") {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return "[" + obj.map((item) => canonicalize(item)).join(",") + "]";
    }
    const record = asRecord(obj);
    const keys = Object.keys(record).sort();
    const pairs = keys.map((key) => JSON.stringify(key) + ":" + canonicalize(record[key]));
    return "{" + pairs.join(",") + "}";
  }

  async function sha256Bytes(data: string): Promise<Uint8Array> {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest("SHA-256", enc.encode(data));
    return new Uint8Array(hash);
  }

  async function sha256Hex(data: string): Promise<string> {
    const bytes = await sha256Bytes(data);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function toBase64Url(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    // btoa expects Latin1
    const b64 = btoa(binary);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function hexToBytes(hex: string): Uint8Array {
    const s = String(hex || "").trim();
    if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2 !== 0) {
      throw new Error(translateWidgetRuntime("invalid_hex_string", runtimeLocale));
    }
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < s.length; i += 2) {
      out[i / 2] = parseInt(s.slice(i, i + 2), 16);
    }
    return out;
  }

  function resolveWidgetId(tab: AppShellTab): string {
    if (tab.widgetId) return tab.widgetId;
    if (tab.widget_name) {
      const w = props.xappWidgets.find(
        (entry) => readString(asRecord(entry).widget_name) === tab.widget_name,
      );
      const widgetId = readTrimmedString(asRecord(w).id);
      if (widgetId) return widgetId;
    }
    return "";
  }

  useEffect(() => {
    if (!active) return;
    const targetWidgetId = resolveWidgetId(active);
    if (!targetWidgetId) {
      setChild(null);
      setError(translateWidgetRuntime("app_shell_tab_missing_widget_reference", runtimeLocale));
      return;
    }

    let alive = true;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await props.createWidgetSession({
          installationId: props.installationId,
          widgetId: targetWidgetId,
        });
        if (!alive) return;
        setChild({
          token: res.token,
          embedUrl: res.embedUrl,
          context: res.context,
          widget: res.widget,
          tool: res.tool,
        });
      } catch (e) {
        if (!alive) return;
        setChild(null);
        setError(readFirstString(asRecord(e).message) || String(e));
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, props.installationId]);

  useEffect(() => {
    if (typeof props.host.getContext !== "function") return;
    let alive = true;
    void (async () => {
      try {
        const context = await props.host.getContext?.();
        if (!alive) return;
        const nextLocale = readTrimmedString(context?.locale) || getDefaultWidgetRuntimeLocale();
        localeRef.current = nextLocale;
        setRuntimeLocale(nextLocale);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.host]);

  useEffect(() => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "XAPPS_WIDGET_CONTEXT_REQUEST" }, "*");
      }
    } catch {
      // ignore
    }
    function handleMessage(event: MessageEvent) {
      const message = asRecord(event.data);
      const type = readString(message.type);
      const id = message.id;
      if (type === "XAPPS_WIDGET_CONTEXT") {
        const theme = asRecord(message.theme);
        themeRef.current =
          theme && Object.keys(theme).length > 0 ? (theme as Record<string, unknown>) : null;
        localeRef.current = readTrimmedString(message.locale) || null;
        setRuntimeLocale(readTrimmedString(message.locale) || getDefaultWidgetRuntimeLocale());
      } else if (type === "XAPPS_LOCALE_CHANGED") {
        localeRef.current = readTrimmedString(message.locale) || null;
        setRuntimeLocale(readTrimmedString(message.locale) || getDefaultWidgetRuntimeLocale());
        const widgetIframe = iframeRef.current;
        const guardIframe = guardIframeRef.current;
        const localeMessage = {
          type: "XAPPS_LOCALE_CHANGED",
          locale: localeRef.current,
        };
        if (widgetIframe?.contentWindow) {
          widgetIframe.contentWindow.postMessage(localeMessage, "*");
        }
        if (guardIframe?.contentWindow) {
          guardIframe.contentWindow.postMessage(localeMessage, "*");
        }
      } else if (type === "XAPPS_WIDGET_READY" || type === "XAPPS_WIDGET_CONTEXT_REQUEST") {
        const widgetIframe = iframeRef.current;
        const guardIframe = guardIframeRef.current;
        if (
          childRef.current &&
          widgetIframe?.contentWindow &&
          event.source === widgetIframe.contentWindow
        ) {
          widgetIframe.contentWindow.postMessage(
            {
              type: "XAPPS_WIDGET_CONTEXT",
              token: childRef.current.token,
              baseUrl: props.apiBaseUrl,
              theme: themeRef.current,
              locale: localeRef.current,
            },
            "*",
          );
        } else if (
          guardOverlay &&
          guardIframe?.contentWindow &&
          event.source === guardIframe.contentWindow
        ) {
          guardIframe.contentWindow.postMessage(
            {
              type: "XAPPS_WIDGET_CONTEXT",
              token: guardOverlay.token,
              baseUrl: props.apiBaseUrl,
              theme: themeRef.current,
              locale: localeRef.current,
            },
            "*",
          );
        }
      } else if (type === "XAPPS_UI_GET_CONTEXT") {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              type: "XAPPS_UI_GET_CONTEXT_RESULT",
              id,
              payload: {
                installationId: props.installationId,
                widgetId: resolveWidgetId(active!),
                devMode: false,
              },
            },
            "*",
          );
        }
      } else if (type === "XAPPS_UI_STATE_UPDATE") {
        const widgetId = readString(message.widgetId);
        const state = asRecord(message.state);
        const iframes = document.querySelectorAll("iframe");
        iframes.forEach((iframe) => {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage(
              { type: "XAPPS_UI_STATE_UPDATE", widgetId, state },
              "*",
            );
          }
        });
      } else if (type === "XAPPS_REQUEST_CREATE") {
        const requestId = message.id;
        void (async () => {
          try {
            const data = asRecord(message.data);
            const installationId = readFirstString(data.installationId, props.installationId);
            const toolName = readFirstString(data.toolName);
            const payload = data.payload ?? {};

            const token = childRef.current?.token ?? "";
            const toolPolicy = readFirstString(asRecord(childRef.current?.tool).signature_policy);
            const ctx = childRef.current?.context;

            const body: Record<string, unknown> = {
              installationId,
              toolName,
              payload,
              // If caller already provided subject signature fields, forward them.
              subjectSignature: data.subjectSignature,
              subjectKeyId: data.subjectKeyId,
              subjectSignatureAlg: data.subjectSignatureAlg,
              subjectSignatureNonce: data.subjectSignatureNonce,
              subjectSignatureTimestamp: data.subjectSignatureTimestamp,
            };

            const needsEd25519 = toolPolicy === "ed25519";
            const hasSignature =
              typeof body.subjectSignature === "string" &&
              typeof body.subjectKeyId === "string" &&
              typeof body.subjectSignatureNonce === "string" &&
              typeof body.subjectSignatureTimestamp === "string";

            if (needsEd25519 && !hasSignature) {
              if (!ctx?.subjectId) {
                throw new Error(
                  translateWidgetRuntime("subject_signature_requires_subject_id", runtimeLocale),
                );
              }

              const nodeEnv =
                typeof globalThis !== "undefined" &&
                "process" in globalThis &&
                (globalThis as { process?: { env?: Record<string, unknown> } }).process
                  ? String(
                      (globalThis as { process?: { env?: Record<string, unknown> } }).process?.env
                        ?.NODE_ENV || "",
                    )
                  : "";
              if (nodeEnv === "production") {
                throw new Error(
                  translateWidgetRuntime(
                    "subject_signature_dev_key_not_supported_in_production",
                    runtimeLocale,
                  ),
                );
              }
              const skHex = localStorage.getItem("XAPPS_DEV_ED25519_PRIVATE_KEY_HEX") ?? "";
              if (!skHex) {
                throw new Error(
                  translateWidgetRuntime("subject_signature_dev_key_required", runtimeLocale),
                );
              }

              // 1) Resolve active subject key ID
              const keyRes = await fetch(`${props.apiBaseUrl}/v1/signing/subject-keys/active`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
              });
              const keyData = asRecord(await keyRes.json().catch(() => ({})));
              if (!keyRes.ok) {
                throw new Error(
                  readFirstString(keyData.message) ||
                    translateWidgetRuntime("failed_to_resolve_subject_key", runtimeLocale, {
                      status: keyRes.status,
                    }),
                );
              }
              const keyId = readFirstString(keyData.keyId);
              if (!keyId) {
                throw new Error(translateWidgetRuntime("missing_subject_key_id", runtimeLocale));
              }

              // 2) Mint nonce
              const nonceRes = await fetch(`${props.apiBaseUrl}/v1/signing/nonces`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              const nonceData = asRecord(await nonceRes.json().catch(() => ({})));
              if (!nonceRes.ok) {
                throw new Error(
                  readFirstString(nonceData.message) ||
                    translateWidgetRuntime("failed_to_mint_nonce", runtimeLocale, {
                      status: nonceRes.status,
                    }),
                );
              }
              const nonce = readFirstString(nonceData.nonce);
              if (!nonce) {
                throw new Error(translateWidgetRuntime("missing_signing_nonce", runtimeLocale));
              }

              // 3) Canonicalize + hash payload
              const payloadHash = await sha256Hex(canonicalize(payload));
              const timestamp = new Date().toISOString();

              const canonicalPayload = {
                clientId: ctx.clientId,
                installationId: ctx.installationId,
                xappId: ctx.xappId,
                toolName,
                nonce,
                payloadHash,
                timestamp,
                keyId,
              };

              const digestBytes = await sha256Bytes(canonicalize(canonicalPayload));
              const sigBytes = ed25519.sign(digestBytes, hexToBytes(skHex));

              body.subjectSignature = toBase64Url(sigBytes);
              body.subjectKeyId = keyId;
              body.subjectSignatureAlg = "ed25519";
              body.subjectSignatureNonce = nonce;
              body.subjectSignatureTimestamp = timestamp;
            }

            const createRequestWithGuardRetry = async (
              requestBody: Record<string, unknown>,
              attemptedOrchestration: boolean,
              currentOrchestration?: Record<string, unknown>,
            ): Promise<Record<string, unknown>> => {
              const effectiveBody = {
                ...requestBody,
                ...(currentOrchestration && Object.keys(currentOrchestration).length
                  ? { guardOrchestration: currentOrchestration }
                  : {}),
              };
              const res = await fetch(`${props.apiBaseUrl}/v1/requests`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(effectiveBody),
              });
              const out = asRecord(await res.json().catch(() => ({})));
              if (res.ok) return out;

              const guard = readGuardBlocked(out);
              if (guard?.uiRequired && !attemptedOrchestration) {
                const action = asRecord(guard.action);
                const actionKind = String(action.kind || "")
                  .trim()
                  .toLowerCase();
                const childWidgetRecord = asRecord(childRef.current?.widget);
                const childWidgetId = readFirstString(childWidgetRecord.id);
                if (actionKind === "open_guard" && guard.guardUi && childWidgetId) {
                  const resolved = await requestSubjectProfileGuardResolution({
                    installationId,
                    widgetId: childWidgetId,
                    guardUi: guard.guardUi,
                  });
                  const resolutionPayload = asRecord(asRecord(resolved).payload);
                  return createRequestWithGuardRetry(
                    {
                      ...requestBody,
                      payload: {
                        ...(requestBody.payload && typeof requestBody.payload === "object"
                          ? (requestBody.payload as Record<string, unknown>)
                          : {}),
                        ...resolutionPayload,
                      },
                    },
                    false,
                    currentOrchestration,
                  );
                }
                const approved = await confirmGuardAction({
                  title:
                    (typeof action.title === "string" ? action.title : "") ||
                    (typeof action.label === "string" ? action.label : "") ||
                    translateWidgetRuntime("guard_action_required", runtimeLocale),
                  message: guard.message,
                  confirmLabel:
                    (typeof action.label === "string" ? action.label : "") ||
                    translateWidgetRuntime("continue", runtimeLocale),
                  cancelLabel: translateWidgetRuntime("cancel", runtimeLocale),
                  action,
                });
                if (approved) {
                  const challengeToken = readGuardChallengeToken(
                    out.details ?? asRecord(out.guard).details,
                  );
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
                    requestBody,
                    true,
                    attachReturnedPaymentEvidence(nextOrchestration, guard),
                  );
                }
              }

              throw new Error(formatRequestErrorMessage(out, res.status, runtimeLocale));
            };

            const out = await createRequestWithGuardRetry(body, false);

            const iframe = iframeRef.current;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage(
                { type: "XAPPS_REQUEST_CREATE_RESULT", id: requestId, ok: true, data: out },
                "*",
              );
            }
          } catch (err) {
            const iframe = iframeRef.current;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage(
                {
                  type: "XAPPS_ERROR",
                  id: requestId,
                  ok: false,
                  error: { message: readFirstString(asRecord(err).message) || String(err) },
                },
                "*",
              );
            }
          }
        })();
      } else if (type === "XAPPS_REQUEST_GET") {
        const data = asRecord(message.data);
        const requestId = readFirstString(data.requestId);
        const msgId = message.id;
        fetch(`${props.apiBaseUrl}/v1/requests/${requestId}`, {
          headers: { Authorization: `Bearer ${childRef.current?.token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            const iframe = iframeRef.current;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage(
                { type: "XAPPS_REQUEST_GET_RESULT", id: msgId, ok: true, data },
                "*",
              );
            }
          });
      } else if (type === "XAPPS_REQUEST_RESPONSE") {
        const data = asRecord(message.data);
        const requestId = readFirstString(data.requestId);
        const msgId = message.id;
        fetch(`${props.apiBaseUrl}/v1/requests/${requestId}/response`, {
          headers: { Authorization: `Bearer ${childRef.current?.token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            const iframe = iframeRef.current;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage(
                { type: "XAPPS_REQUEST_RESPONSE_RESULT", id: msgId, ok: true, data },
                "*",
              );
            }
          });
      } else if (type === "XAPPS_SUBJECT_PROFILE_GUARD_RESULT") {
        if (
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
        if (readFirstString(data.status) === "resolved") {
          pending.resolve(data);
        } else {
          pending.reject(
            new Error(translateWidgetRuntime("subject_profile_completion_canceled", runtimeLocale)),
          );
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [active, guardOverlay, props.apiBaseUrl, props.installationId]);

  const childWidgetRecord = asRecord(child?.widget);
  const childRenderer = readFirstString(childWidgetRecord.renderer);
  const childWidgetId = readFirstString(childWidgetRecord.id);

  return (
    <div className="portal-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{ display: "flex", borderBottom: "1px solid var(--cx-border)", gap: 6, padding: 10 }}
      >
        {tabs.map((t, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIdx(idx)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: idx === activeIdx ? "rgba(59,130,246,0.12)" : "transparent",
              color: idx === activeIdx ? "var(--cx-primary)" : "inherit",
              boxShadow: "none",
            }}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {busy ? (
          <div style={{ color: "#6b7280" }}>{translateWidgetRuntime("loading", runtimeLocale)}</div>
        ) : null}
        {error ? (
          <div style={{ color: "#b91c1c" }}>
            {translateWidgetRuntime("error_prefix", runtimeLocale, { message: error })}
          </div>
        ) : null}

        {!busy && !error && child && child.widget ? (
          childRenderer === "ui-kit" && active?.render_mode === "host" ? (
            <UiKitWidget
              apiBaseUrl={props.apiBaseUrl}
              installationId={props.installationId}
              widgetToken={child.token}
              widget={child.widget}
              tool={child.tool}
              host={props.host}
              createWidgetSession={props.createWidgetSession}
            />
          ) : (
            <iframe
              ref={iframeRef}
              src={
                active?.render_mode === "publisher" && childRenderer === "ui-kit" && childWidgetId
                  ? `${props.apiBaseUrl}/embed/widgets/${childWidgetId}?token=${child.token}&renderer=publisher`
                  : child.embedUrl.startsWith("http")
                    ? child.embedUrl
                    : window.location.origin + child.embedUrl
              }
              style={{ width: "100%", height: "70vh", border: 0, borderRadius: 12 }}
              allow="clipboard-read; clipboard-write; publickey-credentials-get; publickey-credentials-create"
              title={String(
                active?.title || translateWidgetRuntime("app_tab_fallback", runtimeLocale),
              )}
            />
          )
        ) : null}
      </div>
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
              borderRadius: 16,
              overflow: "hidden",
              background: "var(--cx-card)",
              boxShadow: "var(--cx-shadow-lg)",
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
              title={translateWidgetRuntime("subject_profile_guard", runtimeLocale)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
