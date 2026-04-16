# `@xapps-platform/embed-sdk`

Low-level browser host/embed primitives for Xapps catalog, widget, and payment-resume flows.

## Install

```bash
npm install @xapps-platform/embed-sdk
```

## Status

Host-facing browser SDK package in this repo (`packages/xapps-embed-sdk/src/index.ts`).
Current platform runtime also serves the built browser artifacts through `/embed/sdk/*`, and the same surface is now published as `@xapps-platform/embed-sdk`.

## Build output

- `dist/sdk/xapps-embed-sdk.esm.js`
- `dist/sdk/xapps-embed-sdk.umd.js`

Built by `scripts/build/build-embed-sdk.mjs`.

Package metadata:

- package name: `@xapps-platform/embed-sdk`
- ESM export: `dist/xapps-embed-sdk.esm.js`
- UMD export: `dist/xapps-embed-sdk.umd.js`

## Purpose

- Catalog/widget iframe host orchestration
- Bridge event forwarding and lifecycle handling
- Token refresh / signing / vendor assertion callback wiring hooks
- Payment return/resume helper primitives for tenant checkout orchestration
- Widget-driven operational surface opens for marketplace/embed flows

For the current XMS plans, balances, paywalls, and hosted-purchase reader path, read:

- [docs/specifications/xms/README.md](/home/dacrise/x/xapps/docs/specifications/xms/README.md)

## Relation To `@xapps-platform/browser-host`

`@xapps-platform/embed-sdk` is the low-level browser SDK.

It owns:

- iframe catalog/widget orchestration
- bridge and host UI helpers
- payment resume helpers
- owner-managed payment-page helpers

`@xapps-platform/browser-host` sits above it and composes those primitives into the standard marketplace and single-xapp host flow.

Use:

- `@xapps-platform/embed-sdk` when you need low-level browser primitives or a custom host shape
- `@xapps-platform/browser-host` when you want the standard host bootstrap/runtime path and only need local pages, branding, and small callbacks

Hosted-integrator note:

- same-origin `/api/*` remains the default
- low-level consumers can override host API and bridge-v2 endpoints explicitly
- `@xapps-platform/browser-host` now derives those remote endpoints from `backendBaseUrl` for the standard host flow

## Integrator page requirements

Minimum page requirements:

- one catalog mount element for `createHost({ container })`
- optional widget mount element if using split panel mode (`widgetMount.container`)
- script execution after mount elements are available

No fixed DOM contract is required for:

- toasts
- modal markup
- custom controls

`createHostConfirmDialog()` injects its own dialog DOM.

`createHostUiBridge(...)` is callback-driven, so host UI component choices remain integrator-defined.

## Minimal usage

```ts
import {
  parsePaymentReturnFromSearch,
  stripPaymentReturnParamsFromUrl,
} from "@xapps-platform/embed-sdk";

const payment = parsePaymentReturnFromSearch(window.location.search);
if (payment) {
  const cleanUrl = stripPaymentReturnParamsFromUrl(window.location.href);
  history.replaceState({}, "", cleanUrl);
}
```

## Payment Return Helpers

Use these helpers in host pages to keep payment return handling deterministic and avoid stale URL evidence reuse:

- `parsePaymentReturnFromSearch(search)` -> payment evidence + `xapps_resume` token state.
- `parsePaymentResumeFromSearch(search)` -> typed resume route (`installationId`, `widgetId`, `xappId`, `toolName`, `returnUrl`).
- `stripPaymentReturnParamsFromUrl(urlLike)` -> removes `xapps_payment_*` (+ `xapps_resume` by default).
- `resolvePaymentReturnContext(urlLike)` -> one-shot resolver returning:
  - `resume`
  - `paymentParams`
  - `cleanedUrl`
  - `buildHostReturnUrl(...)` helper

Required return param note:

- Canonical payment evidence requires `xapps_payment_issuer` in returned query params.

Minimal host pattern:

