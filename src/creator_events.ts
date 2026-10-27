import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const assetReady = z.object({
  event_id: z.string().min(1),
  event_type: z.literal("asset.ready"),
  data: z.object({
    asset_id: z.string().min(1),
    order_id: z.string().min(1),
    buyer_id: z.string().min(1),
    download_url: z.string().url(),
  }).strict(),
}).strict();

const subscriberChanged = z.object({
  event_id: z.string().min(1),
  event_type: z.literal("subscriber.changed"),
  data: z.object({
    subscriber_id: z.string().min(1),
    creator_id: z.string().min(1),
    state: z.enum(["active", "paused", "ended"]),
  }).strict(),
}).strict();

const contentSubmitted = z.object({
  event_id: z.string().min(1),
  event_type: z.literal("content.submitted"),
  data: z.object({
    content_id: z.string().min(1),
    creator_id: z.string().min(1),
    source_url: z.string().url(),
  }).strict(),
}).strict();

export const creatorEvent = z.discriminatedUnion("event_type", [
  assetReady,
  subscriberChanged,
  contentSubmitted,
]);

export type CreatorEvent = z.infer<typeof creatorEvent>;

export type CreatorDecision = {
  event_id: string;
  action: "deliver_asset" | "sync_subscriber" | "process_content";
  subject_id: string;
  recipient_id: string;
};

export function decide(event: CreatorEvent): CreatorDecision {
  if (event.event_type === "asset.ready") {
    return {
      event_id: event.event_id,
      action: "deliver_asset",
      subject_id: event.data.asset_id,
      recipient_id: event.data.buyer_id,
    };
  }
  if (event.event_type === "subscriber.changed") {
    return {
      event_id: event.event_id,
      action: "sync_subscriber",
      subject_id: event.data.subscriber_id,
      recipient_id: event.data.creator_id,
    };
  }
  return {
    event_id: event.event_id,
    action: "process_content",
    subject_id: event.data.content_id,
    recipient_id: event.data.creator_id,
  };
}

export function verifySignature(raw: Buffer, signature: string, secret: string): boolean {
  const suppliedHex = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const supplied = Buffer.from(suppliedHex, "hex");
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}
