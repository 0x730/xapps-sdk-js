import {
  createGatewayExecutionModule,
  createHostReferenceModule,
  createReferenceSurfaceModule,
  createHostProxyService,
} from "./backend/modules.js";
import {
  buildHostedGatewayPaymentUrl,
  buildModeHostedGatewayPaymentUrl,
  createPaymentEvidenceHandler,
  createPaymentRuntime,
  extractHostedPaymentSessionId,
  registerPaymentPageApiRoutes,
  registerPaymentPageAssetRoute,
} from "./backend/paymentRuntime.js";
import {
  activateXappPurchaseReference,
  consumeXappWalletCredits,
  finalizeXappHostedPurchase,
  findXappHostedPaymentPreset,
  listXappHostedPaymentPresets,
  normalizeXappMonetizationScopeKind,
  readXappMonetizationSnapshot,
  resolveXappHostedPaymentDefinition,
  resolveXappMonetizationScope,
  startXappHostedPurchase,
  type ActivateXappPurchaseReferenceInput,
  type ConsumeXappWalletCreditsInput,
  type FinalizeXappHostedPurchaseInput,
  type ListXappHostedPaymentPresetsInput,
  type ReadXappMonetizationSnapshotInput,
  type ResolveXappHostedPaymentDefinitionInput,
  type ResolveXappMonetizationScopeInput,
  type StartXappHostedPurchaseInput,
} from "./backend/xms.js";
import {
  normalizeBackendKitOptions,
  resolvePlatformSecretRefFromEnv,
  type BackendKitNormalizedOptions,
  type StringRecord,
} from "./backend/options.js";

type ReplyLike = {
  code: (statusCode: number) => {
    send: (payload: unknown) => unknown;
  };
};

type RegisterableApp = {
  setNotFoundHandler: (
    handler: (request: unknown, reply: ReplyLike) => Promise<unknown> | unknown,
  ) => void;
};

type RouteModule = {
  registerRoutes: (app: RegisterableApp) => Promise<void> | void;
};

type BackendKitDeps = {
  normalizeOptions?: (input: StringRecord) => BackendKitNormalizedOptions;
  createReferenceSurfaceModule?: (input: {
    gateway: BackendKitNormalizedOptions["gateway"];
    branding: BackendKitNormalizedOptions["branding"];
    enableReference: boolean;
    enableLifecycle: boolean;
    enableBridge: boolean;
    enabledModes: string[];
    reference: BackendKitNormalizedOptions["reference"];
  }) => RouteModule;
  createHostReferenceModule?: (input: {
    gateway: BackendKitNormalizedOptions["gateway"];
    branding: BackendKitNormalizedOptions["branding"];
    reference: BackendKitNormalizedOptions["reference"];
    enableLifecycle: boolean;
    enableBridge: boolean;
    allowedOrigins: string[];
    bootstrap: BackendKitNormalizedOptions["host"]["bootstrap"];
    hostProxyService: unknown;
  }) => RouteModule;
  createGatewayExecutionModule?: (input: {
    enabledModes: string[];
    subjectProfiles: BackendKitNormalizedOptions["subjectProfiles"];
    paymentRuntime: unknown;
  }) => RouteModule;
};

export type BackendKit = {
  options: BackendKitNormalizedOptions;
  registerRoutes: (app: RegisterableApp) => Promise<void>;
  applyNotFoundHandler: (app: RegisterableApp) => void;
};

export type {
  ActivateXappPurchaseReferenceInput,
  ConsumeXappWalletCreditsInput,
  FinalizeXappHostedPurchaseInput,
  ListXappHostedPaymentPresetsInput,
  ReadXappMonetizationSnapshotInput,
  ResolveXappHostedPaymentDefinitionInput,
  ResolveXappMonetizationScopeInput,
  StartXappHostedPurchaseInput,
};

export type VerifyBrowserWidgetContextInput = {
  hostOrigin: string;
  bootstrapTicket?: string | null;
  installationId?: string | null;
  bindToolName?: string | null;
  toolName?: string | null;
  subjectId?: string | null;
};

export type WidgetBootstrapOriginPolicyInput = {
  hostOrigin: string | null | undefined;
  allowedOrigins?: string[] | string | null | undefined;
};

export type WidgetBootstrapOriginPolicyResult =
  | {
      ok: true;
      hostOrigin: string;
      allowedOrigins: string[];
    }
  | {
      ok: false;
      code: "HOST_ORIGIN_REQUIRED" | "HOST_ORIGIN_NOT_ALLOWED";
      message: string;
      hostOrigin: string | null;
      allowedOrigins: string[];
    };

function normalizeOrigin(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!parsed.protocol || !parsed.host) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function normalizeWidgetBootstrapAllowedOrigins(
  value: string[] | string | null | undefined,
): string[] {
  const entries = Array.isArray(value) ? value : String(value || "").split(/[,\n]/);
  const normalized = entries
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry));
  return Array.from(new Set(normalized));
}

