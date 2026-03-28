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
  retry_policy?: {
    max_retries?: number;
    backoff?: "none" | "linear" | "exponential";
  };
  retryPolicy?: {
    maxRetries?: number;
    backoff?: "none" | "linear" | "exponential";
  };
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
  | {
      ok: true;
      config: Record<string, unknown>;
      resolution: NotificationRefResolution;
    }
  | {
      ok: false;
      reason: string;
      message: string;
      details: Record<string, unknown>;
    };
export declare function buildNotificationDefinitionRegistry(
  definitions: unknown,
): Map<string, NotificationDefinition>;
export declare function buildNotificationTemplateRegistry(
  templates: unknown,
): Map<string, NotificationTemplate>;
export declare function readNotificationRef(config: unknown): string;
export declare function readNotificationTemplateRef(config: unknown): string;
export declare function resolveNotificationConfigWithGovernance(input: {
  guardConfig: Record<string, unknown>;
  definition: NotificationDefinition;
  source: NotificationRefResolutionSource;
  templates?: Map<string, NotificationTemplate>;
}): ResolvedNotificationConfigResult;
//# sourceMappingURL=notifications.d.ts.map
