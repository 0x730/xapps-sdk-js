import {
  type KnownGuardTrigger,
  type HookEffectKind,
  type HookExecutionMode,
  type HookFailurePolicy,
  type HookIdempotencyScope,
  type HookProviderScope,
} from "./hookContracts.js";
export type XappManifestTool = {
  tool_name: string;
  title: string;
  description?: string;
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
  entry?: {
    kind?: "platform_template" | "iframe_url";
    template?: string;
    url?: string;
  };
  capabilities?: string[];
  title?: string;
  accessibility?: {
    label?: string;
    role?: string;
  };
  theme?: {
    mode?: "light" | "dark" | string;
    tokens?: Record<string, string>;
  };
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
  health_check?: {
    path?: string;
    interval_s?: number;
  };
  retry_policy?: {
    max_retries?: number;
    backoff?: "none" | "linear" | "exponential";
  };
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
export type XappManifest = {
  title?: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  tags?: string[];
  terms?: {
    title?: string;
    text?: string;
    url?: string;
    version?: string;
  };
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
    virtual_currencies?: Array<{
      code: string;
      name?: string;
      status?: "active" | "archived";
    }>;
    products?: Array<{
      slug: string;
      title?: string;
      description?: string;
      product_family: string;
      status?: "draft" | "active" | "archived";
      virtual_currency?: {
        code: string;
        name?: string;
        status?: "active" | "archived";
      };
      metadata?: Record<string, unknown>;
    }>;
    offerings?: Array<{
      slug: string;
      title?: string;
      description?: string;
      placement?: string;
      status?: "draft" | "active" | "archived";
      targeting_rules?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }>;
    packages?: Array<{
      slug: string;
      product_ref: string;
      offering_ref: string;
      package_kind?: "standard" | "one_time_unlock" | "credit_pack" | "subscription";
      display_order?: number;
      status?: "draft" | "active" | "archived";
      metadata?: Record<string, unknown>;
    }>;
    prices?: Array<{
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
    }>;
    usage_policies?: Array<{
      tool_name: string;
      unit?: string;
      credit_cost: number;
      virtual_currency_code?: string;
      status?: "draft" | "active" | "archived";
      metadata?: Record<string, unknown>;
    }>;
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
    payment_provider_credentials_refs?: Record<string, unknown>;
    payment_provider_secret_refs?: Record<string, unknown>;
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
    [key: string]: unknown;
  }>;
  notification_templates?: Array<{
    name: string;
    [key: string]: unknown;
  }>;
  invoice_definitions?: Array<{
    name: string;
    [key: string]: unknown;
  }>;
  invoice_templates?: Array<{
    name: string;
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
export declare const xappManifestJsonSchema: {
  readonly type: "object";
  readonly required: readonly ["name", "slug", "version", "tools", "widgets"];
  readonly additionalProperties: false;
  readonly properties: {
    readonly title: {
      readonly type: "string";
      readonly maxLength: 200;
    };
    readonly name: {
      readonly type: "string";
      readonly minLength: 1;
      readonly maxLength: 200;
    };
    readonly slug: {
      readonly type: "string";
      readonly minLength: 1;
      readonly maxLength: 100;
    };
    readonly description: {
      readonly type: "string";
      readonly maxLength: 2000;
    };
    readonly image: {
      readonly type: "string";
      readonly maxLength: 2048;
    };
    readonly tags: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "string";
        readonly maxLength: 64;
      };
    };
    readonly terms: {
      readonly type: "object";
      readonly additionalProperties: false;
      readonly properties: {
        readonly title: {
          readonly type: "string";
          readonly maxLength: 200;
        };
        readonly text: {
          readonly type: "string";
          readonly maxLength: 20000;
        };
        readonly url: {
          readonly type: "string";
          readonly maxLength: 2048;
        };
        readonly version: {
          readonly type: "string";
          readonly maxLength: 64;
        };
      };
    };
    readonly visibility: {
      readonly type: "string";
      readonly maxLength: 32;
    };
    readonly target_client_id: {
      readonly type: readonly ["string", "null"];
      readonly maxLength: 26;
    };
    readonly metadata: {
      readonly type: "object";
    };
    readonly scopes: {
      readonly type: "array";
      readonly maxItems: 100;
      readonly items: {
        readonly type: "string";
        readonly maxLength: 200;
      };
    };
    readonly version: {
      readonly type: "string";
      readonly minLength: 1;
      readonly maxLength: 64;
    };
    readonly guards: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "object";
        readonly required: readonly ["slug", "trigger"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly slug: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 100;
          };
          readonly trigger: {
            readonly type: "string";
            readonly enum: readonly [
              "before:installation_create",
              "before:widget_load",
              "before:session_open",
              "before:thread_create",
              "before:tool_run",
              "after:install",
              "after:link_complete",
              "before:link_revoke",
              "before:uninstall",
              "after:tool_complete",
              "after:uninstall",
              "after:payment_completed",
              "after:payment_failed",
              "after:request_created",
              "after:response_ready",
              "after:response_finalized",
            ];
          };
          readonly headless: {
            readonly type: "boolean";
          };
          readonly blocking: {
            readonly type: "boolean";
          };
          readonly order: {
            readonly type: "integer";
            readonly minimum: 0;
            readonly maximum: 1000000;
          };
          readonly implements: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 100;
          };
          readonly config: {
            readonly type: "object";
          };
        };
      };
    };
    readonly guards_policy: {
      readonly type: "object";
      readonly additionalProperties: false;
      readonly properties: {
        readonly "before:installation_create": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "before:widget_load": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "before:session_open": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "before:thread_create": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "before:tool_run": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "after:install": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "after:link_complete": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "before:link_revoke": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "before:uninstall": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "after:tool_complete": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "after:uninstall": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "after:payment_completed": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "after:payment_failed": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "after:request_created": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "after:response_ready": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
        readonly "after:response_finalized": {
          readonly anyOf: readonly [
            {
              readonly type: "string";
              readonly enum: readonly ["all", "any"];
            },
            {
              readonly type: "object";
              readonly additionalProperties: false;
              readonly properties: {
                readonly mode: {
                  readonly type: "string";
                  readonly enum: readonly ["all", "any"];
                };
                readonly on_fail: {
                  readonly type: "string";
                  readonly enum: readonly ["stop_on_fail", "continue_on_fail"];
                };
              };
            },
          ];
        };
      };
    };
    readonly linking: {
      readonly type: "object";
      readonly required: readonly ["strategy", "setup_url"];
      readonly additionalProperties: false;
      readonly properties: {
        readonly strategy: {
          readonly type: "string";
          readonly enum: readonly ["platform_v1", "custom"];
        };
        readonly setup_url: {
          readonly type: "string";
          readonly minLength: 1;
          readonly maxLength: 2048;
        };
        readonly guard_slug: {
          readonly type: "string";
          readonly minLength: 1;
          readonly maxLength: 100;
        };
      };
    };
    readonly tools: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "object";
        readonly required: readonly ["tool_name", "title", "input_schema", "output_schema"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly tool_name: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 100;
          };
          readonly title: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 200;
          };
          readonly description: {
            readonly type: "string";
            readonly maxLength: 2000;
          };
          readonly input_schema: {
            readonly type: "object";
          };
          readonly input_ui_schema: {
            readonly type: "object";
          };
          readonly output_ui_schema: {
            readonly type: "object";
          };
          readonly output_schema: {
            readonly type: "object";
          };
          readonly dispatch_policy: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
              readonly endpoint_ref: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly auth_lane: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly credential_profile: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly allow_on_behalf_of: {
                readonly type: "boolean";
              };
              readonly required_policy_fields: {
                readonly type: "array";
                readonly maxItems: 50;
                readonly items: {
                  readonly type: "string";
                  readonly minLength: 1;
                  readonly maxLength: 100;
                };
              };
              readonly disclosure_mode_default: {
                readonly type: "string";
                readonly enum: readonly ["final_answer_only", "scoped_fields"];
              };
            };
          };
          readonly signature_policy: {
            readonly type: "string";
            readonly enum: readonly ["none", "ed25519", "signature_not_required"];
          };
          readonly async: {
            readonly type: "boolean";
          };
          readonly adapter: {
            readonly type: "object";
            readonly required: readonly ["method", "path"];
            readonly additionalProperties: false;
            readonly properties: {
              readonly method: {
                readonly type: "string";
                readonly enum: readonly ["GET", "POST", "PUT", "DELETE", "PATCH"];
              };
              readonly path: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 2048;
              };
              readonly query: {
                readonly type: "object";
              };
              readonly headers: {
                readonly type: "object";
              };
              readonly body: {};
              readonly response_mapping: {
                readonly type: "object";
              };
            };
          };
        };
      };
    };
    readonly widgets: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "object";
        readonly required: readonly ["widget_name", "type", "renderer"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly widget_name: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 100;
          };
          readonly type: {
            readonly type: "string";
            readonly enum: readonly ["read", "write"];
          };
          readonly renderer: {
            readonly type: "string";
            readonly enum: readonly ["platform", "publisher", "json-forms", "ui-kit", "app-shell"];
          };
          readonly bind_tool_name: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly title: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 200;
          };
          readonly accessibility: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
              readonly label: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 300;
              };
              readonly role: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 50;
              };
            };
          };
          readonly theme: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
              readonly mode: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 50;
              };
              readonly tokens: {
                readonly type: "object";
                readonly additionalProperties: {
                  readonly type: "string";
                  readonly maxLength: 2000;
                };
              };
            };
          };
          readonly entry: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
              readonly kind: {
                readonly type: "string";
                readonly enum: readonly ["platform_template", "iframe_url"];
              };
              readonly template: {
                readonly type: "string";
                readonly maxLength: 100000;
              };
              readonly url: {
                readonly type: "string";
                readonly maxLength: 2048;
              };
            };
          };
          readonly capabilities: {
            readonly type: "array";
            readonly maxItems: 50;
            readonly items: {
              readonly type: "string";
              readonly maxLength: 64;
            };
          };
          readonly requires_linking: {
            readonly type: "boolean";
          };
          readonly required_context: {
            readonly type: "object";
          };
          readonly ui_override: {
            readonly type: "object";
          };
          readonly config: {
            readonly type: "object";
          };
        };
      };
    };
    readonly endpoints: {
      readonly type: "object";
      readonly additionalProperties: {
        readonly type: "object";
        readonly required: readonly ["base_url"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly base_url: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 2048;
          };
          readonly timeout_ms: {
            readonly type: "number";
            readonly minimum: 100;
            readonly maximum: 120000;
          };
          readonly health_check: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
              readonly path: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 512;
              };
              readonly interval_s: {
                readonly type: "number";
                readonly minimum: 1;
                readonly maximum: 86400;
              };
            };
          };
          readonly retry_policy: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
              readonly max_retries: {
                readonly type: "number";
                readonly minimum: 0;
                readonly maximum: 10;
              };
              readonly backoff: {
                readonly type: "string";
                readonly enum: readonly ["none", "linear", "exponential"];
              };
            };
          };
          readonly region: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 100;
          };
          readonly labels: {
            readonly type: "object";
            readonly additionalProperties: {
              readonly type: "string";
              readonly maxLength: 200;
            };
          };
        };
      };
    };
    readonly endpoint_groups: {
      readonly type: "object";
      readonly additionalProperties: {
        readonly type: "object";
        readonly required: readonly ["strategy", "members"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly strategy: {
            readonly type: "string";
            readonly enum: readonly ["failover", "round_robin", "region_affinity"];
          };
          readonly members: {
            readonly type: "array";
            readonly minItems: 1;
            readonly maxItems: 20;
            readonly items: {
              readonly type: "string";
              readonly minLength: 1;
              readonly maxLength: 100;
            };
          };
        };
      };
    };
    readonly event_subscriptions: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "object";
        readonly required: readonly ["event_type", "webhook_url"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly event_type: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 200;
          };
          readonly webhook_url: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 2048;
          };
        };
      };
    };
    readonly connectivity: {
      readonly type: "object";
      readonly additionalProperties: false;
      readonly properties: {
        readonly executor_mode: {
          readonly type: "string";
          readonly enum: readonly ["PUBLIC_EXECUTOR", "PRIVATE_EXECUTOR", "AGENT_TUNNEL"];
        };
        readonly auth_mode: {
          readonly type: "string";
          readonly enum: readonly ["PUBLISHER_APP", "USER_DELEGATED", "HYBRID"];
        };
        readonly signing_policy: {
          readonly type: "string";
          readonly enum: readonly ["none", "subject_proof", "publisher_proof"];
        };
        readonly webhooks: {
          readonly type: "object";
        };
        readonly proxy_policy: {
          readonly type: "object";
        };
      };
    };
    readonly monetization: {
      readonly type: "object";
      readonly additionalProperties: false;
      readonly properties: {
        readonly products: {
          readonly type: "array";
          readonly maxItems: 200;
          readonly items: {
            readonly type: "object";
            readonly required: readonly ["slug", "product_family"];
            readonly additionalProperties: false;
            readonly properties: {
              readonly slug: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly title: any;
              readonly description: any;
              readonly product_family: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly status: {
                readonly type: "string";
                readonly enum: readonly ["draft", "active", "archived"];
              };
              readonly metadata: {
                readonly type: "object";
              };
            };
          };
        };
        readonly offerings: {
          readonly type: "array";
          readonly maxItems: 200;
          readonly items: {
            readonly type: "object";
            readonly required: readonly ["slug"];
            readonly additionalProperties: false;
            readonly properties: {
              readonly slug: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly title: any;
              readonly description: any;
              readonly placement: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly status: {
                readonly type: "string";
                readonly enum: readonly ["draft", "active", "archived"];
              };
              readonly targeting_rules: {
                readonly type: "object";
              };
              readonly metadata: {
                readonly type: "object";
              };
            };
          };
        };
        readonly packages: {
          readonly type: "array";
          readonly maxItems: 500;
          readonly items: {
            readonly type: "object";
            readonly required: readonly ["slug", "product_ref", "offering_ref"];
            readonly additionalProperties: false;
            readonly properties: {
              readonly slug: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly product_ref: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly offering_ref: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly package_kind: {
                readonly type: "string";
                readonly enum: readonly [
                  "standard",
                  "one_time_unlock",
                  "credit_pack",
                  "subscription",
                ];
              };
              readonly display_order: {
                readonly type: "integer";
                readonly minimum: 0;
                readonly maximum: 1000000;
              };
              readonly status: {
                readonly type: "string";
                readonly enum: readonly ["draft", "active", "archived"];
              };
              readonly metadata: {
                readonly type: "object";
              };
            };
          };
        };
        readonly prices: {
          readonly type: "array";
          readonly maxItems: 1000;
          readonly items: {
            readonly type: "object";
            readonly required: readonly ["slug", "package_ref", "currency", "amount"];
            readonly additionalProperties: false;
            readonly properties: {
              readonly slug: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly package_ref: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 100;
              };
              readonly currency: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 16;
              };
              readonly amount: {
                readonly type: "number";
                readonly minimum: 0;
              };
              readonly billing_period: {
                readonly type: "string";
                readonly enum: readonly ["day", "week", "month", "year"];
              };
              readonly billing_period_count: {
                readonly type: "integer";
                readonly minimum: 1;
                readonly maximum: 1000000;
              };
              readonly trial_policy: {
                readonly type: "object";
              };
              readonly intro_policy: {
                readonly type: "object";
              };
              readonly country_rules: {
                readonly type: "object";
              };
              readonly status: {
                readonly type: "string";
                readonly enum: readonly ["draft", "active", "archived"];
              };
              readonly metadata: {
                readonly type: "object";
              };
            };
          };
        };
      };
    };
    readonly payment_guard_definitions: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "object";
        readonly required: readonly ["name"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly name: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 200;
          };
          readonly payment_type: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly payment_issuer_mode: {
            readonly type: "string";
            readonly maxLength: 100;
            readonly enum: readonly [
              "owner_managed",
              "gateway_managed",
              "tenant_delegated",
              "publisher_delegated",
              "any",
            ];
          };
          readonly payment_scheme: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly payment_network: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly payment_allowed_issuers: {
            readonly type: "array";
            readonly maxItems: 20;
            readonly items: {
              readonly type: "string";
              readonly maxLength: 100;
              readonly enum: readonly [
                "tenant",
                "publisher",
                "gateway",
                "tenant_delegated",
                "publisher_delegated",
              ];
            };
          };
          readonly payment_return_contract: {
            readonly type: "string";
            readonly maxLength: 200;
          };
          readonly payment_return_required: {
            readonly type: "boolean";
          };
          readonly payment_return_max_age_s: {
            readonly type: "number";
            readonly minimum: 0;
            readonly maximum: 86400;
          };
          readonly payment_return_hmac_secret_refs: {
            readonly type: "object";
          };
          readonly payment_return_hmac_secrets: {
            readonly type: "object";
          };
          readonly payment_return_hmac_delegated_secret_refs: {
            readonly type: "object";
          };
          readonly payment_return_hmac_delegated_secrets: {
            readonly type: "object";
          };
          readonly payment_provider_credentials: {
            readonly type: "object";
          };
          readonly payment_provider_credentials_refs: {
            readonly type: "object";
          };
          readonly payment_provider_secret_refs: {
            readonly type: "object";
          };
          readonly pricing_model: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly pricing: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
              readonly currency: {
                readonly type: "string";
                readonly maxLength: 32;
              };
              readonly default_amount: {
                readonly type: "number";
              };
              readonly xapp_prices: {
                readonly type: "object";
                readonly additionalProperties: {
                  readonly type: "number";
                };
              };
              readonly tool_overrides: {
                readonly type: "object";
                readonly additionalProperties: {
                  readonly type: "number";
                };
              };
              readonly description: {
                readonly type: "string";
                readonly maxLength: 500;
              };
              readonly asset: {
                readonly type: "string";
                readonly maxLength: 256;
              };
              readonly pay_to: {
                readonly type: "string";
                readonly maxLength: 256;
              };
              readonly payTo: {
                readonly type: "string";
                readonly maxLength: 256;
              };
            };
          };
          readonly receipt_field: {
            readonly type: "string";
            readonly maxLength: 200;
          };
          readonly payment_url: {
            readonly type: "string";
            readonly maxLength: 2048;
          };
          readonly accepts: {
            readonly type: "array";
            readonly maxItems: 20;
            readonly items: {
              readonly type: "object";
              readonly additionalProperties: true;
            };
          };
          readonly payment_ui: {
            readonly type: "object";
          };
          readonly policy: {
            readonly type: "object";
          };
          readonly action: {
            readonly type: "object";
          };
          readonly owner_override_allowlist: {
            readonly type: "array";
            readonly maxItems: 100;
            readonly items: {
              readonly type: "string";
              readonly minLength: 1;
              readonly maxLength: 200;
            };
          };
          readonly owner_pricing_floor: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
              readonly default_amount: {
                readonly type: "number";
              };
              readonly xapp_prices: {
                readonly type: "object";
                readonly additionalProperties: {
                  readonly type: "number";
                };
              };
              readonly tool_overrides: {
                readonly type: "object";
                readonly additionalProperties: {
                  readonly type: "number";
                };
              };
            };
          };
        };
      };
    };
    readonly subject_profile_guard_definitions: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "object";
        readonly required: readonly ["name"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly name: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 200;
          };
          readonly policy: {
            readonly type: "object";
          };
          readonly action: {
            readonly type: "object";
          };
          readonly tools: {
            readonly type: "array";
            readonly maxItems: 100;
            readonly items: {
              readonly type: "string";
              readonly minLength: 1;
              readonly maxLength: 200;
            };
          };
          readonly subject_profile_requirement: {
            readonly type: "object";
          };
          readonly subject_profile_remediation: {
            readonly type: "object";
          };
          readonly subject_profile_sources: {
            readonly type: "object";
          };
          readonly owner_override_allowlist: {
            readonly type: "array";
            readonly maxItems: 100;
            readonly items: {
              readonly type: "string";
              readonly minLength: 1;
              readonly maxLength: 200;
            };
          };
        };
      };
    };
    readonly notification_definitions: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "object";
        readonly required: readonly ["name"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly name: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 200;
          };
          readonly channel: {
            readonly type: "string";
            readonly enum: readonly ["email"];
          };
          readonly effect_kind: {
            readonly type: "string";
            readonly enum: readonly ["policy", "invoice", "notification", "integration_call"];
          };
          readonly effectKind: {
            readonly type: "string";
            readonly enum: readonly ["policy", "invoice", "notification", "integration_call"];
          };
          readonly provider_key: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly providerKey: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly execution_mode: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly executionMode: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly provider_scope: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly providerScope: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly provider_execution: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly providerExecution: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly failure_policy: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly failurePolicy: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly retry_policy: {
            readonly type: "object";
          };
          readonly retryPolicy: {
            readonly type: "object";
          };
          readonly idempotency_scope: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly idempotencyScope: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly template_ref: {
            readonly type: "string";
            readonly maxLength: 200;
          };
          readonly templateRef: {
            readonly type: "string";
            readonly maxLength: 200;
          };
          readonly target: {
            readonly type: "object";
          };
          readonly template: {
            readonly type: "object";
          };
        };
      };
    };
    readonly notification_templates: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "object";
        readonly required: readonly ["name"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly name: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 200;
          };
          readonly channel: {
            readonly type: "string";
            readonly enum: readonly ["email"];
          };
          readonly subject: {
            readonly type: "string";
            readonly maxLength: 500;
          };
          readonly text: {
            readonly type: "string";
            readonly maxLength: 20000;
          };
          readonly html: {
            readonly type: "string";
            readonly maxLength: 100000;
          };
        };
      };
    };
    readonly invoice_definitions: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "object";
        readonly required: readonly ["name"];
        readonly additionalProperties: false;
        readonly properties: {
          readonly name: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 200;
          };
          readonly provider_key: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly providerKey: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly effect_kind: {
            readonly type: "string";
            readonly enum: readonly ["policy", "invoice", "notification", "integration_call"];
          };
          readonly effectKind: {
            readonly type: "string";
            readonly enum: readonly ["policy", "invoice", "notification", "integration_call"];
          };
          readonly execution_mode: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly executionMode: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly provider_scope: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly providerScope: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly provider_execution: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly providerExecution: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly failure_policy: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly failurePolicy: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly idempotency_scope: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly idempotencyScope: {
            readonly type: "string";
            readonly maxLength: 100;
          };
          readonly invoice_template_ref: {
            readonly type: "string";
            readonly maxLength: 200;
          };
          readonly invoiceTemplateRef: {
            readonly type: "string";
            readonly maxLength: 200;
          };
          readonly invoice: {
            readonly type: "object";
          };
          readonly template: {
            readonly type: "object";
          };
        };
      };
    };
    readonly invoice_templates: {
      readonly type: "array";
      readonly maxItems: 50;
      readonly items: {
        readonly type: "object";
        readonly required: readonly ["name"];
        readonly additionalProperties: true;
        readonly properties: {
          readonly name: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 200;
          };
          readonly title: {
            readonly type: "string";
            readonly maxLength: 500;
          };
          readonly text: {
            readonly type: "string";
            readonly maxLength: 20000;
          };
          readonly html: {
            readonly type: "string";
            readonly maxLength: 100000;
          };
        };
      };
    };
  };
};
export declare function parseXappManifest(
  input: unknown,
  options?: ParseXappManifestOptions,
): XappManifest;
//# sourceMappingURL=index.d.ts.map
