// @ts-nocheck
import { normalizeWidgetSessionInput } from "./hostContractBoundary.js";
import {
  activateHostSession,
  appendSetCookieHeader,
  applyHostApiCorsHeaders,
  buildHostBootstrapResult,
  buildClearedHostSessionCookieHeader,
  buildHostSessionExchangeResult,
  consumeHostBootstrapReplay,
  ensureHostApiOriginAllowed,
  requireRequestedHostBootstrapOrigin,
  readBodyRecord,
  readHostAuthContext,
  readHostBootstrapContext,
  readHostSessionContext,
  resolveTrustedHostSubjectId,
  revokeHostSession,
  requireHostBootstrapRequest,
  requireHostProxyService,
  resolveHostApiAllowedOrigins,
  sendServiceError,
} from "./shared.js";

function readString(...values) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

async function auditHostSessionExchange(session, input) {
  const auditExchange = typeof session?.auditExchange === "function" ? session.auditExchange : null;
  if (!auditExchange) return;
  await auditExchange(input);
}

export default async function hostApiCoreRoutes(
  fastify,
  {
    hostProxyService,
    allowedOrigins = [],
    bootstrap = {},
    session = {},
    subjectProfiles = {},
  } = {},
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
      const { signingSecret, signingKeyId, ttlSeconds } = requireHostBootstrapRequest(
        request,
        bootstrap,
      );
      const origin = requireRequestedHostBootstrapOrigin(
        body.origin,
        resolveHostApiAllowedOrigins(request, allowedOrigins),
      );
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
          origin,
          signingSecret,
          signingKeyId,
          ttlSeconds,
        }),
      );
    } catch (err) {
      return sendServiceError(request, reply, err, "host bootstrap failed");
    }
  });

  fastify.post("/api/host-session/exchange", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const bootstrapContext = readHostBootstrapContext(request, bootstrap);
      if (!bootstrapContext?.subjectId) {
        throw new Error("Missing host bootstrap token");
      }
      const rateLimitExchange =
        typeof session?.rateLimitExchange === "function" ? session.rateLimitExchange : null;
      if (rateLimitExchange) {
        const allowed = await rateLimitExchange({
          request,
          subjectId: bootstrapContext.subjectId,
          origin: bootstrapContext.origin,
          jti: bootstrapContext.jti,
          iat: bootstrapContext.iat,
          exp: bootstrapContext.exp,
          token: bootstrapContext.token,
          type: "host_bootstrap",
        });
        const accepted =
          allowed === true ||
          (allowed &&
            typeof allowed === "object" &&
            !Array.isArray(allowed) &&
            allowed.allowed !== false);
        if (!accepted) {
          throw new Error("Host session exchange rate limit exceeded");
        }
      }
      await consumeHostBootstrapReplay(bootstrapContext, bootstrap);
      const signingSecret = readString(session?.signingSecret);
      const signingKeyId = readString(session?.signingKeyId);
      if (!signingSecret) {
        throw new Error("Host session exchange is not configured");
      }
      const result = buildHostSessionExchangeResult({
        subjectId: bootstrapContext.subjectId,
        email: bootstrapContext.email,
        name: bootstrapContext.name,
        signingSecret,
        signingKeyId,
        request,
        ttlSeconds:
          Number(session?.absoluteTtlSeconds) > 0
            ? Math.floor(Number(session.absoluteTtlSeconds))
            : undefined,
        session,
      });
      await activateHostSession(result.sessionContext, session);
      await auditHostSessionExchange(session, {
        request,
        ok: true,
        subjectId: bootstrapContext.subjectId,
        origin: bootstrapContext.origin,
        jti: bootstrapContext.jti,
        iat: bootstrapContext.iat,
        exp: bootstrapContext.exp,
        token: bootstrapContext.token,
        type: "host_bootstrap",
        sessionJti: result.sessionContext?.jti || null,
        sessionExp: result.sessionContext?.exp ?? null,
      });
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      appendSetCookieHeader(reply, result.setCookie);
      return reply.send(result.payload);
    } catch (err) {
      try {
        const context = readHostBootstrapContext(request, bootstrap);
        if (context) {
          await auditHostSessionExchange(session, {
            request,
            ok: false,
            subjectId: context.subjectId,
            origin: context.origin,
            jti: context.jti,
            iat: context.iat,
            exp: context.exp,
            token: context.token,
            type: "host_bootstrap",
            reason: String(err?.message || "host session exchange failed"),
          });
        }
      } catch {
        // Ignore audit context extraction failures and preserve the original error.
      }
      return sendServiceError(request, reply, err, "host session exchange failed");
    }
  });

  fastify.post("/api/host-session/logout", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const sessionContext = await readHostSessionContext(request, session);
      if (sessionContext) {
        await revokeHostSession(sessionContext, session);
      }
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      appendSetCookieHeader(reply, buildClearedHostSessionCookieHeader(request, session));
      return reply.send({ ok: true, status: "revoked", sessionMode: "host_session" });
    } catch (err) {
      return sendServiceError(request, reply, err, "host session logout failed");
    }
  });

  fastify.post("/api/resolve-subject", async (request, reply) => {
    if (!ensureHostApiOriginAllowed(request, reply, allowedOrigins)) return;
    try {
      const body = readBodyRecord(request.body);
      await readHostAuthContext(request, session);
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
      const bootstrapContext = await readHostAuthContext(request, session);
      const subjectId = await resolveTrustedHostSubjectId(
        request,
        bootstrapContext,
        body.subjectId,
        session,
      );
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      return reply.code(201).send(
        await service.createCatalogSession({
          origin: body.origin,
          subjectId,
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
      const bootstrapContext = await readHostAuthContext(request, session);
      const requestedSubjectId = readString(body.subjectId);
      const subjectId =
        bootstrapContext?.subjectId || requestedSubjectId
          ? await resolveTrustedHostSubjectId(
              request,
              bootstrapContext,
              requestedSubjectId,
              session,
            )
          : "";
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
      const bootstrapContext = await readHostAuthContext(request, session);
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      const input = normalizeWidgetSessionInput(body, request);
      input.subjectId = await resolveTrustedHostSubjectId(
        request,
        bootstrapContext,
        input.subjectId,
        session,
      );
      return reply.send(await service.createWidgetSession(input));
    } catch (err) {
      return sendServiceError(request, reply, err, "create-widget-session failed");
    }
  });
}
