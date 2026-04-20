# `@xapps-platform/browser-host`

Browser SDK for catalog and single-xapp embedding.

## Install

```bash
npm install @xapps-platform/browser-host
```

## Fast Start

If you are integrating a hosted tenant or building a tenant host shell, start
here:

1. call `bootstrapXappsEmbedSession(...)`
2. call `mountCatalogEmbed(...)` or `mountSingleXappEmbed(...)`
3. keep your own page HTML/CSS outside the SDK

This package is runtime, not sample UI. It does not provide launcher pages,
headers, proof dashboards, or tenant-specific page controllers.

## Use It For

Use `@xapps-platform/browser-host` when you want the standard browser SDK path:

- bootstrap a browser embed session
- mount the full catalog
- mount a single xapp directly
- propagate locale, theme, payment resume, and host return behavior
- use shared browser-side XMS and subject-profile helpers

Important boundary:

- hosted or cross-origin host integrations should use bootstrap entry plus
  host-session exchange
- same-origin tenant hosts should keep the same browser contract on their own
  origin: local browser-safe bootstrap entry, host-session exchange, then
  session-backed host APIs

Use `@xapps-platform/embed-sdk` instead only when you need lower-level iframe,
bridge, or payment-resume primitives and are intentionally building a custom
browser runtime.

For the current XMS reader path, including plans, balances, paywalls, history, and virtual currencies, read:

- [docs/specifications/xms/README.md](/home/dacrise/x/xapps/docs/specifications/xms/README.md)

## Boundary

This package owns browser SDK logic that should not live in tenant or
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

The root entrypoint is the browser SDK. Use it first. Repo-owned reference host
files are intentionally excluded from this contract.

## Backend Location

Default behavior stays same-origin:

- host config from `/api/host-config`
- host mutation/session routes under `/api`

For hosted-integrator mode, point the host contract at a different backend
origin without changing the browser-host runtime shape:

- `backendBaseUrl`
  - derives `hostConfigPath` as `${backendBaseUrl}/api/host-config`
  - derives `apiBasePath` as `${backendBaseUrl}/api`
  - derives bridge-v2 endpoints under `${backendBaseUrl}/api/bridge/*`
- or override `hostConfigPath` / `apiBasePath` explicitly

Backend-hosted frontend integrations should also make the tenant backend
explicitly allow the frontend origin on the host API surface. Same-origin
consumers can leave this unset; hosted-integrator consumers should set the
backend-kit `host.allowedOrigins` list.

For hosted-integrator bootstrap, do not put raw platform API keys in the
browser. Have the integrator backend obtain a short-lived bootstrap token from
the tenant backend, then pass it into browser identity state. The SDK uses it
in `X-Xapps-Host-Bootstrap` to exchange into host-local session.

Treat that token as short-lived bootstrap state, not durable identity storage.

Same-origin tenant note:

- keep the same bootstrap -> exchange -> host-session flow on the tenant origin
- configure `hostBootstrapUrl` to the tenant's local browser-safe bootstrap
  route when it differs from `/api/browser/host-bootstrap`
- bootstrap is the browser entry proof; host-session remains the ongoing
  authority for host APIs

When the host should return to a launcher page instead of `/`, set `entryHref`
in local config.

When the host owns locale selection, pass `locale` in local config. The runtime
seeds it into widget context and exposes reactive locale updates through
`XAPPS_LOCALE_CHANGED`.

The package is actor-agnostic:

- no tenant sample data
- no publisher sample data
- no actor-specific rights logic

Those concerns stay in local config, backend APIs, and later actor adapters.

## SDK Modules

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

## Minimal Usage

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
`mountSingleXappEmbed(...)` as the canonical browser-side entrypoint.

It works the same way for:

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
    hostBootstrapUrl: "/api/browser/host-bootstrap",
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

Hosted-integrator expiry model:

- `bootstrapToken` is short-lived bootstrap state
- the SDK should silently re-bootstrap when possible
- if renewal cannot succeed, control should return to the launcher
- local app identity, not stored bootstrap state, remains the source of truth

Current security posture:

- bootstrap is used to enter the host flow
- host backend verifies it and mints a local session
- browser no longer relies on bootstrap token as the ongoing credential

Host-session endpoints:

- `POST /api/host-session/exchange`
- `POST /api/host-session/logout`

Hosted rollout rule:

- hosted-mode browser-host requires host-session exchange
- bootstrap-header usage should be treated as retirement cleanup only, not the
  supported hosted authority path

Current implementation note:

- the shipped browser-host flow now requires host-session exchange for hosted
  mode
- same-origin tenant pages without hosted bootstrap can still run on local
  subject identity without this hosted exchange path

Runtime surface note:

- mounted controllers expose `logout()`
- when host-session exchange is active, `logout()` calls
  `POST /api/host-session/logout`, clears local identity state, and returns the
  surface to launcher-state

Hosted backend rule:

- cross-origin hosted API calls should authenticate through the host-session
  cookie after exchange
- bootstrap header should be used only for exchange and renewal entry, not as
  ongoing hosted API authority

Security posture rule:

- if you need tighter replay/session guarantees, move authority into a local
  backend session instead of extending browser token lifetime or browser storage

The SDK contract should remain stable while session ownership stays with the
backend-owned host session posture.

This layer sits above `launcher-core` and `@xapps-platform/embed-sdk`, and it
is the default integration path for hosted and self-owned tenant embeds.

Those files are repo implementation details. They exist so our local tenants
can serve working host pages through `/host/*`, but they are not the browser
SDK contract and should not be the starting point for integrators.

## Verify locally

```bash
npm run build --workspace packages/browser-host
npm run smoke --workspace packages/browser-host
```

## Hosted Integrator Starter

For the thin browser starter that pairs with a local `POST /api/browser/host-bootstrap`
route and a platform-hosted tenant backend, use:

- [packages/browser-host/examples/hosted-integrator-starter/README.md](/home/dacrise/x/xapps/packages/browser-host/examples/hosted-integrator-starter/README.md)
- [apps/tenants/docs/tooling/first-hosted-tenant-integrator-handoff.md](/home/dacrise/x/xapps/apps/tenants/docs/tooling/first-hosted-tenant-integrator-handoff.md)
