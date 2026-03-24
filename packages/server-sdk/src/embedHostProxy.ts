import type {
  CatalogSessionInput,
  CatalogSessionResult,
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
};

export type EmbedHostResolveSubjectInput = {
  email: string;
  name?: string | null;
};

export type EmbedHostResolveSubjectResult = GatewaySubjectResolveResult & {
  email: string;
  name: string | null;
};

export type EmbedHostCreateCatalogSessionInput = CatalogSessionInput;

export type EmbedHostCreateWidgetSessionInput = WidgetSessionInput & {
  origin: string;
};

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
    },
    | "resolveSubject"
    | "createCatalogSession"
    | "createWidgetSession"
    | "listInstallations"
    | "installXapp"
    | "updateInstallation"
    | "uninstallInstallation"
  >;
  gatewayUrl?: string;
  hostModes?: EmbedHostMode[];
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
      };
    },

    async resolveSubject(
      input: EmbedHostResolveSubjectInput,
    ): Promise<EmbedHostResolveSubjectResult> {
      const email = requireTrimmedString(input.email, "email").toLowerCase();
      const payload: GatewaySubjectResolveInput = {
        type: "user",
        identifier: {
          idType: "email",
          value: email,
          hint: email,
        },
        email,
      };
      const result: GatewaySubjectResolveResult =
        await options.gatewayClient.resolveSubject(payload);
      return {
        subjectId: result.subjectId,
        email,
        name: readOptionalString(input.name),
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
