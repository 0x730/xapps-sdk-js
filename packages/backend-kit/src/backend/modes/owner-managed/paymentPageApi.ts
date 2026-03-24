// @ts-nocheck
import { registerPaymentPageApiRoutes } from "../../../index.js";

export default async function paymentPageApiRoutes(fastify, { paymentRuntime = {} } = {}) {
  await registerPaymentPageApiRoutes(fastify, {
    gatewayClient: paymentRuntime.gatewayClient || null,
    pathPrefix: "/api/tenant-payment",
  });
}
