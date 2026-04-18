# `xapps-embed-sdk` examples

These are low-level examples.

For the standard integrator path, start from the higher-level browser-host
starter instead:

- [../../browser-host/examples/hosted-integrator-starter/README.md](/home/dacrise/x/xapps/packages/browser-host/examples/hosted-integrator-starter/README.md)

Use the examples in this folder only when you need to work directly with
`embed-sdk` primitives.

## Marketplace host starter

Low-level marketplace host starter for marketplace embedding:

- [marketplace-host-starter/index.html](/home/dacrise/x/xapps/packages/xapps-embed-sdk/examples/marketplace-host-starter/index.html)

Structure:

- `main.js`
  - bootstrap entrypoint
- `runtime.js`
  - runtime wrapper over `createStandardMarketplaceRuntime(...)`
- `shell.js`
  - local shell/mode/identity rendering

Use this when you want:

- full marketplace host
- single-panel or split-panel mode
- a structure similar to `xconect`, but generic

Use this when the higher-level browser-host starter is too opinionated and you
need direct control over the lower-level host runtime. It pairs with:

- `packages/server-sdk/examples/host-proxy/minimal.mjs`
- `packages/xapps-php/examples/host-proxy/minimal.php`

## Runtime-minimal starter

Smallest possible example of the shared marketplace runtime:

- [runtime-minimal/index.html](/home/dacrise/x/xapps/packages/xapps-embed-sdk/examples/runtime-minimal/index.html)

Use this when you want:

- to understand `createStandardMarketplaceRuntime(...)`
- a minimal API smoke/reference
- no extra shell split

## Owner-managed payment page starter

Payment-page reference:

- [payment-page/owner-managed-payment-page-starter.html](/home/dacrise/x/xapps/packages/xapps-embed-sdk/examples/payment-page/owner-managed-payment-page-starter.html)

Use this when you want:

- a tenant/publisher-owned payment page
- payment return forwarding handled by the browser helper
