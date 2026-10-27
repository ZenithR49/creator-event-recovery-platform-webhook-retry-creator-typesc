import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { creatorEvent, decide, verifySignature } from "../src/creator_events.js";

test("a signed ready asset becomes a buyer delivery", () => {
  const body = Buffer.from(JSON.stringify({
    event_id: "evt-42",
    event_type: "asset.ready",
    data: {
      asset_id: "asset-master-7",
      order_id: "order-42",
      buyer_id: "buyer-9",
      download_url: "https://downloads.example/asset-master-7",
    },
  }));
  const secret = "local-test-secret";
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  assert.equal(verifySignature(body, signature, secret), true);
  const event = creatorEvent.parse(JSON.parse(body.toString("utf8")));
  assert.deepEqual(decide(event), {
    event_id: "evt-42",
    action: "deliver_asset",
    subject_id: "asset-master-7",
    recipient_id: "buyer-9",
  });
});

test("the signature covers the exact bytes", () => {
  const secret = "local-test-secret";
  const original = Buffer.from('{"event_id":"evt-42"}');
  const changed = Buffer.from('{ "event_id": "evt-42" }');
  const signature = createHmac("sha256", secret).update(original).digest("hex");
  assert.equal(verifySignature(changed, signature, secret), false);
});
