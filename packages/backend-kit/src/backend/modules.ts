// @ts-nocheck
import { normalizeHostModes, readString } from "./options.js";

export function createHostReferenceModule(
  {
    gateway = {},
    branding = {},
    reference = {},
    enableLifecycle = true,
    enableBridge = true,
    allowedOrigins = [],
    bootstrap = {},
    hostProxyService = null,
  } = {},
  deps = {},
) {
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
    branding,
    hostProxyService: resolvedHostProxyService,
  };

  return {
    async registerRoutes(app) {
      await registerHostRoutes(app, hostOptions);
    },
  };
}

export function createHostProxyService({ gateway = {}, reference = {} } = {}, deps = {}) {
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

  return createEmbedHostProxyService({
    gatewayClient: createGatewayClient({ baseUrl: gatewayUrl, apiKey }),
    gatewayUrl,
    hostModes: hostModes.length > 0 ? hostModes : undefined,
  });
}

export function createGatewayExecutionModule(
  { enabledModes, subjectProfiles = {}, paymentRuntime = {} } = {},
  deps = {},
) {
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
  } = {},
  deps = {},
) {
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
