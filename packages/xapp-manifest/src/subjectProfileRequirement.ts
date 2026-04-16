export type RequiredSubjectProfileFamily =
  | "identity_basic"
  | "billing_individual"
  | "billing_business";

export type SubjectProfileRequirement = {
  requiredProfileFamily: RequiredSubjectProfileFamily;
  requiredProfileFamilies: RequiredSubjectProfileFamily[];
  requiredProfileFields: string[];
  requiredProfileFieldsByFamily: Partial<Record<RequiredSubjectProfileFamily, string[]>>;
};

export type SubjectProfileAllowedSource =
  | "request_payload"
  | "tenant_subject_profile"
  | "publisher_subject_profile"
  | "subject_self_profile";

export type SubjectProfileRemediationFlow =
  | "internal_guard_ui"
  | "hosted_capture"
  | "external_endpoint";

export type SubjectProfileCaptureMode = "collect_only" | "collect_and_save";
export type SubjectProfileSaveScope = "none" | "subject_private";
export type SubjectProfileShareTarget = "tenant" | "publisher" | "app";
export type SubjectProfileDirtyHandling = "discard_incomplete" | "allow_incomplete_draft";

export type SubjectProfileCapturePolicy = {
  captureMode: SubjectProfileCaptureMode;
  saveScope: SubjectProfileSaveScope;
  shareTargets: SubjectProfileShareTarget[];
  acceptanceRequiredFor: SubjectProfileShareTarget[];
  dirtyHandling: SubjectProfileDirtyHandling;
};

export type SubjectProfileSelectionPolicy = {
  allowedSources: SubjectProfileAllowedSource[] | null;
  directSelectableSources: SubjectProfileAllowedSource[];
  allowSubjectPrivateProfileCreation: boolean;
};

export type SubjectProfileRemediationHandoff = {
  contractVersion: "subject_profile_remediation_v1";
  preferredFlow: SubjectProfileRemediationFlow;
  availableFlows: SubjectProfileRemediationFlow[];
  externalEndpointUrl: string | null;
};

export type SubjectProfileRequirementResolution =
  | {
      ok: true;
      requirement: SubjectProfileRequirement | null;
      source: "inline" | "nested" | "none";
    }
  | {
      ok: false;
      reason: "subject_profile_guard_misconfigured";
      message: string;
      details: Record<string, unknown>;
    };

function asObjectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v || "").trim()).filter(Boolean);
}

function dedupeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function normalizeAllowedSource(value: unknown): SubjectProfileAllowedSource | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    ["request_payload", "request-payload", "payload", "explicit_payload", "explicit"].includes(
      normalized,
    )
  ) {
    return "request_payload";
  }
  if (
    ["tenant_subject_profile", "tenant-subject-profile", "tenant_profile", "tenant"].includes(
      normalized,
    )
  ) {
    return "tenant_subject_profile";
  }
  if (
    [
      "publisher_subject_profile",
      "publisher-subject-profile",
      "publisher_profile",
      "publisher",
    ].includes(normalized)
  ) {
    return "publisher_subject_profile";
  }
  if (
    ["subject_self_profile", "subject-self-profile", "self_profile", "self", "subject"].includes(
      normalized,
    )
  ) {
    return "subject_self_profile";
  }
  return null;
}

export function normalizeSubjectProfileAllowedSource(
  value: unknown,
): SubjectProfileAllowedSource | null {
  return normalizeAllowedSource(value);
}

function isAllowedSource(value: unknown): value is SubjectProfileAllowedSource {
  return (
    value === "request_payload" ||
    value === "tenant_subject_profile" ||
    value === "publisher_subject_profile" ||
    value === "subject_self_profile"
  );
}

function normalizeRemediationFlow(value: unknown): SubjectProfileRemediationFlow | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    ["internal_guard_ui", "internal-guard-ui", "internal", "guard_ui", "guard-ui"].includes(
      normalized,
    )
  ) {
    return "internal_guard_ui";
  }
  if (["hosted_capture", "hosted-capture", "hosted", "capture"].includes(normalized)) {
    return "hosted_capture";
  }
  if (
    [
      "external_endpoint",
      "external-endpoint",
      "external",
      "endpoint",
      "third_party_endpoint",
    ].includes(normalized)
  ) {
    return "external_endpoint";
  }
  return null;
}

