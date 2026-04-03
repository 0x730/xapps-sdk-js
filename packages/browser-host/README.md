# `@xapps-platform/browser-host`

Browser-side host/runtime helpers for marketplace and single-xapp reference surfaces.

## Install

```bash
npm install @xapps-platform/browser-host
```

## When to use it

Use `@xapps-platform/browser-host` when you want the standard browser host/runtime shape:

- marketplace bootstrap
- single-xapp bootstrap
- host shell and status helpers
- standard backend-base and bridge endpoint resolution
- shared browser-side XMS/paywall helpers for host apps

Use `@xapps-platform/embed-sdk` instead when you want lower-level iframe/bridge/payment-resume primitives and intend to build a more custom browser host.

## Purpose

This package owns the shared browser host logic that should not live in tenant or publisher apps:

- marketplace bootstrap
- single-xapp bootstrap
- host shell helpers
- marketplace runtime wiring
- reference-theme/runtime helpers
- host proof/status panel rendering
- browser-side XMS catalog flattening, scope defaults, and feature-paywall helpers
- browser-side XMS snapshot summarization for shared access/subscription/wallet presentation
- browser-side XMS offering/package presentation helpers for local paywalls and catalog UIs
- browser-side XMS feature-paywall copy helpers for local app wrappers

Local apps should keep:

- branding and copy
- page HTML/CSS
- identity bootstrap storage keys
- actor-specific config and small callbacks

## Current role

`xconect`, `xconectb`, and the local launcher/host surfaces inside `xconectc`
now serve these package build outputs through `/host/*`.

The package is intended to become the shared host layer for later publisher
consumers too, with actor differences handled by config, rights, accessible
data, and local UI.

Current package shape:

- TypeScript source in `src/*`
- ESM browser outputs in `dist/*`
- local tenant/publisher apps keep only thin wrappers and page assets

Entry points:

- `@xapps-platform/browser-host`
- `@xapps-platform/browser-host/backend-base`
- `@xapps-platform/browser-host/host-shell`
- `@xapps-platform/browser-host/marketplace-runtime`
- `@xapps-platform/browser-host/reference-runtime`
- `@xapps-platform/browser-host/marketplace-host`
- `@xapps-platform/browser-host/single-xapp-host`
- `@xapps-platform/browser-host/host-status`
- `@xapps-platform/browser-host/xms`

## Backend Location

Default behavior stays same-origin:

- host config from `/api/host-config`
- host mutation/session routes under `/api`

For hosted-integrator mode, consumers can point the host contract at a
different backend origin without changing the browser-host runtime shape:

- `backendBaseUrl`
  - derives `hostConfigPath` as `${backendBaseUrl}/api/host-config`
  - derives `apiBasePath` as `${backendBaseUrl}/api`
  - derives bridge-v2 endpoints under `${backendBaseUrl}/api/bridge/*`
- or override `hostConfigPath` / `apiBasePath` explicitly

Backend-hosted frontend integrations should also make the tenant backend
explicitly allow the frontend origin on the host API surface. Same-origin
consumers can leave this unset; hosted-integrator consumers should set the
backend-kit `host.allowedOrigins` list.

For secure hosted-integrator bootstrap, do not put raw platform API keys in the
browser. Have the integrator backend obtain a short-lived bootstrap token from
the tenant backend, then pass that token into the browser host identity state.
When present, `@xapps-platform/browser-host` forwards it automatically in
`X-Xapps-Host-Bootstrap` for the standard host/session routes.

That bootstrap token is intentionally short-lived. Consumers should treat it as
session bootstrap state, not durable identity storage, and re-bootstrap when it
expires.

When the host should return to a launcher page instead of `/`, set `entryHref`
in the local wrapper config. This is the supported seam for same-origin tenant
launchers such as `xconectc /catalog`, where the launcher resolves the subject
first and the shared host surfaces should redirect back to that launcher after
expiry or missing identity.

When the host owns locale selection, pass `locale` in the local wrapper config.
The shared browser-host/embed runtime now seeds that locale into widget context
and exposes reactive locale updates through the shared `XAPPS_LOCALE_CHANGED`
bridge path.

For testing, the current tenant/reference hosts now expose this through launcher
and header language selectors, and the same local seam can also be driven with
`?locale=en` or `?locale=ro` on the host page URL.

The package is intentionally actor-agnostic:

- no tenant sample data
- no publisher sample data
- no actor-specific rights logic

Those concerns stay in local config, backend APIs, and later actor adapters.

## Minimal usage

```ts
import {
  buildFeaturePaywallCopyModel,
  buildMonetizationPackagePresentation,
  flattenXappMonetizationCatalog,
  getDefaultXappMonetizationScopeKind,
  resolveBackendBaseUrl,
  resolveBridgeEndpoints,
  resolveHostConfigUrl,
  summarizeXappMonetizationSnapshot,
} from "@xapps-platform/browser-host";

const backendBaseUrl = resolveBackendBaseUrl({
  backendBaseUrl: "https://tenant.example.test/",
});
const hostConfigUrl = resolveHostConfigUrl({ backendBaseUrl });
const endpoints = resolveBridgeEndpoints({ backendBaseUrl });
const defaultScope = getDefaultXappMonetizationScopeKind({
  context: { subject_id: "sub_123" },
});
const packageCards = flattenXappMonetizationCatalog([]);
const packagePresentation = buildMonetizationPackagePresentation(packageCards[0]);
const paywallCopy = buildFeaturePaywallCopyModel({
  feature: { title: "Premium export", requirements: { credits: 50 } },
  snapshotSummary: { wallet: { creditsRemaining: "10" } },
});
const snapshotSummary = summarizeXappMonetizationSnapshot({
  access_projection: { has_current_access: true, credits_remaining: "500" },
});
```

## Verify locally

```bash
npm run build --workspace packages/browser-host
npm run smoke --workspace packages/browser-host
```
