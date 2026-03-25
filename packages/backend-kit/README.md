# @xapps-platform/backend-kit

Modular Node backend kit for the current Xapps backend contract.

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

## What It Gives You

The current package surface provides:

- backend-kit option normalization
- backend-kit composition
- default route surface
- default mode tree
- payment runtime assembly
- host-proxy service assembly
- subject-profile sourcing hooks

Internal package structure is intentionally modular:

- `src/index.ts`
  thin public facade
- `src/backend/options.ts`
  option normalization and config shaping
- `src/backend/paymentRuntime.ts`
  payment runtime assembly and payment-page API helpers
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
- bridge
- payment
- guard
- subject profiles

For hosted-integrator mode, the host API surface can also enforce explicit
frontend-origin allowlists through `host.allowedOrigins`. Leave it empty for
same-origin consumers; set it when the browser host runs on another domain and
must call the tenant backend cross-origin. In practice that allowlist covers
the browser-facing host API surface, including:

- `/api/host-config`
- `/api/resolve-subject`
- `/api/create-catalog-session`
- `/api/create-widget-session`
- lifecycle routes under `/api/install*`
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
