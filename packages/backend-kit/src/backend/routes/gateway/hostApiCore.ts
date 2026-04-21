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
  ensureHostApiBrowserUnsafeOriginAllowed,
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

function isAcceptedRateLimitResult(allowed) {
  return (
    allowed === true ||
    (allowed && typeof allowed === "object" && !Array.isArray(allowed) && allowed.allowed !== false)
  );
}

async function runHookSafely(request, hook, input, label) {
  if (typeof hook !== "function") return;
  try {
    await hook(input);
  } catch (error) {
    if (typeof request?.log?.warn === "function") {
      request.log.warn({ err: error }, label);
    } else {
      console.warn(label, error);
    }
  }
}

async function auditHostBootstrap(bootstrap, request, input) {
  await runHookSafely(
    request,
    bootstrap?.auditBootstrap,
    input,
    "host-bootstrap audit hook failed",
  );
}

async function auditHostSessionExchange(session, input) {
  await runHookSafely(
    input?.request,
    session?.auditExchange,
    input,
    "host-session exchange audit hook failed",
  );
}

async function auditHostSessionLogout(session, request, input) {
  await runHookSafely(
    request,
    session?.auditLogout,
    input,
    "host-session logout audit hook failed",
  );
}

async function auditHostSessionRevocation(session, request, input) {
  await runHookSafely(
    request,
    session?.auditRevocation,
    input,
    "host-session revocation audit hook failed",
  );
}

