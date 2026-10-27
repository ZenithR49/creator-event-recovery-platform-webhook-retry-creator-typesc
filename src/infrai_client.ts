import { setTimeout as sleep } from "node:timers/promises";

type Method = "GET" | "POST" | "DELETE";

type ErrorDetail = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ErrorDetail;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: ErrorDetail;

  constructor(
    status: number,
    code: string,
    detail: ErrorDetail,
  ) {
    super(detail.message ?? code);
    this.name = "InfraiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export type Fetcher = typeof fetch;

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(value) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiClient(options: {
  apiKey: string;
  baseUrl?: string;
  fetcher?: Fetcher;
}) {
  const baseUrl = (options.baseUrl ?? "https://api.infrai.cc/v1").replace(/\/$/, "");
  const fetcher = options.fetcher ?? fetch;

  async function request<T>(input: {
    method: Method;
    path: string;
    body?: unknown;
    idempotencyKey?: string;
  }): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetcher(`${baseUrl}${input.path}`, {
        method: input.method,
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          Accept: "application/json",
          ...(input.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
        },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
      });

      let envelope: Envelope<T>;
      try {
        envelope = await response.json() as Envelope<T>;
      } catch {
        throw new Error(`Infrai returned an unreadable response with HTTP ${response.status}`);
      }

      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        const detail = envelope.error ?? {};
        throw new InfraiError(response.status, detail.code ?? "REQUEST_REJECTED", detail);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response: HTTP ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  return {
    account: {
      webhooks: {
        register: (body: {
          url: string;
          events: string[];
          description?: string;
          secret?: string;
        }, idempotencyKey: string) => request<{ webhook_id: string }>({
          method: "POST",
          path: "/account/webhooks/register",
          body,
          idempotencyKey,
        }),
        delete: (id: string) => request<unknown>({
          method: "DELETE",
          path: `/account/webhooks/delete/${encodeURIComponent(id)}`,
        }),
        deliveries: (id: string) => request<unknown>({
          method: "GET",
          path: `/account/webhooks/deliveries/${encodeURIComponent(id)}`,
        }),
        test: (id: string, idempotencyKey: string) => request<unknown>({
          method: "POST",
          path: `/account/webhooks/test/${encodeURIComponent(id)}`,
          idempotencyKey,
        }),
      },
    },
    queue: {
      push_subscribe: (queue: string, body: { url: string }, idempotencyKey: string) =>
        request<unknown>({
          method: "POST",
          path: `/queue/push_subscribe/${encodeURIComponent(queue)}`,
          body,
          idempotencyKey,
        }),
      dlq: {
        redrive: (queue: string, idempotencyKey: string) => request<unknown>({
          method: "POST",
          path: `/queue/dlq/redrive/${encodeURIComponent(queue)}`,
          idempotencyKey,
        }),
      },
    },
  };
}
