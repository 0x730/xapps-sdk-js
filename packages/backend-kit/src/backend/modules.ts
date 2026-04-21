import type { BackendKitNormalizedOptions, HostSurface, StringRecord } from "./options.js";
import { normalizeHostModes, readString } from "./options.js";

type RegisterableApp = unknown;

type RouteModule = {
  registerRoutes: (app: RegisterableApp) => Promise<void> | void;
};

type HostReferenceModuleInput = {
  gateway?: StringRecord;
  branding?: StringRecord;
  reference?: StringRecord;
  subjectProfiles?: StringRecord;
  enableLifecycle?: boolean;
  enableBridge?: boolean;
  allowedOrigins?: string[];
  bootstrap?: BackendKitNormalizedOptions["host"]["bootstrap"];
  session?: BackendKitNormalizedOptions["host"]["session"];
  hostProxyService?: unknown;
};

type HostReferenceModuleDeps = {
  createHostProxyService?: (input: {
    gateway?: StringRecord;
    branding?: StringRecord;
    reference?: StringRecord;
  }) => unknown;
  registerHostRoutes?: (
    app: RegisterableApp,
    options: {
      enableLifecycle: boolean;
      enableBridge: boolean;
      allowedOrigins: string[];
      bootstrap: BackendKitNormalizedOptions["host"]["bootstrap"];
      session: BackendKitNormalizedOptions["host"]["session"];
      branding: StringRecord;
      subjectProfiles: StringRecord;
      hostProxyService: unknown;
    },
  ) => Promise<void> | void;
};

type HostProxyServiceDeps = {
  createGatewayClient?: (input: { baseUrl: string; apiKey: string }) => unknown;
  createEmbedHostProxyService?: (input: {
    gatewayClient: unknown;
    gatewayUrl: string;
    hostModes?: HostSurface[];
    installationPolicy?: {
      mode?: "manual" | "auto_available";
      update_mode?: "manual" | "auto_update_compatible";
    };
    resolveInstallationPolicy?: () => Promise<
      | {
          mode?: "manual" | "auto_available";
          update_mode?: "manual" | "auto_update_compatible";
        }
      | null
      | undefined
    >;
  }) => unknown;
};

type GatewayExecutionModuleDeps = {
  registerPaymentRoutes?: (
    app: RegisterableApp,
    options: { enabledModes: string[]; paymentRuntime: unknown },
  ) => Promise<void> | void;
  registerGuardRoutes?: (
    app: RegisterableApp,
    options: { enabledModes: string[]; paymentRuntime: unknown },
  ) => Promise<void> | void;
  registerSubjectProfileRoutes?: (
    app: RegisterableApp,
    subjectProfiles: StringRecord,
  ) => Promise<void> | void;
};

type ReferenceSurfaceModuleDeps = {
  registerReferenceRoutes?: (
    app: RegisterableApp,
    options: {
      enableReference: boolean;
      enableLifecycle: boolean;
      enableBridge: boolean;
      enabledModes?: string[];
      gateway: StringRecord;
      branding: StringRecord;
      reference: StringRecord;
    },
  ) => Promise<void> | void;
};

export function createHostReferenceModule(
  {
    gateway = {},
    branding = {},
    reference = {},
    subjectProfiles = {},
    enableLifecycle = true,
    enableBridge = true,
    allowedOrigins = [],
    bootstrap = {
      apiKeys: [],
      signingSecret: "",
      signingKeyId: "",
      verifierKeys: {},
      ttlSeconds: 300,
      consumeJti: null,
      rateLimitBootstrap: null,
      auditBootstrap: null,
      deprecatedWarn: false,
    },
    session = {
      signingSecret: "",
      signingKeyId: "",
      verifierKeys: {},
      cookieName: "xapps_host_session",
      absoluteTtlSeconds: 1800,
      idleTtlSeconds: 0,
      cookiePath: "/api",
      cookieDomain: "",
      cookieSameSite: "auto",
      cookieSecure: "auto",
      store: {
        activate: null,
        touch: null,
        isRevoked: null,
        revoke: null,
      },
      resolveSameOriginSubjectId: null,
      rateLimitExchange: null,
      rateLimitLogout: null,
      auditExchange: null,
      auditLogout: null,
      auditRevocation: null,
    },
    hostProxyService = null,
  }: HostReferenceModuleInput = {},
  deps: HostReferenceModuleDeps = {},
): RouteModule {
  const createHostProxyService =
    typeof deps.createHostProxyService === "function" ? deps.createHostProxyService : null;
  const registerHostRoutes =
    typeof deps.registerHostRoutes === "function" ? deps.registerHostRoutes : null;
  if (!createHostProxyService || !registerHostRoutes) {
    throw new TypeError("host reference module dependencies are incomplete");
  }

  const resolvedHostProxyService =
    hostProxyService ||
    createHostProxyService({
      gateway,
      branding,
      reference,
    });
  const hostOptions = {
    enableLifecycle,
    enableBridge,
    allowedOrigins,
    bootstrap,
    session,
    branding,
    subjectProfiles,
    hostProxyService: resolvedHostProxyService,
  };

  return {
    async registerRoutes(app) {
      await registerHostRoutes(app, hostOptions);
    },
  };
}

