/*
Xapps Embed SDK
- Provides a small host-side helper to mount the Catalog embed and handle bridge events
- Delegated rendering: Catalog requests installs/open; host performs privileged actions
*/

export {
  createHostExpandOverlayController,
  type HostExpandOverlayController,
} from "./hostExpandOverlay";
export {
  asRecord,
  mergeGuardResolutionPayload,
  openGuardWidgetOverlay,
  readGuardBlockedPayload,
  type GuardBlockedPayload,
} from "./guardTakeover";

export * from "./sharedTypes";
export * from "./paymentReturn";
export * from "./hostApi";
export * from "./hostUiBridge";
export * from "./embedHost";
export * from "./catalogHost";
