import { createEmbedHostProxyService, createGatewayApiClient } from "../../dist/index.js";

const gatewayUrl = process.env.XAPPS_BASE_URL || "http://localhost:3000";
const gatewayApiKey = process.env.XAPPS_GATEWAY_API_KEY || "";

if (!gatewayApiKey) {
  console.error("Missing XAPPS_GATEWAY_API_KEY");
  process.exit(1);
}

const gatewayClient = createGatewayApiClient({
  baseUrl: gatewayUrl,
  apiKey: gatewayApiKey,
  requestTimeoutMs: 30_000,
});

const hostProxy = createEmbedHostProxyService({
  gatewayUrl,
  gatewayClient,
});

async function runDemo() {
  const subject = await hostProxy.resolveSubject({
    email: "demo@example.com",
    displayName: "Demo User",
  });

  const catalog = await hostProxy.createCatalogSession({
    subjectId: subject.subjectId,
  });

  console.log(
    JSON.stringify(
      {
        hostConfig: hostProxy.getHostConfig(),
        headers: hostProxy.getNoStoreHeaders(),
        subject,
        catalog,
      },
      null,
      2,
    ),
  );
}

runDemo().catch((error) => {
  console.error(error);
  process.exit(1);
});

/*
Framework mapping sketch:

  app.get("/api/host-config", async (_req, reply) => {
    reply.headers(hostProxy.getNoStoreHeaders()).send(hostProxy.getHostConfig());
  });

  app.post("/api/resolve-subject", async (req, reply) => {
    reply.headers(hostProxy.getNoStoreHeaders()).send(await hostProxy.resolveSubject(req.body));
  });

  app.post("/api/create-catalog-session", async (req, reply) => {
    reply.headers(hostProxy.getNoStoreHeaders()).send(await hostProxy.createCatalogSession(req.body));
  });

  app.post("/api/create-widget-session", async (req, reply) => {
    reply.headers(hostProxy.getNoStoreHeaders()).send(await hostProxy.createWidgetSession(req.body));
  });

Add installations and bridge routes only if your host profile needs them.
*/
