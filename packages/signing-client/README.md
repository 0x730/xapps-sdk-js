# `@xapps/signing-client`

Browser signing helper for subject-action payloads.

## Install

```bash
npm install @xapps/signing-client
```

## Exports

- Canonicalization/hash helpers: `jcs`, `sha256Hex`, `hashPayload`
- Encoding helpers: `bytesToBase64url`, `base64urlToBytes`
- Signing helpers:
  - `generateEd25519KeyPair`, `exportPublicKey`, `signActionEd25519`
  - `signActionWebAuthn`, `formatWebAuthnRegistration`

## Minimal usage

```ts
import { generateEd25519KeyPair, signActionEd25519 } from "@xapps/signing-client";

const keyPair = await generateEd25519KeyPair();
const proof = await signActionEd25519(subjectAction, keyPair.privateKey, "kid_1");
```

## Notes

- Runtime: browser/Web Crypto API; also usable in Node.js environments with `crypto.subtle`.
- Optional helper for signing UX that can be used from widget flows (`@xapps/widget-sdk`) or host UI flows (`@xapps/marketplace-ui`) when needed.
- Not a bridge/orchestration package (`xapps-embed-sdk`) and not a backend verification package (`@xapps/server-sdk`).
- Designed for signing flows, not full widget bridge/session orchestration.
- See package/runtime ownership: `docs/guides/12-package-usage-and-ownership.md`.
