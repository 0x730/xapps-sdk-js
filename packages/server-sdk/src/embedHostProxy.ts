import type {
  CatalogSessionInput,
  CatalogSessionResult,
  EmbedMyXappCreatePurchasePaymentSessionInput,
  EmbedMyXappMonetizationHistoryInput,
  EmbedMyXappMonetizationHistoryResult,
  EmbedMyXappFinalizePurchasePaymentSessionInput,
  EmbedMyXappMonetizationInput,
  EmbedMyXappMonetizationResult,
  EmbedMyXappPreparePurchaseIntentInput,
  GatewaySubjectResolveInput,
  GatewaySubjectResolveResult,
  InstallXappInput,
  InstallXappResult,
  ListInstallationsInput,
  ListInstallationsResult,
  UninstallInstallationInput,
  UninstallInstallationResult,
  UpdateInstallationInput,
  UpdateInstallationResult,
  RunWidgetToolRequestInput,
  WidgetSessionInput,
  WidgetSessionResult,
} from "./gatewayApiClient.js";

export type EmbedHostMode = {
  key: string;
  label: string;
};

export type EmbedHostNoStoreHeaders = {
  "Cache-Control": string;
  Pragma: string;
  Expires: string;
};

export type EmbedHostConfigResult = {
  ok: true;
  gatewayUrl?: string;
  hostModes: EmbedHostMode[];
  installationPolicy?: {
    mode: "manual" | "auto_available";
    update_mode: "manual" | "auto_update_compatible";
  };
};

export type EmbedHostResolveSubjectInput = {
  subjectId?: string | null;
  type?: string | null;
  identifier?: {
    idType?: string | null;
    value?: string | null;
    hint?: string | null;
  } | null;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  linkId?: string | null;
};

export type EmbedHostResolveSubjectResult = GatewaySubjectResolveResult & {
  email: string | null;
  name: string | null;
};

export type EmbedHostCreateCatalogSessionInput = CatalogSessionInput;

export type EmbedHostCreateWidgetSessionInput = WidgetSessionInput & {
  origin: string;
};

export type EmbedHostGetMyXappMonetizationInput = EmbedMyXappMonetizationInput;
export type EmbedHostGetMyXappMonetizationHistoryInput = EmbedMyXappMonetizationHistoryInput;

export type EmbedHostPrepareMyXappPurchaseIntentInput = EmbedMyXappPreparePurchaseIntentInput;

export type EmbedHostCreateMyXappPurchasePaymentSessionInput =
  EmbedMyXappCreatePurchasePaymentSessionInput;

export type EmbedHostFinalizeMyXappPurchasePaymentSessionInput =
  EmbedMyXappFinalizePurchasePaymentSessionInput;

export type EmbedHostBridgeTokenRefreshInput = Pick<
  EmbedHostCreateWidgetSessionInput,
  "installationId" | "widgetId" | "origin" | "subjectId" | "hostReturnUrl"
>;

export type EmbedHostBridgeTokenRefreshResult = {
  token: string;
  expires_in: number;
};

export type EmbedHostBridgeSignInput = {
  envelope?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
};

export type EmbedHostBridgeSignResult =
  | { ok: true; envelope: Record<string, unknown> }
  | { ok: false; error?: string };

export type EmbedHostBridgeVendorAssertionInput = {
  data?: Record<string, unknown> | null;
};

export type EmbedHostBridgeVendorAssertionResult =
  | { ok: true; vendor_assertion: string; link_id?: string }
  | { ok: false; error?: string };

export type EmbedHostRunWidgetToolRequestInput = RunWidgetToolRequestInput;

export class EmbedHostProxyInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "EmbedHostProxyInputError";
    this.status = status;
  }
}

export class EmbedHostProxyNotConfiguredError extends Error {
  status: number;

  constructor(message: string, status = 501) {
    super(message);
    this.name = "EmbedHostProxyNotConfiguredError";
    this.status = status;
  }
}

