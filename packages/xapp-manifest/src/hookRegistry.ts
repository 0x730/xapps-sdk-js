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

const HOOK_REGISTRY: HookRegistryEntry[] = [
  {
    trigger: "before:installation_create",
    implemented: true,
    blockingDefault: true,
    allowedEffectKinds: ["policy"],
    allowsDelegatedExecution: false,
    auditCategory: "guard_policy",
  },
  {
    trigger: "before:widget_load",
    implemented: true,
    blockingDefault: true,
    allowedEffectKinds: ["policy"],
    allowsDelegatedExecution: false,
    auditCategory: "guard_policy",
  },
  {
    trigger: "before:session_open",
    implemented: true,
    blockingDefault: true,
    allowedEffectKinds: ["policy"],
    allowsDelegatedExecution: false,
    auditCategory: "guard_policy",
  },
  {
    trigger: "before:thread_create",
    implemented: true,
    blockingDefault: true,
    allowedEffectKinds: ["policy"],
    allowsDelegatedExecution: false,
    auditCategory: "guard_policy",
  },
  {
    trigger: "before:tool_run",
    implemented: true,
    blockingDefault: true,
    allowedEffectKinds: ["policy"],
    allowsDelegatedExecution: true,
    auditCategory: "guard_policy",
  },
  {
    trigger: "after:install",
    implemented: true,
    blockingDefault: false,
    allowedEffectKinds: ["policy", "integration_call"],
    allowsDelegatedExecution: false,
    auditCategory: "lifecycle",
  },
  {
    trigger: "after:link_complete",
    implemented: true,
    blockingDefault: false,
    allowedEffectKinds: ["policy", "integration_call"],
    allowsDelegatedExecution: false,
    auditCategory: "lifecycle",
  },
  {
    trigger: "before:link_revoke",
    implemented: true,
    blockingDefault: true,
    allowedEffectKinds: ["policy"],
    allowsDelegatedExecution: false,
    auditCategory: "guard_policy",
  },
  {
    trigger: "before:uninstall",
    implemented: true,
    blockingDefault: true,
    allowedEffectKinds: ["policy"],
    allowsDelegatedExecution: false,
    auditCategory: "guard_policy",
  },
  {
    trigger: "after:tool_complete",
    implemented: true,
    blockingDefault: false,
    allowedEffectKinds: ["policy", "integration_call"],
    allowsDelegatedExecution: true,
    auditCategory: "response",
  },
  {
    trigger: "after:uninstall",
    implemented: true,
    blockingDefault: false,
    allowedEffectKinds: ["policy", "integration_call"],
    allowsDelegatedExecution: false,
    auditCategory: "lifecycle",
  },
  {
    trigger: "after:payment_completed",
    implemented: true,
    blockingDefault: false,
    allowedEffectKinds: ["invoice", "policy", "notification", "integration_call"],
    allowsDelegatedExecution: true,
    auditCategory: "payment",
  },
  {
    trigger: "after:payment_failed",
    implemented: false,
    blockingDefault: false,
    allowedEffectKinds: ["notification", "integration_call"],
    allowsDelegatedExecution: true,
    auditCategory: "payment",
  },
  {
    trigger: "after:request_created",
    implemented: true,
    blockingDefault: false,
    allowedEffectKinds: ["notification", "integration_call"],
    allowsDelegatedExecution: true,
    auditCategory: "request",
  },
  {
    trigger: "after:response_ready",
    implemented: false,
    blockingDefault: false,
    allowedEffectKinds: ["notification", "integration_call"],
    allowsDelegatedExecution: true,
    auditCategory: "response",
  },
  {
    trigger: "after:response_finalized",
    implemented: true,
    blockingDefault: false,
    allowedEffectKinds: ["invoice", "policy", "notification", "integration_call"],
    allowsDelegatedExecution: true,
    auditCategory: "response",
  },
];

const HOOK_REGISTRY_MAP = new Map(HOOK_REGISTRY.map((entry) => [entry.trigger, entry] as const));

export function getHookRegistryEntry(trigger: string): HookRegistryEntry | null {
  const normalized = String(trigger || "").trim() as KnownGuardTrigger;
  const entry = HOOK_REGISTRY_MAP.get(normalized);
  return entry ? { ...entry, allowedEffectKinds: [...entry.allowedEffectKinds] } : null;
}

export function getDefaultFailurePolicyForEffectKind(
  effectKind: HookEffectKind,
): HookFailurePolicy {
  if (effectKind === "policy") return "fail_closed";
  if (effectKind === "invoice") return "retry";
  if (effectKind === "notification") return "fail_open";
  return "audit_only";
}

export function isImplementedHookTrigger(trigger: string): trigger is CurrentGuardTrigger {
  const entry = getHookRegistryEntry(trigger);
  return Boolean(entry?.implemented);
}
