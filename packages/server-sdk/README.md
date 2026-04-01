# `@xapps-platform/server-sdk`

Node.js helper SDK for publisher server/executor integrations.

If you only need manifest schema/types/parsing, install `@xapps-platform/xapp-manifest` directly.
`@xapps-platform/server-sdk` re-exports that manifest surface for backend consumers that already depend on the SDK.

## Install

```bash
npm install @xapps-platform/server-sdk
```

## Exports

- `parseDispatchRequest`
- `verifyXappsSignature`
- `buildCanonicalString`
- `createCallbackClient`
- `createGatewayApiClient`
- `createPublisherApiClient`
- `GatewayApiClient.verifyBrowserWidgetContext(...)`
- `XappsServerSdkError`
- `parsePaymentReturnEvidence`
- `parsePaymentReturnEvidenceFromSearch`
- `buildPaymentReturnCanonicalString`
- `signPaymentReturnEvidence`
- `buildPaymentReturnQueryParams`
- `buildSignedPaymentReturnRedirectUrl`
- `verifyPaymentReturnEvidence`
- `verifySubjectProofEnvelope`
- `verifyJwsSubjectProof`
- `verifyWebauthnSubjectProof`
- `parseXappManifest`
- `xappManifestJsonSchema`
- `resolveSecretFromRef` — sync secret ref resolution (`env:`, `file:`)
- `resolveSecretFromRefAsync` — async secret ref resolution (`env:`, `file:`, `vault://`, `awssm://`, `platform://`)
- `resolveSecret` / `resolveSecretAsync` — convenience wrappers (secret > secretRef > throws)
- `buildPaymentProviderCredentialRefsByProvider` — canonical helper for guard `payment_provider_credentials_refs`
- `buildPaymentProviderCredentialsBundle` — canonical helper for session `payment_provider_credentials`
- `humanizePaymentSchemeLabel` — canonical scheme display-name helper for managed-lane payment UI
- `buildGatewaySessionAccepts` — canonical helper for gateway session `accepts[]`
- `readGatewaySessionUi` — canonical helper for guard `hosted_ui` / `payment_ui` aliases
- `buildManagedGatewaySessionMetadata` — canonical helper for managed-lane gateway session metadata
- `buildManagedGatewayPaymentSessionInput` — canonical helper for managed-lane `createPaymentSession(...)` inputs
- `buildHostedGatewayPaymentUrlFromGuardContext` — canonical hosted gateway session bootstrap helper for tenant/publisher backends
- `extractHostedPaymentSessionId` — canonical helper for recovering `payment_session_id` from hosted payment URLs
- `resolveMergedPaymentGuardContext` — canonical helper for merging payload/context/resume values in payment guards
- `resolvePaymentGuardPriceAmount` — canonical helper for guard pricing lookup (`tool_overrides`, `xapp_prices`, default)
- `normalizePaymentAllowedIssuers` — canonical helper for guard allowed-issuer normalization
- `hasUpstreamPaymentVerified` — canonical helper for upstream payment verification hints
- `buildPaymentGuardAction` — canonical helper for `complete_payment` guard actions
- `createPaymentHandler` — unified payment handler factory (supports `secretRef` config)
- `createPaymentHandlerAsync` — async handler factory for external `secretRef` schemes

For manifest-only use cases:

- prefer `@xapps-platform/xapp-manifest`
- use `@xapps-platform/server-sdk` when you also need backend protocol/client helpers

## Recommended lane / package split

For tenant/publisher integrators, the safe default path is:

1. `gateway_managed`
2. gateway-orchestrated delegated lanes
3. owner-managed only when you truly need tenant/publisher-owned provider execution

Practical rule:

- stay at `@xapps-platform/server-sdk` level for managed/delegated lanes
- only drop to `@xapps/payment-providers` when you are implementing provider execution yourself

## Enterprise host contract

`@xapps-platform/server-sdk` supports host-style integrations through the gateway client and
the framework-neutral embed host proxy service:

- `createGatewayApiClient(...)`
  - includes host-facing gateway methods:
    - `resolveSubject(...)`
    - `createCatalogSession(...)`
    - `createWidgetSession(...)`
    - `verifyBrowserWidgetContext(...)`
    - `listInstallations(...)`
    - `installXapp(...)`
    - `updateInstallation(...)`
    - `uninstallInstallation(...)`
