// @ts-nocheck
import hostApiBridgeRoutes from "./hostApiBridge.js";
import hostApiCoreRoutes from "./hostApiCore.js";
import hostApiLifecycleRoutes from "./hostApiLifecycle.js";
import { sendHostApiPreflight } from "./shared.js";

export default async function hostGatewayApiRoutes(
  fastify,
  {
    enableLifecycle = true,
    enableBridge = true,
    hostProxyService = null,
    allowedOrigins = [],
    bootstrap = {},
  } = {},
) {
  const preflightPaths = [
    "/api/host-config",
    "/api/resolve-subject",
    "/api/create-catalog-session",
    "/api/create-widget-session",
  ];
  if (enableLifecycle) {
    preflightPaths.push(
      "/api/installations",
      "/api/install",
      "/api/update",
      "/api/uninstall",
      "/api/widget-tool-request",
      "/api/my-xapps/:xappId/monetization",
      "/api/my-xapps/:xappId/monetization/history",
      "/api/my-xapps/:xappId/monetization/purchase-intents/prepare",
      "/api/my-xapps/:xappId/monetization/purchase-intents/:intentId/payment-session",
      "/api/my-xapps/:xappId/monetization/purchase-intents/:intentId/payment-session/finalize",
    );
  }
  if (enableBridge) {
    preflightPaths.push(
      "/api/bridge/token-refresh",
      "/api/bridge/sign",
      "/api/bridge/vendor-assertion",
    );
  }

  for (const path of preflightPaths) {
    fastify.options(path, async (request, reply) =>
      sendHostApiPreflight(request, reply, allowedOrigins),
    );
  }

  await fastify.register(hostApiCoreRoutes, { hostProxyService, allowedOrigins, bootstrap });

  if (enableLifecycle) {
    await fastify.register(hostApiLifecycleRoutes, { hostProxyService, allowedOrigins, bootstrap });
  }

  if (enableBridge) {
    await fastify.register(hostApiBridgeRoutes, { hostProxyService, allowedOrigins, bootstrap });
  }
}