function isRemediationFlow(value: unknown): value is SubjectProfileRemediationFlow {
  return (
    value === "internal_guard_ui" || value === "hosted_capture" || value === "external_endpoint"
  );
}

function normalizeCaptureMode(value: unknown): SubjectProfileCaptureMode | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["collect_only", "collect-only", "collect"].includes(normalized)) return "collect_only";
  if (["collect_and_save", "collect-and-save", "save"].includes(normalized)) {
    return "collect_and_save";
  }
  return null;
}

function normalizeSaveScope(value: unknown): SubjectProfileSaveScope | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["none", "no_save", "no-save"].includes(normalized)) return "none";
  if (
    ["subject_private", "subject-private", "subject", "subject_only", "subject-only"].includes(
      normalized,
    )
  ) {
    return "subject_private";
  }
  return null;
}

function normalizeShareTarget(value: unknown): SubjectProfileShareTarget | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "tenant") return "tenant";
  if (normalized === "publisher") return "publisher";
  if (["app", "xapp"].includes(normalized)) return "app";
  return null;
}

function isShareTarget(value: unknown): value is SubjectProfileShareTarget {
  return value === "tenant" || value === "publisher" || value === "app";
}

function normalizeDirtyHandling(value: unknown): SubjectProfileDirtyHandling | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["discard_incomplete", "discard-incomplete", "discard"].includes(normalized)) {
    return "discard_incomplete";
  }
  if (
    ["allow_incomplete_draft", "allow-incomplete-draft", "allow_draft", "draft"].includes(
      normalized,
    )
  ) {
    return "allow_incomplete_draft";
  }
  return null;
}

function readString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return null;
}

export function normalizeRequiredSubjectProfileFamily(
  value: unknown,
): RequiredSubjectProfileFamily | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["identity_basic", "identity-basic", "identity", "basic_identity"].includes(normalized)) {
    return "identity_basic";
  }
  if (
    ["billing_individual", "billing-individual", "individual", "person", "natural_person"].includes(
      normalized,
    )
  ) {
    return "billing_individual";
  }
  if (
    ["billing_business", "billing-business", "business", "company", "organization"].includes(
      normalized,
    )
  ) {
    return "billing_business";
  }
  return null;
}