```ts
import { resolvePaymentReturnContext } from "/embed/sdk/xapps-embed-sdk.esm.js";

const payment = resolvePaymentReturnContext(window.location.href);
if (payment.cleanedUrl !== window.location.href) {
  const next = new URL(payment.cleanedUrl);
  history.replaceState({}, "", next.pathname + next.search + next.hash);
}

const hostReturnUrl = payment.buildHostReturnUrl({
  baseUrl: window.location.href,
});
const resume = payment.resume;
```

## Owner-Managed Payment Page Helper

Use `createOwnerManagedPaymentPageController(urlLike)` in owner-managed tenant/publisher payment pages to avoid cloning:

- return URL resolution
- cancel URL resolution
- `xapps_payment_*` forwarding back to the calling widget/host page

Recommended pattern:

```ts
import { createOwnerManagedPaymentPageController } from "/embed/sdk/xapps-embed-sdk.esm.js";

const controller = createOwnerManagedPaymentPageController(window.location.href);
if (controller.hasReturnedPaymentEvidence) {
  controller.redirectReturnedPaymentToHost();
}

const returnUrl = controller.resolveReturnUrl(session);
const cancelUrl = controller.resolveCancelUrl({ session, referrer: document.referrer });
```

Owner-managed payment pages should serve the ESM bundle from the same origin as the page itself, for example:

- `/embed/sdk/xapps-embed-sdk.esm.js`

Canonical starter/reference:

- `packages/xapps-embed-sdk/examples/payment-page/owner-managed-payment-page-starter.html`
- `docs/guides/23-owner-managed-payment-page-starter.md`

## Host Boilerplate Helpers

Use these helpers to remove repeated host page logic:

- `resolveGatewayBaseUrl(options?)`:
  - resolves host gateway base URL with override + storage + `:3000` default-port inference.
- `createHostApiClient(options?)`:
  - standardized host API calls with timeout, normalized JSON/text errors, and retryability metadata.
- `createHostPaymentResumeState(urlLike, options?)`:
  - one-time payment evidence/resume lifecycle (`getPendingPaymentParams`, `consumePaymentParams`, `getResume`, `consumeResume`) and URL cleanup support.

## Enterprise Host Composition

The intended enterprise split is:

- `@xapps-platform/server-sdk`
  - server-side privileged gateway work
  - subject resolution
  - catalog/widget session minting
  - optional installation lifecycle routes
- `xapps-embed-sdk`
  - low-level browser host/runtime primitives
  - bridge handling
  - overlay and host UI handling
  - payment resume handling
- `@xapps-platform/browser-host`
  - standard marketplace host bootstrap
  - standard single-xapp bootstrap
  - reference runtime/theme helpers
  - shared host proof/status panel rendering
- tenant/integrator host app
  - branding
  - identity bootstrap
  - optional override hooks

Integrators should not rebuild the host orchestration from scratch. The recommended browser-side path is:

- `createEmbedHost(...)` for low-level host composition
- `createStandardMarketplaceRuntime(...)` for the standard single-panel / split-panel marketplace host flow
- `createHostDomUiController(...)` for toast/modal/confirm DOM wiring

`apps/tenants/xconect/host/*` is now a consumer of these helpers, not the target shape third parties should copy line-by-line.

## Verify locally

```bash
npm run build --workspace packages/xapps-embed-sdk
npm run smoke --workspace packages/xapps-embed-sdk
```

## Standard Marketplace Runtime

Use `createStandardMarketplaceRuntime(...)` when the host wants the standard marketplace flow and only needs to provide mounts, theme, and small overrides.

It owns:

- single-panel catalog runtime
- split-panel catalog + widget runtime
- marketplace mutation failure handling
- split-panel widget context tracking
- payment resume reopen flow

Minimal shape:

