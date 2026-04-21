type UnknownRecord = Record<string, unknown>;

type ScopeFieldsInput = {
  subjectId?: string | null;
  subject_id?: string | null;
  installationId?: string | null;
  installation_id?: string | null;
  realmRef?: string | null;
  realm_ref?: string | null;
};

type PreparePurchaseInput = ScopeFieldsInput & {
  xappId: string;
  offeringId?: string | null;
  offering_id?: string | null;
  packageId?: string | null;
  package_id?: string | null;
  priceId?: string | null;
  price_id?: string | null;
  sourceKind?: string | null;
  source_kind?: string | null;
  sourceRef?: string | null;
  source_ref?: string | null;
  paymentLane?: string | null;
  payment_lane?: string | null;
  paymentSessionId?: string | null;
  payment_session_id?: string | null;
  requestId?: string | null;
  request_id?: string | null;
};

export type StartXappHostedPurchaseInput = PreparePurchaseInput & {
  paymentGuardRef?: string | null;
  payment_guard_ref?: string | null;
  issuer?: string | null;
  scheme?: string | null;
  paymentScheme?: string | null;
  payment_scheme?: string | null;
  returnUrl?: string | null;
  return_url?: string | null;
  cancelUrl?: string | null;
  cancel_url?: string | null;
  xappsResume?: string | null;
  xapps_resume?: string | null;
  pageUrl?: string | null;
  page_url?: string | null;
  locale?: string | null;
  metadata?: UnknownRecord | null;
};

export type FinalizeXappHostedPurchaseInput = {
  xappId: string;
  intentId?: string | null;
  intent_id?: string | null;
};

export type ActivateXappPurchaseReferenceInput = PreparePurchaseInput & {
  status?: string | null;
  providerRef?: string | null;
  provider_ref?: string | null;
  evidenceRef?: string | null;
  evidence_ref?: string | null;
  settlementRef?: string | null;
  settlement_ref?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  occurredAt?: string | null;
  occurred_at?: string | null;
};

export type ReadXappMonetizationSnapshotInput = ScopeFieldsInput & {
  xappId: string;
  includeWalletAccounts?: boolean | null;
  includeWalletLedger?: boolean | null;
  walletAccountId?: string | null;
  wallet_account_id?: string | null;
  paymentSessionId?: string | null;
  payment_session_id?: string | null;
  requestId?: string | null;
  request_id?: string | null;
  settlementRef?: string | null;
  settlement_ref?: string | null;
};

export type XappMonetizationReferencePackageSummary = {
  package_slug: string | null;
  paywall_slug: string | null;
  product_family: string | null;
  package_kind: string | null;
  purchase_policy: {
    can_purchase: boolean;
    status: "available" | "current_recurring_plan" | "owned_additive_unlock";
    transition_kind:
      | "start_recurring"
      | "replace_recurring"
      | "buy_additive_unlock"
      | "buy_credit_pack"
      | "activate_hybrid"
      | "none";
    reason: string | null;
  } | null;
};

export type XappMonetizationReferenceSummary = {
  current_recurring_plan: {
    product_slug: string | null;
    package_slug: string | null;
    status: string | null;
    renews_at: string | null;
  } | null;
  owned_additive_unlocks: XappMonetizationReferencePackageSummary[];
  available_additive_unlocks: XappMonetizationReferencePackageSummary[];
  recurring_options: XappMonetizationReferencePackageSummary[];
  credit_topups: XappMonetizationReferencePackageSummary[];
  blocked_packages: XappMonetizationReferencePackageSummary[];
  owned_entitlement_count: number;
  has_current_access: boolean;
};

export type ConsumeXappWalletCreditsInput = {
  xappId: string;
  walletAccountId?: string | null;
  wallet_account_id?: string | null;
  amount: string;
  sourceRef?: string | null;
  source_ref?: string | null;
  metadata?: UnknownRecord | null;
};

export type ResolveXappMonetizationScopeInput = {
  scopeKind?: string | null;
  scope_kind?: string | null;
  context?: UnknownRecord | null;
  realmRef?: string | null;
  realm_ref?: string | null;
};

