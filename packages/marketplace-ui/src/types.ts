import type { LocalizedText } from "@xapps-platform/platform-i18n";

export type CatalogXapp = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  visibility?: string;
  status?: string;
  publisher?: {
    name: string;
    slug: string;
  };
  manifest?: {
    title?: LocalizedText;
    description?: LocalizedText;
    image?: string;
    tags?: string[];
    [k: string]: unknown;
  } | null;
  latest_version?: {
    version: string;
    [k: string]: unknown;
  } | null;
};

export type CatalogXappDetail = {
  xapp: Record<string, unknown>;
  version: Record<string, unknown>;
  manifest: Record<string, unknown>;
  tools: Record<string, unknown>[];
  widgets: {
    id: string;
    default?: boolean;
    widget_name?: string;
    title?: LocalizedText;
    bind_tool_name?: string | null;
  }[];
  usage_credit_summary?: {
    available_count: number;
    available_session_backed_count?: number;
    available_ledger_only_count?: number;
    reserved_count: number;
    reserved_active_count?: number;
    reserved_stale_count?: number;
    consumed_count: number;
    updated_at?: string | null;
    by_tool: {
      tool_name: string;
      available_count: number;
      available_session_backed_count?: number;
      available_ledger_only_count?: number;
      reserved_count: number;
      reserved_active_count?: number;
      reserved_stale_count?: number;
      consumed_count: number;
    }[];
  } | null;
  operational_surfaces?: OperationalSurfacesDescriptor | null;
};

export type MarketplaceMonetizationAccessProjection = {
  entitlement_state?: string | null;
  balance_state?: string | null;
  has_current_access?: boolean;
  tier?: string | null;
  credits_remaining?: string | null;
  source_ref?: string | null;
  [k: string]: unknown;
};

export type MarketplaceCurrentSubscription = {
  id?: string | null;
  status?: string | null;
  tier?: string | null;
  billing_period?: string | null;
  billing_period_count?: number | null;
  current_period_starts_at?: string | null;
  current_period_ends_at?: string | null;
  renews_at?: string | null;
  cancelled_at?: string | null;
  expired_at?: string | null;
  overdue_policy?: {
    has_current_access?: boolean;
    effective_status_reason?: string | null;
    expiry_boundary_at?: string | null;
    expiry_boundary_source?: string | null;
    overdue_since?: string | null;
    [k: string]: unknown;
  } | null;
  source_ref?: string | null;
  [k: string]: unknown;
};

export type MarketplaceXappMonetizationState = {
  xapp_id: string;
  version_id: string;
  subject_id?: string | null;
  paywalls?: Array<Record<string, unknown>> | null;
  additive_entitlements?: Array<{
    id?: string | null;
    status?: string | null;
    tier?: string | null;
    product_id?: string | null;
    product_slug?: string | null;
    purchase_intent_id?: string | null;
    source_kind?: string | null;
    source_ref?: string | null;
    state_version?: string | null;
    starts_at?: string | null;
    expires_at?: string | null;
  }> | null;
  access_projection?: MarketplaceMonetizationAccessProjection | null;
  current_subscription?: MarketplaceCurrentSubscription | null;
};

export type OperationalSurfaceDescriptor = {
  enabled: boolean;
  scope: "xapp";
  visibility: {
    portal: boolean;
    embed: boolean;
  };
  filters: {
    xapp_id: string;
    installation_id?: string;
  };
  derived_from: string[];
};

export type OperationalSurfacesDescriptor = {
  requests: OperationalSurfaceDescriptor;
  payments: OperationalSurfaceDescriptor;
  invoices: OperationalSurfaceDescriptor;
  notifications: OperationalSurfaceDescriptor;
};

export type OperationalSurfaceVisibilityMode = "contract" | "testing_all";
export type OperationalSurfacePlacement = "in_router" | "side_panel" | "full_page";

export type InstallationInfo = {
  installationId: string;
  xappId: string;
  status?: string;
  updateAvailable?: boolean;
};

