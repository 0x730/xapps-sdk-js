export type WidgetResultPresentation = "runtime_default" | "inline" | "publisher_managed";

export type GuardUiDescriptor = {
  contract_version: string;
  app_uri?: string;
  xapp_slug?: string;
  widget_name?: string;
  preferred_renderer?: string;
  payload_field?: string;
  remediation?: Record<string, unknown>;
};

export type WidgetContext = {
  installationId: string;
  widgetId?: string;
  requestId?: string;
  toolName?: string;
  devMode?: boolean;
  resultPresentation?: WidgetResultPresentation;
  locale?: string | null;
};

export type WidgetExpandStage = "inline" | "focus" | "fullscreen";

export type WidgetExpandRequestInput = {
  expanded: boolean;
  source?: string;
  widgetId?: string;
  mode?: "expand" | "collapse";
  stage?: WidgetExpandStage;
  suggested?: Record<string, unknown>;
};

export type WidgetExpandResult = {
  hostManaged: boolean;
  expanded: boolean;
  stage: WidgetExpandStage;
  nativeFullscreen?: boolean;
};

export type WidgetOperationalSurfaceKey = "requests" | "payments" | "invoices" | "notifications";

export type WidgetOpenOperationalSurfaceInput = {
  surface: WidgetOperationalSurfaceKey;
  placement?: "in_router" | "side_panel" | "full_page";
  xappId?: string;
  installationId?: string;
  requestId?: string;
  paymentSessionId?: string;
  invoiceId?: string;
  notificationId?: string;
};

export type WidgetOpenMonetizationPlansInput = {
  xappId?: string;
  installationId?: string;
  paywallSlug?: string;
  fallbackPath?: string;
};

export type GuardRequestInput = {
  guardSlug: string;
  trigger?: string;
  context?: Record<string, unknown>;
  config?: Record<string, unknown> | null;
};

export type GuardDecision =
  | {
      guard_slug: string;
      trigger?: string;
      status: "passed";
      satisfied?: boolean;
      receipt?: string;
      details?: Record<string, unknown>;
    }
  | {
      guard_slug: string;
      trigger?: string;
      status: "failed" | "cancelled";
      satisfied?: boolean;
      reason?: string;
      message?: string;
      details?: Record<string, unknown>;
    };

export type WidgetHostAdapter = {
  showNotification: (message: string, variant?: "info" | "success" | "warning" | "error") => void;
  showAlert: (message: string, title?: string) => void;
  openModal: (title?: string, message?: string) => void;
  closeModal: () => void;
  navigate: (path: string) => void;
  refresh: () => void;
  openOperationalSurface?: (input: WidgetOpenOperationalSurfaceInput) => void;
  openMonetizationPlans?: (input: WidgetOpenMonetizationPlansInput) => void;

  // Optional convenience hooks for hosts that want tighter integration.
  updateState?: (patch: Record<string, unknown>) => void;
  getContext?: () => Promise<WidgetContext>;
  requestGuard?: (input: GuardRequestInput) => Promise<GuardDecision> | GuardDecision;
  expandWidget?: (
    input: WidgetExpandRequestInput,
  ) => Promise<WidgetExpandResult | null | undefined> | WidgetExpandResult | null | undefined;
  confirmDialog?: (input: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean> | boolean;
};

export type UiKitWidgetProps = {
  apiBaseUrl: string;
  installationId: string;
  widgetToken: string;
  widget: any;
  tool: any;
  host: WidgetHostAdapter;
  createWidgetSession?: (input: {
    installationId: string;
    widgetId: string;
    locale?: string;
    resultPresentation?: WidgetResultPresentation;
    guardUi?: GuardUiDescriptor;
  }) => Promise<{
    token: string;
    embedUrl: string;
    context?: {
      clientId: string;
      installationId: string;
      xappId: string;
      subjectId: string | null;
      requestId?: string | null;
      resultPresentation?: WidgetResultPresentation;
      locale?: string | null;
    } | null;
    widget?: any | null;
    tool?: any | null;
  }>;
};

export type AppShellWidgetProps = {
  apiBaseUrl: string;
  installationId: string;
  // widget session for the shell itself (not reused for children; shell mints child sessions)
  shellWidget: any;
  // list of all widgets for this xapp version (provided by widget-sessions when renderer is app-shell)
  xappWidgets: any[];
  // Injected session minter to keep this runtime independent of any specific API client.
  createWidgetSession: (input: {
    installationId: string;
    widgetId: string;
    locale?: string;
    resultPresentation?: WidgetResultPresentation;
    guardUi?: GuardUiDescriptor;
  }) => Promise<{
    token: string;
    embedUrl: string;
    context?: {
      clientId: string;
      installationId: string;
      xappId: string;
      subjectId: string | null;
      requestId?: string | null;
      resultPresentation?: WidgetResultPresentation;
      locale?: string | null;
    } | null;
    widget?: any | null;
    tool?: any | null;
  }>;
  host: WidgetHostAdapter;
};