export type ResolveXappHostedPaymentDefinitionInput = {
  manifest: UnknownRecord;
  paymentGuardRef?: string | null;
  payment_guard_ref?: string | null;
  paymentScheme?: string | null;
  payment_scheme?: string | null;
  env?: Record<string, string | undefined>;
};

export type ListXappHostedPaymentPresetsInput = {
  manifest: UnknownRecord;
};

type GatewayPurchaseFlowClient = {
  prepareXappPurchaseIntent: (input: UnknownRecord) => Promise<UnknownRecord>;
  createXappPurchasePaymentSession?: (input: UnknownRecord) => Promise<UnknownRecord>;
  reconcileXappPurchasePaymentSession?: (input: UnknownRecord) => Promise<UnknownRecord>;
  finalizeXappPurchasePaymentSession?: (input: UnknownRecord) => Promise<UnknownRecord>;
  issueXappPurchaseAccess?: (input: UnknownRecord) => Promise<UnknownRecord>;
  createXappPurchaseTransaction?: (input: UnknownRecord) => Promise<UnknownRecord>;
  getXappMonetizationAccess?: (input: UnknownRecord) => Promise<UnknownRecord>;
  getXappCurrentSubscription?: (input: UnknownRecord) => Promise<UnknownRecord>;
  listXappEntitlements?: (input: UnknownRecord) => Promise<UnknownRecord>;
  listXappWalletAccounts?: (input: UnknownRecord) => Promise<UnknownRecord>;
  listXappWalletLedger?: (input: UnknownRecord) => Promise<UnknownRecord>;
  consumeXappWalletCredits?: (input: UnknownRecord) => Promise<UnknownRecord>;
};

function readOptionalString(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : undefined;
}

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function readLocalizedText(value: unknown, fallback = ""): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return (
      readString((value as UnknownRecord).en) ||
      readString((value as UnknownRecord).ro) ||
      Object.values(value as UnknownRecord)
        .map((item) => readString(item))
        .find(Boolean) ||
      fallback
    );
  }
  return readString(value) || fallback;
}

function readMetadata(value: unknown): UnknownRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as UnknownRecord;
}

