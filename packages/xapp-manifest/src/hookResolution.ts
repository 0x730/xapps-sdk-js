import {
  normalizeHookEffectKind,
  normalizeHookExecutionMode,
  normalizeHookFailurePolicy,
  normalizeHookIdempotencyScope,
  normalizeHookProviderScope,
  type HookEffectKind,
  type HookExecutionMode,
  type HookFailurePolicy,
  type HookIdempotencyScope,
  type HookProviderScope,
} from "./hookContracts.js";
import { getDefaultFailurePolicyForEffectKind, getHookRegistryEntry, type HookRegistryEntry } from "./hookRegistry.js";

export type HookResolutionInput = {
  slug: string;
  trigger: string;
  config?: Record<string, unknown> | null;
};

export type NormalizedHookGuardConfig = {
  effectKind: HookEffectKind;
  executionMode: HookExecutionMode | null;
  providerScope: HookProviderScope | null;
  failurePolicy: HookFailurePolicy;
  idempotencyScope: HookIdempotencyScope | null;
  providerKey: string | null;
};

export type ResolvedHookGuardSemantics = {
  slug: string;
  trigger: string;
  hook: HookRegistryEntry | null;
  config: NormalizedHookGuardConfig;
};

function readString(value: unknown): string {
  const normalized = String(value ?? "").trim();
  return normalized || "";
}

function readConfigValue(config: Record<string, unknown>, snake: string, camel: string): unknown {
  return config[snake] ?? config[camel];
}

export function normalizeHookGuardConfig(input: HookResolutionInput): ResolvedHookGuardSemantics {
  const config =
    input.config && typeof input.config === "object" && !Array.isArray(input.config)
      ? input.config
      : {};
  const hook = getHookRegistryEntry(input.trigger);
  const explicitEffectKind = normalizeHookEffectKind(
    readConfigValue(config, "effect_kind", "effectKind"),
  );
  const effectKind = explicitEffectKind ?? hook?.allowedEffectKinds[0] ?? "policy";
  const explicitFailurePolicy = normalizeHookFailurePolicy(
    readConfigValue(config, "failure_policy", "failurePolicy"),
  );

  return {
    slug: input.slug,
    trigger: input.trigger,
    hook,
    config: {
      effectKind,
      executionMode: normalizeHookExecutionMode(
        readConfigValue(config, "execution_mode", "executionMode"),
      ),
      providerScope: normalizeHookProviderScope(
        readConfigValue(config, "provider_scope", "providerScope"),
      ),
      failurePolicy: explicitFailurePolicy ?? getDefaultFailurePolicyForEffectKind(effectKind),
      idempotencyScope: normalizeHookIdempotencyScope(
        readConfigValue(config, "idempotency_scope", "idempotencyScope"),
      ),
      providerKey: readString(readConfigValue(config, "provider_key", "providerKey")) || null,
    },
  };
}
