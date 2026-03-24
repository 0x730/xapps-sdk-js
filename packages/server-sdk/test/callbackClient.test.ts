import { describe, expect, it, vi } from "vitest";
import { createCallbackClient, XappsServerSdkError } from "../src/index.js";

describe("server-sdk callback client", () => {
  it("posts callback events and completions with auth and idempotency headers", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });

    const client = createCallbackClient({
      baseUrl: "https://gateway.example",
      callbackToken: "cb-token",
      fetchImpl: fetchMock as typeof fetch,
    });

    await client.sendEvent(
      "req_1",
      { type: "PROGRESS", message: "working", data: { step: 1 } },
      { idempotencyKey: "idem-1" },
    );
    await client.complete(
      "req_1",
      { status: "success", result: { ok: true } },
      { idempotencyKey: "idem-2" },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCall = fetchMock.mock.calls[0] as [string, RequestInit];
    const secondCall = fetchMock.mock.calls[1] as [string, RequestInit];

    expect(firstCall[0]).toContain("/v1/requests/req_1/events");
    expect((firstCall[1].headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-1");
    expect(secondCall[0]).toContain("/v1/requests/req_1/complete");
    expect((secondCall[1].headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-2");
  });

  it("retries retryable callback failures and eventually succeeds", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      calls += 1;
      if (calls < 2) {
        return new Response(JSON.stringify({ message: "temporary" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = createCallbackClient({
      baseUrl: "https://gateway.example",
      callbackToken: "cb-token",
      fetchImpl: fetchMock as typeof fetch,
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 },
      idempotencyKeyFactory: ({ operation, requestId }) => `${operation}-${requestId}`,
    });

    await expect(
      client.sendEvent("req_2", { type: "PROGRESS" }, { retry: { maxAttempts: 2 } }),
    ).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails with typed retry exhaustion after repeated retryable errors", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      return new Response(JSON.stringify({ message: "still failing" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    });

    const client = createCallbackClient({
      baseUrl: "https://gateway.example",
      callbackToken: "cb-token",
      fetchImpl: fetchMock as typeof fetch,
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 },
    });

    await expect(client.complete("req_3", { status: "failed" })).rejects.toMatchObject({
      name: "XappsServerSdkError",
      code: "CALLBACK_RETRY_EXHAUSTED",
    } satisfies Partial<XappsServerSdkError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