```ts
import {
  createHostDomUiController,
  createHostPaymentResumeState,
  createStandardMarketplaceRuntime,
} from "/embed/sdk/xapps-embed-sdk.esm.js";

const hostUi = createHostDomUiController({
  toastRootId: "toast-root",
  modalBackdropId: "host-modal",
  modalTitleId: "host-modal-title",
  modalMessageId: "host-modal-message",
  modalCloseId: "host-modal-close",
});

const runtime = createStandardMarketplaceRuntime({
  baseUrl: "http://localhost:3000",
  subjectId,
  apiBasePath: "/api",
  paymentResumeState: createHostPaymentResumeState(window.location.href, {
    autoCleanUrl: true,
  }),
  hostUi,
  getCatalogMount: () => document.getElementById("catalog"),
  getWidgetMount: () => document.getElementById("widget"),
  singlePanel: {
    resumeDelayMs: 220,
  },
  splitPanel: {
    setWidgetPlaceholder: (title, message) => {
      const node = document.getElementById("widget");
      if (node) node.textContent = `${title} ${message}`.trim();
    },
  },
});

await runtime.mount("single-panel");
```

This helper is the current best-fit contract for Node/PHP tenant hosts that want marketplace embedding without rebuilding the orchestration layer.

Starter/reference:

- `packages/xapps-embed-sdk/examples/runtime-minimal/index.html`
- `packages/xapps-embed-sdk/examples/marketplace-host-starter/index.html`
  - split starter shape:
    - `main.js`
    - `runtime.js`
    - `shell.js`
- examples overview:
  - `packages/xapps-embed-sdk/examples/README.md`

Recommended starter interpretation:

- `runtime-minimal`
  - smallest possible runtime smoke
  - use it to understand the API surface
- `marketplace-host-starter`
  - recommended third-party starting point
  - use it when you want a real host page shape

Inside `marketplace-host-starter`:

- `main.js`
  - entry/bootstrap only
- `runtime.js`
  - shared browser runtime configuration
- `shell.js`
  - local branding and page chrome

This is also the intended split for real tenant hosts such as `xconect`.

## DOM Host UI Helper

Use `createHostDomUiController(...)` when the host already has DOM elements for:

- toast root
- modal backdrop/title/message/close button

It returns:

- `bridgeOptions`
  - pass directly into `createHostUiBridge(...)` or `createEmbedHost(...)`
- `showNotification(...)`
- `showAlert(...)`
- `openModal(...)`
- `closeModal(...)`
- `destroy()`

This removes repeated host-page toast/modal plumbing while still letting the integrator bring their own DOM and design system.

## Widget Context / Split-Panel Helpers

For hosts that need finer control than `createStandardMarketplaceRuntime(...)`, the package now also exposes:

- `createEmbedHostWidgetContext(...)`
- `createMutationFailureCallbacks(...)`
- `createSplitPanelCatalogEventHandler(...)`
- `createSplitPanelMutationCallbacks(...)`

These are lower-level composition primitives for hosts that need custom split-panel lifecycle behavior without dropping back to fully manual wiring.

Practical rule:

- start at `createStandardMarketplaceRuntime(...)`
- drop to `createEmbedHost(...)` only when the host shape is genuinely narrower or more custom
- do not rebuild host bridge, overlay, payment resume, or mutation plumbing directly in tenant pages

## Bridge V2 Handler Helper

Use `createBridgeV2ApiHandlers(...)` to avoid duplicating token-refresh/sign/vendor-assertion/session-expiry plumbing per page.

```ts
import { createBridgeV2ApiHandlers } from "/embed/sdk/xapps-embed-sdk.esm.js";

const bridgeV2 = createBridgeV2ApiHandlers({
  callApi: (path, payload) =>
    fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    }).then((r) => r.json()),
  getWidgetContext: () => ({ installationId, widgetId }),
  getSubjectId: () => subjectId,
  getPortalToken: () => portalToken,
  getHostOrigin: () => window.location.origin,
  getHostReturnUrl: () => window.location.href,
  clearSession: () => {
    localStorage.removeItem("integration_host_bridge_session_token");
  },
});
```

Default bridge-v2 endpoints stay same-origin:

- `/api/bridge/token-refresh`
- `/api/bridge/sign`
- `/api/bridge/vendor-assertion`

Cross-domain or custom host consumers can override those endpoints through:

- `createBridgeV2ApiHandlers({ endpoints: ... })`
- `createEmbedHost({ bridgeV2: { endpoints } })`
- `createStandardMarketplaceRuntime({ bridgeV2: { endpoints } })`

## Marketplace Mutation Helper

Use `createMarketplaceMutationEventHandler(...)` to standardize install/update/uninstall event handling:

```ts
import { createMarketplaceMutationEventHandler } from "/embed/sdk/xapps-embed-sdk.esm.js";

const handleMarketplaceMutations = createMarketplaceMutationEventHandler({
  getHost: () => host,
  getSubjectId: () => subjectId,
  callApi: (path, payload) =>
    fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    }).then((r) => r.json()),
  endpoints: {
    install: "/api/install",
    update: "/api/update",
    uninstall: "/api/uninstall",
  },
});

const host = createHost({
  // ...
  onEvent: async (evt) => {
    if (await handleMarketplaceMutations(evt)) return;
    if (evt.type === "XAPPS_OPEN_WIDGET") currentWidgetContext = evt.data;
  },
});
```

Behavior:

- Emits standardized success/failure events back to catalog.
- Supports install-time default widget open.
- If install is blocked with `GUARD_BLOCKED + action.kind = "open_guard"` and the payload includes
  `details.guard_ui`, the helper now opens the internal guard widget, waits for the returned retry
  payload, and retries the install call automatically.
- Supports callback hooks for page-specific side-effects.
- Leaves `XAPPS_OPEN_WIDGET` to host default lifecycle (no duplicate open calls).

`XappsHost.openWidget(...)` uses the same guard-widget takeover path for blocked
`before:session_open` widget opens: if `/v1/widget-sessions` returns
`GUARD_BLOCKED + details.guard_ui`, the host opens the internal guard widget, waits for the
returned payload, and retries the original widget-session mint.

The guard-takeover primitives (`readGuardBlockedPayload`, `openGuardWidgetOverlay`, payload merge)
now live in the shared embed-sdk package code so other host surfaces in the monorepo, including
portal, can reuse the same orchestration semantics instead of maintaining a separate variant.

## Host UI Bridge Helper

Use `createHostUiBridge(...)` to standardize host-side UI event handling (`XAPPS_UI_*`) and `window.XappsHost` exposure:

```ts
import { createHostConfirmDialog, createHostUiBridge } from "/embed/sdk/xapps-embed-sdk.esm.js";

const confirmDialog = createHostConfirmDialog();
const hostUiBridge = createHostUiBridge({
  getContext: () => ({ installationId, widgetId, devMode: false }),
  showNotification: (message, variant) => toast(message, variant),
  showAlert: (message, title) => alert(`${title || "Alert"}\n\n${message}`),
  openModal: (title, message) => modal.open(title, message),
  closeModal: () => modal.close(),
  navigate: (path) => navigate(path),
  refresh: () => window.location.reload(),
  updateState: (patch) => setState(patch),
  confirmDialog: ({ title, message, confirmLabel, cancelLabel }) =>
    confirmDialog({ title, message, confirmLabel, cancelLabel }),
});

window.addEventListener("beforeunload", () => hostUiBridge.detach());
```

Behavior:

- Handles `XAPPS_UI_NOTIFICATION|ALERT|MODAL_OPEN|MODAL_CLOSE|NAVIGATE|REFRESH|STATE_UPDATE|GET_CONTEXT|CONFIRM_REQUEST`.
- Exposes `window.XappsHost` by default.
- Returns a controller with `detach()` for cleanup.

Operational surface support:

- `XAPPS_OPEN_OPERATIONAL_SURFACE`
- Supported surfaces:
  - `requests`
  - `payments`
  - `invoices`
  - `notifications`
- Optional focused record ids:
  - `requestId`
  - `paymentSessionId`
  - `invoiceId`
  - `notificationId`
- Optional placement hint:
  - `in_router`
  - `side_panel`
  - `full_page`

Current default behavior remains `in_router`. Additional placements are declared now so hosts can
evolve later without changing the widget-side API.

