# `@xapps-platform/publisher-verifier`

Verification helper library for backend publisher callback/executor flows.

## Install

```bash
npm install @xapps-platform/publisher-verifier
```

## When to use it

Use this package directly when a backend needs publisher-side proof verification helpers without taking a dependency on the broader `@xapps-platform/server-sdk` surface.

## Status

This package is now prepared for public distribution because it complements external executor/callback verification flows built on top of `@xapps-platform/server-sdk`.

## Exports

- Main entry: `@xapps-platform/publisher-verifier` (`src/index.js`)
- Includes JWS and WebAuthn verification helpers used by server-side validation flows.

## Minimal usage

```js
import {
  verifyJwsSubjectProof,
  verifyWebauthnSubjectProof,
  verifySubjectProofEnvelope,
} from "@xapps-platform/publisher-verifier";

const jwsResult = await verifyJwsSubjectProof(input);
const webauthnResult = await verifyWebauthnSubjectProof(input);
const envelopeResult = await verifySubjectProofEnvelope(input);
```

## Notes

- Runtime: Node.js backend.
- Complements `@xapps-platform/server-sdk` verification/callback primitives.
- See package/runtime ownership: `docs/guides/12-package-usage-and-ownership.md`.

## Verify locally

```bash
npm run smoke --workspace packages/publisher-verifier
```
