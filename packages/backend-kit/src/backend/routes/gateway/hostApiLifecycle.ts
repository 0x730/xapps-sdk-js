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
}
