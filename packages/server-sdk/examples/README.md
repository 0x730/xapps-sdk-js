# `@xapps/server-sdk` examples

Use these examples by intent.

## Host proxy starter

Minimal server-side host proxy reference:

- [host-proxy/minimal.mjs](/home/dacrise/x/xapps/packages/server-sdk/examples/host-proxy/minimal.mjs)
- [host-proxy/plans.mjs](/home/dacrise/x/xapps/packages/server-sdk/examples/host-proxy/plans.mjs)
- [host-proxy/hosted-integrator-bootstrap.mjs](/home/dacrise/x/xapps/packages/server-sdk/examples/host-proxy/hosted-integrator-bootstrap.mjs)

Use this when you want:

- the smallest secure backend boundary for marketplace embedding
- subject resolution
- catalog/widget session minting
- current-user installed-app plans / XMS host monetization wiring
- a framework-neutral example to map into Fastify, Express, Laravel, or PHP
- the local `POST /api/browser/host-bootstrap` bridge for hosted-integrator mode

This maps to the `minimal embed` backend profile:

- `POST /api/resolve-subject`
- `POST /api/create-catalog-session`
- `POST /api/create-widget-session`

When you also expose the host plans surface, add:

- `GET /api/my-xapps/:xappId/monetization`
- `POST /api/my-xapps/:xappId/monetization/purchase-intents/prepare`
- `POST /api/my-xapps/:xappId/monetization/purchase-intents/:intentId/payment-session`
- `POST /api/my-xapps/:xappId/monetization/purchase-intents/:intentId/payment-session/finalize`

For the browser pair in hosted-integrator mode, use:

- [packages/browser-host/examples/hosted-integrator-starter/README.md](/home/dacrise/x/xapps/packages/browser-host/examples/hosted-integrator-starter/README.md)

## Managed gateway session examples

Payment-lane examples:

- [managed-gateway-session/tenant.mjs](/home/dacrise/x/xapps/packages/server-sdk/examples/managed-gateway-session/tenant.mjs)
- [managed-gateway-session/publisher.mjs](/home/dacrise/x/xapps/packages/server-sdk/examples/managed-gateway-session/publisher.mjs)

Use these when you want:

- managed gateway payment session creation
- tenant/publisher backend examples for the payment cookbook

If your marketplace host also exposes install/update/uninstall, extend the host proxy starter with the `marketplace lifecycle` routes instead of changing the browser contract.
