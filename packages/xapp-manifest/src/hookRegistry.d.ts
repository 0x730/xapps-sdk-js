import {
  type CurrentGuardTrigger,
  type HookEffectKind,
  type HookFailurePolicy,
  type KnownGuardTrigger,
} from "./hookContracts.js";
export type HookRegistryEntry = {
  trigger: KnownGuardTrigger;
  implemented: boolean;
  blockingDefault: boolean;
  allowedEffectKinds: HookEffectKind[];
  allowsDelegatedExecution: boolean;
  auditCategory: "guard_policy" | "lifecycle" | "payment" | "request" | "response";
  notes?: string;
};
export declare function getHookRegistryEntry(trigger: string): HookRegistryEntry | null;
export declare function getDefaultFailurePolicyForEffectKind(
  effectKind: HookEffectKind,
): HookFailurePolicy;
export declare function isImplementedHookTrigger(trigger: string): trigger is CurrentGuardTrigger;
//# sourceMappingURL=hookRegistry.d.ts.map
