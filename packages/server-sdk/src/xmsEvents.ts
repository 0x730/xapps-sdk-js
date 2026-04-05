const XMS_LIFECYCLE_EVENT_TYPES = [
  "xapps.xms.purchase_intent.prepared",
  "xapps.xms.transaction.reconciled",
  "xapps.xms.access.issued",
  "xapps.xms.access_snapshot.refreshed",
] as const;

export type XmsLifecycleEventType = (typeof XMS_LIFECYCLE_EVENT_TYPES)[number];

export type XmsLifecycleEventEnvelope = {
  eventId?: string | null;
  eventType?: string | null;
  occurredAt?: string | null;
  installationId?: string | null;
  payload?: Record<string, unknown> | null;
};

export type NormalizedXmsLifecycleEvent = {
  eventId: string | null;
  eventType: XmsLifecycleEventType;
  occurredAt: string | null;
  payload: Record<string, unknown>;
  scope: {
    clientId: string | null;
    publisherId: string | null;
    subjectId: string | null;
    installationId: string | null;
    realmRef: string | null;
    xappId: string | null;
    xappVersionId: string | null;
  };
  correlation: {
    purchaseIntentId: string | null;
    paymentSessionId: string | null;
    requestId: string | null;
    snapshotId: string | null;
    entitlementId: string | null;
    subscriptionContractId: string | null;
    walletAccountId: string | null;
    walletLedgerId: string | null;
    transactionId: string | null;
  };
  semantics: {
    phase: "prepare_intent" | "reconcile_transaction" | "issue_access" | "refresh_access";
    reason: string | null;
    issuanceMode: string | null;
    accessTier: string | null;
    accessState: string | null;
    balanceState: string | null;
    purchaseIntentStatus: string | null;
    transactionStatus: string | null;
    packageId: string | null;
    priceId: string | null;
    offeringId: string | null;
  };
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function readNestedRecord(record: UnknownRecord | null, key: string): UnknownRecord | null {
  return asRecord(record?.[key]);
}

function readNestedString(record: UnknownRecord | null, key: string): string | null {
  return readString(record?.[key]);
}

export function isXmsLifecycleEventType(value: unknown): value is XmsLifecycleEventType {
  return (
    typeof value === "string" && (XMS_LIFECYCLE_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function normalizeXmsLifecycleEvent(
  input: XmsLifecycleEventEnvelope | UnknownRecord | null | undefined,
): NormalizedXmsLifecycleEvent | null {
  const envelope = asRecord(input);
  if (!envelope) return null;

  const eventType = readString(envelope.eventType);
  if (!isXmsLifecycleEventType(eventType)) return null;

  const payload = asRecord(envelope.payload) ?? {};
  const purchaseIntent = readNestedRecord(payload, "purchase_intent");
  const transaction = readNestedRecord(payload, "transaction");
  const accessProjection = readNestedRecord(payload, "access_projection");

  let phase: NormalizedXmsLifecycleEvent["semantics"]["phase"] = "prepare_intent";
  if (eventType === "xapps.xms.transaction.reconciled") phase = "reconcile_transaction";
  if (eventType === "xapps.xms.access.issued") phase = "issue_access";
  if (eventType === "xapps.xms.access_snapshot.refreshed") phase = "refresh_access";

  return {
    eventId: readString(envelope.eventId),
    eventType,
    occurredAt: readString(envelope.occurredAt),
    payload,
    scope: {
      clientId: readNestedString(payload, "client_id"),
      publisherId: readNestedString(payload, "publisher_id"),
      subjectId: readNestedString(payload, "subject_id"),
      installationId:
        readNestedString(payload, "installation_id") ?? readString(envelope.installationId),
      realmRef: readNestedString(payload, "realm_ref"),
      xappId: readNestedString(payload, "xapp_id"),
      xappVersionId: readNestedString(payload, "xapp_version_id"),
    },
    correlation: {
      purchaseIntentId:
        readNestedString(payload, "purchase_intent_id") ??
        readNestedString(purchaseIntent, "purchase_intent_id"),
      paymentSessionId:
        readNestedString(payload, "payment_session_id") ??
        readNestedString(transaction, "payment_session_id") ??
        readNestedString(purchaseIntent, "payment_session_id"),
      requestId:
        readNestedString(payload, "request_id") ??
        readNestedString(transaction, "request_id") ??
        readNestedString(purchaseIntent, "request_id"),
      snapshotId: readNestedString(payload, "snapshot_id"),
      entitlementId: readNestedString(payload, "entitlement_id"),
      subscriptionContractId: readNestedString(payload, "subscription_contract_id"),
      walletAccountId: readNestedString(payload, "wallet_account_id"),
      walletLedgerId: readNestedString(payload, "wallet_ledger_id"),
      transactionId: readNestedString(transaction, "id"),
    },
    semantics: {
      phase,
      reason: readNestedString(payload, "reason"),
      issuanceMode: readNestedString(payload, "issuance_mode"),
      accessTier: readNestedString(accessProjection, "tier"),
      accessState: readNestedString(accessProjection, "entitlement_state"),
      balanceState: readNestedString(accessProjection, "balance_state"),
      purchaseIntentStatus:
        readNestedString(purchaseIntent, "status") ?? readNestedString(payload, "intent_status"),
      transactionStatus: readNestedString(transaction, "status"),
      packageId:
        readNestedString(purchaseIntent, "package_id") ??
        readNestedString(readNestedRecord(purchaseIntent, "package"), "id"),
      priceId:
        readNestedString(purchaseIntent, "price_id") ??
        readNestedString(readNestedRecord(purchaseIntent, "price"), "id"),
      offeringId:
        readNestedString(purchaseIntent, "offering_id") ??
        readNestedString(readNestedRecord(purchaseIntent, "offering"), "id"),
    },
  };
}

export { XMS_LIFECYCLE_EVENT_TYPES };
