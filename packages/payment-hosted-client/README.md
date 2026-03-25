# `@xapps-platform/payment-hosted-client`

Browser-safe hosted payment client for gateway payment flows.

Status:

- prepared for public distribution as the external browser payment integration surface

This package wraps the gateway hosted payment endpoints:

- `GET /v1/gateway-payment/session`
- `POST /v1/gateway-payment/complete`
- `POST /v1/gateway-payment/client-settle`

Contract notes:

- hosted method negotiation is canonical `session.accepts[]` (do not read legacy metadata aliases)
- `completeSession` may return `flow=client_collect` with `client_settle_url`; client-settle can use that explicit URL
- hosted `ui` fields are presentation-only and never authority for settlement/signing

It is intentionally protocol/UI-focused and excludes:

- provider adapter logic
- provider credentials/secrets
- provider credential bundle refs
- signing or policy authority behavior

## Usage

```ts
import { createHostedPaymentClient } from "@xapps-platform/payment-hosted-client";

const client = createHostedPaymentClient();
const session = await client.getSession({ paymentSessionId: "pay_123" });
const result = await client.completeSession({ paymentSessionId: "pay_123" });
```