- `createEmbedHostProxyService(...)`
  - exposes:
    - `getHostConfig()`
    - `getNoStoreHeaders()`
    - `resolveSubject(...)`
    - `createCatalogSession(...)`
    - `createWidgetSession(...)`
    - `refreshWidgetToken(...)`
    - `listInstallations(...)`
    - `installXapp(...)`
    - `updateInstallation(...)`
    - `uninstallInstallation(...)`
    - optional bridge sign / vendor assertion hooks

Higher-level tenant/publisher backend kits are intentionally not part of the
current supported SDK surface. The next redesign for that layer will start from
backend `lib/` and `modes/`, not from route-wrapper aliases.

## Host profiles

The secure backend surface should be presented as explicit profiles, not one giant route list.

### Minimal embed profile

Required:

- `POST /api/resolve-subject`
- `POST /api/create-catalog-session`
- `POST /api/create-widget-session`

### Marketplace lifecycle profile

Adds:

- `GET /api/installations`
- `POST /api/install`
- `POST /api/update`
- `POST /api/uninstall`

### Advanced bridge profile

Adds only when needed:

- `POST /api/bridge/token-refresh`
- `POST /api/bridge/sign`
- `POST /api/bridge/vendor-assertion`

The browser-side consumer of these routes should be `xapps-embed-sdk`, not custom tenant JavaScript that rewrites the flow from zero.

## Minimal host proxy example

```ts
import { createEmbedHostProxyService, createGatewayApiClient } from "@xapps-platform/server-sdk";

const gateway = createGatewayApiClient({
  baseUrl: process.env.XAPPS_BASE_URL ?? "http://localhost:3000",
  apiKey: process.env.XAPPS_GATEWAY_API_KEY ?? "",
});

const hostProxy = createEmbedHostProxyService({
  gatewayClient: gateway,
  gatewayUrl: process.env.XAPPS_BASE_URL ?? "http://localhost:3000",
});

const headers = hostProxy.getNoStoreHeaders();
const subject = await hostProxy.resolveSubject({
  email: "demo@example.com",
  name: "Demo User",
});
const catalog = await hostProxy.createCatalogSession({
  origin: "https://tenant.example.test",
  subjectId: subject.subjectId,
});
const verified = await gateway.verifyBrowserWidgetContext({
  hostOrigin: "https://tenant.example.test",
  installationId: "inst_123",
  bindToolName: "submit_form",
  subjectId: subject.subjectId,
});
```

## Request-capable publisher widget bootstrap

For `widgets[].entry.kind = "iframe_url"` request-capable widgets, the current
shipped contract is:

- keep `iframe_url` as a public/bootstrap shell
- do not put secrets or long-lived tokens in the manifest URL
- send the short-lived widget token and current widget context to your backend
- let your backend call `GatewayApiClient.verifyBrowserWidgetContext(...)`
- expose private request-capable runtime only after that verification succeeds
- if the page is opened directly outside an Xapps host/embed, keep private
  runtime blocked and show a clear host-required message

This keeps compatibility with the current bridge model while letting publishers
keep real request/runtime access private.

Optional stronger bootstrap transport already supported:

- `widgets[].config.xapps.bootstrap_transport = "signed_ticket"`
- current first slice reuses the short-lived signed widget token as a bootstrap
  ticket and carries it through the iframe URL hash
- browser widgets can forward it to the backend as `bootstrapTicket`
- `GatewayApiClient.verifyBrowserWidgetContext(...)` will then use:
  - `Origin: <hostOrigin>`
  - `Authorization: Bearer <bootstrapTicket>`

Example:

```ts
const verified = await gateway.verifyBrowserWidgetContext({
  hostOrigin: "https://tenant.example.test",
  installationId: "inst_123",
  bindToolName: "submit_form",
  subjectId: "sub_123",
  bootstrapTicket: "bst_123",
});
```

## Publisher linking + bridge helpers

`createPublisherApiClient(...)` now covers the publisher-side linking helpers used
around publisher-rendered and bridge-enabled integrations:

- `completeLink(...)`
- `revokeLink(...)`
- `getLinkStatus()`
- `exchangeBridgeToken(...)`

These helpers are additive to the existing import/publish/endpoints surface.
They belong in the publisher API client, not in the backend kits.

```ts
import { createPublisherApiClient } from "@xapps-platform/server-sdk";

const publisher = createPublisherApiClient({
  baseUrl: process.env.XAPPS_BASE_URL ?? "http://localhost:3000",
  apiKey: process.env.XAPPS_PUBLISHER_API_KEY ?? "",
});

await publisher.completeLink({
  subjectId: "sub_123",
  xappId: "xapp_123",
  publisherUserId: "publisher-user-123",
  metadata: { email: "user@example.test" },
});
```

## Managed-lane examples

