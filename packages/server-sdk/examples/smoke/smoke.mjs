import {
  createEmbedHostProxyService,
  createGatewayApiClient,
  parsePaymentReturnEvidenceFromSearch,
} from "../../dist/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const requests = [];

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return String(name).toLowerCase() === "content-type" ? "application/json" : null;
      },
    },
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

const gatewayClient = createGatewayApiClient({
  baseUrl: "https://gateway.example.test",
  apiKey: "gateway_key",
  fetchImpl: async (url, init) => {
    requests.push({
      url: String(url),
      method: String(init?.method || ""),
      authorization: init?.headers?.get?.("authorization") || null,
      apiKey: init?.headers?.get?.("x-api-key") || null,
    });

    if (String(url).endsWith("/v1/subjects/resolve")) {
      return jsonResponse({ subjectId: "subject_123" });
    }

    if (String(url).endsWith("/v1/catalog-sessions")) {
      return jsonResponse({
        token: "catalog_token",
        embedUrl: "https://gateway.example.test/embed/catalog",
      });
    }

    if (
      String(url).includes(
        "/v1/requests/latest?installationId=inst_123&toolName=submit_certificate_request_async&subjectId=subject_123",
      )
    ) {
      return jsonResponse({
        requestId: "req_latest_123",
      });
    }

    return jsonResponse({});
  },
});

console.log("server-sdk smoke: start");

const subject = await gatewayClient.resolveSubject({
  type: "user",
  identifier: {
    idType: "email",
    value: "daniel.vladescu@gmail.com",
    hint: "daniel.vladescu@gmail.com",
  },
  email: "daniel.vladescu@gmail.com",
});
assert(subject.subjectId === "subject_123", "resolveSubject should return subjectId");

const catalog = await gatewayClient.createCatalogSession({
  origin: "https://tenant.example.test",
  subjectId: subject.subjectId,
  publishers: ["xplace"],
});
assert(catalog.token === "catalog_token", "createCatalogSession token mismatch");
assert(catalog.embedUrl.includes("/embed/catalog"), "createCatalogSession embedUrl mismatch");
assert(requests[0]?.apiKey === "gateway_key", "gateway api client should forward x-api-key");

const verified = await gatewayClient.verifyBrowserWidgetContext({
  hostOrigin: "https://tenant.example.test",
  installationId: "inst_123",
  bindToolName: "submit_certificate_request_async",
  subjectId: subject.subjectId,
});
assert(verified.verified === true, "verifyBrowserWidgetContext should verify");
assert(verified.latestRequestId === "req_latest_123", "verifyBrowserWidgetContext request id mismatch");

const hostProxy = createEmbedHostProxyService({
  gatewayClient,
  gatewayUrl: "https://gateway.example.test",
  hostModes: [{ key: "single-panel", label: "Single Panel" }],
});
const config = hostProxy.getHostConfig();
assert(config.ok === true, "host config should be ok");
assert(config.gatewayUrl === "https://gateway.example.test", "host config gateway url mismatch");
assert(config.hostModes.length === 1, "host config modes mismatch");

const evidence = parsePaymentReturnEvidenceFromSearch(
  "xapps_payment_contract=xapps_payment_orchestration_v1" +
    "&xapps_payment_session_id=ps_123" +
    "&xapps_payment_status=completed" +
    "&xapps_payment_receipt_id=rcpt_123" +
    "&xapps_payment_amount=50.00" +
    "&xapps_payment_currency=USD" +
    "&xapps_payment_ts=2026-03-24T10:00:00.000Z" +
    "&xapps_payment_issuer=tenant" +
    "&xapp_id=xapp_123" +
    "&tool_name=issue_certificate" +
    "&xapps_payment_sig=signed",
);
assert(evidence?.payment_session_id === "ps_123", "payment evidence parsing mismatch");
assert(evidence?.tool_name === "issue_certificate", "payment evidence tool mismatch");

console.log("server-sdk smoke: ok");