async function warnDeprecatedBootstrapHeaderUsage(bootstrap, request, route) {
  const bootstrapToken = readString(request?.headers?.["x-xapps-host-bootstrap"]);
  if (!bootstrapToken) return;
  const message =
    "host bootstrap header is deprecated outside /api/host-session/exchange and will be removed";
  const warnHook = bootstrap?.deprecatedWarn;
  if (typeof warnHook === "function") {
    await runHookSafely(
      request,
      warnHook,
      {
        request,
        route,
        headerName: "x-xapps-host-bootstrap",
        message,
      },
      "host-bootstrap deprecated warning hook failed",
    );
    return;
  }
  if (warnHook === true) {
    if (typeof request?.log?.warn === "function") {
      request.log.warn(
        {
          route,
          headerName: "x-xapps-host-bootstrap",
        },
        message,
      );
    } else {
      console.warn(message, { route, headerName: "x-xapps-host-bootstrap" });
    }
  }
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
    const body = readBodyRecord(request.body);
    const requestedOrigin = readString(body.origin) || null;
    const requestedSubjectId = readString(body.subjectId) || null;
    const requestedType = readString(body.type) || null;
    const requestedEmail = readString(body.email) || null;
    const requestedName = readString(body.name) || null;
    const requestedLinkId = readString(body.linkId, body.link_id) || null;
    let validatedApiKey = null;
    try {
      const { apiKey, signingSecret, signingKeyId, ttlSeconds } = requireHostBootstrapRequest(
        request,
        bootstrap,
      );
      validatedApiKey = apiKey;
      const rateLimitBootstrap =
        typeof bootstrap?.rateLimitBootstrap === "function" ? bootstrap.rateLimitBootstrap : null;
      if (rateLimitBootstrap) {
        const allowed = await rateLimitBootstrap({
          request,
          apiKey,
          origin: requestedOrigin,
          subjectId: requestedSubjectId,
          type: requestedType,
          identifier: body.identifier ?? null,
          email: requestedEmail,
          name: requestedName,
          linkId: requestedLinkId,
        });
        if (!isAcceptedRateLimitResult(allowed)) {
          throw new Error("Host bootstrap rate limit exceeded");
        }
      }
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
      const result = buildHostBootstrapResult({
        subjectId: resolved.subjectId,
        email: resolved.email ?? body.email,
        name: resolved.name ?? body.name,
        origin,
        signingSecret,
        signingKeyId,
        ttlSeconds,
      });
      await auditHostBootstrap(bootstrap, request, {
        request,
        ok: true,
        apiKey,
        origin,
        subjectId: readString(resolved.subjectId) || requestedSubjectId,
        type: requestedType,
        identifier: body.identifier ?? null,
        email: readString(resolved.email, body.email) || null,
        name: readString(resolved.name, body.name) || null,
        linkId: requestedLinkId,
        token: readString(result.bootstrapToken) || null,
      });
      return reply.send(result);
    } catch (err) {
      await auditHostBootstrap(bootstrap, request, {
        request,
        ok: false,
        apiKey: validatedApiKey,
        origin: requestedOrigin,
        subjectId: requestedSubjectId,
        type: requestedType,
        identifier: body.identifier ?? null,
        email: requestedEmail,
        name: requestedName,
        linkId: requestedLinkId,
        reason: String(err?.message || "host bootstrap failed"),
      });
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
        if (!isAcceptedRateLimitResult(allowed)) {
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
    if (!ensureHostApiBrowserUnsafeOriginAllowed(request, reply, allowedOrigins)) return;
    await warnDeprecatedBootstrapHeaderUsage(bootstrap, request, "/api/host-session/logout");
    try {
      const sessionContext = await readHostSessionContext(request, session);
      const rateLimitLogout =
        typeof session?.rateLimitLogout === "function" ? session.rateLimitLogout : null;
      if (rateLimitLogout) {
        const allowed = await rateLimitLogout({
          request,
          subjectId: readString(sessionContext?.subjectId) || null,
          jti: readString(sessionContext?.jti) || null,
          iat: Number.isFinite(Number(sessionContext?.iat))
            ? Math.floor(Number(sessionContext.iat))
            : null,
          exp: Number.isFinite(Number(sessionContext?.exp))
            ? Math.floor(Number(sessionContext.exp))
            : null,
          token: readString(sessionContext?.token) || null,
          type: "host_session",
        });
        if (!isAcceptedRateLimitResult(allowed)) {
          throw new Error("Host session logout rate limit exceeded");
        }
      }
      if (sessionContext) {
        await revokeHostSession(sessionContext, session);
        await auditHostSessionRevocation(session, request, {
          request,
          ok: true,
          phase: "local_revoke",
          subjectId: readString(sessionContext?.subjectId) || null,
          jti: readString(sessionContext?.jti) || null,
          iat: Number.isFinite(Number(sessionContext?.iat))
            ? Math.floor(Number(sessionContext.iat))
            : null,
          exp: Number.isFinite(Number(sessionContext?.exp))
            ? Math.floor(Number(sessionContext.exp))
            : null,
          token: readString(sessionContext?.token) || null,
          source: "tenant_host_logout",
        });
        const reportHostSessionRevocation =
          typeof service?.reportHostSessionRevocation === "function"
            ? service.reportHostSessionRevocation
            : null;
        if (reportHostSessionRevocation && sessionContext?.jti && Number(sessionContext?.exp) > 0) {
          try {
            await reportHostSessionRevocation({
              hostSessionJti: String(sessionContext.jti || "").trim(),
              exp: Math.floor(Number(sessionContext.exp)),
              revokedAt: Math.floor(Date.now() / 1000),
              source: "tenant_host_logout",
            });
            await auditHostSessionRevocation(session, request, {
              request,
              ok: true,
              phase: "gateway_report",
              subjectId: readString(sessionContext?.subjectId) || null,
              jti: readString(sessionContext?.jti) || null,
              iat: Number.isFinite(Number(sessionContext?.iat))
                ? Math.floor(Number(sessionContext.iat))
                : null,
              exp: Number.isFinite(Number(sessionContext?.exp))
                ? Math.floor(Number(sessionContext.exp))
                : null,
              token: readString(sessionContext?.token) || null,
              source: "tenant_host_logout",
            });
          } catch (error) {
            await auditHostSessionRevocation(session, request, {
              request,
              ok: false,
              phase: "gateway_report",
              subjectId: readString(sessionContext?.subjectId) || null,
              jti: readString(sessionContext?.jti) || null,
              iat: Number.isFinite(Number(sessionContext?.iat))
                ? Math.floor(Number(sessionContext.iat))
                : null,
              exp: Number.isFinite(Number(sessionContext?.exp))
                ? Math.floor(Number(sessionContext.exp))
                : null,
              token: readString(sessionContext?.token) || null,
              source: "tenant_host_logout",
              reason: String(error?.message || "host-session revocation propagation failed"),
            });
            if (typeof request?.log?.warn === "function") {
              request.log.warn({ err: error }, "host-session revocation propagation failed");
            } else {
              console.warn("host-session revocation propagation failed", error);
            }
          }
        }
      }
      applyHostApiCorsHeaders(reply, request, allowedOrigins);
      appendSetCookieHeader(reply, buildClearedHostSessionCookieHeader(request, session));
      await auditHostSessionLogout(session, request, {
        request,
        ok: true,
        subjectId: readString(sessionContext?.subjectId) || null,
        jti: readString(sessionContext?.jti) || null,
        iat: Number.isFinite(Number(sessionContext?.iat))
          ? Math.floor(Number(sessionContext.iat))
          : null,
        exp: Number.isFinite(Number(sessionContext?.exp))
          ? Math.floor(Number(sessionContext.exp))
          : null,
        token: readString(sessionContext?.token) || null,
      });
      return reply.send({ ok: true, status: "revoked", sessionMode: "host_session" });
    } catch (err) {
      await auditHostSessionLogout(session, request, {
        request,
        ok: false,
        subjectId: null,
        jti: null,
        iat: null,
        exp: null,
        token: null,
        reason: String(err?.message || "host session logout failed"),
      });
      return sendServiceError(request, reply, err, "host session logout failed");
    }
  });

  fastify.post("/api/resolve-subject", async (request, reply) => {
    if (!ensureHostApiBrowserUnsafeOriginAllowed(request, reply, allowedOrigins)) return;
    await warnDeprecatedBootstrapHeaderUsage(bootstrap, request, "/api/resolve-subject");
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
    if (!ensureHostApiBrowserUnsafeOriginAllowed(request, reply, allowedOrigins)) return;
    await warnDeprecatedBootstrapHeaderUsage(bootstrap, request, "/api/create-catalog-session");
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
          hostSessionJti: readString(bootstrapContext?.jti) || undefined,
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
    if (!ensureHostApiBrowserUnsafeOriginAllowed(request, reply, allowedOrigins)) return;
    await warnDeprecatedBootstrapHeaderUsage(bootstrap, request, "/api/catalog-customer-profile");
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
    if (!ensureHostApiBrowserUnsafeOriginAllowed(request, reply, allowedOrigins)) return;
    await warnDeprecatedBootstrapHeaderUsage(bootstrap, request, "/api/create-widget-session");
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
      input.hostSessionJti = readString(bootstrapContext?.jti, input.hostSessionJti) || undefined;
      return reply.send(await service.createWidgetSession(input));
    } catch (err) {
      return sendServiceError(request, reply, err, "create-widget-session failed");
    }
  });
}
