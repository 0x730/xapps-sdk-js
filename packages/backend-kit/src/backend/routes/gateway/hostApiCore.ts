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

function readString(...values) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export default async function hostApiCoreRoutes(
  fastify,
  { hostProxyService, allowedOrigins = [], bootstrap = {}, subjectProfiles = {} } = {},
) {
  const service = requireHostProxyService(hostProxyService);
  const resolveCatalogCustomerProfile =
    typeof subjectProfiles?.resolveCatalogCustomerProfile === "function"
      ? subjectProfiles.resolveCatalogCustomerProfile
      : null;
  fastify.get("/api/host-config", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    const config =
      typeof service.getHostConfigForRequest === "function"
        ? await service.getHostConfigForRequest({ request })
        : service.getHostConfig();
    return reply.send({
      ...config,
    });
  });

  fastify.post("/api/host-bootstrap", async (request, reply) => {
    try {
      const body = readBodyRecord(request.body);
      const { signingSecret, ttlSeconds } = requireHostBootstrapRequest(request, bootstrap);
      const resolved = await service.resolveSubject({
        subjectId: body.subjectId,
        type: body.type,
        identifier: body.identifier,
        email: body.email,
        name: body.name,
        metadata: body.metadata,
        linkId: body.linkId ?? body.link_id,
      });
      return reply.send(
        buildHostBootstrapResult({
          subjectId: resolved.subjectId,
          email: resolved.email ?? body.email,
          name: resolved.name ?? body.name,
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
          subjectId: body.subjectId,
          type: body.type,
          identifier: body.identifier,
          email: body.email,
          name: body.name,
          metadata: body.metadata,
          linkId: body.linkId ?? body.link_id,
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
          customerProfile:
            body.customerProfile && typeof body.customerProfile === "object"
              ? body.customerProfile
              : undefined,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "create-catalog-session failed");
    }
  });

  fastify.post("/api/catalog-customer-profile", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      const bootstrapContext = readHostBootstrapContext(request, bootstrap);
      const subjectId = readString(bootstrapContext?.subjectId, body.subjectId);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      if (!subjectId || !resolveCatalogCustomerProfile) {
        return reply.send({ ok: true, customerProfile: null });
      }
      const resolved = await resolveCatalogCustomerProfile({
        subjectId,
        xappId: readString(body.xappId),
        profileFamily: readString(body.profile_family, body.profileFamily) || null,
        xappSlug: readString(body.xapp_slug, body.xappSlug) || null,
        toolName: readString(body.tool_name, body.toolName) || null,
      });
      const data =
        resolved && typeof resolved === "object" && !Array.isArray(resolved) ? resolved : null;

      return reply.send({
        ok: true,
        customerProfile: data || null,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, "catalog-customer-profile failed");
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
