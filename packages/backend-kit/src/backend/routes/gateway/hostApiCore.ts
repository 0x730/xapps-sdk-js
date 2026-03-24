// @ts-nocheck
import { normalizeWidgetSessionInput } from "./hostContractBoundary.js";
import {
  applyHostApiCorsHeaders,
  buildHostBootstrapResult,
  ensureHostApiOriginAllowed,
  readBodyRecord,
  readHostBootstrapContext,
  requireHostBootstrapRequest,
  requireHostProxyService,
  sendServiceError,
} from "./shared.js";

export default async function hostApiCoreRoutes(
  fastify,
  { hostProxyService, allowedOrigins = [], bootstrap = {} } = {},
) {
  const service = requireHostProxyService(hostProxyService);
  fastify.get("/api/host-config", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    return reply.send({
      ...service.getHostConfig(),
    });
  });

  fastify.post("/api/host-bootstrap", async (request, reply) => {
    try {
      const body = readBodyRecord(request.body);
      const { signingSecret, ttlSeconds } = requireHostBootstrapRequest(request, bootstrap);
      const resolved = await service.resolveSubject({
        email: body.email,
        name: body.name,
      });
      return reply.send(
        buildHostBootstrapResult({
          subjectId: resolved.subjectId,
          email: body.email,
          name: body.name,
          origin: body.origin,
          signingSecret,
          ttlSeconds,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "host bootstrap failed");
    }
  });

  fastify.post("/api/resolve-subject", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.send(
        await service.resolveSubject({
          email: body.email,
          name: body.name,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "resolve-subject failed");
    }
  });

  fastify.post("/api/create-catalog-session", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = readHostBootstrapContext(request, bootstrap);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.code(201).send(
        await service.createCatalogSession({
          origin: body.origin,
          subjectId: bootstrapContext?.subjectId || body.subjectId,
          xappId: body.xappId,
          publishers: body.publishers,
          tags: body.tags,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "create-catalog-session failed");
    }
  });

  fastify.post("/api/create-widget-session", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = readHostBootstrapContext(request, bootstrap);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      const input = normalizeWidgetSessionInput(body, request);
      if (bootstrapContext?.subjectId) {
        input.subjectId = bootstrapContext.subjectId;
      }
      return reply.send(await service.createWidgetSession(input));
    } catch (err) {
      return sendServiceError(request, reply, err, "create-widget-session failed");
    }
  });
}
