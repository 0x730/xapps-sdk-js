import AjvImport from "ajv";
import addFormatsImport from "ajv-formats";
import {
  ALL_KNOWN_GUARD_TRIGGERS,
  type KnownGuardTrigger,
  type HookEffectKind,
  type HookExecutionMode,
  type HookFailurePolicy,
  type HookIdempotencyScope,
  type HookProviderScope,
} from "./hookContracts.js";
import { normalizeHookGuardConfig } from "./hookResolution.js";
import {
  buildNotificationDefinitionRegistry,
  buildNotificationTemplateRegistry,
  readNotificationRef,
  readNotificationTemplateRef,
  resolveNotificationConfigWithGovernance,
  resolveNotificationTemplateVariant,
} from "./notifications.js";
import {
  buildInvoiceDefinitionRegistry,
  buildInvoiceTemplateRegistry,
  readInvoiceRef,
  readInvoiceTemplateRef,
  resolveInvoiceConfigWithGovernance,
  resolveInvoiceTemplateVariant,
} from "./invoices.js";
import {
  buildSubjectProfileDefinitionRegistry,
  readSubjectProfileGuardRef,
  resolveSubjectProfileGuardConfigWithGovernance,
} from "./subjectProfileGuardDefinitions.js";
import { resolveSubjectProfileRequirement } from "./subjectProfileRequirement.js";

export type LocalizedText = string | Record<string, string | null | undefined> | null | undefined;

export { resolveNotificationTemplateVariant, resolveInvoiceTemplateVariant };

function isLocalizedTextRecord(value: unknown): value is Record<string, string | null | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => entry == null || typeof entry === "string");
}

export function normalizeManifestLocale(input: unknown, fallbackLocale = "en"): string {
  const raw = String(input || "").trim();
  if (!raw) return fallbackLocale;
  const parts = raw
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return fallbackLocale;
  const [language, ...rest] = parts;
  return [language.toLowerCase(), ...rest.map((part) => part.toUpperCase())].join("-");
}

export function getManifestLocaleCandidates(input: unknown, fallbackLocale = "en"): string[] {
  const normalizedFallback = normalizeManifestLocale(fallbackLocale, "en");
  const normalized = normalizeManifestLocale(input, normalizedFallback);
  const out = new Set<string>([normalized]);
  const dash = normalized.indexOf("-");
  if (dash > 0) out.add(normalized.slice(0, dash));
  const fallbackDash = normalizedFallback.indexOf("-");
  if (fallbackDash > 0) out.add(normalizedFallback.slice(0, fallbackDash));
  out.add(normalizedFallback);
  out.add("en");
  return Array.from(out);
}

export function resolveManifestLocalizedText(
  value: LocalizedText,
  locale: unknown,
  fallbackLocale = "en",
): string {
  if (typeof value === "string") return value;
  if (!isLocalizedTextRecord(value)) return "";
  for (const candidate of getManifestLocaleCandidates(locale, fallbackLocale)) {
    const resolved = value[candidate];
    if (typeof resolved === "string" && resolved.trim()) return resolved;
  }
  for (const resolved of Object.values(value)) {
    if (typeof resolved === "string" && resolved.trim()) return resolved;
  }
  return "";
}

export type XappManifestTool = {
  tool_name: string;
  title: LocalizedText;
  description?: LocalizedText;
  input_schema: Record<string, unknown>;
  input_ui_schema?: Record<string, unknown>;
  output_ui_schema?: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  dispatch_policy?: {
    endpoint_ref?: string;
    auth_lane?: string;
    credential_profile?: string;
    allow_on_behalf_of?: boolean;
    required_policy_fields?: string[];
    disclosure_mode_default?: "final_answer_only" | "scoped_fields";
  };
  signature_policy?: "none" | "ed25519" | "signature_not_required";
  async?: boolean;
  adapter?: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    path: string;
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    body?: unknown;
    response_mapping?: Record<string, unknown>;
  };
};

export type XappManifestWidget = {
  widget_name: string;
  type: "read" | "write";
  renderer: "platform" | "publisher" | "json-forms" | "ui-kit" | "app-shell";
  bind_tool_name?: string;
  entry?: { kind?: "platform_template" | "iframe_url"; template?: string; url?: string };
  capabilities?: string[];
  title?: LocalizedText;
  accessibility?: { label?: LocalizedText; role?: string };
  theme?: { mode?: "light" | "dark" | string; tokens?: Record<string, string> };
  requires_linking?: boolean;
  required_context?: Record<string, unknown>;
  ui_override?: Record<string, unknown>;
  config?: Record<string, unknown> & {
    result_presentation?: "runtime_default" | "inline" | "publisher_managed";
    resultPresentation?: "runtime_default" | "inline" | "publisher_managed";
    xapps?: Record<string, unknown> & {
      result_presentation?: "runtime_default" | "inline" | "publisher_managed";
      resultPresentation?: "runtime_default" | "inline" | "publisher_managed";
      publisher_runtime_mode?: "bridge" | "passive";
      publisherRuntimeMode?: "bridge" | "passive";
      bootstrap_transport?: "public" | "signed_ticket";
      bootstrapTransport?: "public" | "signed_ticket";
    };
  };
};

export type XappManifestEndpointConfig = {
  base_url: string;
  timeout_ms?: number;
  health_check?: { path?: string; interval_s?: number };
  retry_policy?: { max_retries?: number; backoff?: "none" | "linear" | "exponential" };
  region?: string;
  labels?: Record<string, string>;
};

export type XappManifestEndpointGroup = {
  strategy: "failover" | "round_robin" | "region_affinity";
  members: string[];
};

export type XappManifestEventSubscription = {
  event_type: string;
  webhook_url: string;
};

export type XappManifestConnectivity = {
  executor_mode?: "PUBLIC_EXECUTOR" | "PRIVATE_EXECUTOR" | "AGENT_TUNNEL";
  auth_mode?: "PUBLISHER_APP" | "USER_DELEGATED" | "HYBRID";
  signing_policy?: "none" | "subject_proof" | "publisher_proof";
  webhooks?: Record<string, unknown>;
  proxy_policy?: Record<string, unknown>;
};

export type XappManifestGuard = {
  slug: string;
  trigger: KnownGuardTrigger;
  headless?: boolean;
  blocking?: boolean;
  order?: number;
  implements?: string;
  config?: Record<string, unknown> & {
    effect_kind?: HookEffectKind;
    effectKind?: HookEffectKind;
    execution_mode?: HookExecutionMode;
    executionMode?: HookExecutionMode;
    provider_scope?: HookProviderScope;
    providerScope?: HookProviderScope;
    provider_execution?: "inline" | "queued";
    providerExecution?: "inline" | "queued";
    failure_policy?: HookFailurePolicy;
    failurePolicy?: HookFailurePolicy;
    idempotency_scope?: HookIdempotencyScope;
    idempotencyScope?: HookIdempotencyScope;
  };
};

export type XappManifestMonetizationProduct = {
  slug: string;
  title?: LocalizedText;
  description?: LocalizedText;
  product_family: string;
  status?: "draft" | "active" | "archived";
  virtual_currency?: {
    code: string;
    name?: string;
    status?: "active" | "archived";
  };
  metadata?: Record<string, unknown>;
};

export type XappManifestMonetizationVirtualCurrency = {
  code: string;
  name?: string;
  status?: "active" | "archived";
};

