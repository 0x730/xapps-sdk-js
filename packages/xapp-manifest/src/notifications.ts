export type NotificationDefinition = {
  name: string;
  channel?: string;
  provider_key?: string;
  providerKey?: string;
  execution_mode?: string;
  executionMode?: string;
  provider_scope?: string;
  providerScope?: string;
  failure_policy?: string;
  failurePolicy?: string;
  retry_policy?: { max_retries?: number; backoff?: "none" | "linear" | "exponential" };
  retryPolicy?: { maxRetries?: number; backoff?: "none" | "linear" | "exponential" };
  idempotency_scope?: string;
  idempotencyScope?: string;
  template_ref?: string;
  templateRef?: string;
  target?: Record<string, unknown>;
  template?: Record<string, unknown>;
  [key: string]: unknown;
};

export type NotificationTemplate = {
  name: string;
  channel?: string;
  subject?: string;
  text?: string;
  html?: string;
  [key: string]: unknown;
};

export type NotificationRefResolutionSource = "consumer_manifest" | "owner_manifest";
export type NotificationTemplateResolutionSource =
  | NotificationRefResolutionSource
  | "owner_settings";

export type NotificationRefResolution = {
  notification_ref: string;
  definition_name: string;
  source: NotificationRefResolutionSource;
  template_ref?: string | null;
  template_name?: string | null;
  template_source?: NotificationTemplateResolutionSource | null;
};

export type ResolvedNotificationConfigResult =
  | { ok: true; config: Record<string, unknown>; resolution: NotificationRefResolution }
  | { ok: false; reason: string; message: string; details: Record<string, unknown> };

export function buildNotificationDefinitionRegistry(
  definitions: unknown,
): Map<string, NotificationDefinition> {
  const registry = new Map<string, NotificationDefinition>();
  if (!Array.isArray(definitions)) return registry;
  for (const def of definitions) {
    if (!def || typeof def !== "object") continue;
    const name = String((def as any).name ?? "").trim();
    if (!name) continue;
    registry.set(name, def as NotificationDefinition);
  }
  return registry;
}

export function buildNotificationTemplateRegistry(
  templates: unknown,
): Map<string, NotificationTemplate> {
  const registry = new Map<string, NotificationTemplate>();
  if (!Array.isArray(templates)) return registry;
  for (const template of templates) {
    if (!template || typeof template !== "object") continue;
    const name = String((template as any).name ?? "").trim();
    if (!name) continue;
    registry.set(name, template as NotificationTemplate);
  }
  return registry;
}

export function readNotificationRef(config: unknown): string {
  if (!config || typeof config !== "object" || Array.isArray(config)) return "";
  return String((config as any).notification_ref ?? (config as any).notificationRef ?? "").trim();
}

export function readNotificationTemplateRef(config: unknown): string {
  if (!config || typeof config !== "object" || Array.isArray(config)) return "";
  return String((config as any).template_ref ?? (config as any).templateRef ?? "").trim();
}

function resolveNotificationTemplateConfig(input: {
  config: Record<string, unknown>;
  templates: Map<string, NotificationTemplate>;
  source: NotificationRefResolutionSource;
  baseResolution: NotificationRefResolution;
}): ResolvedNotificationConfigResult {
  const templateRef = readNotificationTemplateRef(input.config);
  if (!templateRef) {
    return {
      ok: true,
      config: input.config,
      resolution: {
        ...input.baseResolution,
        template_ref: null,
        template_name: null,
        template_source: null,
      },
    };
  }
  const template = input.templates.get(templateRef);
  if (!template) {
    return {
      ok: false,
      reason: "notification_template_ref_unresolved",
      message: `Notification template_ref "${templateRef}" cannot be resolved`,
      details: {
        notification_ref_resolution: input.baseResolution,
        template_ref: templateRef,
        template_source: input.source,
      },
    };
  }

  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.config)) {
    if (key === "template_ref" || key === "templateRef") continue;
    merged[key] = value;
  }
  const resolvedTemplate: Record<string, unknown> = {};
  if (typeof template.subject === "string") resolvedTemplate.subject = template.subject;
  if (typeof template.text === "string") resolvedTemplate.text = template.text;
  if (typeof template.html === "string") resolvedTemplate.html = template.html;
  const inlineTemplate =
    merged.template && typeof merged.template === "object" && !Array.isArray(merged.template)
      ? (merged.template as Record<string, unknown>)
      : {};
  merged.template = { ...resolvedTemplate, ...inlineTemplate };

  return {
    ok: true,
    config: merged,
    resolution: {
      ...input.baseResolution,
      template_ref: templateRef,
      template_name: String(template.name || "").trim() || templateRef,
      template_source: input.source,
    },
  };
}

export function resolveNotificationConfigWithGovernance(input: {
  guardConfig: Record<string, unknown>;
  definition: NotificationDefinition;
  source: NotificationRefResolutionSource;
  templates?: Map<string, NotificationTemplate>;
}): ResolvedNotificationConfigResult {
  const ref = readNotificationRef(input.guardConfig);
  const definitionName = String(input.definition.name || "").trim() || ref;
  const resolution: NotificationRefResolution = {
    notification_ref: ref,
    definition_name: definitionName,
    source: input.source,
  };
  if (input.source === "owner_manifest") {
    const disallowedOverridePaths = Object.keys(input.guardConfig).filter(
      (key) => key !== "notification_ref" && key !== "notificationRef",
    );
    if (disallowedOverridePaths.length > 0) {
      return {
        ok: false,
        reason: "notification_override_not_allowed",
        message: `Notification ref ${ref} does not allow guard-level overrides when resolved from owner manifest`,
        details: {
          notification_ref_resolution: resolution,
          disallowed_override_paths: disallowedOverridePaths,
        },
      };
    }
  }

  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.definition)) {
    if (key === "name") continue;
    merged[key] = value;
  }
  for (const [key, value] of Object.entries(input.guardConfig)) {
    if (key === "notification_ref" || key === "notificationRef") continue;
    if (value === undefined) continue;
    merged[key] = value;
  }

  return resolveNotificationTemplateConfig({
    config: merged,
    templates: input.templates ?? new Map(),
    source: input.source,
    baseResolution: resolution,
  });
}
