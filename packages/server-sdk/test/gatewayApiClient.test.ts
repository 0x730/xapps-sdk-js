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

  it("supports low-level xapp monetization lifecycle routes", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      const method = String(init?.method || "GET").toUpperCase();

      if (
        href === "https://gateway.example.test/v1/xapps/xapp_123/monetization" &&
        method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            sellables: [{ id: "offering_123" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/access?subject_id=sub_123" &&
        method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            access_projection: { has_current_access: true, credits_remaining: 500 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/current-subscription?installation_id=inst_123" &&
        method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            current_subscription: { id: "sub_123", status: "active" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/wallet-accounts?subject_id=sub_123" &&
        method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            items: [
              {
                id: "wallet_123",
                status: "active",
                product_slug: "creator_credits_500",
                balance_remaining: "500",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/wallet-ledger?subject_id=sub_123&payment_session_id=pay_123" &&
        method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            items: [
              {
                id: "ledger_123",
                wallet_account_id: "wallet_123",
                event_kind: "top_up",
                payment_session_id: "pay_123",
                amount: "500",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/wallet-accounts/wallet_123/consume" &&
        method === "POST"
      ) {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({
          amount: "25",
          source_ref: "feature:priority_support_call",
          metadata: {
            feature_key: "priority_support_call",
            surface: "creator-club",
          },
        });
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            wallet_account: {
              id: "wallet_123",
              product_slug: "creator_credits_500",
              balance_remaining: "475",
            },
            wallet_ledger: {
              id: "ledger_consume_123",
              wallet_account_id: "wallet_123",
              event_kind: "consume",
              source_ref: "feature:priority_support_call",
              amount: "25",
            },
            access_projection: { has_current_access: true, credits_remaining: 475 },
            snapshot_id: "snapshot_123",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/purchase-intents/prepare" &&
        method === "POST"
      ) {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({
          offering_id: "offering_123",
          package_id: "package_123",
          price_id: "price_123",
          subject_id: "sub_123",
          source_kind: "owner_managed_external",
          source_ref: "creator-club",
          payment_lane: "publisher_rendered_playground",
        });
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            prepared_intent: { purchase_intent_id: "intent_123", status: "created" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/purchase-intents/intent_123" &&
        method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            prepared_intent: { purchase_intent_id: "intent_123", status: "awaiting_payment" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/purchase-intents/intent_123/transactions" &&
        method === "POST"
      ) {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({
          status: "verified",
          payment_session_id: "pay_123",
        });
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            transaction: { id: "txn_123", status: "verified" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/purchase-intents/intent_123/transactions" &&
        method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            items: [{ id: "txn_123", status: "verified" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/purchase-intents/intent_123/payment-session" &&
        method === "POST"
      ) {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({
          payment_guard_ref: "creator_club_gateway_managed_hosted",
          issuer: "gateway",
          scheme: "mock_manual",
          return_url: "https://tenant.example.test/return",
          metadata: { source: "creator-club" },
        });
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            payment_session: { payment_session_id: "pay_123", status: "pending" },
            payment_page_url: "https://pay.example.test/pay_123",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/purchase-intents/intent_123/payment-session/reconcile" &&
        method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            prepared_intent: { purchase_intent_id: "intent_123", status: "paid" },
            payment_session: { payment_session_id: "pay_123", status: "completed" },
            transaction: { id: "txn_123", status: "verified" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/purchase-intents/intent_123/payment-session/finalize" &&
        method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            result: {
              prepared_intent: { purchase_intent_id: "intent_123", status: "paid" },
              payment_session: { payment_session_id: "pay_123", status: "completed" },
              transaction: { id: "txn_123", status: "verified" },
              access_projection: { has_current_access: true },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/purchase-intents/intent_123/issue-access" &&
        method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            prepared_intent: { purchase_intent_id: "intent_123", status: "paid" },
            issuance_mode: "one_time_purchase",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/subscription-contracts/contract_123/reconcile-payment-session" &&
        method === "POST"
      ) {
        const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        expect(payload).toMatchObject({ payment_session_id: "pay_renewal_123" });
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            payment_session: { payment_session_id: "pay_renewal_123", status: "completed" },
            subscription_contract: { id: "contract_123", status: "active" },
            current_subscription: { id: "contract_123", status: "active" },
            access_projection: { entitlement_state: "active" },
            transaction: { id: "txn_renewal_123", status: "verified" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/subscription-contracts/contract_123/cancel" &&
        method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            payment_session: null,
            subscription_contract: { id: "contract_123", status: "cancelled" },
            current_subscription: { id: "contract_123", status: "cancelled" },
            access_projection: { entitlement_state: "active" },
            transaction: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        href ===
          "https://gateway.example.test/v1/xapps/xapp_123/monetization/subscription-contracts/contract_123/refresh-state" &&
        method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            xapp_id: "xapp_123",
            version_id: "ver_123",
            payment_session: null,
            subscription_contract: { id: "contract_123", status: "past_due" },
            current_subscription: { id: "contract_123", status: "past_due" },
            access_projection: { entitlement_state: "suspended" },
            transaction: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unhandled request: ${method} ${href}`);
    });

    const client = createGatewayApiClient({
      baseUrl: "https://gateway.example.test",
      fetchImpl,
    });

    await expect(client.getXappMonetizationCatalog("xapp_123")).resolves.toMatchObject({
      xapp_id: "xapp_123",
    });
    await expect(
      client.getXappMonetizationAccess({ xappId: "xapp_123", subjectId: "sub_123" }),
    ).resolves.toMatchObject({
      access_projection: { has_current_access: true, credits_remaining: 500 },
    });
    await expect(
      client.getXappCurrentSubscription({ xappId: "xapp_123", installationId: "inst_123" }),
    ).resolves.toMatchObject({
      current_subscription: { id: "sub_123", status: "active" },
    });
    await expect(
      client.listXappWalletAccounts({ xappId: "xapp_123", subjectId: "sub_123" }),
    ).resolves.toMatchObject({
      items: [{ id: "wallet_123", product_slug: "creator_credits_500", balance_remaining: "500" }],
    });
    await expect(
      client.listXappWalletLedger({
        xappId: "xapp_123",
        subjectId: "sub_123",
        paymentSessionId: "pay_123",
      }),
    ).resolves.toMatchObject({
      items: [{ id: "ledger_123", wallet_account_id: "wallet_123", event_kind: "top_up" }],
    });
    await expect(
      client.consumeXappWalletCredits({
        xappId: "xapp_123",
        walletAccountId: "wallet_123",
        amount: "25",
        sourceRef: "feature:priority_support_call",
        metadata: {
          feature_key: "priority_support_call",
          surface: "creator-club",
        },
      }),
    ).resolves.toMatchObject({
      wallet_account: { id: "wallet_123", balance_remaining: "475" },
      wallet_ledger: {
        id: "ledger_consume_123",
        wallet_account_id: "wallet_123",
        event_kind: "consume",
      },
      access_projection: { has_current_access: true, credits_remaining: 475 },
      snapshot_id: "snapshot_123",
    });
    await expect(
      client.prepareXappPurchaseIntent({
        xappId: "xapp_123",
        offeringId: "offering_123",
        packageId: "package_123",
        priceId: "price_123",
        subjectId: "sub_123",
        sourceKind: "owner_managed_external",
        sourceRef: "creator-club",
        paymentLane: "publisher_rendered_playground",
      }),
    ).resolves.toMatchObject({
      prepared_intent: { purchase_intent_id: "intent_123", status: "created" },
    });
    await expect(
      client.getXappPurchaseIntent({
        xappId: "xapp_123",
        intentId: "intent_123",
      }),
    ).resolves.toMatchObject({
      prepared_intent: { purchase_intent_id: "intent_123", status: "awaiting_payment" },
    });
    await expect(
      client.createXappPurchaseTransaction({
        xappId: "xapp_123",
        intentId: "intent_123",
        status: "verified",
        paymentSessionId: "pay_123",
      }),
    ).resolves.toMatchObject({
      transaction: { id: "txn_123", status: "verified" },
    });
    await expect(
      client.listXappPurchaseTransactions({
        xappId: "xapp_123",
        intentId: "intent_123",
      }),
    ).resolves.toMatchObject({
      items: [{ id: "txn_123", status: "verified" }],
    });
    await expect(
      client.createXappPurchasePaymentSession({
        xappId: "xapp_123",
        intentId: "intent_123",
        paymentGuardRef: "creator_club_gateway_managed_hosted",
        issuer: "gateway",
        scheme: "mock_manual",
        returnUrl: "https://tenant.example.test/return",
        metadata: { source: "creator-club" },
      }),
    ).resolves.toMatchObject({
      payment_session: { payment_session_id: "pay_123", status: "pending" },
      payment_page_url: "https://pay.example.test/pay_123",
    });
    await expect(
      client.reconcileXappPurchasePaymentSession({
        xappId: "xapp_123",
        intentId: "intent_123",
      }),
    ).resolves.toMatchObject({
      transaction: { id: "txn_123", status: "verified" },
    });
    await expect(
      client.issueXappPurchaseAccess({
        xappId: "xapp_123",
        intentId: "intent_123",
      }),
    ).resolves.toMatchObject({
      prepared_intent: { purchase_intent_id: "intent_123", status: "paid" },
    });
    await expect(
      client.finalizeXappPurchasePaymentSession({
        xappId: "xapp_123",
        intentId: "intent_123",
      }),
    ).resolves.toMatchObject({
      transaction: { id: "txn_123", status: "verified" },
      access_projection: { has_current_access: true },
    });
    await expect(
      client.reconcileXappSubscriptionContractPaymentSession({
        xappId: "xapp_123",
        contractId: "contract_123",
        paymentSessionId: "pay_renewal_123",
      }),
    ).resolves.toMatchObject({
      subscription_contract: { id: "contract_123", status: "active" },
      transaction: { id: "txn_renewal_123", status: "verified" },
    });
    await expect(
      client.cancelXappSubscriptionContract({
        xappId: "xapp_123",
        contractId: "contract_123",
      }),
    ).resolves.toMatchObject({
      subscription_contract: { id: "contract_123", status: "cancelled" },
    });
    await expect(
      client.refreshXappSubscriptionContractState({
        xappId: "xapp_123",
        contractId: "contract_123",
      }),
    ).resolves.toMatchObject({
      subscription_contract: { id: "contract_123", status: "past_due" },
      access_projection: { entitlement_state: "suspended" },
    });
  });
});