Minimal callback example:

```ts
const hostUiBridge = createHostUiBridge({
  getContext: () => ({ installationId, widgetId, devMode: false }),
  openOperationalSurface: (input) => {
    const next = new URL(window.location.href);
    next.searchParams.set("surface", input.surface);
    if (input.installationId) next.searchParams.set("installationId", input.installationId);
    if (input.paymentSessionId) next.searchParams.set("paymentSessionId", input.paymentSessionId);
    if (input.invoiceId) next.searchParams.set("invoiceId", input.invoiceId);
    if (input.notificationId) next.searchParams.set("notificationId", input.notificationId);
    window.location.assign(next.toString());
  },
});
```

## Expand / Focus / Fullscreen Bridge

`createHostUiBridge(...)` also supports widget expand requests so hosts can provide a real overlay/fullscreen experience outside iframe bounds.

Widget -> host:

- `XAPPS_UI_EXPAND_REQUEST` (`stage`: `inline` | `focus` | `fullscreen`)

Host -> widget:

- `XAPPS_UI_EXPAND_RESULT` (`hostManaged`, `expanded`, `stage`, optional `nativeFullscreen`)

Minimal host callback example:

```ts
import { createHostUiBridge, type HostUiExpandResult } from "/embed/sdk/xapps-embed-sdk.esm.js";

let overlayStage: "inline" | "focus" | "fullscreen" = "inline";

const hostUiBridge = createHostUiBridge({
  expandWidget: async (input, event): Promise<HostUiExpandResult> => {
    overlayStage = input.stage || (input.expanded ? "focus" : "inline");
    renderOverlayForIframe(event.source as Window | null, overlayStage);
    return {
      hostManaged: true,
      expanded: overlayStage !== "inline",
      stage: overlayStage,
    };
  },
});
```

Host requirements:

- keep the same iframe instance during expand/collapse when possible
- send `XAPPS_UI_EXPAND_RESULT` so widget UI state stays in sync
- allow fullscreen on iframe (`allowfullscreen`, `allow="fullscreen; ..."`) if you want native fullscreen

See `docs/specifications/expansions/05-widget-host-expand-focus-fullscreen-bridge.md`.

### Reusable Host Overlay Controller (Recommended)

For tenant/integrator hosts that want a production-ready overlay implementation (focus/fullscreen/close, nested bridge support, same-iframe preservation), use the exported helper instead of copying page-local scripts:

```ts
import {
  createHostExpandOverlayController,
  createHostUiBridge,
} from "/embed/sdk/xapps-embed-sdk.esm.js";

const hostExpandOverlay = createHostExpandOverlayController();
const hostUiBridge = createHostUiBridge({
  expandWidget: (input, event) => hostExpandOverlay.handleExpandRequest(input, event),
});

window.addEventListener("beforeunload", () => {
  hostUiBridge.detach();
  hostExpandOverlay.destroy();
});
```

Notes:

- Supports `focus` / `fullscreen` / `inline` with `XAPPS_UI_EXPAND_REQUEST/RESULT`
- Includes nested bridge handling (`XAPPS_UI_NESTED_EXPAND_REQUEST/RESULT`) for embedded Marketplace-in-host topologies
- Keeps iframe instances in place where possible to avoid widget/session reloads
- Integrators should still enforce strict `event.origin` / `event.source` allowlists in production host pages

React host example (with origin allowlist):

```tsx
import { useEffect, useRef } from "react";
import {
  createHostExpandOverlayController,
  createHostUiBridge,
} from "/embed/sdk/xapps-embed-sdk.esm.js";

export function WidgetHostBridge() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const overlay = createHostExpandOverlayController();
    const allowedOrigins = new Set([window.location.origin]);
    const hostUiBridge = createHostUiBridge({
      allowMessage: (event) => {
        if (!allowedOrigins.has(event.origin)) return false;
        return event.source === iframeRef.current?.contentWindow;
      },
      expandWidget: (input, event) => overlay.handleExpandRequest(input, event),
    });

    return () => {
      hostUiBridge.detach();
      overlay.destroy();
    };
  }, []);

  return <iframe ref={iframeRef} title="Widget" allow="fullscreen" />;
}
```

