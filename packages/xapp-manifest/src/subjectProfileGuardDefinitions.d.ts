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
export declare function buildSubjectProfileDefinitionRegistry(definitions: unknown): Map<string, SubjectProfileGuardDefinition>;
export declare function readSubjectProfileGuardRef(config: unknown): string;
export declare function resolveSubjectProfileGuardConfigWithGovernance(input: {
    guardConfig: Record<string, unknown>;
    definition: SubjectProfileGuardDefinition;
    source: SubjectProfileGuardRefResolutionSource;
}): {
    ok: true;
    config: Record<string, unknown>;
    resolution: SubjectProfileGuardRefResolution;
} | {
    ok: false;
    reason: string;
    message: string;
    details: Record<string, unknown>;
};
//# sourceMappingURL=subjectProfileGuardDefinitions.d.ts.map