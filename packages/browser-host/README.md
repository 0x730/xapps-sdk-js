# `@xapps-platform/browser-host`

Browser SDK for catalog and single-xapp embedding.

## Install

```bash
npm install @xapps-platform/browser-host
```

## When to use it

Use `@xapps-platform/browser-host` when you want the standard browser SDK path:

- bootstrap a browser embed session
- mount the full catalog
- mount a single xapp directly
- propagate locale, theme, payment resume, and host return behavior
- use shared browser-side XMS and subject-profile helpers

Use `@xapps-platform/embed-sdk` instead only when you need lower-level iframe,
bridge, or payment-resume primitives and are intentionally building a more
custom browser runtime.

For the current XMS reader path, including plans, balances, paywalls, history, and virtual currencies, read:

- [docs/specifications/xms/README.md](/home/dacrise/x/xapps/docs/specifications/xms/README.md)

## Purpose

This package owns the browser SDK logic that should not live in tenant or
integrator apps:

- session bootstrap and browser identity state
- catalog and single-xapp mounting
- backend base-path and bridge endpoint resolution
- locale, theme, payment resume, and host return plumbing
- browser-side XMS and subject-profile helpers

Local apps should keep:

- branding and copy
- page HTML/CSS
- small configuration objects and callbacks
- optional custom shell UI

## Public SDK surface

Supported package entrypoints:

- `@xapps-platform/browser-host`
- `@xapps-platform/browser-host/backend-base`
- `@xapps-platform/browser-host/launcher-core`
- `@xapps-platform/browser-host/embed-surface`
- `@xapps-platform/browser-host/standard-runtime`
- `@xapps-platform/browser-host/subject-profile`
- `@xapps-platform/browser-host/modal-shell`
- `@xapps-platform/browser-host/xms`
- `@xapps-platform/browser-host/xms-copy`

The root entrypoint is the browser SDK. Use it first.

The package root now intentionally excludes repo-owned reference host files
such as launcher pages, sample shell rendering helpers, proof/status panels,
and page-specific controllers. Those still exist for repo tenants and examples,
but they are not the SDK contract.

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

## SDK modules

- `embed-surface`
  - high-level browser SDK entrypoint for complete embedding
- `launcher-core`
  - host bootstrap, browser identity storage, silent re-bootstrap helpers
- `backend-base`
  - backend base URL, host-config URL, and bridge endpoint resolution
- `standard-runtime`
  - generic catalog runtime/theme helpers for tenants building on the shared host flow
- `subject-profile`
  - browser-side subject-profile selection and remediation helpers
- `modal-shell`
  - generic modal shell primitive used by browser-host and embed flows
- `xms`
  - browser-side monetization/read helpers for plans, paywalls, balances, and history

## Minimal usage

```ts
import {
  buildFeaturePaywallCopyModel,
  buildMonetizationPaywallHtml,
  buildMonetizationPackagePresentation,
  buildMonetizationPaywallPresentation,
  buildMonetizationPaywallRenderModel,
  flattenXappMonetizationPaywallPackages,
  flattenXappMonetizationCatalog,
  getDefaultXappMonetizationScopeKind,
  listXappMonetizationPaywalls,
  resolveBackendBaseUrl,
  resolveBridgeEndpoints,
  resolveHostConfigUrl,
  selectXappMonetizationPaywall,
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
const paywalls = listXappMonetizationPaywalls([]);
const paywall = selectXappMonetizationPaywall({ paywalls, placement: "paywall" });
const paywallPackages = flattenXappMonetizationPaywallPackages(paywall);
const paywallPresentation = buildMonetizationPaywallPresentation(paywall);
const paywallRenderModel = buildMonetizationPaywallRenderModel(paywall);
const paywallHtml = buildMonetizationPaywallHtml(paywall);
const paywallCopy = buildFeaturePaywallCopyModel({
  feature: { title: "Premium export", requirements: { credits: 50 } },
  snapshotSummary: { wallet: { creditsRemaining: "10" } },
});
const snapshotSummary = summarizeXappMonetizationSnapshot({
  access_projection: { has_current_access: true, credits_remaining: "500" },
});
```

## Unified Embed Surface

Use `bootstrapXappsEmbedSession(...)` plus `mountCatalogEmbed(...)` or
`mountSingleXappEmbed(...)` as the canonical browser-side entrypoint for
complete embedding.

This is the intended public surface above the older page-wrapper helpers. The
older wrappers remain useful for reference hosts, but the unified surface is
the path new integrators should start from.

This surface works the same way for:

- hosted mode, where the tenant backend stays on the platform
- self-owned tenant mode, where the tenant owns the backend but keeps the same
  `/api/*` host contract

Minimal pattern:

```ts
import { bootstrapXappsEmbedSession, mountCatalogEmbed } from "@xapps-platform/browser-host";

await bootstrapXappsEmbedSession(
  {
    identifier: {
      idType: "tenant_member_id",
      value: "acct-company-a-user-42",
    },
  },
  {
    hostBootstrapUrl: "/api/host-bootstrap",
    identityStorageKey: "xapps_host_identity_v1",
  },
);

const controller = await mountCatalogEmbed({
  backendBaseUrl: "https://tenant.example.test",
  container: document.getElementById("catalog"),
  widgetContainer: document.getElementById("widget"),
  mode: "single-panel",
  identityStorageKey: "xapps_host_identity_v1",
});
```

Use:

- `mountCatalogEmbed(...)` for `single-panel` or `split-panel`
- `mountSingleXappEmbed(...)` plus `xappId` for direct xapp mount

This layer sits above `launcher-core` and `@xapps-platform/embed-sdk`, and it
is the default integration path for both hosted and self-owned tenant embeds.

## Reference hosts in this repo

This repository still ships reference host pages and shell helpers used by:

- `xconect`
- `xconecta`
- `xconectb`
- `xconectc`
- hosted proof/reference variants

Those files are repo implementation details. They exist so our local tenants
can serve working host pages through `/host/*`, but they are not the browser
SDK contract and should not be the starting point for integrators.

## Verify locally

```bash
npm run build --workspace packages/browser-host
npm run smoke --workspace packages/browser-host
```

## Hosted Integrator Starter

For the thin browser starter that pairs with a local `POST /api/host-bootstrap`
route and a platform-hosted tenant backend, use:

- [packages/browser-host/examples/hosted-integrator-starter/README.md](/home/dacrise/x/xapps/packages/browser-host/examples/hosted-integrator-starter/README.md)