function readLower(value: unknown): string {
  return readString(value).toLowerCase();
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = readLower(value);
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function requireGatewayMethod<T extends keyof GatewayPurchaseFlowClient>(
  gatewayClient: GatewayPurchaseFlowClient,
  methodName: T,
): NonNullable<GatewayPurchaseFlowClient[T]> {
  const method = gatewayClient[methodName];
  if (typeof method !== "function") {
    throw new TypeError(`gatewayClient must implement ${String(methodName)}`);
  }
  return method as NonNullable<GatewayPurchaseFlowClient[T]>;
}

function requireIntentId(result: UnknownRecord, methodName: string): string {
  const preparedIntent =
    result.prepared_intent && typeof result.prepared_intent === "object"
      ? (result.prepared_intent as UnknownRecord)
      : null;
  const intentId = readOptionalString(preparedIntent?.purchase_intent_id);
  if (!intentId) {
    throw new Error(`${methodName} returned a purchase intent without purchase_intent_id`);
  }
  return intentId;
}

function buildScopeFields(input: ScopeFieldsInput): UnknownRecord {
  return {
    ...(readOptionalString(input.subjectId ?? input.subject_id)
      ? { subject_id: readOptionalString(input.subjectId ?? input.subject_id) }
      : {}),
    ...(readOptionalString(input.installationId ?? input.installation_id)
      ? { installation_id: readOptionalString(input.installationId ?? input.installation_id) }
      : {}),
    ...(readOptionalString(input.realmRef ?? input.realm_ref)
      ? { realm_ref: readOptionalString(input.realmRef ?? input.realm_ref) }
      : {}),
  };
}

function buildPreparePayload(input: PreparePurchaseInput): UnknownRecord {
  return {
    xappId: input.xappId,
    offering_id: readOptionalString(input.offeringId ?? input.offering_id),
    package_id: readOptionalString(input.packageId ?? input.package_id),
    price_id: readOptionalString(input.priceId ?? input.price_id),
    ...buildScopeFields(input),
    source_kind: readOptionalString(input.sourceKind ?? input.source_kind),
    source_ref: readOptionalString(input.sourceRef ?? input.source_ref),
    payment_lane: readOptionalString(input.paymentLane ?? input.payment_lane),
    payment_session_id: readOptionalString(input.paymentSessionId ?? input.payment_session_id),
    request_id: readOptionalString(input.requestId ?? input.request_id),
  };
}

export function normalizeXappMonetizationScopeKind(
  value: unknown,
): "subject" | "installation" | "realm" {
  const raw = readString(value).toLowerCase();
  if (raw === "installation" || raw === "realm") return raw;
  return "subject";
}

export function resolveXappMonetizationScope(input: ResolveXappMonetizationScopeInput): {
  scope_kind: "subject" | "installation" | "realm";
  scope_fields: UnknownRecord;
} {
  const scopeKind = normalizeXappMonetizationScopeKind(input.scopeKind ?? input.scope_kind);
  const context =
    input.context && typeof input.context === "object" && !Array.isArray(input.context)
      ? input.context
      : {};
  if (scopeKind === "installation") {
    const installationId = readString(context.installation_id);
    if (!installationId) {
      throw new Error("Installation context is required for installation-scoped monetization");
    }
    return {
      scope_kind: scopeKind,
      scope_fields: { installation_id: installationId },
    };
  }
  if (scopeKind === "realm") {
    const realmRef = readString(input.realmRef ?? input.realm_ref);
    if (!realmRef) {
      throw new Error("realmRef is required for realm-scoped monetization");
    }
    return {
      scope_kind: scopeKind,
      scope_fields: { realm_ref: realmRef },
    };
  }
  const subjectId = readString(context.subject_id);
  if (!subjectId) {
    throw new Error("Subject context is required for subject-scoped monetization");
  }
  return {
    scope_kind: scopeKind,
    scope_fields: { subject_id: subjectId },
  };
}

function normalizePaymentIssuerMode(value: unknown): string {
  const raw = readString(value).toLowerCase();
  if (
    raw === "gateway_managed" ||
    raw === "tenant_delegated" ||
    raw === "publisher_delegated" ||
    raw === "owner_managed"
  ) {
    return raw;
  }
  return "";
}

function formatPaymentIssuerModeLabel(issuerMode: string) {
  const raw = normalizePaymentIssuerMode(issuerMode);
  if (raw === "gateway_managed") return "Gateway managed";
  if (raw === "tenant_delegated") return "Tenant delegated";
  if (raw === "publisher_delegated") return "Publisher delegated";
  if (raw === "owner_managed") return "Owner managed";
  return "Unknown lane";
}

function formatPaymentSchemeLabel(value: unknown) {
  const raw = readString(value).toLowerCase();
  if (!raw) return "";
  return raw.replace(/_/g, " ");
}

function buildHostedPaymentPresetDescription(definition: UnknownRecord) {
  const paymentUi = readMetadata(definition.payment_ui) || {};
  const copy = readMetadata(paymentUi.copy) || {};
  const subtitle = readLocalizedText(copy.subtitle);
  if (subtitle) return subtitle;
  const title = readLocalizedText(copy.title);
  if (title) return title;
  const issuerMode = normalizePaymentIssuerMode(definition.payment_issuer_mode);
  if (!issuerMode) return "Hosted payment lane from manifest definition.";
  return `${issuerMode.replace(/_/g, " ")} hosted payment lane.`;
}

function listAcceptedPaymentSchemes(definition: UnknownRecord): string[] {
  const out: string[] = [];
  const primary = readString(definition.payment_scheme).toLowerCase();
  if (primary) out.push(primary);
  const accepts = Array.isArray(definition.accepts) ? definition.accepts : [];
  for (const item of accepts) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const scheme = readString((item as UnknownRecord).scheme).toLowerCase();
    if (scheme && !out.includes(scheme)) out.push(scheme);
  }
  return out;
}

function buildHostedPaymentPresetDescriptionForScheme(
  definition: UnknownRecord,
  paymentScheme: string,
) {
  const paymentUi = readMetadata(definition.payment_ui) || {};
  const schemes = Array.isArray(paymentUi.schemes) ? paymentUi.schemes : [];
  const schemeUi = schemes.find((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return readString((item as UnknownRecord).scheme).toLowerCase() === paymentScheme;
  }) as UnknownRecord | undefined;
  if (schemeUi) {
    const subtitle = readLocalizedText(schemeUi.subtitle);
    if (subtitle) return subtitle;
    const title = readLocalizedText(schemeUi.title);
    if (title) return title;
  }
  return buildHostedPaymentPresetDescription(definition);
}

