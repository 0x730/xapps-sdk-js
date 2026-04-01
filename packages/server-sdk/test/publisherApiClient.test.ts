import { describe, expect, it, vi } from "vitest";
import { PublisherApiClientError, createPublisherApiClient } from "../src/publisherApiClient.js";

describe("server-sdk publisherApiClient", () => {
  it("covers publisher linking and bridge helpers with typed responses", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      const method = String(init?.method || "GET").toUpperCase();
      const headers = new Headers(init?.headers);

      if (
        href === "https://publisher.example.test/v1/publisher/links/complete" &&
        method === "POST"
      ) {
        expect(headers.get("authorization")).toBe("Bearer publisher-token");
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({
          subjectId: "sub_123",
          xappId: "xapp_demo",
          publisherUserId: "publisher-user-123",
          realm: "prod",
          metadata: { email: "demo@example.test" },
        });
        return new Response(JSON.stringify({ success: true, link_id: "lnk_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (
        href === "https://publisher.example.test/v1/publisher/links/revoke" &&
        method === "POST"
      ) {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({
          subjectId: "sub_123",
          xappId: "xapp_demo",
          publisherUserId: "publisher-user-123",
          reason: "user_disconnect",
        });
        return new Response(JSON.stringify({ revoked: true, alreadyRevoked: false, deleted: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (href === "https://publisher.example.test/v1/publisher/links/status" && method === "GET") {
        return new Response(
          JSON.stringify({
            linked: true,
            publisherUserId: "publisher-user-123",
            link_id: "lnk_123",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (
        href === "https://publisher.example.test/v1/publisher/bridge/token" &&
        method === "POST"
      ) {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toEqual({
          publisher_id: "pub_123",
          scopes: ["publisher.api:read", "publisher.api:read"],
          link_required: true,
        });
        return new Response(
          JSON.stringify({
            vendor_assertion: "vendor_assertion_fixture",
            issuer: "xapps",
            subject_id: "sub_123",
            link_id: "lnk_123",
            expires_in: 900,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      throw new Error(`Unhandled request: ${method} ${href}`);
    });

    const client = createPublisherApiClient({
      baseUrl: "https://publisher.example.test",
      token: "publisher-token",
      fetchImpl,
    });

    await expect(
      client.completeLink({
        subjectId: "sub_123",
        xappId: "xapp_demo",
        publisherUserId: "publisher-user-123",
        realm: "prod",
        metadata: { email: "demo@example.test" },
      }),
    ).resolves.toEqual({ success: true, link_id: "lnk_123" });

    await expect(client.getLinkStatus()).resolves.toEqual({
      linked: true,
      publisherUserId: "publisher-user-123",
      link_id: "lnk_123",
    });

    await expect(
      client.revokeLink({
        subjectId: "sub_123",
        xappId: "xapp_demo",
        publisherUserId: "publisher-user-123",
        reason: "user_disconnect",
      }),
    ).resolves.toEqual({ revoked: true, alreadyRevoked: false, deleted: 1 });

    await expect(
      client.exchangeBridgeToken({
        publisher_id: "pub_123",
        scopes: ["publisher.api:read", "", "publisher.api:read"],
        link_required: true,
      }),
    ).resolves.toEqual({
      vendor_assertion: "vendor_assertion_fixture",
      issuer: "xapps",
      subject_id: "sub_123",
      link_id: "lnk_123",
      expires_in: 900,
    });
  });

  it("surfaces publisher bridge linking conflicts as typed API conflicts", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          message: "Linking required before vendor assertion minting",
          code: "NEEDS_LINKING",
          setup_url: "https://publisher.example.test/link",
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      );
    });

    const client = createPublisherApiClient({
      baseUrl: "https://publisher.example.test",
      token: "publisher-token",
      fetchImpl,
    });

    await expect(
      client.exchangeBridgeToken({
        publisher_id: "pub_123",
        link_required: true,
      }),
    ).rejects.toMatchObject<Partial<PublisherApiClientError>>({
      code: "PUBLISHER_API_CONFLICT",
      status: 409,
    });
  });
});