## Host Bootstrap Composition (Documentation Baseline)

Use this composition pattern to standardize host page wiring without adding a new runtime helper:

```ts
import {
  createBridgeV2ApiHandlers,
  createHost,
  createHostApiClient,
  createHostPaymentResumeState,
  createHostUiBridge,
  resolveGatewayBaseUrl,
} from "/embed/sdk/xapps-embed-sdk.esm.js";

const baseUrl = resolveGatewayBaseUrl({ fallback: "http://localhost:3000" });
const api = createHostApiClient({ baseUrl, timeoutMs: 15000 });
const payment = createHostPaymentResumeState(window.location.href);
const hostUiBridge = createHostUiBridge({ getContext: () => ({ installationId, widgetId }) });
const bridgeV2 = createBridgeV2ApiHandlers({
  callApi: (path, payload) => api(path, payload),
  getWidgetContext: () => ({ installationId, widgetId }),
  getHostReturnUrl: () => payment.buildHostReturnUrl({ baseUrl: window.location.href }),
  clearSession: () => localStorage.removeItem("integration_host_bridge_session_token"),
});

const host = createHost({
  container,
  baseUrl,
  hostApi: {
    createCatalogSessionUrl: "/api/create-catalog-session",
    createWidgetSessionUrl: "/api/create-widget-session",
  },
  bridgeV2,
  embedContext: {
    getHostReturnUrl: () => payment.buildHostReturnUrl({ baseUrl: window.location.href }),
    getPaymentParams: () => payment.consumePaymentParams(),
  },
});

window.addEventListener("beforeunload", () => hostUiBridge.detach());
```

Notes:

- `createHostPaymentResumeState(...)` gives one-time payment evidence consumption.
- `embedContext.getPaymentParams()` should not return persistent query params repeatedly.
- Keep this bootstrap structure consistent across all host pages.

## Additive Host Context Helper (`embedContext`)

`createHost(...)` supports an additive `embedContext` option so integrators do not hand-wire `xapps_host_return_url` and payment params per page:

```ts
const payment = resolvePaymentReturnContext(window.location.href);

const host = createHost({
  container,
  baseUrl,
  hostApi: {
    createCatalogSessionUrl: "/api/create-catalog-session",
    createWidgetSessionUrl: "/api/create-widget-session",
  },
  embedContext: {
    getHostReturnUrl: () =>
      payment.buildHostReturnUrl({
        baseUrl: window.location.href,
        paymentParams: payment.paymentParams,
      }),
    getPaymentParams: () => payment.paymentParams,
  },
});
```

Behavior:

- Catalog/widget URLs automatically receive `xapps_host_return_url`.
- `xapps_payment_*` keys are auto-forwarded when present.
- Existing hosts are unchanged if `embedContext` is omitted.

## Notes

- Consumers typically load built artifacts from `/embed/sdk/*` endpoints.
- Current baseline contract: gateway-served artifacts are the supported integration path.
- `@xapps-platform/marketplace-ui` can use these host-side primitives and now includes xapp-scoped
  `requests`, `payments`, `invoices`, and `notifications` surfaces in addition to catalog, detail,
  and widget routes, but embed-sdk is also valid for non-React/static hosts.
- `@xapps-platform/widget-sdk` remains widget-iframe runtime API; embed-sdk remains host-side transport/orchestration.
- Distribution policy:
  - `Option A (Current default)`: artifact-first distribution (`dist/sdk/*`) served by gateway embed routes.
  - `Option B (Formalized)`: npm package distribution (`xapps-embed-sdk`) with semver contract and release policy.
- Package metadata/pipeline:
  - `packages/xapps-embed-sdk/package.json`
  - `scripts/prepare/prepare-embed-sdk-package.mjs` (prepack artifact copy into package `dist/`)
- Semver baseline:
  - additive-only changes in current minor track
  - breaking changes only via major version + migration notes
