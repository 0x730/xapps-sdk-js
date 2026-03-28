import {
  type HookEffectKind,
  type HookExecutionMode,
  type HookFailurePolicy,
  type HookIdempotencyScope,
  type HookProviderScope,
} from "./hookContracts.js";
import { type HookRegistryEntry } from "./hookRegistry.js";
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
export declare function normalizeHookGuardConfig(
  input: HookResolutionInput,
): ResolvedHookGuardSemantics;
//# sourceMappingURL=hookResolution.d.ts.map
