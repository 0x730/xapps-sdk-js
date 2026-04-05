import {
  activateXappPurchaseReference,
  buildXappMonetizationReferenceSummary,
  consumeXappWalletCredits,
  createBackendKit,
  evaluateWidgetBootstrapOriginPolicy,
  finalizeXappHostedPurchase,
  findXappHostedPaymentPreset,
  listXappHostedPaymentPresets,
  normalizeXappMonetizationScopeKind,
  readXappMonetizationSnapshot,
  resolveXappHostedPaymentDefinition,
  resolveXappMonetizationScope,
  startXappHostedPurchase,
  verifyBrowserWidgetContext,
} from "../../dist/index.js";
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
assert(
  verified.latestRequestId === "req_latest_123",
  "backend-kit verifyBrowserWidgetContext request mismatch",
);

const widgetBootstrapPolicy = evaluateWidgetBootstrapOriginPolicy({
  hostOrigin: "https://tenant.example.test/path",
  allowedOrigins: "https://tenant.example.test,https://tenant-b.example.test",
});
assert(widgetBootstrapPolicy.ok === true, "widget bootstrap policy should allow normalized host");
assert(
  widgetBootstrapPolicy.ok && widgetBootstrapPolicy.hostOrigin === "https://tenant.example.test",
  "widget bootstrap policy normalized host mismatch",
);

const widgetBootstrapPolicyRejected = evaluateWidgetBootstrapOriginPolicy({
  hostOrigin: "https://tenant-c.example.test",
  allowedOrigins: ["https://tenant.example.test"],
});
assert(
  widgetBootstrapPolicyRejected.ok === false &&
    widgetBootstrapPolicyRejected.code === "HOST_ORIGIN_NOT_ALLOWED",
  "widget bootstrap policy should reject unknown host origin",
);
assert(
  normalizeXappMonetizationScopeKind("installation") === "installation",
  "backend-kit normalizeXappMonetizationScopeKind installation mismatch",
);
const resolvedScope = resolveXappMonetizationScope({
  scopeKind: "subject",
  context: { subject_id: "sub_123" },
});
assert(
  resolvedScope.scope_fields.subject_id === "sub_123",
  "backend-kit resolveXappMonetizationScope subject mismatch",
);
const resolvedPaymentDefinition = resolveXappHostedPaymentDefinition({
  manifest: {
    payment_guard_definitions: [
      {
        name: "publisher_checkout_default",
        payment_issuer_mode: "publisher_delegated",
        payment_scheme: "stripe",
        accepts: [{ scheme: "mock_manual" }],
      },
    ],
  },
  paymentGuardRef: "publisher_checkout_default",
  paymentScheme: "mock_manual",
  env: {
    PUBLISHER_DELEGATED_PAYMENT_RETURN_SECRET_REF: "platform://publisher:return:secret",
  },
});
assert(
  resolvedPaymentDefinition.issuerMode === "publisher_delegated",
  "backend-kit resolveXappHostedPaymentDefinition issuer mismatch",
);
assert(
  resolvedPaymentDefinition.metadata?.payment_return_signing?.secret_ref ===
    "platform://publisher:return:secret",
  "backend-kit resolveXappHostedPaymentDefinition signing secret mismatch",
);
assert(
  resolvedPaymentDefinition.scheme === "mock_manual",
  "backend-kit resolveXappHostedPaymentDefinition scheme mismatch",
);
const hostedPaymentPresets = listXappHostedPaymentPresets({
  manifest: {
    payment_guard_definitions: [
      {
        name: "gateway_checkout_default",
        payment_issuer_mode: "gateway_managed",
        payment_scheme: "stripe",
        accepts: [{ scheme: "mock_manual" }],
      },
    ],
  },
});
assert(hostedPaymentPresets.length === 2, "backend-kit listXappHostedPaymentPresets mismatch");
assert(
  hostedPaymentPresets.some((item) => item.label === "Gateway managed (stripe)"),
  "backend-kit hosted payment stripe preset label mismatch",
);
assert(
  hostedPaymentPresets.some((item) => item.label === "Gateway managed (mock manual)"),
  "backend-kit hosted payment mock preset label mismatch",
);
assert(
  findXappHostedPaymentPreset({
    manifest: {
      payment_guard_definitions: [
        {
          name: "gateway_checkout_default",
          payment_issuer_mode: "gateway_managed",
          payment_scheme: "stripe",
          accepts: [{ scheme: "mock_manual" }],
        },
      ],
    },
    paymentGuardRef: "gateway_checkout_default",
    paymentScheme: "mock_manual",
  })?.paymentScheme === "mock_manual",
  "backend-kit findXappHostedPaymentPreset mismatch",
);

