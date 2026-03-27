export const CURRENT_GUARD_TRIGGERS = [
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
] as const;

export const RESERVED_POST_ACTION_GUARD_TRIGGERS = [
  "after:payment_completed",
  "after:payment_failed",
  "after:request_created",
  "after:response_ready",
  "after:response_finalized",
] as const;

export const ALL_KNOWN_GUARD_TRIGGERS = [
  ...CURRENT_GUARD_TRIGGERS,
  ...RESERVED_POST_ACTION_GUARD_TRIGGERS,
] as const;

export const HOOK_EFFECT_KINDS = ["policy", "invoice", "notification", "integration_call"] as const;
export const HOOK_EXECUTION_MODES = [
  "gateway_managed",
  "tenant_managed",
  "publisher_managed",
  "gateway_delegated",
] as const;
export const HOOK_PROVIDER_SCOPES = ["gateway", "tenant", "publisher"] as const;
export const HOOK_FAILURE_POLICIES = ["fail_closed", "fail_open", "audit_only", "retry"] as const;
export const HOOK_IDEMPOTENCY_SCOPES = [
  "none",
  "request",
  "request_response",
  "payment_session",
  "payment_receipt",
  "response_version",
] as const;

export type CurrentGuardTrigger = (typeof CURRENT_GUARD_TRIGGERS)[number];
export type ReservedPostActionGuardTrigger = (typeof RESERVED_POST_ACTION_GUARD_TRIGGERS)[number];
export type KnownGuardTrigger = (typeof ALL_KNOWN_GUARD_TRIGGERS)[number];
export type HookEffectKind = (typeof HOOK_EFFECT_KINDS)[number];
export type HookExecutionMode = (typeof HOOK_EXECUTION_MODES)[number];
export type HookProviderScope = (typeof HOOK_PROVIDER_SCOPES)[number];
export type HookFailurePolicy = (typeof HOOK_FAILURE_POLICIES)[number];
export type HookIdempotencyScope = (typeof HOOK_IDEMPOTENCY_SCOPES)[number];

export function normalizeHookEffectKind(value: unknown): HookEffectKind | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return HOOK_EFFECT_KINDS.includes(normalized as HookEffectKind)
    ? (normalized as HookEffectKind)
    : null;
}

export function normalizeHookExecutionMode(value: unknown): HookExecutionMode | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return HOOK_EXECUTION_MODES.includes(normalized as HookExecutionMode)
    ? (normalized as HookExecutionMode)
    : null;
}

export function normalizeHookProviderScope(value: unknown): HookProviderScope | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return HOOK_PROVIDER_SCOPES.includes(normalized as HookProviderScope)
    ? (normalized as HookProviderScope)
    : null;
}

export function normalizeHookFailurePolicy(value: unknown): HookFailurePolicy | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return HOOK_FAILURE_POLICIES.includes(normalized as HookFailurePolicy)
    ? (normalized as HookFailurePolicy)
    : null;
}

export function normalizeHookIdempotencyScope(value: unknown): HookIdempotencyScope | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return HOOK_IDEMPOTENCY_SCOPES.includes(normalized as HookIdempotencyScope)
    ? (normalized as HookIdempotencyScope)
    : null;
}
