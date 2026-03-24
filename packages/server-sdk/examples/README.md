# `@xapps/server-sdk` examples

Use these examples by intent.

## Host proxy starter

Minimal server-side host proxy reference:

- [host-proxy/minimal.mjs](/home/dacrise/x/xapps/packages/server-sdk/examples/host-proxy/minimal.mjs)

Use this when you want:

- the smallest secure backend boundary for marketplace embedding
- subject resolution
- catalog/widget session minting
- a framework-neutral example to map into Fastify, Express, Laravel, or PHP

This maps to the `minimal embed` backend profile:

- `POST /api/resolve-subject`
- `POST /api/create-catalog-session`
- `POST /api/create-widget-session`

## Managed gateway session examples

Payment-lane examples:

- [managed-gateway-session/tenant.mjs](/home/dacrise/x/xapps/packages/server-sdk/examples/managed-gateway-session/tenant.mjs)
- [managed-gateway-session/publisher.mjs](/home/dacrise/x/xapps/packages/server-sdk/examples/managed-gateway-session/publisher.mjs)

Use these when you want:

- managed gateway payment session creation
- tenant/publisher backend examples for the payment cookbook

If your marketplace host also exposes install/update/uninstall, extend the host proxy starter with the `marketplace lifecycle` routes instead of changing the browser contract.
