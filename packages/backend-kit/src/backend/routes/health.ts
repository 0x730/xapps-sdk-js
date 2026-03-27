type HealthRouteOptions = {
  branding?: {
    serviceName?: string | null;
    stackLabel?: string | null;
  } | null;
  reference?: {
    mode?: string | null;
  } | null;
  tools?: unknown[] | null;
};

type HealthRouteResponse = {
  ok: true;
  service: string;
  mode: string;
  stack?: string;
  tools?: unknown[];
  time: string;
};

type FastifyLike = {
  get: (path: string, handler: () => Promise<HealthRouteResponse> | HealthRouteResponse) => void;
};

function nowIso(): string {
  return new Date().toISOString();
}

export default async function healthRoutes(
  fastify: FastifyLike,
  options: HealthRouteOptions = {},
): Promise<void> {
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
