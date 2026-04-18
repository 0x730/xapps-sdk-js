# Hosted Integrator Starter

This is the thin browser starter for the hosted-integrator shape.

It uses the browser SDK surface:

- `bootstrapXappsEmbedSession(...)`
- `mountCatalogEmbed(...)`
- `mountSingleXappEmbed(...)`

The canonical process still lives here:

- [apps/tenants/docs/tooling/first-hosted-tenant-integrator-handoff.md](/home/dacrise/x/xapps/apps/tenants/docs/tooling/first-hosted-tenant-integrator-handoff.md)

The starter only covers the browser slice of that process:

1. the local app resolves the current external identity
2. the local app calls local `POST /api/host-bootstrap`
3. the local backend calls the hosted tenant backend
4. the hosted tenant returns `subjectId` + short-lived `bootstrapToken`
5. the browser stores that bootstrap state
6. the browser mounts `@xapps-platform/browser-host`

Files:

- `launcher.html`
- `marketplace.html`
- `single-xapp.html`
- `launcher.js`
- `marketplace.js`
- `single-xapp.js`
- `starter-config.js`
- `starter.css`

Only these package APIs are the contract:

- `bootstrapXappsEmbedSession(...)`
- `mountCatalogEmbed(...)`
- `mountSingleXappEmbed(...)`

The HTML pages and their small local scripts are example app files. They
demonstrate one browser integration shape; they are not the SDK.

The point of this starter is to stay thin:

- no repo reference shell layer
- no starter runtime wrapper over the SDK
- no tenant-specific controller code
- direct `browser-host` SDK calls only

Pair this browser starter with one of:

- [packages/server-sdk/examples/host-proxy/hosted-integrator-bootstrap.mjs](/home/dacrise/x/xapps/packages/server-sdk/examples/host-proxy/hosted-integrator-bootstrap.mjs)
- [packages/xapps-php/examples/host-proxy/hosted-integrator-bootstrap.php](/home/dacrise/x/xapps/packages/xapps-php/examples/host-proxy/hosted-integrator-bootstrap.php)

This starter is intentionally generic:

- no proof dashboard
- no preset identities
- no `xconect` branding
- no tenant-specific copy

It is the reference browser shape for integrators who keep their own app shell
while the tenant backend remains platform-hosted.

Important:

- first bootstrap usually sends `identifier`, not `subjectId`
- `subjectId` is resolved by the hosted tenant
- later, if the integrator stores that `subjectId`, they may reuse it

For the first real hosted-tenant lane, subject profiles are mandatory, so this
browser starter is only one part of the integration. The integrator also needs
the server-to-server profile source described in the canonical handoff above.