const fakeGatewayClient = {
  async prepareXappPurchaseIntent(input) {
    return {
      prepared_intent: {
        purchase_intent_id: "pi_123",
        price: { amount: "29", currency: "RON" },
        ...input,
      },
    };
  },
  async createXappPurchasePaymentSession(input) {
    return {
      payment_session: {
        payment_session_id: "pay_123",
        ...input,
      },
      payment_page_url:
        "https://gateway.example.test/v1/gateway-payment.html?payment_session_id=pay_123",
    };
  },
  async finalizeXappPurchasePaymentSession(input) {
    return {
      prepared_intent: { purchase_intent_id: "pi_123", status: "paid" },
      payment_session: { payment_session_id: "pay_123", status: "completed" },
      transaction: { id: "txn_123", status: "verified" },
      access_projection: {
        has_current_access: true,
        source_intent_id: input.intentId,
      },
    };
  },
  async createXappPurchaseTransaction(input) {
    return {
      transaction: {
        id: "txn_ref_123",
        status: input.status,
        amount: input.amount,
        currency: input.currency,
      },
    };
  },
  async issueXappPurchaseAccess(input) {
    return {
      prepared_intent: { purchase_intent_id: input.intentId, status: "paid" },
      access_projection: {
        has_current_access: true,
        source_intent_id: input.intentId,
      },
    };
  },
  async getXappMonetizationAccess() {
    return {
      access_projection: {
        entitlement_state: "active",
        has_current_access: true,
      },
    };
  },
  async getXappCurrentSubscription() {
    return {
      current_subscription: {
        id: "sub_contract_123",
        status: "active",
      },
    };
  },
  async listXappWalletAccounts() {
    return {
      items: [{ id: "wallet_123", credits_remaining: 500 }],
    };
  },
  async consumeXappWalletCredits(input) {
    return {
      wallet_account: {
        id: String(input.walletAccountId || ""),
        balance_remaining: "475",
      },
      wallet_ledger: {
        id: "ledger_123",
        wallet_account_id: String(input.walletAccountId || ""),
        event_kind: "consume",
        amount: String(input.amount || ""),
        source_ref: String(input.source_ref || ""),
      },
      access_projection: {
        has_current_access: true,
        credits_remaining: 475,
      },
      snapshot_id: "snapshot_123",
    };
  },
};

const snapshot = await readXappMonetizationSnapshot(fakeGatewayClient, {
  xappId: "xapp_123",
  subjectId: "sub_123",
});
assert(
  snapshot.access_projection?.has_current_access === true,
  "backend-kit readXappMonetizationSnapshot access mismatch",
);
assert(
  snapshot.current_subscription?.id === "sub_contract_123",
  "backend-kit readXappMonetizationSnapshot subscription mismatch",
);
assert(
  Array.isArray(snapshot.wallet_accounts) && snapshot.wallet_accounts[0]?.id === "wallet_123",
  "backend-kit readXappMonetizationSnapshot wallet mismatch",
);