- Tenant backend:
  - `packages/server-sdk/examples/managed-gateway-session/tenant.mjs`
- Publisher backend:
  - `packages/server-sdk/examples/managed-gateway-session/publisher.mjs`
- Minimal marketplace host proxy:
  - `packages/server-sdk/examples/host-proxy/minimal.mjs`
- Examples overview:
  - `packages/server-sdk/examples/README.md`

Run after building the SDK:

```bash
node packages/server-sdk/examples/managed-gateway-session/tenant.mjs
node packages/server-sdk/examples/managed-gateway-session/publisher.mjs
node packages/server-sdk/examples/host-proxy/minimal.mjs
```

## Minimal usage

```ts
import {
  buildManagedGatewayPaymentSessionInput,
  createGatewayApiClient,
  buildSignedPaymentReturnRedirectUrl,
  createCallbackClient,
  parsePaymentReturnEvidenceFromSearch,
  parseDispatchRequest,
  verifyPaymentReturnEvidence,
  verifyXappsSignature,
} from "@xapps-platform/server-sdk";

const dispatch = parseDispatchRequest(req.body);
const signature = verifyXappsSignature({
  method: req.method,
  pathWithQuery: req.originalUrl,
  body: JSON.stringify(req.body ?? {}),
  timestamp: String(req.header("x-xapps-timestamp") ?? ""),
  signature: String(req.header("x-xapps-signature") ?? ""),
  secret: process.env.XAPPS_SHARED_SECRET ?? "",
});

if (!signature.ok) throw new Error(signature.reason);

const callbacks = createCallbackClient({
  baseUrl: process.env.XAPPS_BASE_URL ?? "",
  callbackToken: dispatch.callbackToken ?? "",
});
await callbacks.sendEvent(dispatch.requestId, { type: "request.updated" });

const gateway = createGatewayApiClient({
  baseUrl: process.env.XAPPS_BASE_URL ?? "http://localhost:3000",
  apiKey: process.env.XAPPS_GATEWAY_API_KEY ?? "",
  requestTimeoutMs: 30_000,
});
const guardConfig = {
  payment_scheme: "stripe",
  accepts: [{ scheme: "mock_manual", label: "Mock Hosted Redirect" }],
  payment_ui: {
    brand: { name: "Tenant A", accent: "#635bff" },
    schemes: [{ scheme: "stripe", title: "Pay with Stripe" }],
  },
};
const paymentSession = await gateway.createPaymentSession(
  buildManagedGatewayPaymentSessionInput({
    source: "tenant-backend",
    guardSlug: "tenant-payment-policy",
    guardConfig,
    xappId: "xapp_abc",
    toolName: "submit_form",
    amount: "3.00",
    currency: "USD",
    paymentIssuer: "gateway",
    paymentScheme: "stripe",
    returnUrl: "https://tenant.example/host",
  }),
);

// See also:
// - packages/server-sdk/examples/managed-gateway-session/tenant.mjs
// - packages/server-sdk/examples/managed-gateway-session/publisher.mjs

const completed = await gateway.completePaymentSession({
  paymentSessionId: String(paymentSession.session?.payment_session_id || ""),
  status: "completed",
});
// Additive fields are available when gateway returns client-collect/provider metadata:
// completed.flow, completed.paymentSessionId, completed.clientSettleUrl,
// completed.providerReference, completed.scheme, completed.metadata

// Hosted gateway payment-page paths (xpo-core canonical contract):
const hostedSession = await gateway.getGatewayPaymentSession({
  paymentSessionId: String(paymentSession.session?.payment_session_id || ""),
  returnUrl: "https://tenant.example/host",
});
const hostedComplete = await gateway.completeGatewayPayment({
  paymentSessionId: String(hostedSession.session?.payment_session_id || ""),
});
if (hostedComplete.flow === "client_collect" && hostedComplete.clientSettleUrl) {
  await gateway.clientSettleGatewayPayment({
    paymentSessionId: String(hostedComplete.paymentSessionId || ""),
    status: "paid",
    clientToken: String((hostedComplete.metadata as any)?.client_token || ""),
  });
}

const payment = parsePaymentReturnEvidenceFromSearch(req.url.split("?")[1] || "");
if (payment) {
  const verified = verifyPaymentReturnEvidence({
    evidence: payment,
    secret: process.env.TENANT_PAYMENT_RETURN_SECRET ?? "",
    expected: {
      issuer: "tenant",
      xapp_id: String(req.body?.xapp_id || ""),
      tool_name: String(req.body?.tool_name || ""),
    },
  });
  if (!verified.ok) throw new Error(verified.reason);
}

const redirectUrl = buildSignedPaymentReturnRedirectUrl({
  returnUrl: "https://tenant.example/host",
  evidence: {
    contract: "xapps_payment_orchestration_v1",
    payment_session_id: "pay_123",
    status: "paid",
    receipt_id: "rcpt_123",
    amount: "3.00",
    currency: "USD",
    ts: new Date().toISOString(),
    issuer: "tenant",
    xapp_id: "xapp_abc",
    tool_name: "submit_form",
  },
  secret: process.env.TENANT_PAYMENT_RETURN_SECRET ?? "",
});
// redirectUrl now includes canonical xapps_payment_* fields + xapp_id/tool_name + signature
```

