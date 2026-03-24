// @ts-nocheck
import { registerPaymentPageAssetRoute } from "../../../index.js";

export default async function paymentAssetRoutes(fastify, { paymentRuntime = {} } = {}) {
  await registerPaymentPageAssetRoute(fastify, {
    pagePath: "/tenant-payment.html",
    pageFile: paymentRuntime.paymentPageFile,
  });
}