export type EmbedHostProxyServiceOptions = {
  gatewayClient: Pick<
    {
      resolveSubject: (input: GatewaySubjectResolveInput) => Promise<GatewaySubjectResolveResult>;
      createCatalogSession: (input: CatalogSessionInput) => Promise<CatalogSessionResult>;
      createWidgetSession: (input: WidgetSessionInput) => Promise<WidgetSessionResult>;
      listInstallations: (input?: ListInstallationsInput) => Promise<ListInstallationsResult>;
      installXapp: (input: InstallXappInput) => Promise<InstallXappResult>;
      updateInstallation: (input: UpdateInstallationInput) => Promise<UpdateInstallationResult>;
      uninstallInstallation: (
        input: UninstallInstallationInput,
      ) => Promise<UninstallInstallationResult>;
      getEmbedMyXappMonetization: (
        input: EmbedMyXappMonetizationInput,
      ) => Promise<EmbedMyXappMonetizationResult>;
      getEmbedMyXappMonetizationHistory: (
        input: EmbedMyXappMonetizationHistoryInput,
      ) => Promise<EmbedMyXappMonetizationHistoryResult>;
      prepareEmbedMyXappPurchaseIntent: (
        input: EmbedMyXappPreparePurchaseIntentInput,
      ) => Promise<Record<string, unknown>>;
      createEmbedMyXappPurchasePaymentSession: (
        input: EmbedMyXappCreatePurchasePaymentSessionInput,
      ) => Promise<Record<string, unknown>>;
      finalizeEmbedMyXappPurchasePaymentSession: (
        input: EmbedMyXappFinalizePurchasePaymentSessionInput,
      ) => Promise<Record<string, unknown>>;
      runWidgetToolRequest: (input: RunWidgetToolRequestInput) => Promise<Record<string, unknown>>;
    },
    | "resolveSubject"
    | "createCatalogSession"
    | "createWidgetSession"
    | "listInstallations"
    | "installXapp"
    | "updateInstallation"
    | "uninstallInstallation"
    | "getEmbedMyXappMonetization"
    | "getEmbedMyXappMonetizationHistory"
    | "prepareEmbedMyXappPurchaseIntent"
    | "createEmbedMyXappPurchasePaymentSession"
    | "finalizeEmbedMyXappPurchasePaymentSession"
    | "runWidgetToolRequest"
  >;
  gatewayUrl?: string;
  hostModes?: EmbedHostMode[];
  installationPolicy?: {
    mode?: "manual" | "auto_available";
    update_mode?: "manual" | "auto_update_compatible";
  };
  resolveInstallationPolicy?:
    | (() =>
        | Promise<
            | {
                mode?: "manual" | "auto_available";
                update_mode?: "manual" | "auto_update_compatible";
              }
            | null
            | undefined
          >
        | {
            mode?: "manual" | "auto_available";
            update_mode?: "manual" | "auto_update_compatible";
          }
        | null
        | undefined)
    | null;
  tokenRefreshTtlSeconds?: number;
  bridge?: {
    sign?:
      | ((input: EmbedHostBridgeSignInput) => Promise<EmbedHostBridgeSignResult>)
      | ((input: EmbedHostBridgeSignInput) => EmbedHostBridgeSignResult);
    vendorAssertion?:
      | ((
          input: EmbedHostBridgeVendorAssertionInput,
        ) => Promise<EmbedHostBridgeVendorAssertionResult>)
      | ((input: EmbedHostBridgeVendorAssertionInput) => EmbedHostBridgeVendorAssertionResult);
  };
};

const DEFAULT_HOST_MODES: EmbedHostMode[] = [
  { key: "single-panel", label: "Single Panel" },
  { key: "split-panel", label: "Split Panel" },
];

const NO_STORE_HEADERS: EmbedHostNoStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function requireTrimmedString(value: unknown, field: string): string {
  const resolved = String(value || "").trim();
  if (!resolved) throw new EmbedHostProxyInputError(`${field} is required`);
  return resolved;
}

