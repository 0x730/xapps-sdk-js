import React from "react";
import { AppShellWidget } from "./AppShellWidget";
import { UiKitWidget } from "./UiKitWidget";
import type { GuardUiDescriptor, WidgetHostAdapter } from "./types";
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

  const session = useWidgetSession({
    apiBaseUrl: props.apiBaseUrl,
    installationId: props.installationId,
    widgetId: props.widgetId,
    devMode: props.devMode,
    createWidgetSession: props.createWidgetSession,
  });
  const widgetRecord = asRecord(session.widgetMeta);
  const renderer = readString(widgetRecord.renderer);

  if (session.embedUrl) {
    return (
      <iframe
        key={session.embedUrl}
        src={session.embedUrl}
        allow="publickey-credentials-get; publickey-credentials-create"
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