export type XappManifestMonetizationOffering = {
  slug: string;
  title?: LocalizedText;
  description?: LocalizedText;
  placement?: string;
  status?: "draft" | "active" | "archived";
  targeting_rules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type XappManifestMonetizationPackage = {
  slug: string;
  product_ref: string;
  offering_ref: string;
  package_kind?: "standard" | "one_time_unlock" | "credit_pack" | "subscription";
  display_order?: number;
  status?: "draft" | "active" | "archived";
  metadata?: Record<string, unknown>;
};

export type XappManifestMonetizationPrice = {
  slug: string;
  package_ref: string;
  currency: string;
  amount: number;
  billing_period?: "day" | "week" | "month" | "year";
  billing_period_count?: number;
  trial_policy?: Record<string, unknown>;
  intro_policy?: Record<string, unknown>;
  country_rules?: Record<string, unknown>;
  status?: "draft" | "active" | "archived";
  metadata?: Record<string, unknown>;
};

export type XappManifestMonetizationPaywall = {
  slug: string;
  title?: LocalizedText;
  description?: LocalizedText;
  placement?: string;
  offering_refs: string[];
  package_refs?: string[];
  default_package_ref?: string;
  status?: "draft" | "active" | "archived";
  targeting_rules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type XappManifestMonetizationUsagePolicy = {
  tool_name: string;
  unit?: string;
  credit_cost: number;
  virtual_currency_code?: string;
  status?: "draft" | "active" | "archived";
  metadata?: Record<string, unknown>;
};

export type XappManifestMonetizationHooks = {
  after_payment_completed?: Record<string, unknown>;
};

export type XappManifest = {
  title?: LocalizedText;
  name: string;
  slug: string;
  description?: LocalizedText;
  image?: string;
  tags?: string[];
  terms?: { title?: LocalizedText; text?: LocalizedText; url?: string; version?: string };
  visibility?: string;
  metadata?: Record<string, unknown>;
  target_client_id?: string;
  scopes?: string[];
  version: string;
  guards?: XappManifestGuard[];
  guards_policy?: Partial<
    Record<
      KnownGuardTrigger,
      | "all"
      | "any"
      | {
          mode?: "all" | "any";
          on_fail?: "stop_on_fail" | "continue_on_fail";
        }
    >
  >;
  linking?: {
    strategy: "platform_v1" | "custom";
    setup_url: string;
    guard_slug?: string;
  };
  tools: XappManifestTool[];
  widgets: XappManifestWidget[];
  endpoints?: Record<string, XappManifestEndpointConfig>;
  endpoint_groups?: Record<string, XappManifestEndpointGroup>;
  event_subscriptions?: XappManifestEventSubscription[];
  connectivity?: XappManifestConnectivity;
  monetization?: {
    virtual_currencies?: XappManifestMonetizationVirtualCurrency[];
    products?: XappManifestMonetizationProduct[];
    offerings?: XappManifestMonetizationOffering[];
    packages?: XappManifestMonetizationPackage[];
    prices?: XappManifestMonetizationPrice[];
    paywalls?: XappManifestMonetizationPaywall[];
    usage_policies?: XappManifestMonetizationUsagePolicy[];
    hooks?: XappManifestMonetizationHooks;
  };
  payment_guard_definitions?: Array<{
    name: string;
    payment_type?: string;
    payment_issuer_mode?: string;
    payment_scheme?: string;
    payment_network?: string;
    payment_allowed_issuers?: string[];
    payment_return_contract?: string;
    payment_return_required?: boolean;
    payment_return_max_age_s?: number;
    payment_return_hmac_secret_refs?: Record<string, string>;
    payment_return_hmac_secrets?: Record<string, string>;
    payment_return_hmac_delegated_secret_refs?: Record<string, Record<string, string>>;
    payment_return_hmac_delegated_secrets?: Record<string, Record<string, string>>;
    payment_provider_credentials?: Record<string, unknown>;
    payment_provider_credentials_refs?: Record<
      string,
      {
        [key: string]: string | Record<string, string> | undefined;
        bundle_ref?: string;
        bundleRef?: string;
        secret_bundle_ref?: string;
        secretBundleRef?: string;
        refs?: Record<string, string>;
        secret_refs?: Record<string, string>;
      }
    >;
    payment_provider_secret_refs?: Record<
      string,
      {
        [key: string]: string | Record<string, string> | undefined;
        bundle_ref?: string;
        bundleRef?: string;
        secret_bundle_ref?: string;
        secretBundleRef?: string;
        refs?: Record<string, string>;
        secret_refs?: Record<string, string>;
      }
    >;
    pricing_model?: string;
    pricing?: Record<string, unknown>;
    receipt_field?: string;
    payment_url?: string;
    accepts?: Array<Record<string, unknown>>;
    payment_ui?: Record<string, unknown>;
    policy?: Record<string, unknown>;
    action?: Record<string, unknown>;
    owner_override_allowlist?: string[];
    owner_pricing_floor?: {
      default_amount?: number;
      xapp_prices?: Record<string, number>;
      tool_overrides?: Record<string, number>;
    };
  }>;
  subject_profile_guard_definitions?: Array<{
    name: string;
    policy?: Record<string, unknown>;
    action?: Record<string, unknown>;
    tools?: string[];
    subject_profile_requirement?: Record<string, unknown>;
    subject_profile_remediation?: Record<string, unknown>;
    subject_profile_sources?: Record<string, unknown>;
    owner_override_allowlist?: string[];
  }>;
  notification_definitions?: Array<{
    name: string;
    channel?: string;
    effect_kind?: HookEffectKind;
    effectKind?: HookEffectKind;
    provider_key?: string;
    providerKey?: string;
    execution_mode?: HookExecutionMode;
    executionMode?: HookExecutionMode;
    provider_scope?: HookProviderScope;
    providerScope?: HookProviderScope;
    provider_execution?: "inline" | "queued";
    providerExecution?: "inline" | "queued";
    failure_policy?: HookFailurePolicy;
    failurePolicy?: HookFailurePolicy;
    idempotency_scope?: HookIdempotencyScope;
    idempotencyScope?: HookIdempotencyScope;
    template_ref?: string;
    templateRef?: string;
    target?: Record<string, unknown>;
    template?: Record<string, unknown>;
  }>;
  notification_templates?: Array<{
    name: string;
    family?: string;
    locale?: string;
    channel?: string;
    subject?: string;
    text?: string;
    html?: string;
  }>;
  invoice_definitions?: Array<{
    name: string;
    provider_key?: string;
    providerKey?: string;
    effect_kind?: HookEffectKind;
    effectKind?: HookEffectKind;
    execution_mode?: HookExecutionMode;
    executionMode?: HookExecutionMode;
    provider_scope?: HookProviderScope;
    providerScope?: HookProviderScope;
    failure_policy?: HookFailurePolicy;
    failurePolicy?: HookFailurePolicy;
    idempotency_scope?: HookIdempotencyScope;
    idempotencyScope?: HookIdempotencyScope;
    invoice_template_ref?: string;
    invoiceTemplateRef?: string;
    invoice?: Record<string, unknown>;
    template?: Record<string, unknown>;
  }>;
  invoice_templates?: Array<{
    name: string;
    family?: string;
    locale?: string;
    title?: string;
    text?: string;
    html?: string;
    [key: string]: unknown;
  }>;
};

export type ManifestWarning = {
  kind:
    | "unreferenced_payment_guard_definitions"
    | "unreferenced_subject_profile_guard_definitions"
    | "unreferenced_notification_definitions"
    | "unreferenced_notification_templates"
    | "unreferenced_invoice_definitions"
    | "unreferenced_invoice_templates";
  details: Record<string, unknown>;
};

export type ParseXappManifestOptions = {
  warn?: (warning: ManifestWarning) => void;
};

function localizedTextSchema(maxLength: number, minLength = 0) {
  const stringRule: Record<string, unknown> = { type: "string", maxLength };
  if (minLength > 0) stringRule.minLength = minLength;
  return {
    anyOf: [
      stringRule,
      {
        type: "object",
        minProperties: 1,
        propertyNames: { type: "string", minLength: 2, maxLength: 32 },
        additionalProperties: {
          anyOf: [{ ...stringRule }, { type: "null" }],
        },
      },
    ],
  };
}

export const xappManifestJsonSchema = {
  type: "object",
  required: ["name", "slug", "version", "tools", "widgets"],
  additionalProperties: false,
  properties: {
    title: localizedTextSchema(200),
    name: { type: "string", minLength: 1, maxLength: 200 },
    slug: { type: "string", minLength: 1, maxLength: 100 },
    description: localizedTextSchema(2000),
    image: { type: "string", maxLength: 2048 },
    tags: { type: "array", maxItems: 50, items: { type: "string", maxLength: 64 } },
    terms: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: localizedTextSchema(200),
        text: localizedTextSchema(20000),
        url: { type: "string", maxLength: 2048 },
        version: { type: "string", maxLength: 64 },
      },
    },
    visibility: { type: "string", maxLength: 32 },
    target_client_id: { type: ["string", "null"], maxLength: 26 },
    metadata: { type: "object" },
    scopes: { type: "array", maxItems: 100, items: { type: "string", maxLength: 200 } },
    version: { type: "string", minLength: 1, maxLength: 64 },
    guards: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["slug", "trigger"],
        additionalProperties: false,
        properties: {
          slug: { type: "string", minLength: 1, maxLength: 100 },
          trigger: { type: "string", enum: [...ALL_KNOWN_GUARD_TRIGGERS] },
          headless: { type: "boolean" },
          blocking: { type: "boolean" },
          order: { type: "integer", minimum: 0, maximum: 1000000 },
          implements: { type: "string", minLength: 1, maxLength: 100 },
          config: { type: "object" },
        },
      },
    },
    guards_policy: {
      type: "object",
      additionalProperties: false,
      properties: {
        "before:installation_create": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "before:widget_load": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "before:session_open": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "before:thread_create": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "before:tool_run": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "after:install": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "after:link_complete": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "before:link_revoke": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "before:uninstall": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "after:tool_complete": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "after:uninstall": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "after:payment_completed": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "after:payment_failed": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "after:request_created": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "after:response_ready": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
        "after:response_finalized": {
          anyOf: [
            { type: "string", enum: ["all", "any"] },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", enum: ["all", "any"] },
                on_fail: { type: "string", enum: ["stop_on_fail", "continue_on_fail"] },
              },
            },
          ],
        },
      },
    },
    linking: {
      type: "object",
      required: ["strategy", "setup_url"],
      additionalProperties: false,
      properties: {
        strategy: { type: "string", enum: ["platform_v1", "custom"] },
        setup_url: { type: "string", minLength: 1, maxLength: 2048 },
        guard_slug: { type: "string", minLength: 1, maxLength: 100 },
      },
    },
    tools: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["tool_name", "title", "input_schema", "output_schema"],
        additionalProperties: false,
        properties: {
          tool_name: { type: "string", minLength: 1, maxLength: 100 },
          title: localizedTextSchema(200, 1),
          description: localizedTextSchema(2000),
          input_schema: { type: "object" },
          input_ui_schema: { type: "object" },
          output_ui_schema: { type: "object" },
          output_schema: { type: "object" },
          dispatch_policy: {
            type: "object",
            additionalProperties: false,
            properties: {
              endpoint_ref: { type: "string", minLength: 1, maxLength: 100 },
              auth_lane: { type: "string", minLength: 1, maxLength: 100 },
              credential_profile: { type: "string", minLength: 1, maxLength: 100 },
              allow_on_behalf_of: { type: "boolean" },
              required_policy_fields: {
                type: "array",
                maxItems: 50,
                items: { type: "string", minLength: 1, maxLength: 100 },
              },
              disclosure_mode_default: {
                type: "string",
                enum: ["final_answer_only", "scoped_fields"],
              },
            },
          },
          signature_policy: { type: "string", enum: ["none", "ed25519", "signature_not_required"] },
          async: { type: "boolean" },
          adapter: {
            type: "object",
            required: ["method", "path"],
            additionalProperties: false,
            properties: {
              method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
              path: { type: "string", minLength: 1, maxLength: 2048 },
              query: { type: "object" },
              headers: { type: "object" },
              body: {},
              response_mapping: { type: "object" },
            },
          },
        },
      },
    },
    widgets: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["widget_name", "type", "renderer"],
        additionalProperties: false,
        properties: {
          widget_name: { type: "string", minLength: 1, maxLength: 100 },
          type: { type: "string", enum: ["read", "write"] },
          renderer: {
            type: "string",
            enum: ["platform", "publisher", "json-forms", "ui-kit", "app-shell"],
          },
          bind_tool_name: { type: "string", maxLength: 100 },
          title: localizedTextSchema(200, 1),
          accessibility: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: localizedTextSchema(300, 1),
              role: { type: "string", minLength: 1, maxLength: 50 },
            },
          },
          theme: {
            type: "object",
            additionalProperties: false,
            properties: {
              mode: { type: "string", minLength: 1, maxLength: 50 },
              tokens: { type: "object", additionalProperties: { type: "string", maxLength: 2000 } },
            },
          },
          entry: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: { type: "string", enum: ["platform_template", "iframe_url"] },
              template: { type: "string", maxLength: 100000 },
              url: { type: "string", maxLength: 2048 },
            },
          },
          capabilities: { type: "array", maxItems: 50, items: { type: "string", maxLength: 64 } },
          requires_linking: { type: "boolean" },
          required_context: { type: "object" },
          ui_override: { type: "object" },
          config: { type: "object" },
        },
      },
    },
    endpoints: {
      type: "object",
      additionalProperties: {
        type: "object",
        required: ["base_url"],
        additionalProperties: false,
        properties: {
          base_url: { type: "string", minLength: 1, maxLength: 2048 },
          timeout_ms: { type: "number", minimum: 100, maximum: 120000 },
          health_check: {
            type: "object",
            additionalProperties: false,
            properties: {
              path: { type: "string", minLength: 1, maxLength: 512 },
              interval_s: { type: "number", minimum: 1, maximum: 86400 },
            },
          },
          retry_policy: {
            type: "object",
            additionalProperties: false,
            properties: {
              max_retries: { type: "number", minimum: 0, maximum: 10 },
              backoff: { type: "string", enum: ["none", "linear", "exponential"] },
            },
          },
          region: { type: "string", minLength: 1, maxLength: 100 },
          labels: { type: "object", additionalProperties: { type: "string", maxLength: 200 } },
        },
      },
    },
    endpoint_groups: {
      type: "object",
      additionalProperties: {
        type: "object",
        required: ["strategy", "members"],
        additionalProperties: false,
        properties: {
          strategy: { type: "string", enum: ["failover", "round_robin", "region_affinity"] },
          members: {
            type: "array",
            minItems: 1,
            maxItems: 20,
            items: { type: "string", minLength: 1, maxLength: 100 },
          },
        },
      },
    },
    event_subscriptions: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["event_type", "webhook_url"],
        additionalProperties: false,
        properties: {
          event_type: { type: "string", minLength: 1, maxLength: 200 },
          webhook_url: { type: "string", minLength: 1, maxLength: 2048 },
        },
      },
    },
    connectivity: {
      type: "object",
      additionalProperties: false,
      properties: {
        executor_mode: {
          type: "string",
          enum: ["PUBLIC_EXECUTOR", "PRIVATE_EXECUTOR", "AGENT_TUNNEL"],
        },
        auth_mode: { type: "string", enum: ["PUBLISHER_APP", "USER_DELEGATED", "HYBRID"] },
        signing_policy: { type: "string", enum: ["none", "subject_proof", "publisher_proof"] },
        webhooks: { type: "object" },
        proxy_policy: { type: "object" },
      },
    },
    monetization: {
      type: "object",
      additionalProperties: false,
      properties: {
        virtual_currencies: {
          type: "array",
          maxItems: 200,
          items: {
            type: "object",
            required: ["code"],
            additionalProperties: false,
            properties: {
              code: { type: "string", minLength: 1, maxLength: 100 },
              name: { type: "string", minLength: 1, maxLength: 200 },
              status: { type: "string", enum: ["active", "archived"] },
            },
          },
        },
        products: {
          type: "array",
          maxItems: 200,
          items: {
            type: "object",
            required: ["slug", "product_family"],
            additionalProperties: false,
            properties: {
              slug: { type: "string", minLength: 1, maxLength: 100 },
              title: localizedTextSchema(200),
              description: localizedTextSchema(2000),
              product_family: { type: "string", minLength: 1, maxLength: 100 },
              status: { type: "string", enum: ["draft", "active", "archived"] },
              virtual_currency: {
                type: "object",
                additionalProperties: false,
                required: ["code"],
                properties: {
                  code: { type: "string", minLength: 1, maxLength: 100 },
                  name: { type: "string", minLength: 1, maxLength: 200 },
                  status: { type: "string", enum: ["active", "archived"] },
                },
              },
              metadata: { type: "object" },
            },
          },
        },
        offerings: {
          type: "array",
          maxItems: 200,
          items: {
            type: "object",
            required: ["slug"],
            additionalProperties: false,
            properties: {
              slug: { type: "string", minLength: 1, maxLength: 100 },
              title: localizedTextSchema(200),
              description: localizedTextSchema(2000),
              placement: { type: "string", minLength: 1, maxLength: 100 },
              status: { type: "string", enum: ["draft", "active", "archived"] },
              targeting_rules: { type: "object" },
              metadata: { type: "object" },
            },
          },
        },
        packages: {
          type: "array",
          maxItems: 500,
          items: {
            type: "object",
            required: ["slug", "product_ref", "offering_ref"],
            additionalProperties: false,
            properties: {
              slug: { type: "string", minLength: 1, maxLength: 100 },
              product_ref: { type: "string", minLength: 1, maxLength: 100 },
              offering_ref: { type: "string", minLength: 1, maxLength: 100 },
              package_kind: {
                type: "string",
                enum: ["standard", "one_time_unlock", "credit_pack", "subscription"],
              },
              display_order: { type: "integer", minimum: 0, maximum: 1000000 },
              status: { type: "string", enum: ["draft", "active", "archived"] },
              metadata: { type: "object" },
            },
          },
        },
        prices: {
          type: "array",
          maxItems: 1000,
          items: {
            type: "object",
            required: ["slug", "package_ref", "currency", "amount"],
            additionalProperties: false,
            properties: {
              slug: { type: "string", minLength: 1, maxLength: 100 },
              package_ref: { type: "string", minLength: 1, maxLength: 100 },
              currency: { type: "string", minLength: 1, maxLength: 16 },
              amount: { type: "number", minimum: 0 },
              billing_period: { type: "string", enum: ["day", "week", "month", "year"] },
              billing_period_count: { type: "integer", minimum: 1, maximum: 1000000 },
              trial_policy: { type: "object" },
              intro_policy: { type: "object" },
              country_rules: { type: "object" },
              status: { type: "string", enum: ["draft", "active", "archived"] },
              metadata: { type: "object" },
            },
          },
        },
        paywalls: {
          type: "array",
          maxItems: 200,
          items: {
            type: "object",
            required: ["slug", "offering_refs"],
            additionalProperties: false,
            properties: {
              slug: { type: "string", minLength: 1, maxLength: 100 },
              title: localizedTextSchema(200),
              description: localizedTextSchema(2000),
              placement: { type: "string", minLength: 1, maxLength: 100 },
              offering_refs: {
                type: "array",
                minItems: 1,
                maxItems: 50,
                items: { type: "string", minLength: 1, maxLength: 100 },
              },
              package_refs: {
                type: "array",
                minItems: 1,
                maxItems: 200,
                items: { type: "string", minLength: 1, maxLength: 100 },
              },
              default_package_ref: { type: "string", minLength: 1, maxLength: 100 },
              status: { type: "string", enum: ["draft", "active", "archived"] },
              targeting_rules: { type: "object" },
              metadata: { type: "object" },
            },
          },
        },
        usage_policies: {
          type: "array",
          maxItems: 200,
          items: {
            type: "object",
            required: ["tool_name", "credit_cost"],
            additionalProperties: false,
            properties: {
              tool_name: { type: "string", minLength: 1, maxLength: 100 },
              unit: { type: "string", minLength: 1, maxLength: 100 },
              credit_cost: { type: "number", minimum: 0 },
              virtual_currency_code: { type: "string", minLength: 1, maxLength: 100 },
              status: { type: "string", enum: ["draft", "active", "archived"] },
              metadata: { type: "object" },
            },
          },
        },
        hooks: {
          type: "object",
          additionalProperties: false,
          properties: {
            after_payment_completed: {
              type: "object",
              additionalProperties: true,
              properties: {
                enabled: { type: "boolean" },
                guard_slug: { type: "string", minLength: 1, maxLength: 200 },
                guardSlug: { type: "string", minLength: 1, maxLength: 200 },
                invoice_ref: { type: "string", minLength: 1, maxLength: 200 },
                invoiceRef: { type: "string", minLength: 1, maxLength: 200 },
                by_payment_guard_ref: {
                  type: "object",
                  additionalProperties: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
                byPaymentGuardRef: {
                  type: "object",
                  additionalProperties: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    payment_guard_definitions: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          payment_type: { type: "string", maxLength: 100 },
          payment_issuer_mode: {
            type: "string",
            maxLength: 100,
            enum: [
              "owner_managed",
              "gateway_managed",
              "tenant_delegated",
              "publisher_delegated",
              "any",
            ],
          },
          payment_scheme: { type: "string", maxLength: 100 },
          payment_network: { type: "string", maxLength: 100 },
          payment_allowed_issuers: {
            type: "array",
            maxItems: 20,
            items: {
              type: "string",
              maxLength: 100,
              enum: ["tenant", "publisher", "gateway", "tenant_delegated", "publisher_delegated"],
            },
          },
          payment_return_contract: { type: "string", maxLength: 200 },
          payment_return_required: { type: "boolean" },
          payment_return_max_age_s: { type: "number", minimum: 0, maximum: 86400 },
          payment_return_hmac_secret_refs: { type: "object" },
          payment_return_hmac_secrets: { type: "object" },
          payment_return_hmac_delegated_secret_refs: { type: "object" },
          payment_return_hmac_delegated_secrets: { type: "object" },
          payment_provider_credentials: { type: "object" },
          payment_provider_credentials_refs: { type: "object" },
          payment_provider_secret_refs: { type: "object" },
          pricing_model: { type: "string", maxLength: 100 },
          pricing: {
            type: "object",
            additionalProperties: false,
            properties: {
              currency: { type: "string", maxLength: 32 },
              default_amount: { type: "number" },
              xapp_prices: { type: "object", additionalProperties: { type: "number" } },
              tool_overrides: { type: "object", additionalProperties: { type: "number" } },
              description: { type: "string", maxLength: 500 },
              asset: { type: "string", maxLength: 256 },
              pay_to: { type: "string", maxLength: 256 },
              payTo: { type: "string", maxLength: 256 },
            },
          },
          receipt_field: { type: "string", maxLength: 200 },
          payment_url: { type: "string", maxLength: 2048 },
          accepts: {
            type: "array",
            maxItems: 20,
            items: { type: "object", additionalProperties: true },
          },
          payment_ui: { type: "object" },
          policy: { type: "object" },
          action: { type: "object" },
          owner_override_allowlist: {
            type: "array",
            maxItems: 100,
            items: { type: "string", minLength: 1, maxLength: 200 },
          },
          owner_pricing_floor: {
            type: "object",
            additionalProperties: false,
            properties: {
              default_amount: { type: "number" },
              xapp_prices: { type: "object", additionalProperties: { type: "number" } },
              tool_overrides: { type: "object", additionalProperties: { type: "number" } },
            },
          },
        },
      },
    },
    subject_profile_guard_definitions: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          policy: { type: "object" },
          action: { type: "object" },
          tools: {
            type: "array",
            maxItems: 100,
            items: { type: "string", minLength: 1, maxLength: 200 },
          },
          subject_profile_requirement: { type: "object" },
          subject_profile_remediation: { type: "object" },
          subject_profile_sources: { type: "object" },
          owner_override_allowlist: {
            type: "array",
            maxItems: 100,
            items: { type: "string", minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    notification_definitions: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          channel: { type: "string", enum: ["email"] },
          effect_kind: {
            type: "string",
            enum: ["policy", "invoice", "notification", "integration_call"],
          },
          effectKind: {
            type: "string",
            enum: ["policy", "invoice", "notification", "integration_call"],
          },
          provider_key: { type: "string", maxLength: 100 },
          providerKey: { type: "string", maxLength: 100 },
          execution_mode: { type: "string", maxLength: 100 },
          executionMode: { type: "string", maxLength: 100 },
          provider_scope: { type: "string", maxLength: 100 },
          providerScope: { type: "string", maxLength: 100 },
          provider_execution: { type: "string", maxLength: 100 },
          providerExecution: { type: "string", maxLength: 100 },
          failure_policy: { type: "string", maxLength: 100 },
          failurePolicy: { type: "string", maxLength: 100 },
          retry_policy: { type: "object" },
          retryPolicy: { type: "object" },
          idempotency_scope: { type: "string", maxLength: 100 },
          idempotencyScope: { type: "string", maxLength: 100 },
          template_ref: { type: "string", maxLength: 200 },
          templateRef: { type: "string", maxLength: 200 },
          target: { type: "object" },
          template: { type: "object" },
        },
      },
    },
    notification_templates: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          family: { type: "string", minLength: 1, maxLength: 200 },
          locale: { type: "string", minLength: 2, maxLength: 32 },
          channel: { type: "string", enum: ["email"] },
          subject: { type: "string", maxLength: 500 },
          text: { type: "string", maxLength: 20000 },
          html: { type: "string", maxLength: 100000 },
        },
      },
    },
    invoice_definitions: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          provider_key: { type: "string", maxLength: 100 },
          providerKey: { type: "string", maxLength: 100 },
          effect_kind: {
            type: "string",
            enum: ["policy", "invoice", "notification", "integration_call"],
          },
          effectKind: {
            type: "string",
            enum: ["policy", "invoice", "notification", "integration_call"],
          },
          execution_mode: { type: "string", maxLength: 100 },
          executionMode: { type: "string", maxLength: 100 },
          provider_scope: { type: "string", maxLength: 100 },
          providerScope: { type: "string", maxLength: 100 },
          provider_execution: { type: "string", maxLength: 100 },
          providerExecution: { type: "string", maxLength: 100 },
          failure_policy: { type: "string", maxLength: 100 },
          failurePolicy: { type: "string", maxLength: 100 },
          idempotency_scope: { type: "string", maxLength: 100 },
          idempotencyScope: { type: "string", maxLength: 100 },
          invoice_template_ref: { type: "string", maxLength: 200 },
          invoiceTemplateRef: { type: "string", maxLength: 200 },
          invoice: { type: "object" },
          template: { type: "object" },
        },
      },
    },
    invoice_templates: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["name"],
        additionalProperties: true,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          family: { type: "string", minLength: 1, maxLength: 200 },
          locale: { type: "string", minLength: 2, maxLength: 32 },
          title: { type: "string", maxLength: 500 },
          text: { type: "string", maxLength: 20000 },
          html: { type: "string", maxLength: 100000 },
        },
      },
    },
  },
} as const;

