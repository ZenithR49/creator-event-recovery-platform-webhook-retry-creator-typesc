import assert from "node:assert/strict";
import test from "node:test";
import { createInfraiClient, InfraiError } from "../src/infrai_client.js";

test("a 4xx envelope remains a typed caller error", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    ok: false,
    data: null,
    error: { code: "INPUT_REJECTED", message: "Check the request" },
    metadata: {},
  }), { status: 400, headers: { "Content-Type": "application/json" } });
  const infrai = createInfraiClient({ apiKey: "test-key", fetcher });

  await assert.rejects(
    () => infrai.account.webhooks.deliveries("hook-1"),
    (error: unknown) => error instanceof InfraiError
      && error.status === 400
      && error.code === "INPUT_REJECTED",
  );
});