export function evaluateWidgetBootstrapOriginPolicy(
  input: WidgetBootstrapOriginPolicyInput,
): WidgetBootstrapOriginPolicyResult {
  const hostOrigin = normalizeOrigin(input.hostOrigin);
  const allowedOrigins = normalizeWidgetBootstrapAllowedOrigins(input.allowedOrigins);
  if (!hostOrigin) {
    return {
      ok: false,
      code: "HOST_ORIGIN_REQUIRED",
      message: "Host origin is required to verify browser widget context",
      hostOrigin: null,
      allowedOrigins,
    };
  }
  if (allowedOrigins.length > 0 && !allowedOrigins.includes(hostOrigin)) {
    return {
      ok: false,
      code: "HOST_ORIGIN_NOT_ALLOWED",
      message: "Host origin is not allowed for widget bootstrap verification",
      hostOrigin,
      allowedOrigins,
    };
  }
  return {
    ok: true,
    hostOrigin,
    allowedOrigins,
  };
}

export async function verifyBrowserWidgetContext(
  gatewayClient: {
    verifyBrowserWidgetContext: (
      input: VerifyBrowserWidgetContextInput,
    ) => Promise<Record<string, unknown>>;
  },
  input: VerifyBrowserWidgetContextInput,
) {
  return gatewayClient.verifyBrowserWidgetContext(input);
}

export async function createBackendKit(
  input: StringRecord = {},
  deps: BackendKitDeps = {},
): Promise<BackendKit> {
  const normalizeOptions =
    typeof deps.normalizeOptions === "function" ? deps.normalizeOptions : null;
  const createReferenceSurfaceModuleDep =
    typeof deps.createReferenceSurfaceModule === "function"
      ? deps.createReferenceSurfaceModule
      : null;
  const createHostReferenceModuleDep =
    typeof deps.createHostReferenceModule === "function" ? deps.createHostReferenceModule : null;
  const createGatewayExecutionModuleDep =
    typeof deps.createGatewayExecutionModule === "function"
      ? deps.createGatewayExecutionModule
      : null;
  if (
    !normalizeOptions ||
    !createReferenceSurfaceModuleDep ||
    !createHostReferenceModuleDep ||
    !createGatewayExecutionModuleDep
  ) {
    throw new TypeError("backend kit dependencies are incomplete");
  }

  const options = normalizeOptions(input);
  const paymentRuntime = await createPaymentRuntime(options, deps);

  const referenceSurfaceModule = createReferenceSurfaceModuleDep({
    gateway: options.gateway,
    branding: options.branding,
    enableReference: options.host.enableReference,
    enableLifecycle: options.host.enableLifecycle,
    enableBridge: options.host.enableBridge,
    enabledModes: options.payments.enabledModes,
    reference: options.reference,
  });
  const hostReferenceModule = createHostReferenceModuleDep({
    gateway: options.gateway,
    branding: options.branding,
    reference: options.reference,
    enableLifecycle: options.host.enableLifecycle,
    enableBridge: options.host.enableBridge,
    allowedOrigins: options.host.allowedOrigins,
    bootstrap: options.host.bootstrap,
    hostProxyService: options.overrides.hostProxyService,
  });
  const gatewayExecutionModule = createGatewayExecutionModuleDep({
    enabledModes: options.payments.enabledModes,
    subjectProfiles: options.subjectProfiles,
    paymentRuntime,
  });

  return {
    options,
    async registerRoutes(app) {
      await referenceSurfaceModule.registerRoutes(app);
      await hostReferenceModule.registerRoutes(app);
      await gatewayExecutionModule.registerRoutes(app);
    },
    applyNotFoundHandler(app) {
      app.setNotFoundHandler(async (_request, reply) =>
        reply.code(404).send({ message: "Not found" }),
      );
    },
  };
}

export {
  buildHostedGatewayPaymentUrl as buildHostedGatewayPaymentUrl,
  buildModeHostedGatewayPaymentUrl as buildModeHostedGatewayPaymentUrl,
  createGatewayExecutionModule,
  createHostReferenceModule,
  createReferenceSurfaceModule,
  createHostProxyService,
  activateXappPurchaseReference,
  consumeXappWalletCredits,
  createPaymentEvidenceHandler,
  createPaymentRuntime,
  extractHostedPaymentSessionId,
  finalizeXappHostedPurchase,
  findXappHostedPaymentPreset,
  listXappHostedPaymentPresets,
  normalizeXappMonetizationScopeKind,
  normalizeBackendKitOptions,
  readXappMonetizationSnapshot,
  registerPaymentPageApiRoutes,
  registerPaymentPageAssetRoute,
  resolveXappHostedPaymentDefinition,
  resolveXappMonetizationScope,
  resolvePlatformSecretRefFromEnv,
  startXappHostedPurchase,
};
