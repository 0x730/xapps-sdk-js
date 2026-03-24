// @ts-nocheck
function nowIso() {
  return new Date().toISOString();
}

export default async function healthRoutes(fastify, options = {}) {
  const branding = options.branding && typeof options.branding === "object" ? options.branding : {};
  const reference =
    options.reference && typeof options.reference === "object" ? options.reference : {};
  const tools = Array.isArray(options.tools) ? options.tools.filter(Boolean) : [];
  fastify.get("/health", async () => ({
    ok: true,
    service: String(branding.serviceName || "").trim() || "tenant-backend",
    mode: String(reference.mode || "").trim() || "reference-minimum",
    ...(String(branding.stackLabel || "").trim()
      ? { stack: String(branding.stackLabel).trim() }
      : {}),
    ...(tools.length > 0 ? { tools } : {}),
    time: nowIso(),
  }));
}
