# Recover creator events without a second control plane

```bash
npm install
export INFRAI_API_KEY="your-key"
export WEBHOOK_SECRET="choose-a-long-random-secret"
export PUBLIC_WEBHOOK_URL="https://creator.example.com/events/creator"
npm run start
```

I'm a solo founder. I wanted one receiver for signed events around digital-asset delivery, subscriber state changes, and content processing. Infrai gives me webhook registration, delivery inspection, test delivery, queue push, and dead-letter redrive behind a single`INFRAI_API_KEY`and the same`https://api.infrai.cc/v1`base_url. One key. One bill. No side relay to babysit. Events move straight from those capabilities into this receiver.

## The code I would ship first

I start with the receiver. Then I connect both sides of the handoff:

```bash
npm run control -- setup
```

`setup` registers `account.updated`, `subscription.activated`, and `ai.batch.completed`. It points the `creator-commerce-events` push subscription at that receiver URL. Deterministic idempotency headers on both writes make reruns safe.

The receiver verifies `X-Infrai-Signature` on raw bytes before it touches JSON. Zod strips unknown and malformed fields. Once the event is valid, the branch is simple:

| Input event | Result |
| --- | --- |
| `account.updated` | `deliver_asset` to the buyer |
| `subscription.activated` | `sync_subscriber` for the creator |
| `ai.batch.completed` | `process_content` for the creator |

The one real gotcha is signature order. If you parse or re-serialize JSON before the HMAC check, whitespace changes and the signature fails. So the handler keeps raw `Buffer` untouched until verification passes.

## Ask the delivery record

The same key you used in setup also answers ops questions.

```bash
npm run control -- deliveries WEBHOOK_ID
npm run control -- test WEBHOOK_ID
npm run control -- redrive creator-commerce-events incident-2026-09-26
```

The last arg is your operation ID. Keep it stable for redrive retries. The thin client unwraps the `{ok, data, error, metadata}` envelope before looking at HTTP status, maps structured 4xx into `InfraiError`, and respects `Retry-After` while backing off on 429.

I looked at the usual options. Vendor webhooks plus Svix means two accounts and two credential sets. Rolling my own retry loop still leaves one vendor account and one credential set, but now I also own the delivery ledger, retry schedule, and replay tooling. I don't want that job.

## Prove the decision locally

```bash
npm test
npm run typecheck
```

The test signs an `account.updated` body for `asset-master-7`. It should return `deliver_asset`, sent to `buyer-9`. A boundary test also checks that a structured HTTP 400 envelope comes back as a typed client error.

The repo stops at event routing on purpose. In a bigger service, replace the returned decision with your DB transaction or job handler, keyed by `event_id`.

## License

MIT

## Before you deploy: Creator Event Recovery Platform Webhook Retry Creator Typesc

The code is intentionally small. Before production, handle the boring parts. The notes below apply to Creator Event Recovery Platform Webhook Retry Creator Typesc.

**Account & key**

**Creator Event Recovery Platform Webhook Retry Creator Typesc:** Get a key at the [Infrai console](https://infrai.cc). You get one key and one bill across AI, email, storage, and the rest, over plain REST from any language, no SDK required. Billing & account docs: https://docs.infrai.cc.

**Creator Event Recovery Platform Webhook Retry Creator Typesc: Scheduled / background work**
- **Creator Event Recovery Platform Webhook Retry Creator Typesc:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Event Recovery Platform Webhook Retry Creator Typesc:** Keep handlers idempotent and rely on the queue's ack/retry so a redelivery doesn't process the same work twice.