export type MarketplaceClient = {
  listCatalogXapps(): Promise<{ items: CatalogXapp[] }>;
  getCatalogXapp(
    xappId: string,
    options?: { installationId?: string | null },
  ): Promise<CatalogXappDetail>;
  getMyXappMonetization?(
    xappId: string,
    options?: { subjectId?: string | null; installationId?: string | null; locale?: string | null },
  ): Promise<MarketplaceXappMonetizationState>;
  prepareMyXappPurchaseIntent?(input: {
    xappId: string;
    offeringId: string;
    packageId: string;
    priceId: string;
    subjectId?: string | null;
    installationId?: string | null;
  }): Promise<{
    xapp_id: string;
    version_id: string;
    prepared_intent: {
      purchase_intent_id: string;
      package_id: string;
      price_id: string;
      status: string;
    };
  }>;
  createMyXappPurchasePaymentSession?(input: {
    xappId: string;
    intentId: string;
    returnUrl: string;
    cancelUrl?: string | null;
    pageUrl?: string | null;
    xappsResume?: string | null;
    locale?: string | null;
  }): Promise<{
    xapp_id: string;
    version_id: string;
    payment_session: {
      payment_session_id: string | null;
      status: string;
      amount: string;
      currency: string;
      issuer: string;
      return_url: string | null;
      cancel_url: string | null;
      xapps_resume: string | null;
    };
    payment_page_url: string | null;
  }>;
  finalizeMyXappPurchasePaymentSession?(input: { xappId: string; intentId: string }): Promise<{
    xapp_id: string;
    version_id: string;
    payment_session: {
      payment_session_id: string | null;
      status: string;
      amount: string;
      currency: string;
      issuer: string;
      return_url: string | null;
      cancel_url: string | null;
      xapps_resume: string | null;
    };
    prepared_intent: {
      purchase_intent_id: string;
      package: { id: string; slug: string; product_id: string };
      price: {
        id: string;
        currency: string;
        amount: string;
        catalog_amount: string;
        billing_period: string;
        billing_period_count: number | null;
        trial_policy: Record<string, unknown> | null;
        intro_policy: Record<string, unknown> | null;
        applied_trial_policy: Record<string, unknown> | null;
        applied_intro_policy: Record<string, unknown> | null;
        checkout_mode: string;
      };
      offering: { id: string; slug: string };
      status: string;
    };
    transaction?: Record<string, unknown> | null;
    idempotent?: boolean;
    issuance_mode?: string | null;
    entitlement?: Record<string, unknown> | null;
    subscription_contract?: Record<string, unknown> | null;
    wallet_account?: Record<string, unknown> | null;
    wallet_ledger?: Record<string, unknown> | null;
    access_projection?: MarketplaceMonetizationAccessProjection | null;
    snapshot_id?: string | null;
  }>;

  // Requests (read-only)
  listMyRequests(query?: {
    xappId?: string;
    toolName?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: unknown[];
    pagination?: { total: number; page: number; pageSize: number; totalPages: number };
  }>;
  getMyRequest(id: string): Promise<unknown>;
  reconcileMyRequestPayment?(input: {
    requestId: string;
    paymentSessionId?: string | null;
    returnUrl?: string | null;
    cancelUrl?: string | null;
    xappsResume?: string | null;
  }): Promise<{
    status: string;
    payment_session_id: string;
    provider_status: string;
    finality_state: "confirmed_paid" | "still_pending" | "failed";
    reconciled: boolean;
    redirect_url: string | null;
  }>;
  listMyPaymentSessions?(query?: {
    paymentSessionId?: string;
    xappId?: string;
    installationId?: string;
    toolName?: string;
    status?: string;
    issuer?: string;
    createdFrom?: string;
    createdTo?: string;
    limit?: number;
  }): Promise<{
    items: unknown[];
  }>;
  getMyPaymentSession?(id: string): Promise<unknown>;
  listMyInvoices?(query?: {
    requestId?: string;
    paymentSessionId?: string;
    xappId?: string;
    installationId?: string;
    status?: string;
    ownerScope?: string;
    search?: string;
    createdFrom?: string;
    createdTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: unknown[];
    pagination?: { total: number; page: number; pageSize: number; totalPages: number };
  }>;
  getMyInvoiceHistory?(id: string): Promise<unknown>;
  listMyNotifications?(query?: {
    notificationId?: string;
    status?: string;
    trigger?: string;
    xappId?: string;
    installationId?: string;
    unread?: boolean;
    limit?: number;
  }): Promise<{
    items: unknown[];
    unread_count: number;
    preferences?: Record<string, unknown>;
  }>;
  markMyNotificationRead?(notificationId: string): Promise<{ ok: boolean; unread_count: number }>;
  markAllMyNotificationsRead?(): Promise<{ ok: boolean; unread_count: number }>;
  getWidgetToken(
    installationId: string,
    widgetId: string,
  ): Promise<{
    token: string;
    expires_in?: number;
    context?: {
      clientId: string;
      installationId: string;
      xappId: string;
      subjectId: string | null;
      requestId?: string | null;
      resultPresentation?: "runtime_default" | "inline" | "publisher_managed";
      locale?: string | null;
    } | null;
  }>;
};

export type MarketplaceHostAdapter = {
  subjectId?: string | null;
  theme?: Record<string, unknown> | null;
  locale?: string | null;

  /**
   * Whether the current runtime is allowed to perform Marketplace mutations (install/update/uninstall).
   *
   * Portal: typically requires an authenticated user session.
   * Embed: typically true (mutations are host-driven via postMessage + server-to-server).
   */
  canMutate?(): boolean;

  // For enabling/disabling actions.
  getInstallationsByXappId(): Record<string, InstallationInfo>;
  refreshInstallations(): void;

  requestInstall(input: {
    xappId: string;
    defaultWidgetId?: string | null;
    subjectId?: string | null;
    termsAccepted?: boolean;
  }): void;

  // Host-driven mutations (portal can implement via direct API calls; embed via postMessage).
  requestUpdate?(input: { installationId: string; xappId: string; termsAccepted?: boolean }): void;
  requestUninstall?(input: { installationId: string; xappId: string }): void;

  openWidget(input: {
    installationId: string;
    widgetId: string;
    xappId?: string;
    xappTitle?: string;
    widgetName?: string;
    toolName?: string;
  }): void;

  openOperationalSurface?(input: {
    surface: "requests" | "payments" | "invoices" | "notifications";
    placement?: OperationalSurfacePlacement;
    xappId?: string;
    installationId?: string;
    requestId?: string;
    paymentSessionId?: string;
    invoiceId?: string;
    notificationId?: string;
  }): void;

  // Optional: called by UI when it thinks height changed
  notifyResize?(height: number): void;
  notifyNavigation?(input: { path: string; page?: string; params?: unknown }): void;
};

export type MarketplaceEnv = {
  locale?: string;
  title?: string;
  copy?: {
    addAppLabel?: string;
    removeAppLabel?: string;
    updateAppLabel?: string;
    openAppLabel?: string;
  };
  /**
   * Enables access to request-related pages and links ("Requests").
   * In public catalog embeds this should be set to false to hide links
   * and show a friendly message when routes are accessed directly.
   * Defaults to true when omitted.
   */
  requestsEnabled?: boolean;
  /**
   * If true, opening a widget will navigate to a sub-route within the marketplace
   * instead of notifying the host to open it in a separate panel/window.
   */
  embedMode?: boolean;
  /**
   * If true, the UI is restricted to a single xapp view.
   * Back navigation to the catalog is disabled.
   */
  singleXappMode?: boolean;
  /**
   * The ID of the xapp when in singleXappMode.
   */
  xappId?: string;
  /**
   * Optional publisher slugs to filter the catalog.
   */
  publishers?: string[];
  /**
   * Optional tags to filter the catalog.
   */
  tags?: string[];
  /**
   * Host-side visibility policy for xapp operational surfaces.
   *
   * `contract`: only show surfaces explicitly resolved from the xapp contract.
   * `testing_all`: expose all supported surfaces in that host for validation/testing.
   */
  operationalSurfacesVisibility?: {
    portal?: OperationalSurfaceVisibilityMode;
    embed?: OperationalSurfaceVisibilityMode;
  };
  /**
   * Host-side placement policy for xapp operational surfaces.
   *
   * Current default is `in_router` in all hosts.
   * Additional placements are declared now for future host behavior, but they do not change
   * rendering until a host explicitly implements them.
   */
  operationalSurfacePlacement?: {
    portal?: {
      default?: OperationalSurfacePlacement;
      bySurface?: Partial<
        Record<"requests" | "payments" | "invoices" | "notifications", OperationalSurfacePlacement>
      >;
    };
    embed?: {
      default?: OperationalSurfacePlacement;
      bySurface?: Partial<
        Record<"requests" | "payments" | "invoices" | "notifications", OperationalSurfacePlacement>
      >;
    };
  };
};
