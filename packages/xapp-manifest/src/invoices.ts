export type InvoiceDefinition = {
  name: string;
  provider_key?: string;
  providerKey?: string;
  effect_kind?: string;
  effectKind?: string;
  execution_mode?: string;
  executionMode?: string;
  provider_scope?: string;
  providerScope?: string;
  provider_execution?: string;
  providerExecution?: string;
  failure_policy?: string;
  failurePolicy?: string;
  idempotency_scope?: string;
  idempotencyScope?: string;
  invoice_template_ref?: string;
  invoiceTemplateRef?: string;
  invoice?: Record<string, unknown>;
  template?: Record<string, unknown>;
  [key: string]: unknown;
};

export type InvoiceTemplate = {
  name: string;
  family?: string;
  locale?: string;
  title?: string;
  text?: string;
  html?: string;
  [key: string]: unknown;
};

export type InvoiceRefResolutionSource = "consumer_manifest" | "owner_manifest";
export type InvoiceTemplateResolutionSource = InvoiceRefResolutionSource | "owner_settings";

export type InvoiceRefResolution = {
  invoice_ref: string;
  definition_name: string;
  source: InvoiceRefResolutionSource;
  invoice_template_ref?: string | null;
  template_name?: string | null;
  template_source?: InvoiceTemplateResolutionSource | null;
};

export type ResolvedInvoiceConfigResult =
  | { ok: true; config: Record<string, unknown>; resolution: InvoiceRefResolution }
  | { ok: false; reason: string; message: string; details: Record<string, unknown> };

export function buildInvoiceDefinitionRegistry(
  definitions: unknown,
): Map<string, InvoiceDefinition> {
  const registry = new Map<string, InvoiceDefinition>();
  if (!Array.isArray(definitions)) return registry;
  for (const def of definitions) {
    if (!def || typeof def !== "object") continue;
    const name = String((def as any).name ?? "").trim();
    if (!name) continue;
    registry.set(name, def as InvoiceDefinition);
  }
  return registry;
}

export function buildInvoiceTemplateRegistry(templates: unknown): Map<string, InvoiceTemplate> {
  const registry = new Map<string, InvoiceTemplate>();
  if (!Array.isArray(templates)) return registry;
  for (const template of templates) {
    if (!template || typeof template !== "object") continue;
    const name = String((template as any).name ?? "").trim();
    if (!name) continue;
    registry.set(name, template as InvoiceTemplate);
  }
  return registry;
}

function normalizeTemplateLocale(input: unknown, fallbackLocale = "en"): string {
  const raw = String(input || "").trim();
  if (!raw) return fallbackLocale;
  const parts = raw
    .replace(/_/g, "-")
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return fallbackLocale;
  const [language, ...rest] = parts;
  return [language.toLowerCase(), ...rest.map((part) => part.toUpperCase())].join("-");
}

function getTemplateLocaleCandidates(input: unknown, fallbackLocale = "en"): string[] {
  const normalizedFallback = normalizeTemplateLocale(fallbackLocale, "en");
  const normalized = normalizeTemplateLocale(input, normalizedFallback);
  const out = new Set<string>([normalized]);
  const dash = normalized.indexOf("-");
  if (dash > 0) out.add(normalized.slice(0, dash));
  const fallbackDash = normalizedFallback.indexOf("-");
  if (fallbackDash > 0) out.add(normalizedFallback.slice(0, fallbackDash));
  out.add(normalizedFallback);
  out.add("en");
  return Array.from(out);
}