export function resolveSubjectProfileRequirement(
  config: Record<string, unknown>,
): SubjectProfileRequirementResolution {
  const nested = asObjectRecord(
    config.subject_profile_requirement ??
      config.subjectProfileRequirement ??
      config.subject_profile ??
      config.subjectProfile,
  );
  const source =
    Object.keys(nested).length > 0 ? "nested" : Object.keys(config).length > 0 ? "inline" : "none";
  const base = Object.keys(nested).length > 0 ? nested : config;
  const rawRequiredProfileFamily =
    (base as any).required_profile_family ?? (base as any).requiredProfileFamily;
  const rawRequiredProfileFamilies =
    (base as any).required_profile_families ?? (base as any).requiredProfileFamilies;
  const rawRequiredProfileFields =
    (base as any).required_profile_fields ?? (base as any).requiredProfileFields;
  const rawRequiredProfileFieldsByFamily =
    (base as any).required_profile_fields_by_family ?? (base as any).requiredProfileFieldsByFamily;
  const normalizedFamily = normalizeRequiredSubjectProfileFamily(rawRequiredProfileFamily);
  const normalizedFamilies = Array.isArray(rawRequiredProfileFamilies)
    ? Array.from(
        new Set(
          rawRequiredProfileFamilies
            .map(normalizeRequiredSubjectProfileFamily)
            .filter((value): value is RequiredSubjectProfileFamily => Boolean(value)),
        ),
      )
    : [];
  const requiredProfileFamilies =
    normalizedFamilies.length > 0
      ? normalizedFamily && normalizedFamilies.includes(normalizedFamily)
        ? [normalizedFamily, ...normalizedFamilies.filter((family) => family !== normalizedFamily)]
        : normalizedFamilies
      : normalizedFamily
        ? [normalizedFamily]
        : [];
  const requiredProfileFields = dedupeStringArray(readStringArray(rawRequiredProfileFields));
  const fieldsByFamilyRecord =
    rawRequiredProfileFieldsByFamily &&
    typeof rawRequiredProfileFieldsByFamily === "object" &&
    !Array.isArray(rawRequiredProfileFieldsByFamily)
      ? (rawRequiredProfileFieldsByFamily as Record<string, unknown>)
      : {};
  const requiredProfileFieldsByFamily = Object.fromEntries(
    Object.entries(fieldsByFamilyRecord)
      .map(
        ([key, value]) =>
          [
            normalizeRequiredSubjectProfileFamily(key),
            dedupeStringArray(readStringArray(value)),
          ] as const,
      )
      .filter(
        (entry): entry is [RequiredSubjectProfileFamily, string[]] =>
          Boolean(entry[0]) && Array.isArray(entry[1]),
      ),
  ) as Partial<Record<RequiredSubjectProfileFamily, string[]>>;
  const hasRequirementKeys =
    rawRequiredProfileFamily !== undefined ||
    rawRequiredProfileFamilies !== undefined ||
    rawRequiredProfileFields !== undefined ||
    rawRequiredProfileFieldsByFamily !== undefined ||
    Object.keys(nested).length > 0;

  if (!hasRequirementKeys) {
    return { ok: true, requirement: null, source: "none" };
  }
  if (requiredProfileFamilies.length === 0) {
    return {
      ok: false,
      reason: "subject_profile_guard_misconfigured",
      message:
        "subject-profile-check requires required_profile_family or required_profile_families",
      details: {
        required_profile_family: rawRequiredProfileFamily ?? null,
        required_profile_families: Array.isArray(rawRequiredProfileFamilies)
          ? rawRequiredProfileFamilies
          : (rawRequiredProfileFamilies ?? null),
      },
    };
  }

  return {
    ok: true,
    requirement: {
      requiredProfileFamily: requiredProfileFamilies[0],
      requiredProfileFamilies,
      requiredProfileFields,
      requiredProfileFieldsByFamily,
    },
    source,
  };
}

export function resolveSubjectProfileAllowedSources(
  config: Record<string, unknown>,
): SubjectProfileAllowedSource[] {
  return (
    resolveConfiguredSubjectProfileAllowedSources(config) ?? [
      "request_payload",
      "tenant_subject_profile",
      "publisher_subject_profile",
      "subject_self_profile",
    ]
  );
}

export function resolveConfiguredSubjectProfileAllowedSources(
  config: Record<string, unknown>,
): SubjectProfileAllowedSource[] | null {
  const remediation = asObjectRecord(
    config.subject_profile_remediation ?? config.subjectProfileRemediation ?? config.remediation,
  );
  const raw =
    remediation.allowed_sources ??
    remediation.allowedSources ??
    config.allowed_sources ??
    config.allowedSources;
  const parsed = Array.isArray(raw) ? raw.map(normalizeAllowedSource).filter(isAllowedSource) : [];
  return parsed.length > 0 ? Array.from(new Set(parsed)) : null;
}

