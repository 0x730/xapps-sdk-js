# @xapps-platform/backend-kit

Modular Node backend kit for the current Xapps backend contract.

## Install

```bash
npm install @xapps-platform/backend-kit
```

## When to use it

Use `@xapps-platform/backend-kit` when you want a higher-level backend assembly with default routes, payment runtime composition, and override seams.

Use `@xapps-platform/server-sdk` directly only when you need lower-level primitives that the backend kit intentionally does not own.

Current public surface:

- backend composition for the shipped integrator contract

Direction:

- Node and PHP variants should converge on the same backend contract
- actor differences should live in adapters, rights/scope, config, and data access
- not in duplicated platform backend logic

This package sits above:

- `@xapps-platform/server-sdk`

Use it when you want a working backend with default routes, default modes, and
override seams, while keeping the later shared tenant/publisher direction
open. The current shipped reference consumers are still tenant backends, but
the package direction is actor-agnostic where possible.

For request-capable publisher-rendered widgets, use the package layer to
verify browser widget context server-side before exposing private runtime
behavior:

```ts
import {
  evaluateWidgetBootstrapOriginPolicy,
  verifyBrowserWidgetContext,
} from "@xapps-platform/backend-kit";

const originPolicy = evaluateWidgetBootstrapOriginPolicy({
  hostOrigin: request.body?.hostOrigin,
  allowedOrigins: config.widgetBootstrap.allowedOrigins,
});

if (!originPolicy.ok) {
  reply.code(originPolicy.code === "HOST_ORIGIN_REQUIRED" ? 400 : 403).send({
    ok: false,
    error: {
      code: originPolicy.code,
      message: originPolicy.message,
    },
  });
  return;
}

const verified = await verifyBrowserWidgetContext(gatewayClient, {
  hostOrigin: originPolicy.hostOrigin,
  installationId: "inst_123",
  bindToolName: "submit_form",
  subjectId: "sub_123",
  bootstrapTicket: request.body?.bootstrapTicket ?? null,
});
```

Recommended shared local config contract for publisher-rendered bootstrap
routes:

- `widgetBootstrap.allowedOrigins`
- optional app env:
  - `XAPPS_WIDGET_ALLOWED_ORIGINS=https://host.example.test,https://host-b.example.test`

This stays local/app-owned on purpose. The package helper standardizes the
policy behavior without forcing a repo-wide env parser or backend shape.

Recommended request-widget posture:

- treat the widget asset URL as a public/bootstrap shell
- keep request-capable UI blocked until widget context is verified server-side
- do not place private keys, secrets, or durable bearer tokens in `entry.url`
- direct raw browser hits should stay blocked instead of unlocking private runtime

Optional stronger bootstrap transport already supported:

- `widgets[].config.xapps.bootstrap_transport = "signed_ticket"`
- current first slice reuses the short-lived signed widget token as a bootstrap
  ticket and carries it in the iframe URL hash
- browser widget code can forward it to your backend as `bootstrapTicket`
- the backend kit verification passthrough accepts that field without changing
  the current default/public bootstrap contract

This is now a real package, not a placeholder or extraction stub. Keep the
public entry surface stable and split internal package code behind it.

Current package shape:

- TypeScript source in `src/*`
- ESM Node outputs in `dist/*`
- public package exports stay stable while internal modules remain split

## Start Here

Consumer rule:

- import `@xapps-platform/backend-kit`
- import package entry surfaces such as `@xapps-platform/backend-kit/backend/...`
- do not consume raw `src/...` files directly from apps

## Minimal usage

```ts
import { createBackendKit } from "@xapps-platform/backend-kit";

const backendKit = await createBackendKit(
  {
    gateway: { baseUrl: "https://gateway.example.test", apiKey: "gateway_key" },
    host: { allowedOrigins: ["https://tenant.example.test"] },
    payments: { enabledModes: ["gateway_managed"] },
    reference: { hostSurfaces: [{ key: "single-panel", label: "Single Panel" }] },
  },
  deps,
);
```

## What It Gives You

The current package surface provides:

- backend-kit option normalization
- backend-kit composition
- default route surface
- default mode tree
- payment runtime assembly
- higher-level XMS purchase workflow helpers
- host-proxy service assembly
- request-widget bootstrap verification passthrough
- subject-profile sourcing hooks

Internal package structure is intentionally modular:

- `src/index.ts`
  thin public facade
- `src/backend/options.ts`
  option normalization and config shaping
- `src/backend/paymentRuntime.ts`
  payment runtime assembly and payment-page API helpers
- `src/backend/xms.ts`
  higher-level XMS purchase workflow helpers on top of the server SDK
- `src/backend/modules.ts`
  backend module composition
- `src/backend/modes/*`
  explicit default mode tree
- `src/backend/routes/*`
  explicit default route tree

Current route surface includes:

- health
- reference
- host core
- lifecycle
- current-user host monetization lifecycle under `/api/my-xapps/:xappId/...`
  - includes `/api/my-xapps/:xappId/monetization/history` for recent current-user XMS audit buckets
- bridge
- payment
- guard
- subject profiles

Current workflow helpers also include:

- `normalizeXappMonetizationScopeKind(...)`
  normalizes subject / installation / realm scope selection
- `resolveXappMonetizationScope(...)`
  resolves scope fields from runtime context plus optional realm reference
- `resolveXappHostedPaymentDefinition(...)`
  resolves a manifest payment definition into hosted session config, including delegated signing metadata
- `listXappHostedPaymentPresets(...)`
  shapes manifest payment definitions into generic hosted-lane preset options for UI selectors
- `findXappHostedPaymentPreset(...)`
  looks up one hosted-lane preset by `paymentGuardRef`
- `readXappMonetizationSnapshot(...)`
  reads the common app-facing XMS state bundle: access, current subscription, entitlements, and wallet accounts
- `buildXappMonetizationReferenceSummary(...)`
  interprets the current-user XMS snapshot plus projected paywall packages into:
  - primary recurring membership
  - owned additive unlocks
  - available additive unlocks
  - recurring options
  - credit top-ups
  - blocked packages
- host-mounted plans surfaces can now also consume the recent current-user history bundle exposed through:
  - `/api/my-xapps/:xappId/monetization/history`
  - portal `/v1/me/xapps/:xappId/monetization/history`
  - embed `/embed/my-xapps/:xappId/monetization/history`
- `consumeXappWalletCredits(...)`
  consumes credits from one wallet account through the XMS API and returns the updated wallet, ledger entry, and refreshed access projection
- `startXappHostedPurchase(...)`
  prepares a purchase intent and creates the lane-bootstrapped gateway payment session
- `finalizeXappHostedPurchase(...)`
  finalizes a hosted purchase through the platform finalize endpoint, returning reconciliation and issued access state
- `activateXappPurchaseReference(...)`
  prepares a purchase intent, creates a verified reference transaction, and issues access

For hosted-integrator mode, the host API surface can also enforce explicit
frontend-origin allowlists through `host.allowedOrigins`. Leave it empty for
same-origin consumers; set it when the browser host runs on another domain and
must call the tenant backend cross-origin. In practice that allowlist covers
the browser-facing host API surface, including:

- `/api/host-config`
- `/api/resolve-subject`
- `/api/create-catalog-session`
- `/api/create-widget-session`
- `/api/widget-tool-request`
- lifecycle routes under `/api/install*`
- current-user XMS host routes under `/api/my-xapps/:xappId/...`
- bridge routes under `/api/bridge/*`

For the secure long-term hosted-integrator path, use a short-lived bootstrap
token instead of trusting browser subject input:

- integrator backend calls `POST /api/host-bootstrap`
- tenant backend authenticates with `X-API-Key`
- tenant backend resolves the subject through the gateway/host proxy
- tenant backend returns a short-lived `bootstrapToken`
- browser host sends that token in `X-Xapps-Host-Bootstrap`

In the current design, the tenant backend signs that bootstrap token locally.
The gateway participates in subject resolution, but does not issue the browser
bootstrap token itself.

That token should be treated as temporary bootstrap state. After expiry, the
frontend should re-run bootstrap instead of trying to continue on stored
`subjectId` alone.

Recommended host config for that mode:

- `host.allowedOrigins`
- `host.bootstrap.apiKeys`
- `host.bootstrap.signingSecret`
- optional `host.bootstrap.ttlSeconds`

Current default mode tree includes:

- `gateway_managed`
- `tenant_delegated`
- `publisher_delegated`
- `owner_managed`

For `owner_managed`, the packaged default can run tenant-owned or
publisher-owned. Use `payments.ownerIssuer` when the backend should default the
owner-managed lane to `publisher` instead of `tenant` when the guard config
does not narrow the issuer explicitly.

If the owner-managed payment page redirects back to an integrator frontend on a
different domain, include that frontend origin in the payment return URL
allowlist as well.

## What Should Stay Local

A consuming app should still keep these local when they are actor-specific:

- startup and env/config mapping
- branding and host pages/assets
- actor-specific subject-profile catalogs or resolver hooks
- explicit mode or route overrides

## Recommended Consumer Structure

Start small and keep local ownership obvious.

```text
tenant-backend/
  server.js
  lib/
    config.js
    appSurfaceModule.js
    subjectProfiles/defaultProfiles.js
  routes/
    host.js
    host/
      pages.js
      shared.js
  modes/
    index.js
    */README.md
  public/
    branding-assets...
```

Recommended override order:

1. backend-kit options
2. local branding/assets and subject-profile data
3. injected services or resolver hooks
4. explicit route or mode overrides

Do not copy package default route implementations into the app just to mirror
the package layout.

## When To Drop Lower

Use `@xapps-platform/server-sdk` directly only when the consumer needs a lower-level
seam that the backend kit intentionally does not own.

## Rule

Do not add route-level wrapper aliases here.

Keep the public surface:

- module oriented
- config driven
- hook based

Keep internals:

- explicit
- modular
- safe to refactor behind the stable entry surface

Node and PHP should keep the same backend behavior in the end. Differences
should be runtime-adapter concerns, not separate platform feature lines.

## Verify locally

```bash
npm run build --workspace packages/backend-kit
npm run smoke --workspace packages/backend-kit
```
