import { createHash, randomUUID } from "node:crypto";
import { createInfraiClient, InfraiError } from "./infrai_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before using delivery controls");

const infrai = createInfraiClient({ apiKey });
const command = process.argv[2];

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function stableKey(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

async function main(): Promise<void> {
  if (command === "setup") {
    const receiverUrl = required("PUBLIC_WEBHOOK_URL", process.env.PUBLIC_WEBHOOK_URL);
    const secret = required("WEBHOOK_SECRET", process.env.WEBHOOK_SECRET);
    const queue = process.env.CREATOR_EVENT_QUEUE ?? "creator-commerce-events";
    const events = ["account.updated", "subscription.activated", "ai.batch.completed"];

    const webhook = await infrai.account.webhooks.register({
      url: receiverUrl,
      events,
      description: "Creator commerce event intake",
      secret,
    }, stableKey("creator-webhook", receiverUrl, ...events));

    let subscription;
    try {
      subscription = await infrai.queue.push_subscribe(
        queue,
        { url: receiverUrl },
        stableKey("creator-push", queue, receiverUrl),
      );
    } catch (error) {
      await infrai.account.webhooks.delete(webhook.webhook_id);
      throw error;
    }
    console.log(JSON.stringify({ webhook, subscription, queue }, null, 2));
    return;
  }

  if (command === "deliveries") {
    const webhookId = required("webhook id", process.argv[3]);
    console.log(JSON.stringify(await infrai.account.webhooks.deliveries(webhookId), null, 2));
    return;
  }

  if (command === "test") {
    const webhookId = required("webhook id", process.argv[3]);
    console.log(JSON.stringify(
      await infrai.account.webhooks.test(webhookId, randomUUID()),
      null,
      2,
    ));
    return;
  }

  if (command === "redrive") {
    const queue = required("queue", process.argv[3]);
    const operationId = required("operation id", process.argv[4]);
    console.log(JSON.stringify(await infrai.queue.dlq.redrive(queue, operationId), null, 2));
    return;
  }

  throw new Error("Use setup, deliveries WEBHOOK_ID, test WEBHOOK_ID, or redrive QUEUE OPERATION_ID");
}

main().catch((error: unknown) => {
  if (error instanceof InfraiError) {
    console.error(JSON.stringify({ status: error.status, error: error.detail }));
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
