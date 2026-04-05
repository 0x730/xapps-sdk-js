import { createEmbedHostProxyService, createGatewayApiClient } from "../../dist/index.js";

const gatewayUrl = process.env.XAPPS_BASE_URL || "http://localhost:3000";
const gatewayApiKey = process.env.XAPPS_GATEWAY_API_KEY || "";
const xappId = String(process.env.XAPPS_XAPP_ID || "").trim();
const token = String(process.env.XAPPS_HOST_TOKEN || "").trim();

if (!gatewayApiKey) {
  console.error("Missing XAPPS_GATEWAY_API_KEY");
  process.exit(1);
}

if (!xappId || !token) {
  console.error("Missing XAPPS_XAPP_ID or XAPPS_HOST_TOKEN");
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
  const monetization = await hostProxy.getMyXappMonetization({
    xappId,
    token,
    installationId: process.env.XAPPS_INSTALLATION_ID || undefined,
    locale: process.env.XAPPS_LOCALE || "en",
    country: process.env.XAPPS_COUNTRY || undefined,
    realmRef: process.env.XAPPS_REALM_REF || undefined,
  });

  console.log(
    JSON.stringify(
      {
        xappId,
        access: monetization.access || null,
        currentSubscription: monetization.currentSubscription || null,
        entitlements: monetization.entitlements || [],
        paywalls: monetization.paywalls || [],
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

  app.get("/api/my-xapps/:xappId/monetization", async (req, reply) => {
    reply
      .headers(hostProxy.getNoStoreHeaders())
      .send(
        await hostProxy.getMyXappMonetization({
          xappId: req.params.xappId,
          token: req.query.token,
          installationId: req.query.installationId,
          locale: req.query.locale,
          country: req.query.country,
          realmRef: req.query.realmRef,
        }),
      );
  });

  app.post("/api/my-xapps/:xappId/monetization/purchase-intents/prepare", async (req, reply) => {
    reply
      .headers(hostProxy.getNoStoreHeaders())
      .send(
        await hostProxy.prepareMyXappPurchaseIntent({
          xappId: req.params.xappId,
          token: req.body.token,
          offeringId: req.body.offeringId,
          packageId: req.body.packageId,
          priceId: req.body.priceId,
          installationId: req.body.installationId,
          locale: req.body.locale,
          country: req.body.country,
        }),
      );
  });
*/