export function resolveSubjectProfileSelectionPolicy(
  config: Record<string, unknown>,
): SubjectProfileSelectionPolicy {
  const remediation = asObjectRecord(
    config.subject_profile_remediation ?? config.subjectProfileRemediation ?? config.remediation,
  );
  const allowedSources = resolveConfiguredSubjectProfileAllowedSources(config);
  const rawDirectSelectableSources =
    remediation.direct_selectable_sources ??
    remediation.directSelectableSources ??
    config.direct_selectable_sources ??
    config.directSelectableSources;
  const parsedDirectSelectableSources: SubjectProfileAllowedSource[] = Array.isArray(
    rawDirectSelectableSources,
  )
    ? rawDirectSelectableSources
        .map(normalizeAllowedSource)
        .filter((source): source is SubjectProfileAllowedSource => isAllowedSource(source))
    : [];
  const normalizedDirectSelectableSources: SubjectProfileAllowedSource[] =
    parsedDirectSelectableSources.length > 0
      ? Array.from(new Set(parsedDirectSelectableSources))
      : ["subject_self_profile"];
  const directSelectableSources = (
    allowedSources
      ? normalizedDirectSelectableSources.filter((source) => allowedSources.includes(source))
      : normalizedDirectSelectableSources
  ) as SubjectProfileAllowedSource[];
  const rawAllowSubjectPrivateProfileCreation =
    remediation.allow_subject_private_profile_creation ??
    remediation.allowSubjectPrivateProfileCreation ??
    remediation.allow_private_profile_creation ??
    remediation.allowPrivateProfileCreation ??
    config.allow_subject_private_profile_creation ??
    config.allowSubjectPrivateProfileCreation ??
    config.allow_private_profile_creation ??
    config.allowPrivateProfileCreation;
  const configuredAllowSubjectPrivateProfileCreation = readBoolean(
    rawAllowSubjectPrivateProfileCreation,
  );
  const allowSubjectPrivateProfileCreation =
    allowedSources && !allowedSources.includes("subject_self_profile")
      ? false
      : (configuredAllowSubjectPrivateProfileCreation ?? true);
  return {
    allowedSources,
    directSelectableSources,
    allowSubjectPrivateProfileCreation,
  };
}

export function resolveSubjectProfileCapturePolicy(
  config: Record<string, unknown>,
): SubjectProfileCapturePolicy {
  const remediation = asObjectRecord(
    config.subject_profile_remediation ?? config.subjectProfileRemediation ?? config.remediation,
  );
  const captureMode =
    normalizeCaptureMode(remediation.capture_mode ?? remediation.captureMode) ?? "collect_only";
  const saveScope =
    normalizeSaveScope(remediation.save_scope ?? remediation.saveScope) ??
    (captureMode === "collect_and_save" ? "subject_private" : "none");
  const shareTargetsRaw = Array.isArray(remediation.share_targets ?? remediation.shareTargets)
    ? ((remediation.share_targets ?? remediation.shareTargets) as unknown[])
    : [];
  const shareTargets = Array.from(
    new Set(shareTargetsRaw.map(normalizeShareTarget).filter(isShareTarget)),
  );
  const acceptanceRequiredRaw = Array.isArray(
    remediation.acceptance_required_for ?? remediation.acceptanceRequiredFor,
  )
    ? ((remediation.acceptance_required_for ?? remediation.acceptanceRequiredFor) as unknown[])
    : shareTargetsRaw;
  const acceptanceRequiredFor = Array.from(
    new Set(acceptanceRequiredRaw.map(normalizeShareTarget).filter(isShareTarget)),
  );
  const dirtyHandling =
    normalizeDirtyHandling(
      remediation.dirty_profile_handling ?? remediation.dirtyProfileHandling,
    ) ?? (captureMode === "collect_and_save" ? "allow_incomplete_draft" : "discard_incomplete");

  return {
    captureMode,
    saveScope,
    shareTargets,
    acceptanceRequiredFor,
    dirtyHandling,
  };
}

export function resolveSubjectProfileRemediationHandoff(
  config: Record<string, unknown>,
): SubjectProfileRemediationHandoff {
  const remediation = asObjectRecord(
    config.subject_profile_remediation ?? config.subjectProfileRemediation ?? config.remediation,
  );
  const rawFlows = Array.isArray(remediation.available_flows ?? remediation.availableFlows)
    ? ((remediation.available_flows ?? remediation.availableFlows) as unknown[])
    : [];
  const availableFlows = Array.from(
    new Set(rawFlows.map(normalizeRemediationFlow).filter(isRemediationFlow)),
  );
  const preferredFlow =
    normalizeRemediationFlow(remediation.preferred_flow ?? remediation.preferredFlow) ??
    availableFlows[0] ??
    "internal_guard_ui";

  return {
    contractVersion: "subject_profile_remediation_v1",
    preferredFlow,
    availableFlows:
      availableFlows.length > 0
        ? availableFlows
        : preferredFlow === "external_endpoint"
          ? ["external_endpoint"]
          : ["internal_guard_ui", "hosted_capture"],
    externalEndpointUrl: readString(
      remediation.external_endpoint_url ?? remediation.externalEndpointUrl,
    ),
  };
}
