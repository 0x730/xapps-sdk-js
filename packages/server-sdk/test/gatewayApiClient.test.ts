import { describe, expect, it, vi } from "vitest";
import { createGatewayApiClient } from "../src/gatewayApiClient.js";

describe("server-sdk gatewayApiClient", () => {
  it("maps camelCase compatibility fields to the canonical snake_case gateway payload", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;

      expect(payload).toMatchObject({
        payment_session_id: "pay_123",
        page_url: "https://app.example.test/page",
        xapp_id: "xapp_weather",
        tool_name: "lookup",
        payment_scheme: "stripe",
        return_url: "https://app.example.test/return",
        cancel_url: "https://app.example.test/cancel",
        xapps_resume: "resume_123",
        subject_id: "sub_123",
        installation_id: "inst_123",
        client_id: "client_123",
      });

      return new Response(
        JSON.stringify({
          result: {
            session: {
              payment_session_id: "pay_123",
              status: "pending",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const client = createGatewayApiClient({
      baseUrl: "https://gateway.example.test",
      fetchImpl,
    });

    await expect(
      client.createPaymentSession({
        paymentSessionId: "pay_123",
        pageUrl: "https://app.example.test/page",
        xappId: "xapp_weather",
        toolName: "lookup",
        amount: "10.00",
        paymentScheme: "stripe",
        returnUrl: "https://app.example.test/return",
        cancelUrl: "https://app.example.test/cancel",
        xappsResume: "resume_123",
        subjectId: "sub_123",
        installationId: "inst_123",
        clientId: "client_123",
      }),
    ).resolves.toMatchObject({
      session: {
        payment_session_id: "pay_123",
        status: "pending",
      },
    });
  });

  it("supports host integration routes for subject resolution, catalog/widget sessions, and installations", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      const method = String(init?.method || "GET").toUpperCase();

      if (href === "https://gateway.example.test/v1/subjects/resolve" && method === "POST") {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({
          type: "user",
          identifier: {
            idType: "email",
            value: "user@example.test",
            hint: "user@example.test",
          },
          email: "user@example.test",
        });
        return new Response(JSON.stringify({ subjectId: "sub_123" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }

      if (href === "https://gateway.example.test/v1/catalog-sessions" && method === "POST") {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload.origin).toBe("https://tenant.example.test");
        expect(payload.subjectId).toBe("sub_123");
        if (payload.xappId) {
          expect(payload).toMatchObject({
            xappId: "xapp_123",
            publishers: ["pub_a"],
            tags: ["featured"],
          });
        } else {
          expect(payload).toMatchObject({
            publishers: ["pub_a"],
            tags: ["featured"],
          });
        }
        return new Response(
          JSON.stringify({
            token: "catalog_token",
            embedUrl: "/embed/catalog?token=catalog_token",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }

      if (href === "https://gateway.example.test/v1/widget-sessions" && method === "POST") {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({
          installationId: "inst_123",
          widgetId: "widget_123",
          subjectId: "sub_123",
          hostReturnUrl: "https://tenant.example.test/return",
          resultPresentation: "runtime_default",
        });
        expect(new Headers(init?.headers).get("origin")).toBe("https://tenant.example.test");
        return new Response(
          JSON.stringify({
            token: "widget_token",
            embedUrl: "/embed/widgets/widget_123?token=widget_token",
            context: { installationId: "inst_123" },
            widget: { id: "widget_123" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/requests/latest?installationId=inst_123&toolName=submit_certificate_request_async&subjectId=sub_123" &&
        method === "GET" &&
        new Headers(init?.headers).get("authorization") === "Bearer bst_123"
      ) {
        expect(new Headers(init?.headers).get("origin")).toBe("https://tenant.example.test");
        return new Response(
          JSON.stringify({
            requestId: "req_latest_ticket_123",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/requests/latest?installationId=inst_123&toolName=submit_certificate_request_async&subjectId=sub_123" &&
        method === "GET"
      ) {
        expect(new Headers(init?.headers).get("origin")).toBe("https://tenant.example.test");
        expect(new Headers(init?.headers).get("authorization")).not.toBe("Bearer bst_123");
        return new Response(
          JSON.stringify({
            requestId: "req_latest_123",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href === "https://gateway.example.test/v1/installations?subjectId=sub_123" &&
        method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            items: [{ id: "inst_123", xapp_id: "xapp_123", status: "installed" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href === "https://gateway.example.test/v1/installations?subjectId=sub_123" &&
        method === "POST"
      ) {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({ xappId: "xapp_123", termsAccepted: true });
        return new Response(
          JSON.stringify({
            installation: { id: "inst_123", xapp_id: "xapp_123", status: "installed" },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/installations/inst_123/update?subjectId=sub_123" &&
        method === "POST"
      ) {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({ termsAccepted: true });
        return new Response(
          JSON.stringify({
            installation: { id: "inst_123", xapp_id: "xapp_123", status: "installed" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href === "https://gateway.example.test/v1/installations/inst_123?subjectId=sub_123" &&
        method === "DELETE"
      ) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unhandled request: ${method} ${href}`);
    });

    const client = createGatewayApiClient({
      baseUrl: "https://gateway.example.test",
      fetchImpl,
    });

    await expect(
      client.resolveSubject({
        type: "user",
        identifier: {
          idType: "email",
          value: "user@example.test",
          hint: "user@example.test",
        },
        email: "user@example.test",
      }),
    ).resolves.toEqual({ subjectId: "sub_123" });

    await expect(
      client.createCatalogSession({
        origin: "https://tenant.example.test",
        subjectId: "sub_123",
        xappId: "xapp_123",
        publishers: ["pub_a"],
        tags: ["featured"],
      }),
    ).resolves.toEqual({
      token: "catalog_token",
      embedUrl: "/embed/catalog?token=catalog_token",
    });

    await expect(
      client.createCatalogSession({
        origin: "https://tenant.example.test",
        subjectId: "sub_123",
        publishers: ["", "pub_a", " pub_a ", "   "],
        tags: ["featured", "", " featured "],
      }),
    ).resolves.toEqual({
      token: "catalog_token",
      embedUrl: "/embed/catalog?token=catalog_token",
    });

    await expect(
      client.createWidgetSession({
        installationId: "inst_123",
        widgetId: "widget_123",
        origin: "https://tenant.example.test",
        subjectId: "sub_123",
        hostReturnUrl: "https://tenant.example.test/return",
        resultPresentation: "runtime_default",
      }),
    ).resolves.toMatchObject({
      token: "widget_token",
      embedUrl: "/embed/widgets/widget_123?token=widget_token",
      context: { installationId: "inst_123" },
      widget: { id: "widget_123" },
    });

    await expect(
      client.verifyBrowserWidgetContext({
        hostOrigin: "https://tenant.example.test",
        installationId: "inst_123",
        bindToolName: "submit_certificate_request_async",
        subjectId: "sub_123",
      }),
    ).resolves.toEqual({
      verified: true,
      latestRequestId: "req_latest_123",
      result: { requestId: "req_latest_123" },
    });

    await expect(
      client.verifyBrowserWidgetContext({
        hostOrigin: "https://tenant.example.test",
        installationId: "inst_123",
        bindToolName: "submit_certificate_request_async",
        subjectId: "sub_123",
        bootstrapTicket: "bst_123",
      }),
    ).resolves.toEqual({
      verified: true,
      latestRequestId: "req_latest_ticket_123",
      result: { requestId: "req_latest_ticket_123" },
    });

    await expect(client.listInstallations({ subjectId: "sub_123" })).resolves.toEqual({
      items: [{ id: "inst_123", xapp_id: "xapp_123", status: "installed" }],
    });

    await expect(
      client.installXapp({ xappId: "xapp_123", subjectId: "sub_123", termsAccepted: true }),
    ).resolves.toEqual({
      installation: { id: "inst_123", xapp_id: "xapp_123", status: "installed" },
    });

    await expect(
      client.updateInstallation({
        installationId: "inst_123",
        subjectId: "sub_123",
        termsAccepted: true,
      }),
    ).resolves.toEqual({
      installation: { id: "inst_123", xapp_id: "xapp_123", status: "installed" },
    });

    await expect(
      client.uninstallInstallation({ installationId: "inst_123", subjectId: "sub_123" }),
    ).resolves.toEqual({ ok: true });
  });
});
