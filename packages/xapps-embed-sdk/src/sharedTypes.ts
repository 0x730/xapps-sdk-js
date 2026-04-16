export type Theme = Partial<{
  primary: string;
  primaryDark: string;
  bg: string;
  bgSubtle: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  shadowSm: string;
  shadow: string;
  shadowLg: string;
  radiusSm: string;
  radiusMd: string;
  radius: string;
  radiusLg: string;
  fontFamily: string;
  displayFont: string;
  tokens: Record<string, string>;
}>;

export type SessionExpiredPayload = {
  reason:
    | "portal_session_expired"
    | "publisher_session_expired"
    | "publisher_session_revoked"
    | "widget_session_expired"
    | "token_refresh_failed"
    | "portal_logout"
    | "unknown";
  channel: "host" | "publisher_bridge" | "widget_session" | "portal_session";
  recoverable: boolean;
  occurred_at?: string;
  message?: string;
};

export type HostUiContextPayload = Record<string, unknown>;
export type HostUiExpandStage = "inline" | "focus" | "fullscreen";
export type HostUiExpandRequest = {
  expanded: boolean;
  source?: string;
  widgetId?: string;
  mode?: "expand" | "collapse";
  stage?: HostUiExpandStage;
  suggested?: Record<string, unknown>;
};
export type HostUiExpandResult = {
  hostManaged: boolean;
  expanded: boolean;
  stage: HostUiExpandStage;
  nativeFullscreen?: boolean;
};

export type OperationalSurfaceKey =
  | "requests"
  | "monetization"
  | "payments"
  | "invoices"
  | "notifications";

export type OpenOperationalSurfaceInput = {
  surface: OperationalSurfaceKey;
  placement?: "in_router" | "side_panel" | "full_page";
  xappId?: string;
  installationId?: string;
  requestId?: string;
  paymentSessionId?: string;
  invoiceId?: string;
  notificationId?: string;
};

export type InstallationPolicy = {
  mode: "manual" | "auto_available";
  update_mode: "manual" | "auto_update_compatible";
};