function readOptionalString(value: unknown): string | null {
  const resolved = String(value || "").trim();
  return resolved || null;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function rewriteEmbedUrlWithHostReturnUrl(embedUrl: string, hostReturnUrl?: string | null): string {
  const resolvedHostReturnUrl = String(hostReturnUrl || "").trim();
  if (!resolvedHostReturnUrl) return embedUrl;
  try {
    const isAbsolute = /^https?:\/\//i.test(embedUrl);
    const parsed = isAbsolute ? new URL(embedUrl) : new URL(embedUrl, "http://xapps.local");
    parsed.searchParams.set("xapps_host_return_url", resolvedHostReturnUrl);
    return isAbsolute ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return embedUrl;
  }
}

/**
 * Creates a framework-neutral service for tenant/publisher host proxies.
 *
 * The service mirrors the secure backend surface used by xconect today while keeping
 * routing-framework concerns outside the package. Node or PHP hosts can implement the
 * same route contract on top of these methods.
 */
export function createEmbedHostProxyService(options: EmbedHostProxyServiceOptions) {
  const hostModes =
    Array.isArray(options.hostModes) && options.hostModes.length
      ? options.hostModes
      : DEFAULT_HOST_MODES;
  const tokenRefreshTtlSeconds =
    Number.isFinite(options.tokenRefreshTtlSeconds) && Number(options.tokenRefreshTtlSeconds) > 0
      ? Math.floor(Number(options.tokenRefreshTtlSeconds))
      : 900;

  function normalizeInstallationPolicy(
    value:
      | {
          mode?: "manual" | "auto_available";
          update_mode?: "manual" | "auto_update_compatible";
        }
      | null
      | undefined,
  ) {
    if (!value) return undefined;
    return {
      mode: value.mode === "auto_available" ? "auto_available" : "manual",
      update_mode:
        value.update_mode === "auto_update_compatible" ? "auto_update_compatible" : "manual",
    } as const;
  }

  return {
    getNoStoreHeaders(): EmbedHostNoStoreHeaders {
      return { ...NO_STORE_HEADERS };
    },

    getHostConfig(): EmbedHostConfigResult {
      return {
        ok: true,
        ...(readOptionalString(options.gatewayUrl)
          ? { gatewayUrl: String(options.gatewayUrl).trim() }
          : {}),
        hostModes,
        ...(normalizeInstallationPolicy(options.installationPolicy)
          ? { installationPolicy: normalizeInstallationPolicy(options.installationPolicy) }
          : {}),
      };
    },

    async getHostConfigForRequest(): Promise<EmbedHostConfigResult> {
      const resolvedPolicy =
        typeof options.resolveInstallationPolicy === "function"
          ? normalizeInstallationPolicy(await options.resolveInstallationPolicy())
          : normalizeInstallationPolicy(options.installationPolicy);
      return {
        ok: true,
        ...(readOptionalString(options.gatewayUrl)
          ? { gatewayUrl: String(options.gatewayUrl).trim() }
          : {}),
        hostModes,
        ...(resolvedPolicy ? { installationPolicy: resolvedPolicy } : {}),
      };
    },

    async resolveSubject(
      input: EmbedHostResolveSubjectInput,
    ): Promise<EmbedHostResolveSubjectResult> {
      const directSubjectId = readOptionalString(input.subjectId);
      const email = readOptionalString(input.email)?.toLowerCase() ?? null;
      const name = readOptionalString(input.name);

      const rawIdentifier =
        input.identifier && typeof input.identifier === "object" && !Array.isArray(input.identifier)
          ? input.identifier
          : null;
      const explicitIdType = readOptionalString(rawIdentifier?.idType);
      const explicitIdentifierValue = readOptionalString(rawIdentifier?.value);
      const identifierIdType = explicitIdType ?? (email ? "email" : null);
      const identifierValue =
        explicitIdentifierValue ?? (identifierIdType === "email" ? email : null);
      if (directSubjectId && !identifierIdType && !identifierValue) {
        throw new EmbedHostProxyInputError(
          "subjectId requires identifier.idType + identifier.value or email for validation",
        );
      }
      if (!identifierIdType || !identifierValue) {
        throw new EmbedHostProxyInputError(
          "subjectId or identifier.idType + identifier.value (or email) is required",
        );
      }
      const payload: GatewaySubjectResolveInput = {
        type: readOptionalString(input.type) ?? "user",
        identifier: {
          idType: identifierIdType,
          value: identifierValue,
          ...(readOptionalString(rawIdentifier?.hint)
            ? { hint: readOptionalString(rawIdentifier?.hint)! }
            : {}),
        },
        ...(email ? { email } : {}),
        ...(input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
          ? { metadata: input.metadata }
          : {}),
        ...(readOptionalString(input.linkId) ? { linkId: readOptionalString(input.linkId)! } : {}),
      };
      const result: GatewaySubjectResolveResult =
        await options.gatewayClient.resolveSubject(payload);
      if (directSubjectId && result.subjectId !== directSubjectId) {
        throw new EmbedHostProxyInputError(
          "subjectId does not match the resolved subject for the provided identity",
          403,
        );
      }
      return {
        subjectId: result.subjectId,
        email,
        name,
      };
    },

    async listInstallations(input: ListInstallationsInput = {}): Promise<ListInstallationsResult> {
      return options.gatewayClient.listInstallations({
        subjectId: readOptionalString(input.subjectId),
      });
    },

    async installXapp(input: InstallXappInput): Promise<InstallXappResult> {
      return options.gatewayClient.installXapp({
        xappId: requireTrimmedString(input.xappId, "xappId"),
        subjectId: readOptionalString(input.subjectId),
        termsAccepted: readOptionalBoolean(input.termsAccepted),
      });
    },

    async updateInstallation(input: UpdateInstallationInput): Promise<UpdateInstallationResult> {
      return options.gatewayClient.updateInstallation({
        installationId: requireTrimmedString(input.installationId, "installationId"),
        subjectId: readOptionalString(input.subjectId),
        termsAccepted: readOptionalBoolean(input.termsAccepted),
      });
    },

    async uninstallInstallation(
      input: UninstallInstallationInput,
    ): Promise<UninstallInstallationResult> {
      return options.gatewayClient.uninstallInstallation({
        installationId: requireTrimmedString(input.installationId, "installationId"),
        subjectId: readOptionalString(input.subjectId),
      });
    },

    async createCatalogSession(
      input: EmbedHostCreateCatalogSessionInput,
    ): Promise<CatalogSessionResult> {
      return options.gatewayClient.createCatalogSession({
        origin: requireTrimmedString(input.origin, "origin"),
        subjectId: readOptionalString(input.subjectId),
        xappId: readOptionalString(input.xappId),
        publishers: Array.isArray(input.publishers) ? input.publishers : undefined,
        tags: Array.isArray(input.tags) ? input.tags : undefined,
      });
    },

    async createWidgetSession(
      input: EmbedHostCreateWidgetSessionInput,
    ): Promise<WidgetSessionResult> {
      const origin = requireTrimmedString(input.origin, "origin");
      const result = await options.gatewayClient.createWidgetSession({
        installationId: requireTrimmedString(input.installationId, "installationId"),
        widgetId: requireTrimmedString(input.widgetId, "widgetId"),
        origin,
        xappId: readOptionalString(input.xappId),
        subjectId: readOptionalString(input.subjectId),
        requestId: readOptionalString(input.requestId),
        hostReturnUrl: readOptionalString(input.hostReturnUrl),
        resultPresentation: input.resultPresentation ?? undefined,
        guardUi: input.guardUi ?? undefined,
      });
      return {
        ...result,
        embedUrl: rewriteEmbedUrlWithHostReturnUrl(result.embedUrl, input.hostReturnUrl),
      };
    },

    async getMyXappMonetization(
      input: EmbedHostGetMyXappMonetizationInput,
    ): Promise<EmbedMyXappMonetizationResult> {
      return options.gatewayClient.getEmbedMyXappMonetization({
        xappId: requireTrimmedString(input.xappId, "xappId"),
        token: requireTrimmedString(input.token, "token"),
        installationId: readOptionalString(input.installationId),
        locale: readOptionalString(input.locale),
        country: readOptionalString(input.country),
        realmRef: readOptionalString(input.realmRef ?? input.realm_ref),
      });
    },

    async getMyXappMonetizationHistory(
      input: EmbedHostGetMyXappMonetizationHistoryInput,
    ): Promise<EmbedMyXappMonetizationHistoryResult> {
      return options.gatewayClient.getEmbedMyXappMonetizationHistory({
        xappId: requireTrimmedString(input.xappId, "xappId"),
        token: requireTrimmedString(input.token, "token"),
        limit: typeof input.limit === "number" ? input.limit : undefined,
      });
    },

    async prepareMyXappPurchaseIntent(
      input: EmbedHostPrepareMyXappPurchaseIntentInput,
    ): Promise<Record<string, unknown>> {
      return options.gatewayClient.prepareEmbedMyXappPurchaseIntent({
        xappId: requireTrimmedString(input.xappId, "xappId"),
        token: requireTrimmedString(input.token, "token"),
        offeringId: readOptionalString(input.offeringId ?? input.offering_id),
        packageId: readOptionalString(input.packageId ?? input.package_id),
        priceId: readOptionalString(input.priceId ?? input.price_id),
        installationId: readOptionalString(input.installationId ?? input.installation_id),
        locale: readOptionalString(input.locale),
        country: readOptionalString(input.country),
      }) as Promise<Record<string, unknown>>;
    },

    async createMyXappPurchasePaymentSession(
      input: EmbedHostCreateMyXappPurchasePaymentSessionInput,
    ): Promise<Record<string, unknown>> {
      return options.gatewayClient.createEmbedMyXappPurchasePaymentSession({
        xappId: requireTrimmedString(input.xappId, "xappId"),
        intentId: requireTrimmedString(input.intentId, "intentId"),
        token: requireTrimmedString(input.token, "token"),
        returnUrl: readOptionalString(input.returnUrl ?? input.return_url),
        cancelUrl: readOptionalString(input.cancelUrl ?? input.cancel_url),
        xappsResume: readOptionalString(input.xappsResume ?? input.xapps_resume),
        locale: readOptionalString(input.locale),
        installationId: readOptionalString(input.installationId ?? input.installation_id),
        paymentGuardRef: readOptionalString(input.paymentGuardRef ?? input.payment_guard_ref),
        issuer: readOptionalString(input.issuer),
        scheme: readOptionalString(input.scheme),
        paymentScheme: readOptionalString(input.paymentScheme ?? input.payment_scheme),
        metadata: input.metadata ?? undefined,
      }) as Promise<Record<string, unknown>>;
    },

    async finalizeMyXappPurchasePaymentSession(
      input: EmbedHostFinalizeMyXappPurchasePaymentSessionInput,
    ): Promise<Record<string, unknown>> {
      return options.gatewayClient.finalizeEmbedMyXappPurchasePaymentSession({
        xappId: requireTrimmedString(input.xappId, "xappId"),
        intentId: requireTrimmedString(input.intentId, "intentId"),
        token: requireTrimmedString(input.token, "token"),
      }) as Promise<Record<string, unknown>>;
    },

    async runWidgetToolRequest(
      input: EmbedHostRunWidgetToolRequestInput,
    ): Promise<Record<string, unknown>> {
      return options.gatewayClient.runWidgetToolRequest({
        token: requireTrimmedString(input.token, "token"),
        installationId: requireTrimmedString(input.installationId, "installationId"),
        toolName: requireTrimmedString(input.toolName, "toolName"),
        payload:
          input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
            ? input.payload
            : undefined,
      });
    },

    async refreshWidgetToken(
      input: EmbedHostBridgeTokenRefreshInput,
    ): Promise<EmbedHostBridgeTokenRefreshResult> {
      const origin = requireTrimmedString(input.origin, "origin");
      const result = await options.gatewayClient.createWidgetSession({
        installationId: requireTrimmedString(input.installationId, "installationId"),
        widgetId: requireTrimmedString(input.widgetId, "widgetId"),
        origin,
        subjectId: readOptionalString(input.subjectId),
        hostReturnUrl: readOptionalString(input.hostReturnUrl),
      });
      const token = requireTrimmedString(result.token, "token");
      return { token, expires_in: tokenRefreshTtlSeconds };
    },

    async bridgeSign(input: EmbedHostBridgeSignInput): Promise<EmbedHostBridgeSignResult> {
      if (input.envelope && typeof input.envelope === "object" && !Array.isArray(input.envelope)) {
        return { ok: true, envelope: input.envelope };
      }
      if (typeof options.bridge?.sign === "function") {
        return options.bridge.sign(input);
      }
      throw new EmbedHostProxyNotConfiguredError(
        "Signing is not configured for this host. Provide a precomputed envelope or wire a signer.",
      );
    },

    async bridgeVendorAssertion(
      input: EmbedHostBridgeVendorAssertionInput = {},
    ): Promise<EmbedHostBridgeVendorAssertionResult> {
      if (typeof options.bridge?.vendorAssertion === "function") {
        return options.bridge.vendorAssertion(input);
      }
      throw new EmbedHostProxyNotConfiguredError(
        "Vendor assertion is not configured for this host. Add it only when publisher-linked bridge flows are required.",
      );
    },
  };
}