## Gateway client field naming

For `createGatewayApiClient(...)`, the canonical request shape is `snake_case` because it maps
directly to the gateway API boundary:

- `payment_session_id`
- `page_url`
- `xapp_id`
- `tool_name`
- `payment_scheme`
- `return_url`
- `cancel_url`
- `xapps_resume`

The SDK still accepts older camelCase aliases such as `paymentSessionId`, `pageUrl`, `xappId`,
and `toolName` for compatibility, but those aliases are deprecated and should not be used in new
integrator code.

## Secret ref resolution

Secrets can be referenced by scheme-prefixed strings instead of raw values.
`resolveSecretFromRef` resolves synchronously for local schemes; use the async
variant for external providers.

| Scheme                               | Sync | Async | Description                                          |
| ------------------------------------ | :--: | :---: | ---------------------------------------------------- |
| `env:VAR_NAME`                       | yes  |  yes  | Read from `process.env`                              |
| `file:/path/to/secret`               | yes  |  yes  | Read from filesystem (8 KB limit)                    |
| `vault://mount/path#field`           |  —   |  yes  | HashiCorp Vault KV v2 (`VAULT_ADDR` + `VAULT_TOKEN`) |
| `awssm://secret-id#field`            |  —   |  yes  | AWS Secrets Manager (`AWS_REGION` + credentials)     |
| `platform://name?scope=X&scope_id=Y` |  —   | yes\* | Requires `resolvePlatformSecretRef` callback         |

```ts
import {
  resolveSecretFromRef,
  resolveSecretFromRefAsync,
  resolveSecret,
  createPaymentHandler,
} from "@xapps-platform/server-sdk";

// Sync — env: and file: only
const secret = resolveSecretFromRef("env:MY_PAYMENT_SECRET");

// Async — all schemes including vault:// and awssm://
const secret2 = await resolveSecretFromRefAsync("vault://secret/payment#hmac");

// Async platform:// — provide resolver callback
const secret4 = await resolveSecretFromRefAsync(
  "platform://pay-secret?scope=client&scope_id=CL001",
  {
    resolvePlatformSecretRef: async ({ name, scope, scopeId }) => {
      // Resolve from your API/client/cache as needed
      return process.env.PLATFORM_SECRET_VALUE ?? null;
    },
  },
);

// Convenience: tries secret first, falls back to secretRef
const secret3 = resolveSecret({ secretRef: "env:MY_SECRET", context: "payment" });
```

## Payment handler (`createPaymentHandler`)

The `createPaymentHandler` factory accepts either `secret` (raw string) or
`secretRef` (scheme-prefixed ref). When both are provided, `secret` takes
precedence.

```ts
import { createPaymentHandler } from "@xapps-platform/server-sdk";

const handler = createPaymentHandler({
  secret: process.env.PAYMENT_SECRET || undefined,
  secretRef: process.env.PAYMENT_SECRET_REF || undefined,
  issuer: "tenant",
  returnUrlAllowlist: "https://tenant.example.com",
  gatewayClient,
});
```

> **Note:** `createPaymentHandler` uses the sync resolver internally, so
> `vault://`, `awssm://`, and `platform://` refs must be pre-resolved with
> `resolveSecretFromRefAsync()` and passed as `secret`.

For async `secretRef` schemes, use `createPaymentHandlerAsync(...)`:

```ts
import { createPaymentHandlerAsync } from "@xapps-platform/server-sdk";

const handler = await createPaymentHandlerAsync({
  secretRef: "platform://tenant-payment?scope=client&scope_id=CL001",
  secretRefResolverOptions: {
    resolvePlatformSecretRef: async ({ name }) => process.env.PAYMENT_SECRET ?? null,
  },
  issuer: "tenant",
  returnUrlAllowlist: "https://tenant.example.com",
  gatewayClient,
});
```

## Callback hardening features

