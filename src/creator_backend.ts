import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { creatorEvent, decide, verifySignature } from "./creator_events.js";

const port = Number(process.env.PORT ?? "3000");
const secret = process.env.WEBHOOK_SECRET;
if (!secret) throw new Error("Set WEBHOOK_SECRET before starting the receiver");

async function bodyOf(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/events/creator") {
    json(response, 404, { error: "route_not_found" });
    return;
  }

  const raw = await bodyOf(request);
  const signature = request.headers["x-infrai-signature"];
  if (typeof signature !== "string" || !verifySignature(raw, signature, secret)) {
    json(response, 401, { error: "invalid_signature" });
    return;
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw.toString("utf8"));
  } catch {
    json(response, 400, { error: "invalid_json" });
    return;
  }

  const parsed = creatorEvent.safeParse(candidate);
  if (!parsed.success) {
    json(response, 400, { error: "invalid_event", issues: parsed.error.issues });
    return;
  }

  json(response, 200, decide(parsed.data));
});

server.listen(port, () => {
  console.log(`Creator event receiver listening on http://localhost:${port}`);
});
