// @ts-nocheck
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
import { normalizeBackendKitOptions, resolvePlatformSecretRefFromEnv } from "./backend/options.js";

export async function createBackendKit(input = {}, deps = {}) {
  const normalizeOptions =
    typeof deps.normalizeOptions === "function" ? deps.normalizeOptions : null;
  const createReferenceSurfaceModule =
    typeof deps.createReferenceSurfaceModule === "function"
      ? deps.createReferenceSurfaceModule
      : null;
  const createHostReferenceModule =
    typeof deps.createHostReferenceModule === "function" ? deps.createHostReferenceModule : null;
  const createGatewayExecutionModule =
    typeof deps.createGatewayExecutionModule === "function"
      ? deps.createGatewayExecutionModule
      : null;
  if (
    !normalizeOptions ||
    !createReferenceSurfaceModule ||
    !createHostReferenceModule ||
    !createGatewayExecutionModule
  ) {
    throw new TypeError("backend kit dependencies are incomplete");
  }

  const options = normalizeOptions(input);
  const paymentRuntime = await createPaymentRuntime(options, deps);

  const referenceSurfaceModule = createReferenceSurfaceModule({
    gateway: options.gateway,
    branding: options.branding,
    enableReference: options.host.enableReference,
    enableLifecycle: options.host.enableLifecycle,
    enableBridge: options.host.enableBridge,
    enabledModes: options.payments.enabledModes,
    reference: options.reference,
  });
  const hostReferenceModule = createHostReferenceModule({
    gateway: options.gateway,
    branding: options.branding,
    reference: options.reference,
    enableLifecycle: options.host.enableLifecycle,
    enableBridge: options.host.enableBridge,
    allowedOrigins: options.host.allowedOrigins,
    bootstrap: options.host.bootstrap,
    hostProxyService: options.overrides.hostProxyService,
  });
  const gatewayExecutionModule = createGatewayExecutionModule({
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
  createPaymentEvidenceHandler,
  createPaymentRuntime,
  extractHostedPaymentSessionId,
  normalizeBackendKitOptions,
  registerPaymentPageApiRoutes,
  registerPaymentPageAssetRoute,
  resolvePlatformSecretRefFromEnv,
};
