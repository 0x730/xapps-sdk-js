// @ts-nocheck
function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readBool(value) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "y", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

function readString(...values) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function readCatalogProfiles(rawCatalog) {
  if (!rawCatalog) return [];
  try {
    const parsed = JSON.parse(rawCatalog);
    if (Array.isArray(parsed)) return parsed;
    const root = asObject(parsed);
    const directProfiles = [...asArray(root.profiles), ...asArray(root.items)];
    const scoped = [];
    const bySubject = asObject(root.by_subject || root.bySubject || root.subjects);
    for (const [subjectId, value] of Object.entries(bySubject)) {
      for (const entry of asArray(value)) {
        scoped.push({
          ...(asObject(entry) || {}),
          subject_id: readString(asObject(entry).subject_id, asObject(entry).subjectId, subjectId),
        });
      }
    }
    return [...directProfiles, ...scoped];
  } catch {
    return [];
  }
}

function normalizeSubjectProfileCandidate(raw, index, requestedFamily, workspace) {
  const record = asObject(raw);
  const nestedData = asObject(
    record.data ?? record.profile ?? record.customerProfile ?? record.customer_profile,
  );
  const inferredFamily =
    readString(record.profile_family, record.profileFamily, nestedData.profile_family) ||
    (() => {
      const hasBusinessIdentity = readString(
        nestedData.company_name,
        nestedData.companyName,
        nestedData.company_identification_number,
        nestedData.vat_code,
        nestedData.company_registration_number,
      );
      if (hasBusinessIdentity) return "billing_business";
      const hasIdentityOnly =
        readString(nestedData.name, nestedData.email, nestedData.phone) &&
        !readString(nestedData.address, nestedData.city, nestedData.country);
      return hasIdentityOnly ? "identity_basic" : "billing_individual";
    })();
  const data =
    Object.keys(nestedData).length > 0
      ? { ...nestedData, profile_family: inferredFamily }
      : {
          profile_family: inferredFamily,
          company_name: readString(record.company_name, record.companyName) || null,
          company_identification_number: readString(record.company_identification_number) || null,
          vat_code: readString(record.vat_code) || null,
          company_registration_number: readString(record.company_registration_number) || null,
          address: readString(record.address) || null,
          city: readString(record.city) || null,
          country: readString(record.country) || null,
          email: readString(record.email) || null,
          phone: readString(record.phone) || null,
          name: readString(record.name) || null,
          linked_profiles: asArray(record.linked_profiles || record.linkedProfiles),
        };
  const candidate = {
    id:
      readString(record.id, record.profile_id, record.profileId) ||
      `${workspace}_profile_${index + 1}`,
    label:
      readString(
        record.label,
        record.profile_label,
        record.profileLabel,
        data.company_name,
        data.name,
      ) || `${workspace} profile ${index + 1}`,
    profile_family: inferredFamily,
    is_default: readBool(record.is_default ?? record.isDefault) || index === 0,
    data,
    subject_id: readString(record.subject_id, record.subjectId) || null,
  };
  if (requestedFamily && candidate.profile_family !== requestedFamily) return null;
  return candidate;
}

async function buildSubjectProfileCandidateEnvelope(payload, options = {}) {
  const guardContext = asObject(payload.guard_context || payload.guardContext);
  const subjectId = readString(payload.subjectId, payload.subject_id, guardContext.subjectId);
  const requestedFamily = readString(payload.profile_family, payload.profileFamily) || null;
  const xappSlug = readString(payload.xapp_slug, payload.xappSlug);
  const toolName = readString(payload.tool_name, payload.toolName);
  const workspace = readString(options.workspace) || "tenant";
  const source = readString(options.source) || "tenant_subject_profile";
  const configuredProfiles = readCatalogProfiles(readString(options.catalogJson));
  let resolvedProfiles = [];
  if (typeof options.resolveCandidates === "function") {
    const resolved = await options.resolveCandidates({
      payload,
      subjectId: subjectId || null,
      requestedFamily,
      xappSlug: xappSlug || null,
      toolName: toolName || null,
    });
    resolvedProfiles = Array.isArray(resolved) ? resolved : [];
  }
  const providedDefaultProfiles = Array.isArray(options.defaultProfiles)
    ? options.defaultProfiles
    : [];
  const effectiveCatalog =
    resolvedProfiles.length > 0
      ? resolvedProfiles
      : configuredProfiles.length > 0
        ? configuredProfiles
        : providedDefaultProfiles;
  const profiles = effectiveCatalog
    .map((entry, index) =>
      normalizeSubjectProfileCandidate(entry, index, requestedFamily, workspace),
    )
    .filter(Boolean)
    .filter((entry) => {
      const scopedSubjectId = readString(entry.subject_id);
      return !subjectId || !scopedSubjectId || scopedSubjectId === subjectId;
    });
  const selected = profiles.find((entry) => entry.is_default) || profiles[0] || null;
  return {
    ok: true,
    selected_profile_id: selected?.id || null,
    profiles: profiles.map((entry) => {
      const { subject_id, ...rest } = entry;
      void subject_id;
      return rest;
    }),
    source,
    metadata: {
      workspace,
      subject_id: subjectId || null,
      requested_family: requestedFamily,
      xapp_slug: xappSlug || null,
      tool_name: toolName || null,
      profile_count: profiles.length,
      configured_catalog: configuredProfiles.length > 0,
      default_catalog: configuredProfiles.length === 0 && providedDefaultProfiles.length > 0,
    },
  };
}

export default async function subjectProfileRoutes(fastify, options = {}) {
  fastify.post("/guard/subject-profiles/tenant-candidates", async (request, reply) => {
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const payload = body.payload && typeof body.payload === "object" ? body.payload : body;
    return reply.send(await buildSubjectProfileCandidateEnvelope(payload, options));
  });
}
