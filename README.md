# xapps SDK JS

Public JavaScript SDK distribution repo for Xapps.

Current public packages:

- `@xapps-platform/server-sdk`
- `@xapps-platform/cli`
- `@xapps-platform/openapi-import`
- `@xapps-platform/xapp-manifest`
- `@xapps-platform/widget-sdk`
- `@xapps-platform/signing-client`
- `@xapps-platform/embed-sdk`
- `@xapps-platform/browser-host`
- `@xapps-platform/backend-kit`
- `@xapps-platform/marketplace-ui`
- `@xapps-platform/widget-runtime`
- `@xapps-platform/payment-hosted-client`
- `@xapps-platform/publisher-verifier`

Quick package guide:

- `@xapps-platform/server-sdk`: Node backend SDK for gateway, publisher, and verification flows.
- `@xapps-platform/cli`: tenant/publisher xapp workflows such as `init`, `import`, `validate`, `test`, `publish`, and logs.
- `@xapps-platform/openapi-import`: generate Xapp manifest candidates from OpenAPI documents.
- `@xapps-platform/xapp-manifest`: shared manifest schema, parser, and types.
- `@xapps-platform/embed-sdk`: low-level browser host/embed primitives.
- `@xapps-platform/browser-host`: higher-level browser host runtime for marketplace and single-xapp surfaces.
- `@xapps-platform/backend-kit`: higher-level Node backend kit that sits above `server-sdk`.

Install examples:

```bash
npm install @xapps-platform/server-sdk
npm install -D @xapps-platform/cli
npm install @xapps-platform/browser-host
```

Canonical engineering source remains private. This repo is the public distribution surface under:

- `https://github.com/0x730/xapps-sdk-js`

Project homepage:

- `https://gateway.0x730.com`

Maintainer:

- Daniel Vladescu
- daniel.vladescu@gmail.com
