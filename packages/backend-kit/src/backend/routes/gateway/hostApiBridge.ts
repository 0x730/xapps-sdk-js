// @ts-nocheck
import {
  normalizeBridgeRefreshInput,
  normalizeBridgeVendorAssertionInput,
} from "./hostContractBoundary.js";
import {
  applyHostApiCorsHeaders,
  ensureHostApiOriginAllowed,
  readBodyRecord,
  readHostAuthContext,
  requireHostProxyService,
  sendServiceError,
} from "./shared.js";

export default async function hostApiBridgeRoutes(
  fastify,
  { hostProxyService, allowedOrigins = [], session = {} } = {},
) {
  const service = requireHostProxyService(hostProxyService);
  fastify.post("/api/bridge/token-refresh", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = await readHostAuthContext(request, session);
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
      const authContext = await readHostAuthContext(request, session);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      const data = {
        ...body,
        ...(authContext?.subjectId
          ? {
              subjectId: authContext.subjectId,
              subject_id: authContext.subjectId,
            }
          : {}),
      };
      const envelope =
        body.envelope && typeof body.envelope === "object" && !Array.isArray(body.envelope)
          ? body.envelope
          : null;
      return reply.send(
        await service.bridgeSign({
          // If a host session subject is present, force server-side signing semantics.
          // This prevents callers from injecting a precomputed envelope with mismatched subject claims.
          envelope: authContext?.subjectId ? null : envelope,
          data,
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
      const authContext = await readHostAuthContext(request, session);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      const input = normalizeBridgeVendorAssertionInput(body);
      if (authContext?.subjectId) {
        input.subjectId = authContext.subjectId;
        if (input.data && typeof input.data === "object" && !Array.isArray(input.data)) {
          input.data = {
            ...input.data,
            subjectId: authContext.subjectId,
            subject_id: authContext.subjectId,
          };
        }
      }
      return reply.send(await service.bridgeVendorAssertion(input));
    } catch (err) {
      return sendServiceError(request, reply, err, "bridge vendor-assertion failed");
    }
  });
}
