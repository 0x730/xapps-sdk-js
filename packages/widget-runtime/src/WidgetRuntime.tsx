import React from "react";
import { AppShellWidget } from "./AppShellWidget";
import { UiKitWidget } from "./UiKitWidget";
import type { GuardUiDescriptor, WidgetHostAdapter } from "./types";
import { getDefaultWidgetRuntimeLocale, translateWidgetRuntime } from "./i18n";
import { asRecord, readString } from "./runtimeReaders";
import { useWidgetUiBridge } from "./useWidgetUiBridge";
import { useWidgetSession, type WidgetSessionResult } from "./useWidgetSession";

export type WidgetRuntimeProps = {
  apiBaseUrl: string;
  installationId: string;
  widgetId: string;
  devMode?: boolean;
  createWidgetSession: (i: {
    installationId: string;
    widgetId: string;
    locale?: string;
    resultPresentation?: "runtime_default" | "inline" | "publisher_managed";
    guardUi?: GuardUiDescriptor;
  }) => Promise<WidgetSessionResult>;
  host: WidgetHostAdapter;
  iframeStyle?: React.CSSProperties;
};

/**
 * A reusable widget runner that:
 * - mints widget sessions
 * - chooses renderer (iframe vs ui-kit vs app-shell)
 * - wires the widget UI bridge (`XAPPS_UI_*`) to the injected host adapter
 */
export function WidgetRuntime(props: WidgetRuntimeProps) {
  useWidgetUiBridge(props.host);
  const runtimeLocale = getDefaultWidgetRuntimeLocale();
  const [iframeLoadError, setIframeLoadError] = React.useState<string | null>(null);
  const [initialLoadTimedOut, setInitialLoadTimedOut] = React.useState(false);
  const [iframeLoading, setIframeLoading] = React.useState(false);

  const session = useWidgetSession({
    apiBaseUrl: props.apiBaseUrl,
    installationId: props.installationId,
    widgetId: props.widgetId,
    devMode: props.devMode,
    createWidgetSession: props.createWidgetSession,
  });
  const widgetRecord = asRecord(session.widgetMeta);
  const renderer = readString(widgetRecord.renderer);

  React.useEffect(() => {
    setIframeLoadError(null);
    setIframeLoading(Boolean(session.embedUrl));
  }, [session.embedUrl]);

  React.useEffect(() => {
    if (!session.busy || session.embedUrl || session.widgetMeta) {
      setInitialLoadTimedOut(false);
      return;
    }
    setInitialLoadTimedOut(false);
    const timer = window.setTimeout(() => {
      setInitialLoadTimedOut(true);
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [session.busy, session.embedUrl, session.widgetMeta]);

  React.useEffect(() => {
    if (!session.embedUrl || !iframeLoading) {
      setIframeLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setIframeLoadError(translateWidgetRuntime("embedded_widget_load_timed_out", runtimeLocale));
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [iframeLoading, runtimeLocale, session.embedUrl]);

  const retryCard = (message: string) => (
    <div
      role="alert"
      style={{
        border: "1px solid rgba(220, 38, 38, 0.18)",
        borderRadius: 16,
        boxShadow: "0 10px 40px rgba(0,0,0,0.05)",
        background: "#fff",
        minHeight: 220,
        padding: 24,
        display: "grid",
        alignContent: "center",
        justifyItems: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 700, color: "#991b1b" }}>
        {translateWidgetRuntime("widget_unavailable", runtimeLocale)}
      </div>
      <div style={{ color: "#7f1d1d", fontSize: 14, maxWidth: 420 }}>{message}</div>
      <button
        type="button"
        onClick={() => {
          setIframeLoadError(null);
          void session.refreshSession();
        }}
        style={{
          borderRadius: 999,
          border: "1px solid rgba(37, 99, 235, 0.2)",
          background: "#eff6ff",
          color: "#1d4ed8",
          fontWeight: 600,
          padding: "10px 16px",
          cursor: "pointer",
        }}
      >
        {translateWidgetRuntime("retry", runtimeLocale)}
      </button>
    </div>
  );

  if (initialLoadTimedOut && !session.embedUrl && !session.widgetMeta) {
    return retryCard(translateWidgetRuntime("widget_took_too_long_to_start", runtimeLocale));
  }

  if (session.busy && !session.embedUrl && !session.widgetMeta) {
    return (
      <div
        aria-busy="true"
        style={{
          border: "1px solid var(--cx-border)",
          borderRadius: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,0.05)",
          background: "#fff",
          minHeight: 220,
          padding: 24,
          display: "grid",
          alignContent: "center",
          justifyItems: "center",
          gap: 8,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "2px solid rgba(0,0,0,0.12)",
            borderTopColor: "var(--cx-primary, #2563eb)",
            animation: "xapps-widget-runtime-spin 0.85s linear infinite",
          }}
        />
        <div style={{ color: "#6b7280", fontSize: 14 }}>
          {translateWidgetRuntime("loading", runtimeLocale)}
        </div>
      </div>
    );
  }

  if (session.error && !session.embedUrl && !session.widgetMeta) {
    return retryCard(session.error);
  }

  if (session.embedUrl) {
    if (iframeLoadError) {
      return retryCard(iframeLoadError);
    }
    return (
      <>
        <style>{`@keyframes xapps-widget-runtime-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={{ position: "relative" }}>
          {iframeLoading ? (
            <div
              aria-busy="true"
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                alignContent: "center",
                justifyItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.88)",
                borderRadius: 16,
                zIndex: 1,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "2px solid rgba(0,0,0,0.12)",
                  borderTopColor: "var(--cx-primary, #2563eb)",
                  animation: "xapps-widget-runtime-spin 0.85s linear infinite",
                }}
              />
              <div style={{ color: "#6b7280", fontSize: 14 }}>
                {translateWidgetRuntime("loading", runtimeLocale)}
              </div>
            </div>
          ) : null}
          <iframe
            key={session.embedUrl}
            src={session.embedUrl}
            allow="publickey-credentials-get; publickey-credentials-create"
            onLoad={() => {
              setIframeLoading(false);
              setIframeLoadError(null);
            }}
            onError={() => {
              setIframeLoading(false);
              setIframeLoadError(
                translateWidgetRuntime("embedded_widget_could_not_be_loaded", runtimeLocale),
              );
            }}
            style={{
              width: "100%",
              height: 600,
              border: "1px solid var(--cx-border)",
              borderRadius: 16,
              boxShadow: "0 10px 40px rgba(0,0,0,0.05)",
              background: "#fff",
              ...(props.iframeStyle ?? {}),
            }}
          />
        </div>
      </>
    );
  }

  if (renderer === "app-shell" && props.installationId) {
    return (
      <AppShellWidget
        apiBaseUrl={props.apiBaseUrl}
        installationId={props.installationId}
        shellWidget={session.widgetMeta}
        xappWidgets={session.xappWidgets ?? []}
        createWidgetSession={props.createWidgetSession}
        host={props.host}
      />
    );
  }

  if (renderer === "ui-kit" && props.installationId) {
    return (
      <UiKitWidget
        apiBaseUrl={props.apiBaseUrl}
        installationId={props.installationId}
        widgetToken={session.widgetToken}
        widget={session.widgetMeta}
        tool={session.toolMeta}
        host={props.host}
        createWidgetSession={props.createWidgetSession}
      />
    );
  }

  return null;
}
