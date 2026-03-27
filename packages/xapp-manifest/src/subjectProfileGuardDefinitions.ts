export type SubjectProfileGuardDefinition = {
  name: string;
  policy?: Record<string, unknown>;
  action?: Record<string, unknown>;
  tools?: string[];
  subject_profile_requirement?: Record<string, unknown>;
  subject_profile_remediation?: Record<string, unknown>;
  subject_profile_sources?: Record<string, unknown>;
  owner_override_allowlist?: string[];
};

export type SubjectProfileGuardRefResolutionSource = "consumer_manifest" | "owner_manifest";
export type SubjectProfileGuardRefResolution = {
  subject_profile_guard_ref: string;
  definition_name: string;
  source: SubjectProfileGuardRefResolutionSource;
};

export function buildSubjectProfileDefinitionRegistry(
  definitions: unknown,
): Map<string, SubjectProfileGuardDefinition> {
  const registry = new Map<string, SubjectProfileGuardDefinition>();
  if (!Array.isArray(definitions)) return registry;
  for (const definition of definitions) {
    if (!definition || typeof definition !== "object") continue;
    const name = String((definition as any).name ?? "").trim();
    if (!name) continue;
    registry.set(name, definition as SubjectProfileGuardDefinition);
  }
  return registry;
}

export function readSubjectProfileGuardRef(config: unknown): string {
  if (!config || typeof config !== "object" || Array.isArray(config)) return "";
  return String(
    (config as any).subject_profile_guard_ref ?? (config as any).subjectProfileGuardRef ?? "",
  ).trim();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeSubjectProfileGuardValue(
  baseValue: unknown,
  overrideValue: unknown,
): Record<string, unknown> | unknown {
  if (!isPlainRecord(baseValue) || !isPlainRecord(overrideValue)) {
    return overrideValue;
  }
  const merged: Record<string, unknown> = { ...baseValue };
  for (const [key, value] of Object.entries(overrideValue)) {
    if (value === undefined) continue;
    merged[key] = mergeSubjectProfileGuardValue(merged[key], value);
  }
  return merged;
}

function resolveSubjectProfileGuardConfig(
  guardConfig: Record<string, unknown>,
  definitions: Map<string, SubjectProfileGuardDefinition>,
): Record<string, unknown> {
  const ref = readSubjectProfileGuardRef(guardConfig);
  if (!ref) return guardConfig;
  const definition = definitions.get(ref);
  if (!definition) return guardConfig;
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(definition)) {
    if (key === "name") continue;
    merged[key] = value;
  }
  for (const [key, value] of Object.entries(guardConfig)) {
    if (key === "subject_profile_guard_ref" || key === "subjectProfileGuardRef") continue;
    if (value === undefined) continue;
    merged[key] = mergeSubjectProfileGuardValue(merged[key], value);
  }
  return merged;
}

function collectOverridePaths(value: unknown, prefix = "", out = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (prefix) out.add(prefix);
    return out;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key, entry]) =>
      key !== "subject_profile_guard_ref" &&
      key !== "subjectProfileGuardRef" &&
      entry !== undefined,
  );
  if (!entries.length && prefix) out.add(prefix);
  for (const [key, entry] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      collectOverridePaths(entry, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

function isOverridePathAllowed(path: string, allowlist: string[]): boolean {
  return allowlist.some((entry) => {
    const normalized = String(entry || "").trim();
    if (!normalized) return false;
    if (normalized === path) return true;
    if (path.startsWith(`${normalized}.`)) return true;
    if (normalized.endsWith(".*")) {
      const prefix = normalized.slice(0, -2);
      return path === prefix || path.startsWith(`${prefix}.`);
    }
    return false;
  });
}

export function resolveSubjectProfileGuardConfigWithGovernance(input: {
  guardConfig: Record<string, unknown>;
  definition: SubjectProfileGuardDefinition;
  source: SubjectProfileGuardRefResolutionSource;
}):
  | { ok: true; config: Record<string, unknown>; resolution: SubjectProfileGuardRefResolution }
  | { ok: false; reason: string; message: string; details: Record<string, unknown> } {
  const ref = readSubjectProfileGuardRef(input.guardConfig);
  const definitionName = String(input.definition.name || "").trim() || ref;
  const resolution: SubjectProfileGuardRefResolution = {
    subject_profile_guard_ref: ref,
    definition_name: definitionName,
    source: input.source,
  };
  const baseDetails = { subject_profile_guard_ref_resolution: resolution };

  if (input.source === "owner_manifest") {
    const allowlist = Array.isArray(input.definition.owner_override_allowlist)
      ? input.definition.owner_override_allowlist
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      : [];
    if (allowlist.length > 0) {
      const overridePaths = Array.from(collectOverridePaths(input.guardConfig));
      const disallowed = overridePaths.filter((path) => !isOverridePathAllowed(path, allowlist));
      if (disallowed.length > 0) {
        return {
          ok: false,
          reason: "subject_profile_guard_override_not_allowed",
          message: `Guard override includes keys disallowed by owner policy: ${disallowed.join(", ")}`,
          details: {
            ...baseDetails,
            disallowed_override_paths: disallowed,
            allowed_override_paths: allowlist,
          },
        };
      }
    }
  }

  return {
    ok: true,
    config: resolveSubjectProfileGuardConfig(
      input.guardConfig,
      new Map<string, SubjectProfileGuardDefinition>([[ref, input.definition]]),
    ),
    resolution,
  };
}
