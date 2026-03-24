// @ts-nocheck
import { getBackendModeHandlers } from "../../modes/index.js";

export default async function paymentRoutes(fastify, { enabledModes, paymentRuntime = {} } = {}) {
  for (const backendModeHandler of Object.values(getBackendModeHandlers(enabledModes))) {
    await backendModeHandler.registerRoutes(fastify, { paymentRuntime });
  }
}
