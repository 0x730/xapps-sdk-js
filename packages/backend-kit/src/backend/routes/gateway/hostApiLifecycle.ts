// @ts-nocheck
import {
  applyHostApiCorsHeaders,
  ensureHostApiOriginAllowed,
  readBodyRecord,
  readHostBootstrapContext,
  requireHostProxyService,
  sendServiceError,
} from "./shared.js";

export default async function hostApiLifecycleRoutes(
  fastify,
  { hostProxyService, allowedOrigins = [], bootstrap = {} } = {},
) {
  const service = requireHostProxyService(hostProxyService);
  fastify.get("/api/installations", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const query = readBodyRecord(request.query);
      const bootstrapContext = readHostBootstrapContext(request, bootstrap);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.listInstallations({
          subjectId: bootstrapContext?.subjectId || query.subjectId,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "list installations failed");
    }
  });

  fastify.post("/api/install", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = readHostBootstrapContext(request, bootstrap);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.installXapp({
          xappId: body.xappId,
          subjectId: bootstrapContext?.subjectId || body.subjectId,
          termsAccepted: body.termsAccepted,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "install failed");
    }
  });

  fastify.post("/api/update", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = readHostBootstrapContext(request, bootstrap);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.updateInstallation({
          installationId: body.installationId,
          subjectId: bootstrapContext?.subjectId || body.subjectId,
          termsAccepted: body.termsAccepted,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "update failed");
    }
  });

  fastify.post("/api/uninstall", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = readHostBootstrapContext(request, bootstrap);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.uninstallInstallation({
          installationId: body.installationId,
          subjectId: bootstrapContext?.subjectId || body.subjectId,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "uninstall failed");
    }
  });

  fastify.get("/api/my-xapps/:xappId/monetization", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const query = readBodyRecord(request.query);
      const { xappId } = request.params || {};
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.getMyXappMonetization({
          xappId,
          token: query.token,
          installationId: query.installationId,
          locale: query.locale,
          country: query.country,
          realmRef: query.realmRef ?? query.realm_ref,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "get my-xapp monetization failed");
    }
  });

  fastify.get("/api/my-xapps/:xappId/monetization/history", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const query = readBodyRecord(request.query);
      const { xappId } = request.params || {};
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.getMyXappMonetizationHistory({
          xappId,
          token: query.token,
          limit:
            typeof query.limit === "number"
              ? query.limit
              : typeof query.limit === "string"
                ? Number(query.limit)
                : undefined,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "get my-xapp monetization history failed");
    }
  });

  fastify.post("/api/widget-tool-request", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.runWidgetToolRequest({
          token: body.token,
          installationId: body.installationId ?? body.installation_id,
          toolName: body.toolName ?? body.tool_name,
          payload:
            body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
              ? body.payload
              : {},
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "run widget tool request failed");
    }
  });

  fastify.post(
    "/api/my-xapps/:xappId/monetization/purchase-intents/prepare",
    async (request, reply) => {
      if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
      try {
        const body = readBodyRecord(request.body);
        const query = readBodyRecord(request.query);
        const { xappId } = request.params || {};
        applyHostApiCorsHeaders(reply, request, allowedOrigins);
        return reply.send(
          await service.prepareMyXappPurchaseIntent({
            xappId,
            token: query.token ?? body.token,
            offeringId: body.offeringId ?? body.offering_id,
            packageId: body.packageId ?? body.package_id,
            priceId: body.priceId ?? body.price_id,
            installationId: body.installationId ?? body.installation_id,
            locale: body.locale,
            country: body.country,
          }),
        );
      } catch (err) {
        return sendServiceError(request, reply, err, "prepare my-xapp purchase intent failed");
      }
    },
  );

  fastify.post(
    "/api/my-xapps/:xappId/monetization/purchase-intents/:intentId/payment-session",
    async (request, reply) => {
      if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
      try {
        const body = readBodyRecord(request.body);
        const query = readBodyRecord(request.query);
        const { xappId, intentId } = request.params || {};
        applyHostApiCorsHeaders(reply, request, allowedOrigins);
        return reply.send(
          await service.createMyXappPurchasePaymentSession({
            xappId,
            intentId,
            token: query.token ?? body.token,
            returnUrl: body.returnUrl ?? body.return_url,
            cancelUrl: body.cancelUrl ?? body.cancel_url,
            xappsResume: body.xappsResume ?? body.xapps_resume,
            locale: body.locale,
            installationId: body.installationId ?? body.installation_id,
            paymentGuardRef: body.paymentGuardRef ?? body.payment_guard_ref,
            issuer: body.issuer,
            scheme: body.scheme,
            paymentScheme: body.paymentScheme ?? body.payment_scheme,
            metadata: body.metadata,
          }),
        );
      } catch (err) {
        return sendServiceError(
          request,
          reply,
          err,
          "create my-xapp purchase payment-session failed",
        );
      }
    },
  );

  fastify.post(
    "/api/my-xapps/:xappId/monetization/purchase-intents/:intentId/payment-session/finalize",
    async (request, reply) => {
      if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
      try {
        const body = readBodyRecord(request.body);
        const query = readBodyRecord(request.query);
        const { xappId, intentId } = request.params || {};
        applyHostApiCorsHeaders(reply, request, allowedOrigins);
        return reply.send(
          await service.finalizeMyXappPurchasePaymentSession({
            xappId,
            intentId,
            token: query.token ?? body.token,
          }),
        );
      } catch (err) {
        return sendServiceError(
          request,
          reply,
          err,
          "finalize my-xapp purchase payment-session failed",
        );
      }
    },
  );
}