function findPaymentGuardDefinition(
  manifest: UnknownRecord,
  paymentGuardRef: string,
): UnknownRecord | null {
  const definitions = Array.isArray(manifest.payment_guard_definitions)
    ? manifest.payment_guard_definitions
    : Array.isArray((manifest as any).paymentGuardDefinitions)
      ? ((manifest as any).paymentGuardDefinitions as unknown[])
      : [];
  for (const definition of definitions) {
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) continue;
    if (readString((definition as UnknownRecord).name) === paymentGuardRef) {
      return definition as UnknownRecord;
    }
  }
  return null;
}

export function listXappHostedPaymentPresets(input: ListXappHostedPaymentPresetsInput): Array<{
  key: string;
  label: string;
  description: string;
  paymentGuardRef: string;
  paymentScheme: string | null;
  issuerMode: string;
  delegated: boolean;
}> {
  const manifest = readMetadata(input.manifest) || {};
  const definitions = Array.isArray(manifest.payment_guard_definitions)
    ? manifest.payment_guard_definitions
    : Array.isArray((manifest as any).paymentGuardDefinitions)
      ? ((manifest as any).paymentGuardDefinitions as unknown[])
      : [];
  return definitions
    .flatMap((definition) => {
      if (!definition || typeof definition !== "object" || Array.isArray(definition)) return null;
      const record = definition as UnknownRecord;
      const paymentGuardRef = readString(record.name);
      const issuerMode = normalizePaymentIssuerMode(record.payment_issuer_mode);
      if (!paymentGuardRef || !issuerMode) return null;
      const schemes = listAcceptedPaymentSchemes(record);
      return schemes.map((scheme, index) => {
        const schemeLabel = formatPaymentSchemeLabel(scheme);
        return {
          key: `${paymentGuardRef}:${scheme || index}`,
          label: schemeLabel
            ? `${formatPaymentIssuerModeLabel(issuerMode)} (${schemeLabel})`
            : formatPaymentIssuerModeLabel(issuerMode),
          description: buildHostedPaymentPresetDescriptionForScheme(record, scheme),
          paymentGuardRef,
          paymentScheme: scheme || null,
          issuerMode,
          delegated: issuerMode === "tenant_delegated" || issuerMode === "publisher_delegated",
        };
      });
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export function findXappHostedPaymentPreset(
  input: ListXappHostedPaymentPresetsInput & {
    paymentGuardRef?: string | null;
    payment_guard_ref?: string | null;
    paymentScheme?: string | null;
    payment_scheme?: string | null;
  },
) {
  const paymentGuardRef = readString(input.paymentGuardRef ?? input.payment_guard_ref);
  const paymentScheme = readString(input.paymentScheme ?? input.payment_scheme).toLowerCase();
  if (!paymentGuardRef) return null;
  return (
    listXappHostedPaymentPresets({ manifest: input.manifest }).find(
      (item) =>
        item.paymentGuardRef === paymentGuardRef &&
        (!paymentScheme || readString(item.paymentScheme).toLowerCase() === paymentScheme),
    ) || null
  );
}

function readDelegatedReturnSecret(
  issuerMode: string,
  env: Record<string, string | undefined>,
): { secret?: string; secret_ref?: string } {
  if (issuerMode === "tenant_delegated") {
    const secret_ref = readString(
      env.TENANT_DELEGATED_PAYMENT_RETURN_SECRET_REF ?? env.TENANT_PAYMENT_RETURN_SECRET_REF,
    );
    const secret = readString(
      env.TENANT_DELEGATED_PAYMENT_RETURN_SECRET ?? env.TENANT_PAYMENT_RETURN_SECRET,
    );
    return {
      ...(secret_ref ? { secret_ref } : {}),
      ...(secret ? { secret } : {}),
    };
  }
  if (issuerMode === "publisher_delegated") {
    const secret_ref = readString(
      env.PUBLISHER_DELEGATED_PAYMENT_RETURN_SECRET_REF ?? env.PUBLISHER_PAYMENT_RETURN_SECRET_REF,
    );
    const secret = readString(
      env.PUBLISHER_DELEGATED_PAYMENT_RETURN_SECRET ?? env.PUBLISHER_PAYMENT_RETURN_SECRET,
    );
    return {
      ...(secret_ref ? { secret_ref } : {}),
      ...(secret ? { secret } : {}),
    };
  }
  return {};
}

export function resolveXappHostedPaymentDefinition(
  input: ResolveXappHostedPaymentDefinitionInput,
): {
  paymentGuardRef: string;
  issuerMode: string;
  scheme: string | null;
  metadata: UnknownRecord | null;
  definition: UnknownRecord;
} {
  const paymentGuardRef = readString(input.paymentGuardRef ?? input.payment_guard_ref);
  if (!paymentGuardRef) {
    throw new Error("paymentGuardRef is required");
  }
  const definition = findPaymentGuardDefinition(input.manifest, paymentGuardRef);
  if (!definition) {
    throw new Error("Unknown payment lane. Choose one of the configured payment definitions.");
  }
  const issuerMode = normalizePaymentIssuerMode(definition.payment_issuer_mode);
  if (!issuerMode) {
    throw new Error(`Unsupported payment issuer mode for ${paymentGuardRef}`);
  }
  const requestedScheme = readString(input.paymentScheme ?? input.payment_scheme).toLowerCase();
  const supportedSchemes = listAcceptedPaymentSchemes(definition);
  const scheme = requestedScheme || supportedSchemes[0] || null;
  if (requestedScheme && !supportedSchemes.includes(requestedScheme)) {
    throw new Error(`Unsupported payment scheme ${requestedScheme} for ${paymentGuardRef}`);
  }
  const env = input.env || {};
  if (issuerMode === "tenant_delegated" || issuerMode === "publisher_delegated") {
    const signingSecret = readDelegatedReturnSecret(issuerMode, env);
    if (!signingSecret.secret_ref && !signingSecret.secret) {
      throw new Error(
        issuerMode === "tenant_delegated"
          ? "Tenant-delegated payment return secret or secret ref is not configured."
          : "Publisher-delegated payment return secret or secret ref is not configured.",
      );
    }
    return {
      paymentGuardRef,
      issuerMode,
      scheme,
      definition,
      metadata: {
        payment_return_signing: {
          issuer: issuerMode,
          signing_lane: issuerMode,
          resolver_source: "session_metadata_delegated",
          ...signingSecret,
        },
      },
    };
  }
  return {
    paymentGuardRef,
    issuerMode,
    scheme,
    definition,
    metadata: null,
  };
}

function buildSnapshotScopePayload(input: ScopeFieldsInput & { xappId: string }): UnknownRecord {
  return {
    xappId: input.xappId,
    ...buildScopeFields(input),
  };
}

export async function readXappMonetizationSnapshot(
  gatewayClient: GatewayPurchaseFlowClient,
  input: ReadXappMonetizationSnapshotInput,
): Promise<UnknownRecord> {
  const getMonetizationAccess = requireGatewayMethod(gatewayClient, "getXappMonetizationAccess");
  const getCurrentSubscription = requireGatewayMethod(gatewayClient, "getXappCurrentSubscription");
  const listEntitlements =
    typeof gatewayClient.listXappEntitlements === "function"
      ? gatewayClient.listXappEntitlements.bind(gatewayClient)
      : null;
  const listWalletAccounts = requireGatewayMethod(gatewayClient, "listXappWalletAccounts");
  const scopePayload = buildSnapshotScopePayload(input);
  const includeWalletAccounts = input.includeWalletAccounts !== false;
  const includeWalletLedger = input.includeWalletLedger === true;

  const [
    accessResult,
    currentSubscriptionResult,
    entitlementsResult,
    walletAccountsResult,
    walletLedgerResult,
  ] = await Promise.all([
    getMonetizationAccess(scopePayload),
    getCurrentSubscription(scopePayload),
    listEntitlements ? listEntitlements(scopePayload) : Promise.resolve(null),
    includeWalletAccounts ? listWalletAccounts(scopePayload) : Promise.resolve(null),
    includeWalletLedger
      ? requireGatewayMethod(
          gatewayClient,
          "listXappWalletLedger",
        )({
          xappId: input.xappId,
          ...buildScopeFields(input),
          wallet_account_id: readOptionalString(input.walletAccountId ?? input.wallet_account_id),
          payment_session_id: readOptionalString(
            input.paymentSessionId ?? input.payment_session_id,
          ),
          request_id: readOptionalString(input.requestId ?? input.request_id),
          settlement_ref: readOptionalString(input.settlementRef ?? input.settlement_ref),
        })
      : Promise.resolve(null),
  ]);

  return {
    access_projection:
      accessResult?.access_projection && typeof accessResult.access_projection === "object"
        ? accessResult.access_projection
        : null,
    current_subscription:
      currentSubscriptionResult?.current_subscription &&
      typeof currentSubscriptionResult.current_subscription === "object"
        ? currentSubscriptionResult.current_subscription
        : null,
    entitlements:
      entitlementsResult && Array.isArray((entitlementsResult as UnknownRecord).items)
        ? ((entitlementsResult as UnknownRecord).items as unknown[])
        : [],
    wallet_accounts:
      walletAccountsResult && Array.isArray(walletAccountsResult.items)
        ? walletAccountsResult.items
        : [],
    wallet_ledger:
      walletLedgerResult && Array.isArray(walletLedgerResult.items) ? walletLedgerResult.items : [],
  };
}

function hasCurrentOwnedEntitlement(value: unknown): boolean {
  const entitlement = asRecord(value);
  if (!entitlement) return false;
  const status = readLower(entitlement.status);
  if (status !== "active" && status !== "grace_period") return false;
  const expiresAt = readString(entitlement.expires_at);
  if (!expiresAt) return true;
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isNaN(expiresAtMs) || expiresAtMs > Date.now();
}

function normalizeReferencePackageSummary(
  value: unknown,
): XappMonetizationReferencePackageSummary | null {
  const record = asRecord(value);
  if (!record) return null;
  const purchasePolicyRecord = asRecord(record.purchase_policy);
  return {
    package_slug: readOptionalString(record.package_slug) ?? null,
    paywall_slug: readOptionalString(record.paywall_slug) ?? null,
    product_family: readOptionalString(record.product_family) ?? null,
    package_kind: readOptionalString(record.package_kind) ?? null,
    purchase_policy: purchasePolicyRecord
      ? {
          can_purchase: readBoolean(
            purchasePolicyRecord.can_purchase ?? purchasePolicyRecord.canPurchase,
            true,
          ),
          status:
            readLower(purchasePolicyRecord.status) === "current_recurring_plan"
              ? "current_recurring_plan"
              : readLower(purchasePolicyRecord.status) === "owned_additive_unlock"
                ? "owned_additive_unlock"
                : "available",
          transition_kind:
            readLower(
              purchasePolicyRecord.transition_kind ?? purchasePolicyRecord.transitionKind,
            ) === "start_recurring"
              ? "start_recurring"
              : readLower(
                    purchasePolicyRecord.transition_kind ?? purchasePolicyRecord.transitionKind,
                  ) === "replace_recurring"
                ? "replace_recurring"
                : readLower(
                      purchasePolicyRecord.transition_kind ?? purchasePolicyRecord.transitionKind,
                    ) === "buy_additive_unlock"
                  ? "buy_additive_unlock"
                  : readLower(
                        purchasePolicyRecord.transition_kind ?? purchasePolicyRecord.transitionKind,
                      ) === "buy_credit_pack"
                    ? "buy_credit_pack"
                    : readLower(
                          purchasePolicyRecord.transition_kind ??
                            purchasePolicyRecord.transitionKind,
                        ) === "activate_hybrid"
                      ? "activate_hybrid"
                      : "none",
          reason: readOptionalString(purchasePolicyRecord.reason) ?? null,
        }
      : null,
  };
}

export function buildXappMonetizationReferenceSummary(input: {
  snapshot?: unknown;
  paywallPackages?: unknown;
}): XappMonetizationReferenceSummary {
  const snapshot = asRecord(input.snapshot) ?? {};
  const currentSubscription = asRecord(snapshot.current_subscription);
  const entitlements = Array.isArray(snapshot.entitlements) ? snapshot.entitlements : [];
  const accessProjection = asRecord(snapshot.access_projection);
  const paywallPackages = (Array.isArray(input.paywallPackages) ? input.paywallPackages : [])
    .map((item) => normalizeReferencePackageSummary(item))
    .filter((item): item is XappMonetizationReferencePackageSummary => Boolean(item));

  return {
    current_recurring_plan: currentSubscription
      ? {
          product_slug: readOptionalString(currentSubscription.product_slug) ?? null,
          package_slug: readOptionalString(currentSubscription.package_slug) ?? null,
          status: readOptionalString(currentSubscription.status) ?? null,
          renews_at: readOptionalString(currentSubscription.renews_at) ?? null,
        }
      : null,
    owned_additive_unlocks: paywallPackages.filter(
      (item) => item.purchase_policy?.status === "owned_additive_unlock",
    ),
    available_additive_unlocks: paywallPackages.filter(
      (item) =>
        (readLower(item.product_family) === "one_time_unlock" ||
          readLower(item.package_kind) === "one_time_unlock") &&
        item.purchase_policy?.can_purchase !== false,
    ),
    recurring_options: paywallPackages.filter((item) => {
      const transitionKind = item.purchase_policy?.transition_kind ?? "none";
      return transitionKind === "start_recurring" || transitionKind === "replace_recurring";
    }),
    credit_topups: paywallPackages.filter(
      (item) => item.purchase_policy?.transition_kind === "buy_credit_pack",
    ),
    blocked_packages: paywallPackages.filter(
      (item) => item.purchase_policy?.can_purchase === false,
    ),
    owned_entitlement_count: entitlements.filter((item) => hasCurrentOwnedEntitlement(item)).length,
    has_current_access: readBoolean(accessProjection?.has_current_access, false),
  };
}

export async function consumeXappWalletCredits(
  gatewayClient: GatewayPurchaseFlowClient,
  input: ConsumeXappWalletCreditsInput,
): Promise<UnknownRecord> {
  const consumeWalletCredits = requireGatewayMethod(gatewayClient, "consumeXappWalletCredits");
  const walletAccountId = readOptionalString(input.walletAccountId ?? input.wallet_account_id);
  if (!walletAccountId) {
    throw new Error("walletAccountId is required");
  }
  const amount = readString(input.amount);
  if (!amount) {
    throw new Error("amount is required");
  }
  const consumed = await consumeWalletCredits({
    xappId: input.xappId,
    walletAccountId,
    amount,
    source_ref: readOptionalString(input.sourceRef ?? input.source_ref),
    metadata: readMetadata(input.metadata),
  });
  return {
    wallet_account:
      consumed?.wallet_account && typeof consumed.wallet_account === "object"
        ? consumed.wallet_account
        : null,
    wallet_ledger:
      consumed?.wallet_ledger && typeof consumed.wallet_ledger === "object"
        ? consumed.wallet_ledger
        : null,
    access_projection:
      consumed?.access_projection && typeof consumed.access_projection === "object"
        ? consumed.access_projection
        : null,
    snapshot_id: readOptionalString(consumed?.snapshot_id) ?? null,
    consumed,
  };
}

export async function startXappHostedPurchase(
  gatewayClient: GatewayPurchaseFlowClient,
  input: StartXappHostedPurchaseInput,
): Promise<UnknownRecord> {
  const preparePurchaseIntent = requireGatewayMethod(gatewayClient, "prepareXappPurchaseIntent");
  const createPurchasePaymentSession = requireGatewayMethod(
    gatewayClient,
    "createXappPurchasePaymentSession",
  );
  const prepared = await preparePurchaseIntent(buildPreparePayload(input));
  const intentId = requireIntentId(prepared, "prepareXappPurchaseIntent");
  const paymentSession = await createPurchasePaymentSession({
    xappId: input.xappId,
    intentId,
    payment_guard_ref: readOptionalString(input.paymentGuardRef ?? input.payment_guard_ref),
    issuer: readOptionalString(input.issuer),
    scheme: readOptionalString(input.scheme),
    payment_scheme: readOptionalString(input.paymentScheme ?? input.payment_scheme),
    return_url: readOptionalString(input.returnUrl ?? input.return_url),
    cancel_url: readOptionalString(input.cancelUrl ?? input.cancel_url),
    xapps_resume: readOptionalString(input.xappsResume ?? input.xapps_resume),
    page_url: readOptionalString(input.pageUrl ?? input.page_url),
    locale: readOptionalString(input.locale),
    ...buildScopeFields(input),
    metadata: readMetadata(input.metadata),
  });
  return {
    prepared_intent:
      prepared?.prepared_intent && typeof prepared.prepared_intent === "object"
        ? prepared.prepared_intent
        : null,
    payment_session:
      paymentSession?.payment_session && typeof paymentSession.payment_session === "object"
        ? paymentSession.payment_session
        : null,
    payment_page_url: readOptionalString(paymentSession?.payment_page_url) ?? null,
  };
}

export async function finalizeXappHostedPurchase(
  gatewayClient: GatewayPurchaseFlowClient,
  input: FinalizeXappHostedPurchaseInput,
): Promise<UnknownRecord> {
  const finalizePurchasePaymentSession = requireGatewayMethod(
    gatewayClient,
    "finalizeXappPurchasePaymentSession",
  );
  const intentId = readOptionalString(input.intentId ?? input.intent_id);
  if (!intentId) {
    throw new Error("intentId is required");
  }
  const finalized = await finalizePurchasePaymentSession({
    xappId: input.xappId,
    intentId,
  });
  return {
    prepared_intent:
      finalized?.prepared_intent && typeof finalized.prepared_intent === "object"
        ? finalized.prepared_intent
        : null,
    payment_session:
      finalized?.payment_session && typeof finalized.payment_session === "object"
        ? finalized.payment_session
        : null,
    transaction:
      finalized?.transaction && typeof finalized.transaction === "object"
        ? finalized.transaction
        : null,
    access_projection:
      finalized?.access_projection && typeof finalized.access_projection === "object"
        ? finalized.access_projection
        : null,
    issued: finalized,
  };
}

export async function activateXappPurchaseReference(
  gatewayClient: GatewayPurchaseFlowClient,
  input: ActivateXappPurchaseReferenceInput,
): Promise<UnknownRecord> {
  const preparePurchaseIntent = requireGatewayMethod(gatewayClient, "prepareXappPurchaseIntent");
  const createPurchaseTransaction = requireGatewayMethod(
    gatewayClient,
    "createXappPurchaseTransaction",
  );
  const issuePurchaseAccess = requireGatewayMethod(gatewayClient, "issueXappPurchaseAccess");
  const prepared = await preparePurchaseIntent(buildPreparePayload(input));
  const intentId = requireIntentId(prepared, "prepareXappPurchaseIntent");
  const preparedIntent =
    prepared?.prepared_intent && typeof prepared.prepared_intent === "object"
      ? (prepared.prepared_intent as UnknownRecord)
      : null;
  const preparedPrice =
    preparedIntent?.price && typeof preparedIntent.price === "object"
      ? (preparedIntent.price as UnknownRecord)
      : null;
  const transaction = await createPurchaseTransaction({
    xappId: input.xappId,
    intentId,
    status: readOptionalString(input.status) ?? "verified",
    provider_ref: readOptionalString(input.providerRef ?? input.provider_ref),
    evidence_ref: readOptionalString(input.evidenceRef ?? input.evidence_ref),
    payment_session_id: readOptionalString(input.paymentSessionId ?? input.payment_session_id),
    request_id: readOptionalString(input.requestId ?? input.request_id),
    settlement_ref: readOptionalString(input.settlementRef ?? input.settlement_ref),
    amount: input.amount ?? preparedPrice?.amount ?? undefined,
    currency: readOptionalString(input.currency) ?? readOptionalString(preparedPrice?.currency),
    occurred_at: readOptionalString(input.occurredAt ?? input.occurred_at),
  });
  const issued = await issuePurchaseAccess({
    xappId: input.xappId,
    intentId,
  });
  return {
    prepared_intent: preparedIntent,
    transaction:
      transaction?.transaction && typeof transaction.transaction === "object"
        ? transaction.transaction
        : null,
    issued,
  };
}