type AjvCtor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => (data: unknown) => boolean;
  errors?: unknown;
};

const Ajv = AjvImport as unknown as AjvCtor;
const ajv = new Ajv({ allErrors: true, strict: true });
const addFormats =
  (addFormatsImport as unknown as { default?: (ajv: unknown) => void }).default ??
  (addFormatsImport as unknown as (ajv: unknown) => void);
addFormats(ajv);
const validate = ajv.compile(xappManifestJsonSchema);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readMonetizationEntries<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function requireUniqueSlug(entries: Array<{ slug?: string }>, label: string): Set<string> {
  const slugs = new Set<string>();
  for (const entry of entries) {
    const slug = String(entry?.slug ?? "").trim();
    if (!slug) {
      throw Object.assign(new Error(`${label} entries require non-empty slug`), { status: 400 });
    }
    if (slugs.has(slug)) {
      throw Object.assign(new Error(`Duplicate ${label} slug: ${slug}`), { status: 400 });
    }
    slugs.add(slug);
  }
  return slugs;
}

function isTemplatedUrl(value: string): boolean {
  return /^__[A-Z0-9_]+__(?:[/?#].*)?$/.test(String(value || "").trim());
}

function normalizeDispatchPolicyFieldName(field: string): string {
  const normalized = String(field || "").trim();
  if (!normalized) return "";
  if (normalized === "legal_basis") return "legalBasis";
  if (normalized === "consent_ref") return "consentRef";
  if (normalized === "target_subject_id") return "targetSubjectId";
  if (normalized === "requested_data_scope") return "requestedDataScope";
  if (normalized === "actor_subject_id") return "actorSubjectId";
  if (normalized === "disclosure_mode") return "disclosureMode";
  return normalized;
}

const CANONICAL_REQUIRED_POLICY_FIELDS = new Set([
  "actorSubjectId",
  "targetSubjectId",
  "purpose",
  "requestedDataScope",
  "legalBasis",
  "consentRef",
  "disclosureMode",
]);

function validateJsonFormsStepDispatch(tool: XappManifestTool, knownToolNames: Set<string>) {
  const ui = (tool as any).input_ui_schema;
  if (!isRecord(ui)) return;
  if (String((ui as any).type) !== "Categorization") return;
  const options = (ui as any).options;
  if (!isRecord(options) || String((options as any).variant) !== "stepper") return;
  const categories = Array.isArray((ui as any).elements) ? ((ui as any).elements as unknown[]) : [];
  categories.forEach((category, idx) => {
    if (!isRecord(category) || String((category as any).type) !== "Category") return;
    const xapps = (category as any).xapps;
    if (!isRecord(xapps) || !("onStepComplete" in xapps)) return;
    const action = (xapps as any).onStepComplete;
    if (!isRecord(action)) {
      throw Object.assign(
        new Error(
          `Tool ${tool.tool_name} input_ui_schema step ${idx + 1} xapps.onStepComplete must be an object`,
        ),
        { status: 400 },
      );
    }
    if (String((action as any).type) !== "request") {
      throw Object.assign(
        new Error(
          `Tool ${tool.tool_name} input_ui_schema step ${idx + 1} xapps.onStepComplete.type must be "request"`,
        ),
        { status: 400 },
      );
    }
    const toolName = String((action as any).toolName ?? "").trim();
    if (!toolName) {
      throw Object.assign(
        new Error(
          `Tool ${tool.tool_name} input_ui_schema step ${idx + 1} xapps.onStepComplete.toolName is required`,
        ),
        { status: 400 },
      );
    }
    if (!knownToolNames.has(toolName)) {
      throw Object.assign(
        new Error(
          `Tool ${tool.tool_name} input_ui_schema step ${idx + 1} xapps.onStepComplete.toolName references unknown tool: ${toolName}`,
        ),
        { status: 400 },
      );
    }
    if ("payloadMapping" in action && !isRecord((action as any).payloadMapping)) {
      throw Object.assign(
        new Error(
          `Tool ${tool.tool_name} input_ui_schema step ${idx + 1} xapps.onStepComplete.payloadMapping must be an object`,
        ),
        { status: 400 },
      );
    }
    if ("resultMapping" in action && !isRecord((action as any).resultMapping)) {
      throw Object.assign(
        new Error(
          `Tool ${tool.tool_name} input_ui_schema step ${idx + 1} xapps.onStepComplete.resultMapping must be an object`,
        ),
        { status: 400 },
      );
    }
  });
}

function validateEndpointBaseUrl(baseUrl: string) {
  if (baseUrl.startsWith("internal://") || isTemplatedUrl(baseUrl)) return;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw Object.assign(new Error("Invalid endpoint base_url"), { status: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw Object.assign(new Error("Unsupported endpoint base_url scheme"), { status: 400 });
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = String(hostname || "")
    .trim()
    .toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function parseUrlAllowlist(envName: string): string[] {
  const raw = String(process.env[envName] || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function matchesUrlAllowlist(url: URL, allowlist: string[]): boolean {
  if (!allowlist.length) return true;
  const href = url.toString();
  const origin = url.origin;
  return allowlist.some((entry) => href.startsWith(entry) || origin === entry);
}

function validateLinkingSetupUrl(setupUrl: string) {
  if (isTemplatedUrl(setupUrl)) return;
  let parsed: URL;
  try {
    parsed = new URL(setupUrl);
  } catch {
    throw Object.assign(new Error("Invalid linking.setup_url"), { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw Object.assign(new Error("Unsupported linking.setup_url scheme"), { status: 400 });
  }
  const allowInsecure = String(process.env.XAPPS_ALLOW_INSECURE_LINKING_URLS || "")
    .trim()
    .toLowerCase();
  const insecureAllowed = allowInsecure === "true" || allowInsecure === "1";
  if (parsed.protocol !== "https:" && !isLoopbackHostname(parsed.hostname) && !insecureAllowed) {
    throw Object.assign(new Error("linking.setup_url must use https unless it targets localhost"), {
      status: 400,
    });
  }
  const allowlist = parseUrlAllowlist("XAPPS_LINKING_SETUP_URL_ALLOWLIST");
  if (!matchesUrlAllowlist(parsed, allowlist)) {
    throw Object.assign(new Error("linking.setup_url is not in allowlist"), { status: 400 });
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeResultPresentation(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  if (
    normalized === "runtime_default" ||
    normalized === "inline" ||
    normalized === "publisher_managed"
  ) {
    return normalized;
  }
  return "__invalid__";
}

function normalizePublisherRuntimeMode(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  if (normalized === "bridge" || normalized === "passive") {
    return normalized;
  }
  return "__invalid__";
}

function normalizePublisherBootstrapTransport(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  if (normalized === "public" || normalized === "signed_ticket") {
    return normalized;
  }
  return "__invalid__";
}

function validateWidgetResultPresentation(widget: XappManifestWidget) {
  const config = isPlainObject(widget.config) ? widget.config : null;
  if (!config) return;
  const xapps = isPlainObject(config.xapps) ? config.xapps : null;
  const entries: Array<[string, unknown]> = [
    ["config.result_presentation", (config as any).result_presentation],
    ["config.resultPresentation", (config as any).resultPresentation],
    ["config.xapps.result_presentation", xapps ? (xapps as any).result_presentation : undefined],
    ["config.xapps.resultPresentation", xapps ? (xapps as any).resultPresentation : undefined],
  ];
  for (const [fieldPath, rawValue] of entries) {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") continue;
    const normalized = normalizeResultPresentation(rawValue);
    if (normalized === "__invalid__") {
      throw Object.assign(
        new Error(
          `Widget ${widget.widget_name} ${fieldPath} must be one of: runtime_default, inline, publisher_managed`,
        ),
        { status: 400 },
      );
    }
  }
}

function validateWidgetPublisherRuntimeMode(widget: XappManifestWidget) {
  const config = isPlainObject(widget.config) ? widget.config : null;
  if (!config) return;
  const xapps = isPlainObject(config.xapps) ? config.xapps : null;
  if (!xapps) return;
  const entries: Array<[string, unknown]> = [
    ["config.xapps.publisher_runtime_mode", (xapps as any).publisher_runtime_mode],
    ["config.xapps.publisherRuntimeMode", (xapps as any).publisherRuntimeMode],
  ];
  for (const [fieldPath, rawValue] of entries) {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") continue;
    const normalized = normalizePublisherRuntimeMode(rawValue);
    if (normalized === "__invalid__") {
      throw Object.assign(
        new Error(`Widget ${widget.widget_name} ${fieldPath} must be one of: bridge, passive`),
        { status: 400 },
      );
    }
  }
}

function validateWidgetPublisherBootstrapTransport(widget: XappManifestWidget) {
  const config = isPlainObject(widget.config) ? widget.config : null;
  if (!config) return;
  const xapps = isPlainObject(config.xapps) ? config.xapps : null;
  if (!xapps) return;
  const entries: Array<[string, unknown]> = [
    ["config.xapps.bootstrap_transport", (xapps as any).bootstrap_transport],
    ["config.xapps.bootstrapTransport", (xapps as any).bootstrapTransport],
  ];
  for (const [fieldPath, rawValue] of entries) {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") continue;
    const normalized = normalizePublisherBootstrapTransport(rawValue);
    if (normalized === "__invalid__") {
      throw Object.assign(
        new Error(
          `Widget ${widget.widget_name} ${fieldPath} must be one of: public, signed_ticket`,
        ),
        { status: 400 },
      );
    }
  }
}

function validateGuardHookConfig(
  guard: XappManifestGuard,
  resolvedConfigOverride?: Record<string, unknown> | null,
) {
  const rawConfig = isPlainObject(guard.config) ? guard.config : null;
  const effectiveConfig =
    resolvedConfigOverride && isPlainObject(resolvedConfigOverride)
      ? resolvedConfigOverride
      : rawConfig;
  if (!effectiveConfig) return;
  const unresolvedNotificationRef = Boolean(
    rawConfig && readNotificationRef(rawConfig) && !resolvedConfigOverride,
  );
  const unresolvedInvoiceRef = Boolean(
    rawConfig && readInvoiceRef(rawConfig) && !resolvedConfigOverride,
  );
  const resolved = normalizeHookGuardConfig({
    slug: guard.slug,
    trigger: guard.trigger,
    config: effectiveConfig,
  });
  const effectKind = resolved.config.effectKind as HookEffectKind | undefined;
  const executionMode = resolved.config.executionMode as HookExecutionMode | undefined;
  const providerScope = resolved.config.providerScope as HookProviderScope | undefined;
  const failurePolicy = resolved.config.failurePolicy as HookFailurePolicy | undefined;
  const idempotencyScope = resolved.config.idempotencyScope as HookIdempotencyScope | undefined;
  const hookMeta = resolved.hook;
  const supportedFieldChecks: Array<[string, unknown]> = [
    ["config.effect_kind", (rawConfig as any)?.effect_kind ?? (rawConfig as any)?.effectKind],
    [
      "config.execution_mode",
      (rawConfig as any)?.execution_mode ?? (rawConfig as any)?.executionMode,
    ],
    [
      "config.provider_scope",
      (rawConfig as any)?.provider_scope ?? (rawConfig as any)?.providerScope,
    ],
    [
      "config.failure_policy",
      (rawConfig as any)?.failure_policy ?? (rawConfig as any)?.failurePolicy,
    ],
    [
      "config.idempotency_scope",
      (rawConfig as any)?.idempotency_scope ?? (rawConfig as any)?.idempotencyScope,
    ],
  ];
  for (const [fieldPath, rawValue] of supportedFieldChecks) {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") continue;
    if (
      (fieldPath === "config.effect_kind" &&
        !((resolved.config.effectKind as string) || "").trim()) ||
      (fieldPath === "config.execution_mode" &&
        !((resolved.config.executionMode as string | null) || "").trim()) ||
      (fieldPath === "config.provider_scope" &&
        !((resolved.config.providerScope as string | null) || "").trim()) ||
      (fieldPath === "config.failure_policy" &&
        !((resolved.config.failurePolicy as string) || "").trim()) ||
      (fieldPath === "config.idempotency_scope" &&
        !((resolved.config.idempotencyScope as string | null) || "").trim())
    ) {
      throw Object.assign(
        new Error(`Guard ${guard.slug} ${fieldPath} has unsupported value: ${String(rawValue)}`),
        { status: 400 },
      );
    }
  }
  if (effectKind && guard.trigger.startsWith("before:") && effectKind !== "policy") {
    throw Object.assign(
      new Error(
        `Guard ${guard.slug} effect_kind=${effectKind} is not supported on blocking trigger ${guard.trigger}`,
      ),
      { status: 400 },
    );
  }
  if (effectKind && hookMeta && !hookMeta.allowedEffectKinds.includes(effectKind)) {
    throw Object.assign(
      new Error(
        `Guard ${guard.slug} effect_kind=${effectKind} is not supported on trigger ${guard.trigger}`,
      ),
      { status: 400 },
    );
  }
  if (
    effectKind === "policy" &&
    (providerScope || idempotencyScope) &&
    guard.trigger.startsWith("before:")
  ) {
    throw Object.assign(
      new Error(
        `Guard ${guard.slug} policy effect on ${guard.trigger} must not declare provider_scope or idempotency_scope`,
      ),
      { status: 400 },
    );
  }
  if (executionMode === "gateway_delegated" && providerScope === "gateway") {
    throw Object.assign(
      new Error(
        `Guard ${guard.slug} gateway_delegated execution requires provider_scope tenant or publisher`,
      ),
      { status: 400 },
    );
  }
  if (
    (effectKind === "invoice" || effectKind === "notification") &&
    !providerScope &&
    !unresolvedNotificationRef &&
    !unresolvedInvoiceRef
  ) {
    throw Object.assign(
      new Error(`Guard ${guard.slug} effect_kind=${effectKind} requires provider_scope`),
      { status: 400 },
    );
  }
  if (
    (effectKind === "invoice" || effectKind === "notification") &&
    !failurePolicy &&
    !unresolvedNotificationRef &&
    !unresolvedInvoiceRef
  ) {
    throw Object.assign(
      new Error(`Guard ${guard.slug} effect_kind=${effectKind} requires failure_policy`),
      { status: 400 },
    );
  }
  if (
    (effectKind === "invoice" || effectKind === "notification") &&
    !idempotencyScope &&
    !unresolvedNotificationRef &&
    !unresolvedInvoiceRef
  ) {
    throw Object.assign(
      new Error(`Guard ${guard.slug} effect_kind=${effectKind} requires idempotency_scope`),
      { status: 400 },
    );
  }
}

function readPaymentGuardRef(config: unknown): string {
  if (!isPlainObject(config)) return "";
  return String((config as any).payment_guard_ref ?? (config as any).paymentGuardRef ?? "").trim();
}

function validateAdapterShape(tool: XappManifestTool) {
  const adapter = (tool as any).adapter;
  if (!adapter || !isPlainObject(adapter)) return;
  const path = String((adapter as any).path ?? "").trim();
  if (!path.startsWith("/")) {
    throw Object.assign(new Error(`Tool ${tool.tool_name} adapter.path must start with "/"`), {
      status: 400,
    });
  }
  const query = (adapter as any).query;
  if (query !== undefined && !isPlainObject(query)) {
    throw Object.assign(new Error(`Tool ${tool.tool_name} adapter.query must be an object`), {
      status: 400,
    });
  }
  const headers = (adapter as any).headers;
  if (headers !== undefined) {
    if (!isPlainObject(headers)) {
      throw Object.assign(new Error(`Tool ${tool.tool_name} adapter.headers must be an object`), {
        status: 400,
      });
    }
    for (const headerName of Object.keys(headers)) {
      const trimmed = String(headerName).trim();
      if (!trimmed || !/^[A-Za-z0-9-]+$/.test(trimmed)) {
        throw Object.assign(
          new Error(
            `Tool ${tool.tool_name} adapter.headers has invalid header name: ${headerName}`,
          ),
          { status: 400 },
        );
      }
    }
  }
  const responseMapping = (adapter as any).response_mapping;
  if (responseMapping !== undefined) {
    if (!isPlainObject(responseMapping)) {
      throw Object.assign(
        new Error(`Tool ${tool.tool_name} adapter.response_mapping must be an object`),
        { status: 400 },
      );
    }
    if (Object.keys(responseMapping).length === 0) {
      throw Object.assign(
        new Error(`Tool ${tool.tool_name} adapter.response_mapping must not be empty`),
        { status: 400 },
      );
    }
    const outputSchema = isPlainObject(tool.output_schema)
      ? (tool.output_schema as Record<string, unknown>)
      : null;
    const schemaType = String((outputSchema as any)?.type ?? "").trim();
    const schemaProperties = isPlainObject((outputSchema as any)?.properties)
      ? ((outputSchema as any).properties as Record<string, unknown>)
      : null;
    if (schemaType === "object" && schemaProperties) {
      for (const mappedKey of Object.keys(responseMapping)) {
        if (!Object.prototype.hasOwnProperty.call(schemaProperties, mappedKey)) {
          throw Object.assign(
            new Error(
              `Tool ${tool.tool_name} adapter.response_mapping key "${mappedKey}" is not declared in output_schema.properties`,
            ),
            { status: 400 },
          );
        }
      }
      const required = Array.isArray((outputSchema as any)?.required)
        ? (((outputSchema as any).required as unknown[])
            .map((v) => String(v || "").trim())
            .filter(Boolean) as string[])
        : [];
      for (const requiredField of required) {
        if (!Object.prototype.hasOwnProperty.call(responseMapping, requiredField)) {
          throw Object.assign(
            new Error(
              `Tool ${tool.tool_name} adapter.response_mapping must include required output field "${requiredField}"`,
            ),
            { status: 400 },
          );
        }
      }
    }
  }
}

export function parseXappManifest(
  input: unknown,
  options?: ParseXappManifestOptions,
): XappManifest {
  if (!validate(input)) {
    throw Object.assign(new Error("Invalid manifest"), {
      status: 400,
      details: (validate as any).errors ?? null,
    });
  }

  const manifest = input as XappManifest;
  const monetization = isRecord(manifest.monetization) ? manifest.monetization : null;
  const monetizationProducts = readMonetizationEntries(monetization?.products);
  const monetizationOfferings = readMonetizationEntries(monetization?.offerings);
  const monetizationPackages = readMonetizationEntries(monetization?.packages);
  const monetizationPrices = readMonetizationEntries(monetization?.prices);
  const monetizationPaywalls = readMonetizationEntries(monetization?.paywalls);
  const monetizationUsagePolicies = Array.isArray(monetization?.usage_policies)
    ? monetization.usage_policies
    : [];
  const paymentDefinitions = Array.isArray(manifest.payment_guard_definitions)
    ? manifest.payment_guard_definitions
    : [];
  const subjectProfileDefinitions = Array.isArray(manifest.subject_profile_guard_definitions)
    ? manifest.subject_profile_guard_definitions
    : [];
  const notificationDefinitions = Array.isArray(manifest.notification_definitions)
    ? manifest.notification_definitions
    : [];
  const notificationTemplates = Array.isArray(manifest.notification_templates)
    ? manifest.notification_templates
    : [];
  const invoiceDefinitions = Array.isArray(manifest.invoice_definitions)
    ? manifest.invoice_definitions
    : [];
  const invoiceTemplates = Array.isArray(manifest.invoice_templates)
    ? manifest.invoice_templates
    : [];
  const paymentDefinitionNames = new Set<string>();
  const subjectProfileDefinitionNames = new Set<string>();
  const notificationDefinitionNames = new Set<string>();
  const notificationTemplateNames = new Set<string>();
  const invoiceDefinitionNames = new Set<string>();
  const invoiceTemplateNames = new Set<string>();
  const monetizationProductSlugs = requireUniqueSlug(monetizationProducts, "monetization.products");
  const monetizationOfferingSlugs = requireUniqueSlug(
    monetizationOfferings,
    "monetization.offerings",
  );
  const monetizationPackageSlugs = requireUniqueSlug(monetizationPackages, "monetization.packages");
  requireUniqueSlug(monetizationPrices, "monetization.prices");
  requireUniqueSlug(monetizationPaywalls, "monetization.paywalls");

  for (const list of [
    [paymentDefinitions, paymentDefinitionNames, "payment_guard_definitions"],
    [subjectProfileDefinitions, subjectProfileDefinitionNames, "subject_profile_guard_definitions"],
    [notificationDefinitions, notificationDefinitionNames, "notification_definitions"],
    [notificationTemplates, notificationTemplateNames, "notification_templates"],
    [invoiceDefinitions, invoiceDefinitionNames, "invoice_definitions"],
    [invoiceTemplates, invoiceTemplateNames, "invoice_templates"],
  ] as const) {
    const [definitions, names, label] = list;
    for (const def of definitions) {
      const name = String((def as any)?.name ?? "").trim();
      if (!name)
        throw Object.assign(new Error(`${label} entries require non-empty name`), { status: 400 });
      if (names.has(name))
        throw Object.assign(new Error(`Duplicate ${label} name: ${name}`), { status: 400 });
      names.add(name);
    }
  }

  if (manifest.linking && isRecord(manifest.linking)) {
    validateLinkingSetupUrl(String(manifest.linking.setup_url || "").trim());
  }
  if (manifest.endpoints && isRecord(manifest.endpoints)) {
    for (const config of Object.values(manifest.endpoints)) {
      validateEndpointBaseUrl(config.base_url);
    }
  }
  if (manifest.endpoint_groups && isRecord(manifest.endpoint_groups)) {
    const endpointNames = new Set(
      manifest.endpoints && isRecord(manifest.endpoints) ? Object.keys(manifest.endpoints) : [],
    );
    for (const [groupName, group] of Object.entries(manifest.endpoint_groups)) {
      for (const member of group.members) {
        if (!endpointNames.has(member)) {
          throw Object.assign(
            new Error(`Endpoint group ${groupName} references unknown endpoint: ${member}`),
            { status: 400 },
          );
        }
      }
    }
  }

  const knownToolNames = new Set(
    (manifest.tools ?? []).map((tool) => String(tool.tool_name || "").trim()),
  );
  const monetizationUsagePolicyTools = new Set<string>();
  for (const usagePolicy of monetizationUsagePolicies) {
    const toolName = String((usagePolicy as any)?.tool_name ?? "").trim();
    const creditCost = Number((usagePolicy as any)?.credit_cost);
    if (!knownToolNames.has(toolName)) {
      throw Object.assign(
        new Error(`monetization.usage_policies entry references unknown tool_name: ${toolName}`),
        { status: 400 },
      );
    }
    if (!Number.isFinite(creditCost)) {
      throw Object.assign(
        new Error(`monetization.usage_policies entry requires numeric credit_cost: ${toolName}`),
        { status: 400 },
      );
    }
    if (monetizationUsagePolicyTools.has(toolName)) {
      throw Object.assign(
        new Error(`monetization.usage_policies has duplicate tool_name: ${toolName}`),
        { status: 400 },
      );
    }
    monetizationUsagePolicyTools.add(toolName);
  }
  const referencedPaymentDefinitionNames = new Set<string>();
  const referencedSubjectProfileDefinitionNames = new Set<string>();
  const notificationDefinitionRegistry = buildNotificationDefinitionRegistry(
    manifest.notification_definitions ?? [],
  );
  const notificationTemplateRegistry = buildNotificationTemplateRegistry(
    manifest.notification_templates ?? [],
  );
  const invoiceDefinitionRegistry = buildInvoiceDefinitionRegistry(
    manifest.invoice_definitions ?? [],
  );
  const invoiceTemplateRegistry = buildInvoiceTemplateRegistry(manifest.invoice_templates ?? []);
  const subjectProfileDefinitionRegistry = buildSubjectProfileDefinitionRegistry(
    manifest.subject_profile_guard_definitions ?? [],
  );
  const referencedNotificationDefinitionNames = new Set<string>();
  const referencedNotificationTemplateNames = new Set<string>();
  const referencedInvoiceDefinitionNames = new Set<string>();
  const referencedInvoiceTemplateNames = new Set<string>();

  for (const def of notificationDefinitions) {
    const templateRef = readNotificationTemplateRef(def as Record<string, unknown>);
    if (!templateRef) continue;
    referencedNotificationTemplateNames.add(templateRef);
    if (!notificationTemplateRegistry.has(templateRef)) {
      throw Object.assign(
        new Error(
          `notification_definitions entry ${String((def as any)?.name ?? "unknown")} references unknown template_ref: ${templateRef}`,
        ),
        { status: 400 },
      );
    }
  }
  for (const def of invoiceDefinitions) {
    const templateRef = readInvoiceTemplateRef(def as Record<string, unknown>);
    if (!templateRef) continue;
    referencedInvoiceTemplateNames.add(templateRef);
    if (!invoiceTemplateRegistry.has(templateRef)) {
      throw Object.assign(
        new Error(
          `invoice_definitions entry ${String((def as any)?.name ?? "unknown")} references unknown invoice_template_ref: ${templateRef}`,
        ),
        { status: 400 },
      );
    }
  }
  for (const widget of manifest.widgets ?? []) {
    validateWidgetResultPresentation(widget);
    validateWidgetPublisherRuntimeMode(widget);
    validateWidgetPublisherBootstrapTransport(widget);
  }
  for (const monetizationPackage of monetizationPackages) {
    const productRef = String(monetizationPackage.product_ref ?? "").trim();
    if (!monetizationProductSlugs.has(productRef)) {
      throw Object.assign(
        new Error(
          `monetization.packages entry ${String(monetizationPackage.slug ?? "unknown")} references unknown product_ref: ${productRef}`,
        ),
        { status: 400 },
      );
    }
    const offeringRef = String(monetizationPackage.offering_ref ?? "").trim();
    if (!monetizationOfferingSlugs.has(offeringRef)) {
      throw Object.assign(
        new Error(
          `monetization.packages entry ${String(monetizationPackage.slug ?? "unknown")} references unknown offering_ref: ${offeringRef}`,
        ),
        { status: 400 },
      );
    }
  }
  for (const monetizationPrice of monetizationPrices) {
    const packageRef = String(monetizationPrice.package_ref ?? "").trim();
    if (!monetizationPackageSlugs.has(packageRef)) {
      throw Object.assign(
        new Error(
          `monetization.prices entry ${String(monetizationPrice.slug ?? "unknown")} references unknown package_ref: ${packageRef}`,
        ),
        { status: 400 },
      );
    }
  }
  const packageOfferingBySlug = new Map<string, string>();
  for (const monetizationPackage of monetizationPackages) {
    const packageSlug = String(monetizationPackage.slug ?? "").trim();
    const offeringRef = String(monetizationPackage.offering_ref ?? "").trim();
    if (packageSlug && offeringRef) {
      packageOfferingBySlug.set(packageSlug, offeringRef);
    }
  }
  for (const monetizationPaywall of monetizationPaywalls) {
    const paywallSlug = String(monetizationPaywall.slug ?? "unknown").trim() || "unknown";
    const offeringRefs = Array.isArray(monetizationPaywall.offering_refs)
      ? monetizationPaywall.offering_refs.map((value) => String(value ?? "").trim()).filter(Boolean)
      : [];
    if (!offeringRefs.length) {
      throw Object.assign(
        new Error(`monetization.paywalls entry ${paywallSlug} requires at least one offering_ref`),
        { status: 400 },
      );
    }
    const offeringRefSet = new Set<string>();
    for (const offeringRef of offeringRefs) {
      if (!monetizationOfferingSlugs.has(offeringRef)) {
        throw Object.assign(
          new Error(
            `monetization.paywalls entry ${paywallSlug} references unknown offering_ref: ${offeringRef}`,
          ),
          { status: 400 },
        );
      }
      if (offeringRefSet.has(offeringRef)) {
        throw Object.assign(
          new Error(
            `monetization.paywalls entry ${paywallSlug} has duplicate offering_ref: ${offeringRef}`,
          ),
          { status: 400 },
        );
      }
      offeringRefSet.add(offeringRef);
    }

    const packageRefs = Array.isArray(monetizationPaywall.package_refs)
      ? monetizationPaywall.package_refs.map((value) => String(value ?? "").trim()).filter(Boolean)
      : [];
    const packageRefSet = new Set<string>();
    for (const packageRef of packageRefs) {
      if (!monetizationPackageSlugs.has(packageRef)) {
        throw Object.assign(
          new Error(
            `monetization.paywalls entry ${paywallSlug} references unknown package_ref: ${packageRef}`,
          ),
          { status: 400 },
        );
      }
      if (packageRefSet.has(packageRef)) {
        throw Object.assign(
          new Error(
            `monetization.paywalls entry ${paywallSlug} has duplicate package_ref: ${packageRef}`,
          ),
          { status: 400 },
        );
      }
      packageRefSet.add(packageRef);
      const packageOfferingRef = String(packageOfferingBySlug.get(packageRef) ?? "").trim();
      if (packageOfferingRef && !offeringRefSet.has(packageOfferingRef)) {
        throw Object.assign(
          new Error(
            `monetization.paywalls entry ${paywallSlug} package_ref ${packageRef} is not inside paywall offering_refs`,
          ),
          { status: 400 },
        );
      }
    }

    const defaultPackageRef = String(monetizationPaywall.default_package_ref ?? "").trim();
    if (defaultPackageRef) {
      if (!monetizationPackageSlugs.has(defaultPackageRef)) {
        throw Object.assign(
          new Error(
            `monetization.paywalls entry ${paywallSlug} references unknown default_package_ref: ${defaultPackageRef}`,
          ),
          { status: 400 },
        );
      }
      if (packageRefSet.size > 0 && !packageRefSet.has(defaultPackageRef)) {
        throw Object.assign(
          new Error(
            `monetization.paywalls entry ${paywallSlug} default_package_ref must also exist in package_refs when package_refs are declared`,
          ),
          { status: 400 },
        );
      }
      const defaultOfferingRef = String(packageOfferingBySlug.get(defaultPackageRef) ?? "").trim();
      if (defaultOfferingRef && !offeringRefSet.has(defaultOfferingRef)) {
        throw Object.assign(
          new Error(
            `monetization.paywalls entry ${paywallSlug} default_package_ref ${defaultPackageRef} is not inside paywall offering_refs`,
          ),
          { status: 400 },
        );
      }
    }
  }

  for (const tool of manifest.tools ?? []) {
    validateAdapterShape(tool);
    const policy = (tool as any).dispatch_policy;
    if (!policy || !isRecord(policy)) {
      validateJsonFormsStepDispatch(tool, knownToolNames);
      continue;
    }
    const endpointRef = String((policy as any).endpoint_ref ?? "").trim();
    if (endpointRef) {
      const endpointNames = new Set(
        manifest.endpoints && isRecord(manifest.endpoints) ? Object.keys(manifest.endpoints) : [],
      );
      if (!endpointNames.has(endpointRef)) {
        throw Object.assign(
          new Error(
            `Tool ${tool.tool_name} dispatch_policy.endpoint_ref references unknown endpoint: ${endpointRef}`,
          ),
          { status: 400 },
        );
      }
    }
    const requiredPolicyFields = Array.isArray((policy as any).required_policy_fields)
      ? ((policy as any).required_policy_fields as unknown[])
      : [];
    const normalizedRequired = requiredPolicyFields
      .map((v) => normalizeDispatchPolicyFieldName(String(v ?? "")))
      .filter(Boolean);
    for (const field of normalizedRequired) {
      if (!CANONICAL_REQUIRED_POLICY_FIELDS.has(field)) {
        throw Object.assign(
          new Error(
            `Tool ${tool.tool_name} dispatch_policy.required_policy_fields contains unknown policy field: ${field}`,
          ),
          { status: 400 },
        );
      }
    }
    if (new Set(normalizedRequired).size !== normalizedRequired.length) {
      throw Object.assign(
        new Error(
          `Tool ${tool.tool_name} dispatch_policy.required_policy_fields contains duplicates after normalization`,
        ),
        { status: 400 },
      );
    }
    validateJsonFormsStepDispatch(tool, knownToolNames);
  }

  for (const guard of manifest.guards ?? []) {
    const guardConfig = (((guard as any)?.config ?? {}) as Record<string, unknown>) || {};
    const guardSlug = String((guard as any)?.slug || "unknown").trim() || "unknown";
    const subjectProfileGuardRef = readSubjectProfileGuardRef(guardConfig);
    if (subjectProfileGuardRef) referencedSubjectProfileDefinitionNames.add(subjectProfileGuardRef);
    const explicitPolicyKind = String(
      (guardConfig as any)?.policy?.kind ??
        (guardConfig as any)?.guard_kind ??
        (guardConfig as any)?.policy_kind ??
        "",
    )
      .trim()
      .toLowerCase();
    const notificationRef = readNotificationRef(guardConfig);
    const invoiceRef = readInvoiceRef(guardConfig);
    if (notificationRef) referencedNotificationDefinitionNames.add(notificationRef);
    if (invoiceRef) referencedInvoiceDefinitionNames.add(invoiceRef);

    const resolvedNotificationConfig =
      notificationRef && notificationDefinitionRegistry.has(notificationRef)
        ? (() => {
            const resolved = resolveNotificationConfigWithGovernance({
              guardConfig,
              definition: notificationDefinitionRegistry.get(notificationRef)!,
              source: "consumer_manifest",
              templates: notificationTemplateRegistry,
            });
            if (!resolved.ok)
              throw Object.assign(new Error(resolved.message), {
                status: 400,
                details: resolved.details,
              });
            return resolved.config;
          })()
        : null;
    const resolvedInvoiceConfig =
      invoiceRef && invoiceDefinitionRegistry.has(invoiceRef)
        ? (() => {
            const resolved = resolveInvoiceConfigWithGovernance({
              guardConfig,
              definition: invoiceDefinitionRegistry.get(invoiceRef)!,
              source: "consumer_manifest",
              templates: invoiceTemplateRegistry,
            });
            if (!resolved.ok)
              throw Object.assign(new Error(resolved.message), {
                status: 400,
                details: resolved.details,
              });
            return resolved.config;
          })()
        : null;
    const resolvedHookFamilyConfig = resolvedNotificationConfig ?? resolvedInvoiceConfig;
    const templateRef =
      resolvedNotificationConfig && isRecord(resolvedNotificationConfig)
        ? readNotificationTemplateRef(resolvedNotificationConfig)
        : "";
    if (templateRef) {
      referencedNotificationTemplateNames.add(templateRef);
      if (!notificationTemplateRegistry.has(templateRef)) {
        throw Object.assign(
          new Error(
            `Guard ${String((guard as any)?.slug || "unknown")} references unknown template_ref: ${templateRef}`,
          ),
          { status: 400 },
        );
      }
    }
    const invoiceTemplateRef =
      resolvedInvoiceConfig && isRecord(resolvedInvoiceConfig)
        ? readInvoiceTemplateRef(resolvedInvoiceConfig)
        : readInvoiceTemplateRef(guardConfig);
    if (invoiceTemplateRef) {
      referencedInvoiceTemplateNames.add(invoiceTemplateRef);
      if (!invoiceTemplateRegistry.has(invoiceTemplateRef)) {
        throw Object.assign(
          new Error(
            `Guard ${String((guard as any)?.slug || "unknown")} references unknown invoice_template_ref: ${invoiceTemplateRef}`,
          ),
          { status: 400 },
        );
      }
    }
    validateGuardHookConfig(guard, resolvedHookFamilyConfig);
    const resolvedSubjectProfileConfig =
      subjectProfileGuardRef && subjectProfileDefinitionRegistry.has(subjectProfileGuardRef)
        ? (() => {
            const resolved = resolveSubjectProfileGuardConfigWithGovernance({
              guardConfig,
              definition: subjectProfileDefinitionRegistry.get(subjectProfileGuardRef)!,
              source: "consumer_manifest",
            });
            if (!resolved.ok)
              throw Object.assign(new Error(`Guard ${guardSlug}: ${resolved.message}`), {
                status: 400,
                details: resolved.details,
              });
            return resolved.config;
          })()
        : null;
    const subjectProfileRequirement = resolveSubjectProfileRequirement(
      resolvedSubjectProfileConfig ?? guardConfig,
    );
    const expectsSubjectProfileContract =
      guardSlug === "subject-profile-check" ||
      explicitPolicyKind === "subject_profile" ||
      explicitPolicyKind === "subject-profile" ||
      (subjectProfileRequirement.ok && subjectProfileRequirement.source !== "none");
    if (expectsSubjectProfileContract && !subjectProfileRequirement.ok) {
      throw Object.assign(new Error(`Guard ${guardSlug}: ${subjectProfileRequirement.message}`), {
        status: 400,
        details: subjectProfileRequirement.details,
      });
    }
    const ref = readPaymentGuardRef(guardConfig);
    if (!ref) continue;
    referencedPaymentDefinitionNames.add(ref);
    if (!paymentDefinitionNames.has(ref)) {
      const hasExplicitTool = Boolean(
        String((guardConfig as any).tool_name ?? (guardConfig as any).toolName ?? "").trim(),
      );
      if (hasExplicitTool) continue;
      throw Object.assign(
        new Error(`Guard ${guardSlug} references unknown payment_guard_ref: ${ref}`),
        { status: 400 },
      );
    }
  }

  const emitWarning = options?.warn;
  const warnIfNeeded = (kind: ManifestWarning["kind"], details: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "test") return;
    emitWarning?.({ kind, details });
  };

  const unreferencedPaymentDefinitions = Array.from(paymentDefinitionNames).filter(
    (name) => !referencedPaymentDefinitionNames.has(name),
  );
  if (referencedPaymentDefinitionNames.size > 0 && unreferencedPaymentDefinitions.length > 0) {
    warnIfNeeded("unreferenced_payment_guard_definitions", {
      definitions: unreferencedPaymentDefinitions,
    });
  }
  const unreferencedSubjectProfileDefinitions = Array.from(subjectProfileDefinitionNames).filter(
    (name) => !referencedSubjectProfileDefinitionNames.has(name),
  );
  if (
    referencedSubjectProfileDefinitionNames.size > 0 &&
    unreferencedSubjectProfileDefinitions.length > 0
  ) {
    warnIfNeeded("unreferenced_subject_profile_guard_definitions", {
      definitions: unreferencedSubjectProfileDefinitions,
    });
  }
  const unreferencedNotificationDefinitions = Array.from(notificationDefinitionNames).filter(
    (name) => !referencedNotificationDefinitionNames.has(name),
  );
  if (
    referencedNotificationDefinitionNames.size > 0 &&
    unreferencedNotificationDefinitions.length > 0
  ) {
    warnIfNeeded("unreferenced_notification_definitions", {
      definitions: unreferencedNotificationDefinitions,
    });
  }
  const unreferencedNotificationTemplates = Array.from(notificationTemplateNames).filter(
    (name) => !referencedNotificationTemplateNames.has(name),
  );
  if (notificationTemplateNames.size > 0 && unreferencedNotificationTemplates.length > 0) {
    warnIfNeeded("unreferenced_notification_templates", {
      templates: unreferencedNotificationTemplates,
    });
  }
  const unreferencedInvoiceDefinitions = Array.from(invoiceDefinitionNames).filter(
    (name) => !referencedInvoiceDefinitionNames.has(name),
  );
  if (referencedInvoiceDefinitionNames.size > 0 && unreferencedInvoiceDefinitions.length > 0) {
    warnIfNeeded("unreferenced_invoice_definitions", {
      definitions: unreferencedInvoiceDefinitions,
    });
  }
  const unreferencedInvoiceTemplates = Array.from(invoiceTemplateNames).filter(
    (name) => !referencedInvoiceTemplateNames.has(name),
  );
  if (invoiceTemplateNames.size > 0 && unreferencedInvoiceTemplates.length > 0) {
    warnIfNeeded("unreferenced_invoice_templates", { templates: unreferencedInvoiceTemplates });
  }

  return manifest;
}
