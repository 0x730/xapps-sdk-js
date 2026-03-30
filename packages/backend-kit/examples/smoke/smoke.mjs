import { createBackendKit, verifyBrowserWidgetContext } from "../../dist/index.js";
import registerHealthRoutes from "../../dist/backend/routes/health.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log("backend-kit smoke: start");

const registrations = [];

const backendKit = await createBackendKit(
  {
    host: { allowedOrigins: ["https://tenant.example.test"] },
    payments: { enabledModes: ["gateway_managed"] },
    gateway: { baseUrl: "https://gateway.example.test", apiKey: "gateway_key" },
    reference: { hostSurfaces: [{ key: "single-panel", label: "Single Panel" }] },
  },
  {
    normalizeOptions(input) {
      return {
        gateway: input.gateway,
        branding: {},
        host: {
          enableReference: true,
          enableLifecycle: true,
          enableBridge: true,
          allowedOrigins: input.host.allowedOrigins,
          bootstrap: { apiKeys: [], signingSecret: "", ttlSeconds: 300 },
        },
        payments: {
          enabledModes: input.payments.enabledModes,
          ownerIssuer: "tenant",
        },
        reference: input.reference,
        subjectProfiles: {},
        overrides: { hostProxyService: null },
      };
    },
    async createPaymentRuntime() {
      return { ok: true };
    },
    async createPaymentHandler() {
      return {
        async upsertSession() {
          return { ok: true };
        },
      };
    },
    createReferenceSurfaceModule() {
      return {
        async registerRoutes(app) {
          registrations.push({ module: "reference", app });
        },
      };
    },
    createHostReferenceModule() {
      return {
        async registerRoutes(app) {
          registrations.push({ module: "host", app });
        },
      };
    },
    createGatewayExecutionModule() {
      return {
        async registerRoutes(app) {
          registrations.push({ module: "gateway", app });
        },
      };
    },
  },
);

await backendKit.registerRoutes({ name: "fake-app" });
assert(registrations.length === 3, "backend kit should register three module groups");

let healthRouteHandler = null;
await registerHealthRoutes(
  {
    get(path, handler) {
      if (path === "/health") {
        healthRouteHandler = handler;
      }
    },
  },
  {
    branding: { serviceName: "tenant-backend", stackLabel: "xconectc" },
    reference: { mode: "reference-minimum" },
    tools: ["catalog", "payments"],
  },
);

assert(typeof healthRouteHandler === "function", "health route should register GET /health");
const healthResponse = await healthRouteHandler();
assert(healthResponse.ok === true, "health response should be ok");
assert(healthResponse.service === "tenant-backend", "health service mismatch");
assert(
  Array.isArray(healthResponse.tools) && healthResponse.tools.length === 2,
  "health tools mismatch",
);

const verified = await verifyBrowserWidgetContext(
  {
    async verifyBrowserWidgetContext(input) {
      return {
        verified: true,
        latestRequestId: "req_latest_123",
        result: input,
      };
    },
  },
  {
    hostOrigin: "https://tenant.example.test",
    installationId: "inst_123",
    bindToolName: "submit_certificate_request_async",
    subjectId: "sub_123",
  },
);
assert(verified.verified === true, "backend-kit verifyBrowserWidgetContext should verify");
assert(verified.latestRequestId === "req_latest_123", "backend-kit verifyBrowserWidgetContext request mismatch");

console.log("backend-kit smoke: ok");
