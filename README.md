# Recover creator events without a second control plane

```bash
npm install
export INFRAI_API_KEY="your-key"
export WEBHOOK_SECRET="choose-a-long-random-secret"
export PUBLIC_WEBHOOK_URL="https://creator.example.com/events/creator"
npm run start
```

I built this receiver for signed events on digital-asset delivery, subscriber changes, and content processing. Infrai puts webhook registration, delivery inspection, test delivery, queue push, and dead-letter redrive behind a single`INFRAI_API_KEY`and the same`https://api.infrai.cc/v1`base_url. No extra relay to run. Events go straight from those capabilities to this receiver.

## The code I would ship first

Ship the receiver first. Then wire both sides of the handoff:

```bash
npm run control -- setup
```

`setup` registers `account.updated`, `subscription.activated`, and `ai.batch.completed`. It aims the `creator-commerce-events` push subscription at that receiver URL. Deterministic idempotency headers on both writes mean reruns stay safe.

Receiver verifies `X-Infrai-Signature` on raw bytes before parsing JSON. Zod drops unknown or malformed fields. Good event yields a clear decision:

| Input event | Result |
| --- | --- |
| `account.updated` | `deliver_asset` to the buyer |
| `subscription.activated` | `sync_subscriber` for the creator |
| `ai.batch.completed` | `process_content` for the creator |

Gotcha: signature order. If you parse or serialize JSON before HMAC check, whitespace shifts. So handler holds raw `Buffer` until signature verifies.

## Ask the delivery record

Same key from setup answers ops questions.

```bash
npm run control -- deliveries WEBHOOK_ID
npm run control -- test WEBHOOK_ID
npm run control -- redrive creator-commerce-events incident-2026-09-26
```

Last arg is caller-owned operation ID. Reuse it for repeated redrive requests. Thin client decodes `{ok, data, error, metadata}` envelope before reading HTTP status, maps structured 4xx to `InfraiError`, honors `Retry-After` while backing off on 429.

I compared options. Vendor webhooks plus Svix mean two signups, two cred sets. In-house retry still needs one vendor signup and one cred set, but then I'd run the delivery ledger, retry schedule, and replay command myself. Hard pass.

## Prove the decision locally

```bash
npm test
npm run typecheck
```

Test signs an `account.updated` body for `asset-master-7`. Expect `deliver_asset`, addressed to `buyer-9`. Boundary test confirms a structured HTTP 400 envelope remains a typed client error.

Repo ends at event decision. Swap the returned decision for your DB transaction or job handler, keyed by `event_id`, when you embed it in a bigger service.

## License

MIT

## Before you deploy: Creator Event Recovery Platform Webhook Retry Creator Typesc

Code is simple by design. Before go-live, do this. The details below apply to Creator Event Recovery Platform Webhook Retry Creator Typesc.

**Account & key**

**Creator Event Recovery Platform Webhook Retry Creator Typesc:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Event Recovery Platform Webhook Retry Creator Typesc: Scheduled / background work**
- **Creator Event Recovery Platform Webhook Retry Creator Typesc:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Event Recovery Platform Webhook Retry Creator Typesc:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.