- Typed error taxonomy via `XappsServerSdkError` (`code`, `status`, `retryable`)
- Retry policy support:
  - `createCallbackClient({ retry: { maxAttempts, baseDelayMs, maxDelayMs, retryOnStatus } })`
  - Per-call override in `sendEvent(..., { retry })` / `complete(..., { retry })`
- Optional idempotency helper:
  - `idempotencyKeyFactory` at client creation
  - explicit `idempotencyKey` per call
- Strict callback validation for base URL, callback token, request IDs, event type, and completion status

## Payment return helper baseline

- Canonical payment contract helper support for `xapps_payment_orchestration_v1`.
- Query parsing helper for `xapps_payment_*` return params.
- Deterministic signature build/verify helpers with issuer/context checks.
- Verification result reasons aligned to gateway taxonomy (`payment_*`).
- `createGatewayApiClient(...)` supports gateway payment-session APIs (`create/get/complete`) for
  tenant/publisher server-side orchestration.
- `createGatewayApiClient(...)` and `createPublisherApiClient(...)` apply a default 30s request timeout; override with `requestTimeoutMs` (or alias `timeoutMs`) when needed.

## Trigger parity usage notes

- Use `buildSignedPaymentReturnRedirectUrl(...)` to produce a canonical host return URL after checkout.
- Forward that URL consistently across trigger surfaces:
  - widget embed (`xapps_host_return_url`)
  - thread creation (`hostReturnUrl`)
  - installation creation (`hostReturnUrl`)
- Keep the same contract (`xapps_payment_orchestration_v1`) and issuer secret mapping across these flows so guard verification is uniform.
- For multi-method UI, surface `details.accepts[]` and prefer the first supported scheme; `pricing` + `action` remain backward-compatible fallbacks.

## Provider credential bundle helpers

Use SDK helpers to keep provider credential shapes canonical across guard config and session metadata.

```ts
import {
  buildPaymentProviderCredentialRefsByProvider,
  buildPaymentProviderCredentialsBundle,
} from "@xapps-platform/server-sdk";

const guardCredentialRefs = buildPaymentProviderCredentialRefsByProvider({
  stripe: {
    STRIPE_SECRET_KEY: "platform://stripe-secret?scope=client&scope_id=CL001",
    STRIPE_WEBHOOK_SECRET: "platform://stripe-webhook?scope=client&scope_id=CL001",
  },
  paypal: {
    bundle_ref: "platform://payment:gateway:paypal:bundle",
    refs: {
      PAYPAL_CHECKOUT_BASE_URL: "env:PAYPAL_CHECKOUT_BASE_URL",
    },
  },
});
// => assign to payment_guard_definition.payment_provider_credentials_refs

const sessionCredentialBundle = buildPaymentProviderCredentialsBundle({
  refs: {
    COMMON_PROVIDER_TIMEOUT_MS: "env:COMMON_PROVIDER_TIMEOUT_MS",
  },
  bundle_ref: "platform://payment:gateway:common:bundle",
  providers: guardCredentialRefs,
});
// => assign to payment session metadata.payment_provider_credentials
```

Helpers accept:

- flat refs
- `bundle_ref`
- hybrid `bundle_ref` + explicit refs
- nested `refs` for normalization convenience

## Guard blocked forward-compatibility notes

When your backend proxies or logs `GUARD_BLOCKED` payloads, treat `reason` as additive and pass
through `details` without narrowing unknown fields.

Payment-governance reasons currently include:

- `payment_guard_override_not_allowed`
- `payment_guard_pricing_floor_violation`

Payment guard composition provenance is exposed via:

- `details.payment_guard_ref_resolution` (`source`: `consumer_manifest` | `owner_manifest`)

## Unified subject-proof verification surface

- `verifySubjectProofEnvelope(...)`
- `verifyJwsSubjectProof(...)`
- `verifyWebauthnSubjectProof(...)`

Notes:

- These APIs compose `@xapps-platform/publisher-verifier` capabilities.
- You can inject a custom verifier module via `{ verifierModule }` options, or rely on auto-loading when `@xapps-platform/publisher-verifier` is available.

## Notes

- Runtime: Node.js server side.
- Complements host/frontend packages:
  - `@xapps-platform/embed-sdk` forwards browser payment return params.
  - `@xapps-platform/marketplace-ui` can render payment-aware marketplace flows in React hosts.
  - `@xapps-platform/server-sdk` verifies/signs payment evidence and callback contracts server-side.
- Scope is baseline helper primitives; language parity SDKs are tracked in OPEN-014.
- See package/runtime ownership: `docs/guides/12-package-usage-and-ownership.md`.