const referenceSummary = buildXappMonetizationReferenceSummary({
  snapshot: {
    ...snapshot,
    entitlements: [{ status: "active", product_slug: "starter-unlock" }],
  },
  paywallPackages: [
    {
      package_slug: "creator-pro-monthly",
      product_family: "subscription_plan",
      purchase_policy: {
        can_purchase: false,
        status: "current_recurring_plan",
        transition_kind: "none",
      },
    },
    {
      package_slug: "creator-starter-unlock",
      product_family: "one_time_unlock",
      purchase_policy: {
        can_purchase: false,
        status: "owned_additive_unlock",
        transition_kind: "none",
      },
    },
    {
      package_slug: "creator-boost-credits",
      product_family: "credit_pack",
      purchase_policy: {
        can_purchase: true,
        status: "available",
        transition_kind: "buy_credit_pack",
      },
    },
  ],
});
assert(
  referenceSummary.current_recurring_plan?.status === "active",
  "backend-kit buildXappMonetizationReferenceSummary recurring mismatch",
);
assert(
  referenceSummary.owned_additive_unlocks[0]?.package_slug === "creator-starter-unlock",
  "backend-kit buildXappMonetizationReferenceSummary unlock mismatch",
);
assert(
  referenceSummary.credit_topups[0]?.package_slug === "creator-boost-credits",
  "backend-kit buildXappMonetizationReferenceSummary credit mismatch",
);

const consumedCredits = await consumeXappWalletCredits(fakeGatewayClient, {
  xappId: "xapp_123",
  walletAccountId: "wallet_123",
  amount: "25",
  sourceRef: "feature:priority_support_call",
  metadata: {
    feature_key: "priority_support_call",
  },
});
assert(
  consumedCredits.wallet_account?.balance_remaining === "475",
  "backend-kit consumeXappWalletCredits wallet mismatch",
);
assert(
  consumedCredits.wallet_ledger?.event_kind === "consume",
  "backend-kit consumeXappWalletCredits ledger mismatch",
);
assert(
  consumedCredits.access_projection?.credits_remaining === 475,
  "backend-kit consumeXappWalletCredits access mismatch",
);

const hostedPurchase = await startXappHostedPurchase(fakeGatewayClient, {
  xappId: "xapp_123",
  offeringId: "offer_123",
  packageId: "package_123",
  priceId: "price_123",
  subjectId: "sub_123",
  paymentGuardRef: "gateway_checkout_default",
  paymentScheme: "mock_manual",
  returnUrl: "https://tenant.example.test/return",
  pageUrl: "https://gateway.example.test/v1/gateway-payment.html",
});
assert(
  hostedPurchase.prepared_intent?.purchase_intent_id === "pi_123",
  "backend-kit startXappHostedPurchase intent mismatch",
);
assert(
  hostedPurchase.payment_session?.payment_session_id === "pay_123",
  "backend-kit startXappHostedPurchase session mismatch",
);

const finalizedPurchase = await finalizeXappHostedPurchase(fakeGatewayClient, {
  xappId: "xapp_123",
  intentId: "pi_123",
});
assert(
  finalizedPurchase.transaction?.id === "txn_123",
  "backend-kit finalizeXappHostedPurchase transaction mismatch",
);
assert(
  finalizedPurchase.issued?.access_projection?.has_current_access === true,
  "backend-kit finalizeXappHostedPurchase issued access mismatch",
);

const referenceActivation = await activateXappPurchaseReference(fakeGatewayClient, {
  xappId: "xapp_123",
  offeringId: "offer_123",
  packageId: "package_123",
  priceId: "price_123",
  subjectId: "sub_123",
});
assert(
  referenceActivation.transaction?.id === "txn_ref_123",
  "backend-kit activateXappPurchaseReference transaction mismatch",
);
assert(
  referenceActivation.issued?.access_projection?.has_current_access === true,
  "backend-kit activateXappPurchaseReference issued access mismatch",
);

console.log("backend-kit smoke: ok");
