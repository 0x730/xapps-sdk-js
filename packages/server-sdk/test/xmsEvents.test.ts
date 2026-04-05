import { describe, expect, it } from "vitest";
import { isXmsLifecycleEventType, normalizeXmsLifecycleEvent } from "../src/xmsEvents.js";

describe("server-sdk xms event helpers", () => {
  it("recognizes canonical xms lifecycle event types", () => {
    expect(isXmsLifecycleEventType("xapps.xms.access.issued")).toBe(true);
    expect(isXmsLifecycleEventType("xapps.request.completed")).toBe(false);
  });

  it("normalizes access-issued event envelopes into stable scope and correlation fields", () => {
    const normalized = normalizeXmsLifecycleEvent({
      eventId: "evt_123",
      eventType: "xapps.xms.access.issued",
      occurredAt: "2026-04-04T09:15:23.000Z",
      installationId: null,
      payload: {
        client_id: "client_123",
        publisher_id: "publisher_123",
        subject_id: "subject_123",
        installation_id: null,
        realm_ref: "workspace_demo",
        xapp_id: "xapp_123",
        xapp_version_id: "ver_123",
        purchase_intent_id: "intent_123",
        issuance_mode: "wallet_topup",
        payment_session_id: "pay_123",
        request_id: "req_123",
        entitlement_id: "ent_123",
        subscription_contract_id: "sub_123",
        wallet_account_id: "wallet_123",
        wallet_ledger_id: "ledger_123",
        snapshot_id: "snap_123",
        access_projection: {
          tier: "creator_pro_membership_access",
          balance_state: "sufficient",
          entitlement_state: "active",
          has_current_access: true,
        },
      },
    });

    expect(normalized).toMatchObject({
      eventId: "evt_123",
      eventType: "xapps.xms.access.issued",
      scope: {
        clientId: "client_123",
        publisherId: "publisher_123",
        subjectId: "subject_123",
        installationId: null,
        realmRef: "workspace_demo",
        xappId: "xapp_123",
        xappVersionId: "ver_123",
      },
      correlation: {
        purchaseIntentId: "intent_123",
        paymentSessionId: "pay_123",
        requestId: "req_123",
        snapshotId: "snap_123",
        entitlementId: "ent_123",
        subscriptionContractId: "sub_123",
        walletAccountId: "wallet_123",
        walletLedgerId: "ledger_123",
      },
      semantics: {
        phase: "issue_access",
        issuanceMode: "wallet_topup",
        accessTier: "creator_pro_membership_access",
        accessState: "active",
        balanceState: "sufficient",
      },
    });
  });

  it("normalizes purchase-intent and transaction data from nested payload blocks", () => {
    const normalized = normalizeXmsLifecycleEvent({
      eventId: "evt_456",
      eventType: "xapps.xms.transaction.reconciled",
      occurredAt: "2026-04-04T09:15:23.000Z",
      installationId: "inst_123",
      payload: {
        client_id: "client_123",
        xapp_id: "xapp_123",
        intent_status: "reconciled",
        purchase_intent: {
          purchase_intent_id: "intent_123",
          status: "prepared",
          package: { id: "pkg_123" },
          price: { id: "price_123" },
          offering: { id: "offer_123" },
        },
        transaction: {
          id: "txn_123",
          status: "paid",
          payment_session_id: "pay_123",
          request_id: "req_123",
        },
      },
    });

    expect(normalized).toMatchObject({
      scope: {
        installationId: "inst_123",
      },
      correlation: {
        purchaseIntentId: "intent_123",
        paymentSessionId: "pay_123",
        requestId: "req_123",
        transactionId: "txn_123",
      },
      semantics: {
        phase: "reconcile_transaction",
        purchaseIntentStatus: "prepared",
        transactionStatus: "paid",
        packageId: "pkg_123",
        priceId: "price_123",
        offeringId: "offer_123",
      },
    });
  });
});
