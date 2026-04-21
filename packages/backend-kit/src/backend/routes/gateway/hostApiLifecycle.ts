// @ts-nocheck
import {
  applyHostApiCorsHeaders,
  ensureHostApiBrowserUnsafeOriginAllowed,
  ensureHostApiOriginAllowed,
  readBodyRecord,
  readDeprecatedHostBootstrapHeaderWarning,
  readExecutionPlaneToken,
  readHostAuthContext,
  resolveTrustedHostSubjectId,
  requireHostProxyService,
  sendServiceError,
} from "./shared.js";

export default async function hostApiLifecycleRoutes(
  fastify,
  { hostProxyService, allowedOrigins = [], bootstrap = {}, session = {} } = {},
) {
  const service = requireHostProxyService(hostProxyService);
  fastify.get("/api/installations", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    readDeprecatedHostBootstrapHeaderWarning(request, bootstrap, "/api/installations");
    try {
      const query = readBodyRecord(request.query);
      const bootstrapContext = await readHostAuthContext(request, session);
      const subjectId = await resolveTrustedHostSubjectId(
        request,
        bootstrapContext,
        query.subjectId,
        session,
      );
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.listInstallations({
          subjectId,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "list installations failed");
    }
  });

  fastify.post("/api/install", async (request, reply) => {
    if (!ensureHostApiBrowserUnsafeOriginAllowed(request, reply, allowedOrigins)) return;
    readDeprecatedHostBootstrapHeaderWarning(request, bootstrap, "/api/install");
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = await readHostAuthContext(request, session);
      const subjectId = await resolveTrustedHostSubjectId(
        request,
        bootstrapContext,
        body.subjectId,
        session,
      );
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.installXapp({
          xappId: body.xappId,
          subjectId,
          termsAccepted: body.termsAccepted,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "install failed");
    }
  });

  fastify.post("/api/update", async (request, reply) => {
    if (!ensureHostApiBrowserUnsafeOriginAllowed(request, reply, allowedOrigins)) return;
    readDeprecatedHostBootstrapHeaderWarning(request, bootstrap, "/api/update");
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = await readHostAuthContext(request, session);
      const subjectId = await resolveTrustedHostSubjectId(
        request,
        bootstrapContext,
        body.subjectId,
        session,
      );
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.updateInstallation({
          installationId: body.installationId,
          subjectId,
          termsAccepted: body.termsAccepted,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "update failed");
    }
  });

  fastify.post("/api/uninstall", async (request, reply) => {
    if (!ensureHostApiBrowserUnsafeOriginAllowed(request, reply, allowedOrigins)) return;
    readDeprecatedHostBootstrapHeaderWarning(request, bootstrap, "/api/uninstall");
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = await readHostAuthContext(request, session);
      const subjectId = await resolveTrustedHostSubjectId(
        request,
        bootstrapContext,
        body.subjectId,
        session,
      );
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.uninstallInstallation({
          installationId: body.installationId,
          subjectId,
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
          token: readExecutionPlaneToken(request, query.token),
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
          token: readExecutionPlaneToken(request, query.token),
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

  fastify.post(
    "/api/my-xapps/:xappId/monetization/subscription-contracts/:contractId/refresh-state",
    async (request, reply) => {
      if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
      try {
        const body = readBodyRecord(request.body);
        const query = readBodyRecord(request.query);
        const { xappId, contractId } = request.params || {};
        applyHostApiCorsHeaders(reply, request, allowedOrigins);
        return reply.send(
          await service.refreshMyXappSubscriptionContractState({
            xappId,
            contractId,
            token: readExecutionPlaneToken(request, query.token, body.token),
          }),
        );
      } catch (err) {
        return sendServiceError(
          request,
          reply,
          err,
          "refresh my-xapp subscription contract state failed",
        );
      }
    },
  );

  fastify.post(
    "/api/my-xapps/:xappId/monetization/subscription-contracts/:contractId/cancel",
    async (request, reply) => {
      if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
      try {
        const body = readBodyRecord(request.body);
        const query = readBodyRecord(request.query);
        const { xappId, contractId } = request.params || {};
        applyHostApiCorsHeaders(reply, request, allowedOrigins);
        return reply.send(
          await service.cancelMyXappSubscriptionContract({
            xappId,
            contractId,
            token: readExecutionPlaneToken(request, query.token, body.token),
          }),
        );
      } catch (err) {
        return sendServiceError(request, reply, err, "cancel my-xapp subscription failed");
      }
    },
  );

  fastify.post("/api/widget-tool-request", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.runWidgetToolRequest({
          token: readExecutionPlaneToken(request, body.token),
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
            token: readExecutionPlaneToken(request, query.token, body.token),
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
            token: readExecutionPlaneToken(request, query.token, body.token),
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
            token: readExecutionPlaneToken(request, query.token, body.token),
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
