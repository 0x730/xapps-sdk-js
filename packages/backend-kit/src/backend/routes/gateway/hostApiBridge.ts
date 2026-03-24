// @ts-nocheck
import {
  normalizeBridgeRefreshInput,
  normalizeBridgeVendorAssertionInput,
} from "./hostContractBoundary.js";
import {
  applyHostApiCorsHeaders,
  ensureHostApiOriginAllowed,
  readBodyRecord,
  readHostBootstrapContext,
  requireHostProxyService,
  sendServiceError,
} from "./shared.js";

export default async function hostApiBridgeRoutes(
  fastify,
  { hostProxyService, allowedOrigins = [], bootstrap = {} } = {},
) {
  const service = requireHostProxyService(hostProxyService);
  fastify.post("/api/bridge/token-refresh", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = readHostBootstrapContext(request, bootstrap);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      const input = normalizeBridgeRefreshInput(body, request);
      if (bootstrapContext?.subjectId) {
        input.subjectId = bootstrapContext.subjectId;
      }
      return reply.send(await service.refreshWidgetToken(input));
    } catch (err) {
      return sendServiceError(request, reply, err, "bridge token-refresh failed");
    }
  });

  fastify.post("/api/bridge/sign", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.bridgeSign({
          envelope:
            body.envelope && typeof body.envelope === "object" && !Array.isArray(body.envelope)
              ? body.envelope
              : null,
          data: body,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "bridge sign failed");
    }
  });

  fastify.post("/api/bridge/vendor-assertion", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.bridgeVendorAssertion(normalizeBridgeVendorAssertionInput(body)),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "bridge vendor-assertion failed");
    }
  });
}
