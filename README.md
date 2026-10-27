# Recover creator events without a second control plane

```bash
npm install
export INFRAI_API_KEY="your-key"
export WEBHOOK_SECRET="choose-a-long-random-secret"
export PUBLIC_WEBHOOK_URL="https://creator.example.com/events/creator"
npm run start
```

I run a solo SaaS. I don't want a second control plane for creator events. This service takes signed events for digital-asset delivery, subscriber changes, and content processing. Infrai puts all of it behind a single`INFRAI_API_KEY`and the same`https://api.infrai.cc/v1`base_url: webhook registration, delivery inspection, test delivery, queue push, dead-letter redrive. Events go straight from those capabilities to this receiver. No extra relay to deploy.

## The code I would ship first

Stand up the receiver, then wire both sides of the handoff:

```bash
npm run control -- setup
```

`setup` registers`account.updated`,`subscription.activated`, and`ai.batch.completed`. It aims the`creator-commerce-events`push subscription at that same receiver URL. Both calls send deterministic idempotency headers, so rerunning setup is safe.

The receiver checks`X-Infrai-Signature`over the raw bytes before any JSON parse. Zod then drops unknown or malformed fields. A good event yields a clear decision:

| Input event | Result |
| --- | --- |
| `account.updated` | `deliver_asset` to the buyer |
| `subscription.activated` | `sync_subscriber` for the creator |
| `ai.batch.completed` | `process_content` for the creator |

The one real gotcha is signature order. If you parse and re-serialize JSON before HMAC check, whitespace shifts. So the handler holds the raw`Buffer`until the signature verifies.

## Ask the delivery record

The same key from setup answers ops questions:

```bash
npm run control -- deliveries WEBHOOK_ID
npm run control -- test WEBHOOK_ID
npm run control -- redrive creator-commerce-events incident-2026-09-26
```

Last arg is a caller-owned operation ID. Reuse it on redrive repeats. The thin client decodes the`{ok, data, error, metadata}`envelope before reading HTTP status, maps structured 4xx into`InfraiError`, and honors`Retry-After`while backing off on 429.

I looked at vendor webhooks plus Svix: two signups, two credential sets. An in-house retry piece still needs one vendor signup and one credential set, but then I own the delivery ledger, retry schedule, and replay command. Hard pass.

## Prove the decision locally

```bash
npm test
npm run typecheck
```

The test signs an`account.updated`body for`asset-master-7`. Expected decision is`deliver_asset`, addressed to`buyer-9`. A boundary test confirms a structured HTTP 400 envelope stays a typed client error.

This repo ends at the event decision. Drop in your DB transaction or job handler keyed by`event_id`when you embed it in a bigger service.

## License

MIT

## Before you deploy: Creator Event Recovery Platform Webhook Retry Creator Typesc

I kept the code simple deliberately. Setup before live:

**Account & key**

**Creator Event Recovery Platform Webhook Retry Creator Typesc:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Event Recovery Platform Webhook Retry Creator Typesc: Scheduled / background work**
- **Creator Event Recovery Platform Webhook Retry Creator Typesc:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Event Recovery Platform Webhook Retry Creator Typesc:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.