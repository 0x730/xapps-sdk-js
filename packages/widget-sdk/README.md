# `@xapps-platform/widget-sdk`

Browser bridge SDK for publisher widgets running inside Xapps iframes.

## Install

```bash
npm install @xapps-platform/widget-sdk
```

## Exports

- `createBridge` from `@xapps-platform/widget-sdk`
- `useXappsBridge`, `useToolRequest` from `@xapps-platform/widget-sdk/react`
- `XappsAdapter`/`init` from `@xapps-platform/widget-sdk/adapter`

## Minimal usage

```ts
import { createBridge } from "@xapps-platform/widget-sdk";

const bridge = createBridge();
const context = await bridge.getContext();
const tools = await bridge.listTools();
const result = await bridge.createRequest({
  toolName: "example_tool",
  payload: { hello: "world" },
});
const guard = await bridge.requestGuard({
  guardSlug: "platform.confirmation",
  trigger: "before:tool_run",
  context: { requestId: "req_123" },
});
```

## Bridge API Surface

Request lifecycle:

- `createRequest(...)`
- `createMultipartRequest(...)`
- `getRequest(...)`
- `getResponse(...)`
- `getRequestEvents(...)`
- `getRequestArtifacts(...)`
- `attachRequestArtifact(...)`
- `subscribeRequest(...)`
- `unsubscribeRequest(...)`

Upload lifecycle:

- `createUpload(...)`
- `createMultipartUpload(...)`
- `putMultipartUploadPart(...)`
- `listMultipartUploadParts(...)`
- `completeMultipartUpload(...)`
- `getMultipartUpload(...)`

Guard/session/identity:

- `requestGuard(...)`
- `getVendorAssertion(...)`
- `signAction(...)`
- `requestTokenRefresh(...)`
- `getTools(...)` / `listTools(...)`

Bridge listeners:

- `onTokenRefresh(...)`
- `onSessionExpired(...)`
- `onRequestStatusUpdate(...)`
- `onGuardStatus(...)`
- `onExpandResult(...)`
- `onThemeChanged(...)`
- `onFocusRequest(...)`
- `onFocusTrap(...)`

Operational surfaces:

- `openOperationalSurface(...)`

## Expand / Focus / Fullscreen (Widget -> Host)

Widgets can request a larger host-managed presentation mode (for example overlay/focus mode, then fullscreen).

```ts
import { createBridge } from "@xapps-platform/widget-sdk";

const bridge = createBridge();

bridge.onExpandResult((result) => {
  // result.hostManaged, result.stage, result.nativeFullscreen
  console.log("expand result", result);
});

// First step: request focus mode (host overlay if supported).
bridge.requestExpand({
  expanded: true,
  stage: "focus",
  source: "jsonforms",
});

// Optional second step: request fullscreen.
bridge.requestExpand({
  expanded: true,
  stage: "fullscreen",
  source: "jsonforms",
});

// Exit back to inline.
bridge.requestExpand({
  expanded: false,
  stage: "inline",
  source: "jsonforms",
});
```

Notes:

- If the host does not support the expand bridge, widgets should keep a local fallback (inside iframe bounds).
- Host support is documented in `xapps-embed-sdk` and the expansion spec.

## Operational surface opens (Widget -> Host)

Widgets can ask the host to open user-facing operational surfaces for the current xapp context.

```ts
import { createBridge } from "@xapps-platform/widget-sdk";

const bridge = createBridge();

bridge.openOperationalSurface({
  surface: "payments",
  installationId: "inst_123",
  paymentSessionId: "pay_123",
  placement: "in_router",
});
```

Supported surfaces:

- `requests`
- `payments`
- `invoices`
- `notifications`

Optional focused record ids:

- `requestId`
- `paymentSessionId`
- `invoiceId`
- `notificationId`

Placement hints:

- `in_router`
- `side_panel`
- `full_page`

Current platform behavior still defaults to `in_router`. Additional placements are declared now so
hosts can evolve later without changing widget-side API usage.

Publisher-rendered widget shell helper (recommended):

```ts
import { createBridge, createExpandController } from "@xapps-platform/widget-sdk";

const bridge = createBridge();
const expand = createExpandController(bridge, {
  source: "publisher-shell",
  widgetId: "wid_123",
  suggested: { renderer: "publisher", layout: "app" },
});

// Icon-only button: inline -> focus -> fullscreen -> inline
document.getElementById("expandBtn")?.addEventListener("click", () => {
  expand.toggle();
});

expand.onChange((state) => {
  // Hide local overlay chrome while host is managing focus/fullscreen.
  document.body.classList.toggle("host-overlay-active", state.hostManaged && state.expanded);
});
```

## Guard helpers

```ts
import {
  getGuardBlockedDetails,
  getPaymentGuardRefResolution,
  isGuardBlockedError,
  isPaymentGuardGovernanceReason,
} from "@xapps-platform/widget-sdk";

try {
  await bridge.createRequest({ toolName: "generate_report", payload: {} });
} catch (err) {
  if (isGuardBlockedError(err)) {
    const guard = getGuardBlockedDetails(err);
    const refResolution = getPaymentGuardRefResolution(err);
    // guard?.guardSlug, guard?.reason, guard?.action, refResolution?.source
    if (isPaymentGuardGovernanceReason(guard?.reason)) {
      // reason is payment_guard_override_not_allowed or payment_guard_pricing_floor_violation
    }
  }
}
```

## Payment Guard UX Helpers

Use payment helpers so `Pay`/`Submit` state stays correct after replay/consume outcomes:

```ts
import {
  attachPaymentEvidenceToGuardOrchestration,
  resolveGuardPrimaryActionLabel,
  reconcilePaymentEvidenceFromGuardBlocked,
} from "@xapps-platform/widget-sdk";

try {
  await bridge.createRequest({ toolName: "submit_wizard_application", payload });
} catch (err) {
  // Marks current payment evidence as consumed when reason is payment_receipt_already_used.
  reconcilePaymentEvidenceFromGuardBlocked({ error: err });
}

const ctaLabel = resolveGuardPrimaryActionLabel({
  guard: activeGuard,
  submitLabel: "Submit",
  payLabel: "Pay",
});
```

Integration note:

- Host pages should use `@xapps-platform/embed-sdk` payment return helpers (`resolvePaymentReturnContext` preferred) and pass payment params once on resume.
- Widget pages should use `@xapps-platform/widget-sdk` helpers above to avoid stale submit state after replay-rejected evidence.
- `@xapps-platform/marketplace-ui` can carry host/payment context across marketplace routes; widget-sdk remains the widget-side API surface.
- Canonical payment evidence requires `xapps_payment_issuer` to be present in forwarded `xapps_payment_*` params.

## Notes

- Runtime: browser iframe context.
- React hooks are provided via `@xapps-platform/widget-sdk/react`.
- Guard bridge helpers: `requestGuard(...)` and `onGuardStatus(...)`.
- See package/runtime ownership: `docs/guides/12-package-usage-and-ownership.md`.