export function createHostProxyService(
  { gateway = {}, reference = {} }: { gateway?: StringRecord; reference?: StringRecord } = {},
  deps: HostProxyServiceDeps = {},
): unknown {
  const createGatewayClient =
    typeof deps.createGatewayClient === "function" ? deps.createGatewayClient : null;
  const createEmbedHostProxyService =
    typeof deps.createEmbedHostProxyService === "function"
      ? deps.createEmbedHostProxyService
      : null;
  if (!createGatewayClient || !createEmbedHostProxyService) {
    throw new TypeError("backend host proxy dependencies are incomplete");
  }

  const gatewayUrl = readString(gateway.baseUrl).trim();
  const apiKey = readString(gateway.apiKey).trim();
  const hostModes = normalizeHostModes(reference.hostSurfaces);

  const gatewayClient = createGatewayClient({ baseUrl: gatewayUrl, apiKey }) as {
    getClientSelf?: () => Promise<{
      client?: {
        installation_policy?: {
          mode?: "manual" | "auto_available";
          update_mode?: "manual" | "auto_update_compatible";
        } | null;
      } | null;
    }>;
  };
  const referencePolicyResolver =
    reference &&
    typeof (reference as Record<string, unknown>).resolveInstallationPolicy === "function"
      ? ((reference as Record<string, unknown>).resolveInstallationPolicy as () => Promise<
          | {
              mode?: "manual" | "auto_available";
              update_mode?: "manual" | "auto_update_compatible";
            }
          | null
          | undefined
        >)
      : null;

  return createEmbedHostProxyService({
    gatewayClient,
    gatewayUrl,
    hostModes: hostModes.length > 0 ? hostModes : undefined,
    installationPolicy:
      reference.installationPolicy &&
      typeof reference.installationPolicy === "object" &&
      !Array.isArray(reference.installationPolicy)
        ? (reference.installationPolicy as {
            mode?: "manual" | "auto_available";
            update_mode?: "manual" | "auto_update_compatible";
          })
        : undefined,
    resolveInstallationPolicy: async () => {
      if (referencePolicyResolver) {
        return await referencePolicyResolver();
      }
      if (typeof gatewayClient?.getClientSelf !== "function") return undefined;
      const current = await gatewayClient.getClientSelf();
      return current?.client?.installation_policy ?? undefined;
    },
  });
}

export function createGatewayExecutionModule(
  {
    enabledModes = [],
    subjectProfiles = {},
    paymentRuntime = {},
  }: {
    enabledModes?: string[];
    subjectProfiles?: StringRecord;
    paymentRuntime?: unknown;
  } = {},
  deps: GatewayExecutionModuleDeps = {},
): RouteModule {
  const registerPaymentRoutes =
    typeof deps.registerPaymentRoutes === "function" ? deps.registerPaymentRoutes : null;
  const registerGuardRoutes =
    typeof deps.registerGuardRoutes === "function" ? deps.registerGuardRoutes : null;
  const registerSubjectProfileRoutes =
    typeof deps.registerSubjectProfileRoutes === "function"
      ? deps.registerSubjectProfileRoutes
      : null;
  if (!registerPaymentRoutes || !registerGuardRoutes || !registerSubjectProfileRoutes) {
    throw new TypeError("gateway execution module dependencies are incomplete");
  }

  return {
    async registerRoutes(app) {
      await registerPaymentRoutes(app, { enabledModes, paymentRuntime });
      await registerGuardRoutes(app, { enabledModes, paymentRuntime });
      await registerSubjectProfileRoutes(app, subjectProfiles);
    },
  };
}

export function createReferenceSurfaceModule(
  {
    gateway = {},
    branding = {},
    enableReference = true,
    enableLifecycle = true,
    enableBridge = true,
    enabledModes,
    reference = {},
  }: {
    gateway?: StringRecord;
    branding?: StringRecord;
    enableReference?: boolean;
    enableLifecycle?: boolean;
    enableBridge?: boolean;
    enabledModes?: string[];
    reference?: StringRecord;
  } = {},
  deps: ReferenceSurfaceModuleDeps = {},
): RouteModule {
  const registerReferenceRoutes =
    typeof deps.registerReferenceRoutes === "function" ? deps.registerReferenceRoutes : null;
  if (!registerReferenceRoutes) {
    throw new TypeError("reference surface module dependencies are incomplete");
  }

  const referenceOptions = {
    enableReference,
    enableLifecycle,
    enableBridge,
    enabledModes,
    gateway,
    branding,
    reference,
  };

  return {
    async registerRoutes(app) {
      await registerReferenceRoutes(app, referenceOptions);
    },
  };
}