export function resolveInvoiceTemplateVariant(input: {
  templates: unknown;
  templateRef: string;
  locale?: unknown;
  fallbackLocale?: string;
}): InvoiceTemplate | null {
  const templateRef = String(input.templateRef || "").trim();
  if (!templateRef) return null;
  const registry = buildInvoiceTemplateRegistry(input.templates);
  const exact = registry.get(templateRef);

  const templates = Array.isArray(input.templates)
    ? input.templates.filter((template): template is InvoiceTemplate =>
        Boolean(template && typeof template === "object"),
      )
    : [];
  const familyMatches = templates.filter(
    (template) => String(template.family || "").trim() === templateRef,
  );
  if (familyMatches.length > 0) {
    const candidates = getTemplateLocaleCandidates(input.locale, input.fallbackLocale);
    for (const candidate of candidates) {
      const match = familyMatches.find(
        (template) => normalizeTemplateLocale(template.locale, "") === candidate,
      );
      if (match) return match;
    }
    const noLocaleMatch = familyMatches.find((template) => !String(template.locale || "").trim());
    if (noLocaleMatch) return noLocaleMatch;
  }
  if (exact) return exact;
  return familyMatches[0] || null;
}

export function readInvoiceRef(config: unknown): string {
  if (!config || typeof config !== "object" || Array.isArray(config)) return "";
  return String((config as any).invoice_ref ?? (config as any).invoiceRef ?? "").trim();
}

export function readInvoiceTemplateRef(config: unknown): string {
  if (!config || typeof config !== "object" || Array.isArray(config)) return "";
  return String(
    (config as any).invoice_template_ref ?? (config as any).invoiceTemplateRef ?? "",
  ).trim();
}

function resolveInvoiceTemplateConfig(input: {
  config: Record<string, unknown>;
  templates: Map<string, InvoiceTemplate>;
  source: InvoiceRefResolutionSource;
  baseResolution: InvoiceRefResolution;
}): ResolvedInvoiceConfigResult {
  const templateRef = readInvoiceTemplateRef(input.config);
  if (!templateRef) {
    return {
      ok: true,
      config: input.config,
      resolution: {
        ...input.baseResolution,
        invoice_template_ref: null,
        template_name: null,
        template_source: null,
      },
    };
  }
  const template = resolveInvoiceTemplateVariant({
    templates: Array.from(input.templates.values()),
    templateRef,
  });
  if (!template) {
    return {
      ok: false,
      reason: "invoice_template_ref_unresolved",
      message: `Invoice invoice_template_ref "${templateRef}" cannot be resolved`,
      details: {
        invoice_ref_resolution: input.baseResolution,
        invoice_template_ref: templateRef,
        template_source: input.source,
      },
    };
  }

  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.config)) {
    if (key === "invoice_template_ref" || key === "invoiceTemplateRef") continue;
    merged[key] = value;
  }
  const resolvedTemplate: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(template)) {
    if (key === "name" || value === undefined) continue;
    resolvedTemplate[key] = value;
  }
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
      invoice_template_ref: templateRef,
      template_name: String(template.name || "").trim() || templateRef,
      template_source: input.source,
    },
  };
}

export function resolveInvoiceConfigWithGovernance(input: {
  guardConfig: Record<string, unknown>;
  definition: InvoiceDefinition;
  source: InvoiceRefResolutionSource;
  templates?: Map<string, InvoiceTemplate>;
}): ResolvedInvoiceConfigResult {
  const ref = readInvoiceRef(input.guardConfig);
  const definitionName = String(input.definition.name || "").trim() || ref;
  const resolution: InvoiceRefResolution = {
    invoice_ref: ref,
    definition_name: definitionName,
    source: input.source,
  };
  if (input.source === "owner_manifest") {
    const disallowedOverridePaths = Object.keys(input.guardConfig).filter(
      (key) => key !== "invoice_ref" && key !== "invoiceRef",
    );
    if (disallowedOverridePaths.length > 0) {
      return {
        ok: false,
        reason: "invoice_override_not_allowed",
        message: `Invoice ref ${ref} does not allow guard-level overrides when resolved from owner manifest`,
        details: {
          invoice_ref_resolution: resolution,
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
    if (key === "invoice_ref" || key === "invoiceRef") continue;
    if (value === undefined) continue;
    merged[key] = value;
  }

  return resolveInvoiceTemplateConfig({
    config: merged,
    templates: input.templates ?? new Map(),
    source: input.source,
    baseResolution: resolution,
  });
}
