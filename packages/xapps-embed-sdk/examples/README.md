# `xapps-embed-sdk` examples

Use these examples by intent.

## Marketplace host starter

Recommended integrator starter for marketplace embedding:

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

This is the recommended browser-side pair for:

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
