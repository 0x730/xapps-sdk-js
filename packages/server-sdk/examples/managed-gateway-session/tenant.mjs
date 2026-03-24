import {
  buildManagedGatewayPaymentSessionInput,
  createGatewayApiClient,
} from "../../dist/index.js";

function envOrDefault(name, fallback) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

const gateway = createGatewayApiClient({
  baseUrl: envOrDefault("XAPPS_GATEWAY_URL", "http://localhost:3000"),
  apiKey: envOrDefault("XAPPS_GATEWAY_API_KEY", "xapps_test_tenant_b_key_123456789"),
});

const guardConfig = {
  payment_scheme: "stripe",
  accepts: [{ scheme: "mock_manual", label: "Mock Hosted Redirect" }],
  payment_ui: {
    brand: {
      name: "Tenant Example",
      accent: "#635bff",
    },
    schemes: [
      {
        scheme: "stripe",
        title: "Pay with Stripe",
        subtitle: "Secure card checkout hosted by Stripe.",
        cta_label: "Continue to Stripe",
      },
      {
        scheme: "mock_manual",
        title: "Hosted Checkout Test",
        subtitle: "Provider-style redirect and signed return flow.",
        cta_label: "Continue to Checkout",
      },
    ],
  },
};

const input = buildManagedGatewayPaymentSessionInput({
  source: "tenant-backend",
  guardSlug: "tenant-payment-policy",
  guardConfig,
  xappId: envOrDefault("XAPPS_XAPP_ID", "01ABCEXAMPLE"),
  toolName: envOrDefault("XAPPS_TOOL_NAME", "submit_form"),
  amount: envOrDefault("XAPPS_PAYMENT_AMOUNT", "3.00"),
  currency: envOrDefault("XAPPS_PAYMENT_CURRENCY", "USD"),
  paymentIssuer: "gateway",
  paymentScheme: "stripe",
  returnUrl: envOrDefault("XAPPS_RETURN_URL", "https://tenant.example.test/host"),
  cancelUrl: envOrDefault("XAPPS_CANCEL_URL", "https://tenant.example.test/host"),
  subjectId: envOrDefault("XAPPS_SUBJECT_ID", "subj_example"),
  installationId: envOrDefault("XAPPS_INSTALLATION_ID", "inst_example"),
  clientId: envOrDefault("XAPPS_CLIENT_ID", "client_example"),
});

console.log("[tenant managed-lane] createPaymentSession input");
console.log(JSON.stringify(input, null, 2));

const created = await gateway.createPaymentSession(input);
console.log("[tenant managed-lane] created session");
console.log(JSON.stringify(created, null, 2));
