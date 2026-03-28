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
export declare function normalizeRequiredSubjectProfileFamily(
  value: unknown,
): RequiredSubjectProfileFamily | null;
export declare function resolveSubjectProfileRequirement(
  config: Record<string, unknown>,
): SubjectProfileRequirementResolution;
export declare function resolveSubjectProfileAllowedSources(
  config: Record<string, unknown>,
): SubjectProfileAllowedSource[];
export declare function resolveSubjectProfileCapturePolicy(
  config: Record<string, unknown>,
): SubjectProfileCapturePolicy;
export declare function resolveSubjectProfileRemediationHandoff(
  config: Record<string, unknown>,
): SubjectProfileRemediationHandoff;
//# sourceMappingURL=subjectProfileRequirement.d.ts.map
