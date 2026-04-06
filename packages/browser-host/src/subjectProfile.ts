function readString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function readLower(value: unknown): string {
  return readString(value).toLowerCase();
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readLocalizedText(value: unknown, locale?: unknown, fallback = ""): string {
  if (typeof value === "string") return readString(value) || fallback;
  const record = readRecord(value);
  if (!record) return fallback;
  const localeTag = readString(locale).replace(/_/g, "-");
  const candidates = new Set<string>();
  if (localeTag) {
    candidates.add(localeTag);
    const dashIndex = localeTag.indexOf("-");
    if (dashIndex > 0) candidates.add(localeTag.slice(0, dashIndex));
  }
  candidates.add("en");
  candidates.add("ro");
  for (const key of candidates) {
    const resolved = readString(record[key]);
    if (resolved) return resolved;
  }
  for (const entry of Object.values(record)) {
    const resolved = readString(entry);
    if (resolved) return resolved;
  }
  return fallback;
}

function readGuardDescriptor(input: unknown): Record<string, unknown> {
  const record = readRecord(input);
  if (!record) return {};
  if (readString(record.contract_version) === "subject_profile_guard_ui_v1") return record;
  if (readRecord(record.guardUi)) return readRecord(record.guardUi) || {};
  if (readRecord(record.guard_ui)) return readRecord(record.guard_ui) || {};
  return record;
}

function readRemediation(input: unknown): Record<string, unknown> {
  const descriptor = readGuardDescriptor(input);
  return readRecord(descriptor.remediation) || readRecord(input) || {};
}

function readFormDescriptor(input: unknown): Record<string, unknown> {
  const remediation = readRemediation(input);
  return readRecord(remediation.form) || {};
}

function listCandidates(input: unknown): Array<Record<string, unknown>> {
  const remediation = readRemediation(input);
  const candidates = Array.isArray(remediation.candidates) ? remediation.candidates : [];
  return candidates
    .map((item) => readRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function listRefreshSources(input: unknown): Array<Record<string, unknown>> {
  const remediation = readRemediation(input);
  const sources = Array.isArray(remediation.refresh_sources) ? remediation.refresh_sources : [];
  return sources
    .map((item) => readRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function familyLabel(value: string, locale?: unknown): string {
  const normalized = readLower(value);
  if (normalized === "billing_business") {
    return readLower(locale).startsWith("ro") ? "Companie" : "Business";
  }
  if (normalized === "billing_individual") {
    return readLower(locale).startsWith("ro") ? "Persoană fizică" : "Individual";
  }
  if (normalized === "identity_basic") {
    return readLower(locale).startsWith("ro") ? "Identitate" : "Identity";
  }
  return value || (readLower(locale).startsWith("ro") ? "Profil" : "Profile");
}

function shouldUseCandidate(candidate: Record<string, unknown>): boolean {
  const capabilities = readRecord(candidate.capabilities);
  return capabilities?.can_select !== false;
}

function shouldEditCandidate(candidate: Record<string, unknown>): boolean {
  const capabilities = readRecord(candidate.capabilities);
  return capabilities?.can_edit === true || Boolean(readRecord(candidate.editable_profile));
}

function candidateLabel(candidate: Record<string, unknown>, locale?: unknown): string {
  const summary = readRecord(candidate.summary);
  return (
    readString(candidate.label) ||
    readString(summary?.company_name) ||
    readString(summary?.name) ||
    readString(summary?.email) ||
    (readLower(locale).startsWith("ro") ? "Profil" : "Profile")
  );
}

function candidateResolvedProfile(
  candidate: Record<string, unknown>,
): Record<string, unknown> | null {
  return readRecord(candidate.resolved_profile);
}

function candidateEditableProfile(
  candidate: Record<string, unknown>,
): Record<string, unknown> | null {
  return readRecord(candidate.editable_profile) || candidateResolvedProfile(candidate);
}

function buildUseCandidatePayload(
  candidate: Record<string, unknown>,
): Record<string, unknown> | null {
  const selectionPayload = readRecord(candidate.selection_payload);
  if (selectionPayload && readString(selectionPayload.source) === "subject_self_profile") {
    return {
      customerProfile: {
        selection: {
          source: "subject_self_profile",
          candidate_id:
            selectionPayload.candidate_id == null ? null : String(selectionPayload.candidate_id),
        },
        selected_profile_id:
          selectionPayload.selected_profile_id == null
            ? null
            : String(selectionPayload.selected_profile_id),
        selected_profile_source: "subject_self_profile",
        private_profile: {
          mode: "select_existing",
        },
      },
    };
  }
  const resolvedProfile = candidateResolvedProfile(candidate);
  if (!resolvedProfile) return null;
  const nextProfile = { ...resolvedProfile };
  const candidateId = readString(candidate.candidate_id);
  const candidateSource = readString(candidate.source);
  if (candidateSource || candidateId) {
    nextProfile.selection = {
      source: candidateSource || null,
      candidate_id: candidateId || null,
    };
    if (candidateId) nextProfile.selected_profile_id = candidateId;
    if (candidateSource) nextProfile.selected_profile_source = candidateSource;
  }
  return {
    customerProfile: nextProfile,
  };
}

function readAvailableFamilies(input: unknown): string[] {
  const form = readFormDescriptor(input);
  const value = Array.isArray(form.available_families)
    ? form.available_families
    : readString(form.family)
      ? [form.family]
      : [];
  return value.map((item) => readString(item)).filter(Boolean);
}

function readFamilyForm(input: unknown, family: string): Record<string, unknown> {
  const form = readFormDescriptor(input);
  const familyForms = readRecord(form.family_forms);
  const familyForm = readRecord(familyForms?.[family]);
  return familyForm || form;
}

function readProfileSummary(candidate: Record<string, unknown>): string {
  const summary = readRecord(candidate.summary);
  return (
    readString(summary?.email) ||
    readString(summary?.company_identification_number) ||
    readString(summary?.phone)
  );
}

function mergeRefreshedCandidates(
  descriptor: Record<string, unknown>,
  input: { source: string; candidates: Array<Record<string, unknown>> },
) {
  const nextDescriptor = { ...descriptor };
  const remediation = { ...(readRemediation(descriptor) || {}) };
  const currentCandidates = listCandidates(descriptor);
  remediation.candidates = [
    ...currentCandidates.filter((candidate) => readString(candidate.source) !== input.source),
    ...input.candidates,
  ];
  nextDescriptor.remediation = remediation;
  return nextDescriptor;
}

function listDetailRows(candidate: Record<string, unknown>): string[] {
  const summary = readRecord(candidate.summary);
  const values = [
    readString(summary?.company_name),
    readString(summary?.name),
    readString(summary?.company_identification_number),
    readString(summary?.company_registration_number),
    readString(summary?.vat_code),
    readString(summary?.phone),
    readString(summary?.address),
    readString(summary?.city),
    readString(summary?.country),
  ];
  return values.filter(Boolean);
}

function summarizeDetailRows(candidate: Record<string, unknown>): {
  visible: string[];
  hiddenCount: number;
} {
  const details = listDetailRows(candidate);
  const visible = details.slice(0, 4);
  return {
    visible,
    hiddenCount: Math.max(0, details.length - visible.length),
  };
}

function buildOriginText(candidate: Record<string, unknown>): string {
  const origin = readRecord(candidate.origin);
  const sourceLabel = readString(origin?.source_label);
  const detail = readString(origin?.detail);
  if (sourceLabel && detail) return `${sourceLabel} · ${detail}`;
  return sourceLabel || detail;
}

function replaceTemplate(
  input: string,
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  return input.replace(/\{([^}]+)\}/g, (_, key) => {
    const resolved = params[key];
    return resolved == null ? "" : String(resolved);
  });
}

const i18nCatalog = {
  en: {
    title: "Billing profile",
    subtitle: "Choose an existing profile or complete the required invoicing details.",
    available_profiles: "Available profiles",
    profiles_summary: "{count} saved · {ready} ready to use",
    current_profile: "Current profile",
    current_profile_missing: "No current billing profile selected yet",
    current_profile_ready: "Ready to continue",
    current_profile_review: "Review saved profiles or create a new one below.",
    complete_required_profile: "Complete the required profile",
    complete_required_profile_help:
      "This flow needs a complete billing profile before it can continue.",
    continue_with_current_profile: "Continue with the current profile",
    continue_with_current_profile_help:
      "You can continue immediately with the selected billing profile, edit it, or create another one.",
    use_current_profile: "Use current profile",
    create_profile_hint:
      "Create a new billing profile only if the saved profiles are not the right fit.",
    current: "Current",
    ready: "ready",
    default: "default",
    editing: "editing",
    no_profiles: "No reusable subject profiles yet. Load a source or create a new profile.",
    use_profile: "Use this profile",
    edit: "Edit",
    edit_copy: "Edit copy",
    new_profile: "New profile",
    save_and_continue: "Save and continue",
    create_and_continue: "Create and continue",
    back_to_list: "Back to list",
    cancel: "Cancel",
    refreshing: "Refreshing...",
    more_sources: "More sources",
    hide_more_sources: "Hide additional sources",
    additional_sources: "Additional sources",
    profile_sources: "Profile sources",
    more_details_count: "+{count} more",
    create_from_current_identity: "Create from current identity",
    create_private_copy: "Create private copy",
    edit_billing_profile: "Edit billing profile",
    new_billing_profile: "New billing profile",
    profile_type: "Profile type",
    profile_type_help: "Choose whether this billing profile is for an individual or a business.",
    profile_label: "Profile label",
    profile_label_help: "Optional label shown when the user chooses between saved profiles.",
    set_as_default: "Set as default",
    default_profile_help: "Default profile stays available for later sessions and invoicing.",
    select: "Select",
    please_complete_field: "Please complete {field}.",
    close: "Close",
  },
  ro: {
    title: "Profil de facturare",
    subtitle: "Alege un profil existent sau completează detaliile necesare pentru facturare.",
    available_profiles: "Profiluri disponibile",
    profiles_summary: "{count} salvate · {ready} gata de folosit",
    current_profile: "Profil curent",
    current_profile_missing: "Nu este selectat încă un profil curent de facturare",
    current_profile_ready: "Gata pentru a continua",
    current_profile_review: "Revizuiește profilurile salvate sau creează unul nou mai jos.",
    complete_required_profile: "Completează profilul necesar",
    complete_required_profile_help:
      "Acest flux are nevoie de un profil complet de facturare înainte să poată continua.",
    continue_with_current_profile: "Continuă cu profilul curent",
    continue_with_current_profile_help:
      "Poți continua imediat cu profilul selectat, îl poți edita sau poți crea unul nou.",
    use_current_profile: "Folosește profilul curent",
    create_profile_hint: "Creează un profil nou doar dacă profilurile salvate nu sunt potrivite.",
    current: "curent",
    ready: "gata",
    default: "implicit",
    editing: "în editare",
    no_profiles:
      "Nu există încă profiluri reutilizabile. Încarcă o sursă sau creează un profil nou.",
    use_profile: "Folosește acest profil",
    edit: "Editează",
    edit_copy: "Editează copia",
    new_profile: "Profil nou",
    save_and_continue: "Salvează și continuă",
    create_and_continue: "Creează și continuă",
    back_to_list: "Înapoi la listă",
    cancel: "Anulează",
    refreshing: "Se reîmprospătează...",
    more_sources: "Mai multe surse",
    hide_more_sources: "Ascunde sursele suplimentare",
    additional_sources: "Surse suplimentare",
    profile_sources: "Surse profil",
    more_details_count: "+{count} altele",
    create_from_current_identity: "Creează din identitatea curentă",
    create_private_copy: "Creează copie privată",
    edit_billing_profile: "Editează profilul de facturare",
    new_billing_profile: "Profil nou de facturare",
    profile_type: "Tip profil",
    profile_type_help:
      "Alege dacă acest profil de facturare este pentru persoană fizică sau companie.",
    profile_label: "Etichetă profil",
    profile_label_help:
      "Etichetă opțională afișată când utilizatorul alege între profiluri salvate.",
    set_as_default: "Setează ca implicit",
    default_profile_help:
      "Profilul implicit rămâne disponibil pentru sesiunile și facturile viitoare.",
    select: "Selectează",
    please_complete_field: "Te rog completează {field}.",
    close: "Închide",
  },
} as const;

function translate(
  locale: unknown,
  key: keyof (typeof i18nCatalog)["en"],
  fallback?: string,
): string {
  const normalized = readLower(locale);
  const catalog = normalized.startsWith("ro") ? i18nCatalog.ro : i18nCatalog.en;
  return readString(catalog[key]) || fallback || "";
}

export const subjectProfileGuardSurfaceStyles = `
  .xapps-subject-profile {
    --xapps-subject-profile-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
    --sp-primary: #2563eb;
    --sp-primary-hover: #1d4ed8;
    --sp-primary-bg: rgba(37, 99, 235, 0.06);
    --sp-primary-border: rgba(37, 99, 235, 0.18);
    --sp-success: #059669;
    --sp-success-bg: rgba(5, 150, 105, 0.07);
    --sp-success-border: rgba(5, 150, 105, 0.2);
    --sp-amber: #b45309;
    --sp-amber-bg: rgba(180, 83, 9, 0.07);
    --sp-amber-border: rgba(180, 83, 9, 0.18);
    --sp-purple: #7c3aed;
    --sp-purple-bg: rgba(124, 58, 237, 0.07);
    --sp-purple-border: rgba(124, 58, 237, 0.18);
    --sp-text: #0f172a;
    --sp-text-2: #334155;
    --sp-text-3: #475569;
    --sp-text-muted: #64748b;
    --sp-surface: #ffffff;
    --sp-bg: #f8fafc;
    --sp-border: rgba(148, 163, 184, 0.22);
    --sp-shadow-sm: 0 1px 2px rgba(15,23,42,0.04);
    --sp-shadow: 0 1px 3px rgba(15,23,42,0.03), 0 6px 16px rgba(15,23,42,0.06);
    --sp-shadow-lg: 0 2px 6px rgba(15,23,42,0.03), 0 10px 28px rgba(15,23,42,0.08);
    --sp-focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.15);
    --sp-ease: cubic-bezier(0.4, 0, 0.2, 1);
    display: grid;
    gap: 16px;
    color: var(--sp-text);
    font-family: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .xapps-subject-profile__header {
    display: grid;
    gap: 6px;
  }
  .xapps-subject-profile__summary {
    display: grid;
    gap: 12px;
    grid-template-columns: var(--xapps-subject-profile-columns);
  }
  .xapps-subject-profile__summary-card {
    display: grid;
    gap: 8px;
    border: 1px solid var(--sp-border);
    border-radius: 16px;
    background: linear-gradient(180deg, var(--sp-surface) 0%, var(--sp-bg) 100%);
    padding: 14px 16px;
    transition: box-shadow 200ms var(--sp-ease), border-color 200ms var(--sp-ease);
  }
  .xapps-subject-profile__summary-card:hover {
    box-shadow: var(--sp-shadow-sm);
    border-color: rgba(148, 163, 184, 0.35);
  }
  .xapps-subject-profile__summary-label {
    color: var(--sp-text-muted);
    font: 600 0.7rem/1.2 system-ui, sans-serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .xapps-subject-profile__summary-title {
    font: 600 0.92rem/1.3 system-ui, sans-serif;
    color: var(--sp-text);
  }
  .xapps-subject-profile__summary-meta {
    color: var(--sp-text-3);
    font: 400 0.8rem/1.45 system-ui, sans-serif;
  }
  .xapps-subject-profile__focus-card {
    display: grid;
    gap: 14px;
    border: 1px solid var(--sp-border);
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(248,250,255,0.95) 0%, var(--sp-surface) 100%);
    padding: 18px;
  }
  .xapps-subject-profile__focus-copy {
    display: grid;
    gap: 6px;
  }
  .xapps-subject-profile__title {
    margin: 0;
    font: 700 1.05rem/1.25 "IBM Plex Sans", system-ui, sans-serif;
    color: var(--sp-text);
    letter-spacing: -0.01em;
  }
  .xapps-subject-profile__subtitle {
    color: var(--sp-text-muted);
    font: 400 0.85rem/1.5 system-ui, sans-serif;
  }
  .xapps-subject-profile__notice,
  .xapps-subject-profile__error {
    border-radius: 12px;
    padding: 12px 16px;
    font: 400 0.82rem/1.5 system-ui, sans-serif;
  }
  .xapps-subject-profile__notice {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1e40af;
  }
  .xapps-subject-profile__error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
  }
  .xapps-subject-profile__layout {
    display: grid;
    gap: 14px;
    grid-template-columns: var(--xapps-subject-profile-columns);
    align-items: start;
  }
  .xapps-subject-profile__card {
    border: 1px solid var(--sp-border);
    border-radius: 18px;
    background: var(--sp-surface);
    box-shadow: var(--sp-shadow);
    padding: 18px;
    display: grid;
    gap: 14px;
    align-content: start;
    min-width: 0;
  }
  .xapps-subject-profile__section-title {
    margin: 0;
    font: 600 0.9rem/1.25 system-ui, sans-serif;
    color: var(--sp-text);
    letter-spacing: -0.005em;
  }
  .xapps-subject-profile__section-meta {
    color: var(--sp-text-muted);
    font: 400 0.78rem/1.45 system-ui, sans-serif;
  }
  .xapps-subject-profile__toolbar,
  .xapps-subject-profile__toolbar-actions,
  .xapps-subject-profile__candidate-actions,
  .xapps-subject-profile__form-actions,
  .xapps-subject-profile__footer {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .xapps-subject-profile__toolbar {
    justify-content: space-between;
  }
  .xapps-subject-profile__toolbar-copy {
    display: grid;
    gap: 4px;
  }
  .xapps-subject-profile__candidate-list {
    display: grid;
    gap: 8px;
    max-height: 420px;
    overflow-y: auto;
    padding-right: 2px;
    scrollbar-width: thin;
    scrollbar-color: rgba(148,163,184,0.3) transparent;
  }
  .xapps-subject-profile__candidate-list::-webkit-scrollbar {
    width: 5px;
  }
  .xapps-subject-profile__candidate-list::-webkit-scrollbar-track {
    background: transparent;
  }
  .xapps-subject-profile__candidate-list::-webkit-scrollbar-thumb {
    background: rgba(148,163,184,0.3);
    border-radius: 999px;
  }
  .xapps-subject-profile__candidate {
    border: 1px solid var(--sp-border);
    border-radius: 12px;
    background: var(--sp-surface);
    padding: 14px 16px;
    display: grid;
    gap: 10px;
    position: relative;
    transition: border-color 200ms var(--sp-ease), box-shadow 200ms var(--sp-ease);
    cursor: default;
  }
  .xapps-subject-profile__candidate:hover {
    border-color: rgba(148, 163, 184, 0.4);
    box-shadow: var(--sp-shadow-sm);
  }
  .xapps-subject-profile__candidate.is-selected {
    border-color: rgba(37, 99, 235, 0.35);
    background: linear-gradient(180deg, rgba(239,246,255,0.5) 0%, var(--sp-surface) 100%);
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.08), var(--sp-shadow);
  }
  .xapps-subject-profile__candidate.is-selected::before {
    content: "";
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 999px;
    background: linear-gradient(180deg, var(--sp-primary) 0%, #0ea5e9 100%);
  }
  .xapps-subject-profile__candidate-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .xapps-subject-profile__candidate-title {
    font: 600 0.88rem/1.3 system-ui, sans-serif;
    color: var(--sp-text);
  }
  .xapps-subject-profile__candidate-meta,
  .xapps-subject-profile__candidate-origin,
  .xapps-subject-profile__empty {
    color: var(--sp-text-muted);
    font: 400 0.78rem/1.45 system-ui, sans-serif;
  }
  .xapps-subject-profile__empty {
    text-align: center;
    padding: 24px 16px;
  }
  .xapps-subject-profile__candidate-badges,
  .xapps-subject-profile__candidate-details,
  .xapps-subject-profile__chips {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }
  .xapps-subject-profile__candidate-main {
    display: grid;
    gap: 6px;
  }
  .xapps-subject-profile__chip {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    border-radius: 999px;
    border: 1px solid var(--sp-primary-border);
    background: var(--sp-primary-bg);
    color: var(--sp-primary);
    padding: 0 8px;
    font: 600 0.68rem/1 system-ui, sans-serif;
    white-space: nowrap;
  }
  .xapps-subject-profile__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 22px;
    border-radius: 999px;
    padding: 0 8px;
    font: 600 0.67rem/1 system-ui, sans-serif;
    letter-spacing: 0.02em;
    white-space: nowrap;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(248, 250, 252, 0.9);
    color: var(--sp-text-3);
  }
  .xapps-subject-profile__badge[data-badge="ready"] {
    border-color: var(--sp-success-border);
    background: var(--sp-success-bg);
    color: var(--sp-success);
  }
  .xapps-subject-profile__badge[data-badge="current"] {
    border-color: var(--sp-primary-border);
    background: var(--sp-primary-bg);
    color: var(--sp-primary);
  }
  .xapps-subject-profile__badge[data-badge="default"] {
    border-color: var(--sp-amber-border);
    background: var(--sp-amber-bg);
    color: var(--sp-amber);
  }
  .xapps-subject-profile__badge[data-badge="editing"] {
    border-color: var(--sp-purple-border);
    background: var(--sp-purple-bg);
    color: var(--sp-purple);
  }
  .xapps-subject-profile__detail {
    border-radius: 999px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    background: var(--sp-bg);
    color: var(--sp-text-2);
    padding: 3px 9px;
    font: 500 0.72rem/1.3 system-ui, sans-serif;
  }
  .xapps-subject-profile__button {
    appearance: none;
    border: 1px solid var(--sp-border);
    background: var(--sp-surface);
    color: var(--sp-text);
    border-radius: 8px;
    padding: 8px 14px;
    font: 600 0.78rem/1.2 system-ui, sans-serif;
    cursor: pointer;
    transition: all 180ms var(--sp-ease);
    user-select: none;
    white-space: nowrap;
  }
  .xapps-subject-profile__button:hover {
    border-color: var(--sp-primary-border);
    color: var(--sp-primary);
    box-shadow: var(--sp-shadow-sm);
  }
  .xapps-subject-profile__button:active {
    transform: scale(0.97);
  }
  .xapps-subject-profile__button:focus-visible {
    outline: none;
    box-shadow: var(--sp-focus-ring);
  }
  .xapps-subject-profile__button[data-kind="primary"] {
    border-color: var(--sp-primary);
    background: var(--sp-primary);
    color: #fff;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25);
  }
  .xapps-subject-profile__button[data-kind="primary"]:hover {
    background: var(--sp-primary-hover);
    border-color: var(--sp-primary-hover);
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
    color: #fff;
  }
  .xapps-subject-profile__button[data-kind="primary"]:focus-visible {
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25), var(--sp-focus-ring);
  }
  .xapps-subject-profile__button[data-kind="subtle"] {
    border-color: rgba(226, 232, 240, 0.9);
    background: var(--sp-bg);
    color: var(--sp-text-3);
    box-shadow: none;
  }
  .xapps-subject-profile__button[data-kind="subtle"]:hover {
    background: rgba(241, 245, 249, 0.95);
    border-color: rgba(203, 213, 225, 0.95);
    color: var(--sp-text);
  }
  .xapps-subject-profile__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
  .xapps-subject-profile__form {
    display: grid;
    gap: 14px;
  }
  .xapps-subject-profile__form-shell {
    display: grid;
    gap: 14px;
  }
  .xapps-subject-profile__field {
    display: grid;
    gap: 6px;
  }
  .xapps-subject-profile__field label {
    font: 600 0.78rem/1.2 system-ui, sans-serif;
    color: var(--sp-text-2);
  }
  .xapps-subject-profile__field input[type="text"],
  .xapps-subject-profile__field input[type="email"],
  .xapps-subject-profile__field select,
  .xapps-subject-profile__field textarea {
    width: 100%;
    border: 1px solid rgba(203, 213, 225, 0.7);
    border-radius: 8px;
    background: var(--sp-surface);
    padding: 9px 12px;
    color: var(--sp-text);
    font: 400 0.82rem/1.4 system-ui, sans-serif;
    transition: border-color 180ms var(--sp-ease), box-shadow 180ms var(--sp-ease);
    outline: none;
    box-sizing: border-box;
  }
  .xapps-subject-profile__field input[type="text"]:focus,
  .xapps-subject-profile__field input[type="email"]:focus,
  .xapps-subject-profile__field select:focus,
  .xapps-subject-profile__field textarea:focus {
    border-color: var(--sp-primary);
    box-shadow: var(--sp-focus-ring);
  }
  .xapps-subject-profile__field input[type="text"]::placeholder,
  .xapps-subject-profile__field input[type="email"]::placeholder,
  .xapps-subject-profile__field textarea::placeholder {
    color: rgba(148, 163, 184, 0.7);
  }
  .xapps-subject-profile__field input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    width: 36px;
    height: 20px;
    border-radius: 999px;
    background: rgba(203, 213, 225, 0.6);
    border: none;
    cursor: pointer;
    position: relative;
    transition: background 180ms var(--sp-ease);
    flex-shrink: 0;
  }
  .xapps-subject-profile__field input[type="checkbox"]::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    transition: transform 180ms var(--sp-ease);
  }
  .xapps-subject-profile__field input[type="checkbox"]:checked {
    background: var(--sp-primary);
  }
  .xapps-subject-profile__field input[type="checkbox"]:checked::after {
    transform: translateX(16px);
  }
  .xapps-subject-profile__field input[type="checkbox"]:focus-visible {
    box-shadow: var(--sp-focus-ring);
  }
  .xapps-subject-profile__field-help {
    color: var(--sp-text-muted);
    font: 400 0.73rem/1.4 system-ui, sans-serif;
  }
  .xapps-subject-profile__sources-disclosure {
    border: 1px solid rgba(226, 232, 240, 0.8);
    border-radius: 12px;
    background: rgba(248, 250, 252, 0.72);
  }
  .xapps-subject-profile__sources-disclosure summary {
    list-style: none;
    cursor: pointer;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .xapps-subject-profile__sources-disclosure summary::-webkit-details-marker {
    display: none;
  }
  .xapps-subject-profile__sources-disclosure summary::after {
    content: "+";
    color: var(--sp-text-muted);
    font: 600 0.95rem/1 system-ui, sans-serif;
  }
  .xapps-subject-profile__sources-disclosure[open] summary::after {
    content: "−";
  }
  .xapps-subject-profile__sources-disclosure-body {
    padding: 0 12px 12px;
  }
  .xapps-subject-profile__refresh-panel {
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--sp-bg);
    border: 1px solid rgba(226, 232, 240, 0.8);
  }
  .xapps-subject-profile__secondary-sources {
    display: none;
    gap: 8px;
    flex-wrap: wrap;
  }
  .xapps-subject-profile__secondary-sources.is-open {
    display: flex;
  }
  .xapps-subject-profile__form-actions--sticky {
    position: sticky;
    bottom: 0;
    z-index: 1;
    margin-top: 4px;
    padding-top: 12px;
    background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.94) 28%, rgba(255,255,255,1) 100%);
  }
  .xapps-subject-profile.is-form-open .xapps-subject-profile__summary {
    gap: 8px;
  }
  .xapps-subject-profile.is-form-open .xapps-subject-profile__toolbar {
    align-items: flex-start;
  }
  .xapps-subject-profile.is-form-open .xapps-subject-profile__candidate-list {
    gap: 6px;
    max-height: 320px;
  }
  .xapps-subject-profile.is-form-open .xapps-subject-profile__candidate {
    padding: 10px 14px;
  }
  .xapps-subject-profile.is-form-open .xapps-subject-profile__candidate-main {
    gap: 5px;
  }
  .xapps-subject-profile.is-form-open .xapps-subject-profile__candidate-actions {
    gap: 6px;
  }
  .xapps-subject-profile.is-form-open .xapps-subject-profile__refresh-panel {
    gap: 6px;
    padding: 10px 12px;
  }
  @media (max-width: 960px) {
    .xapps-subject-profile__summary {
      grid-template-columns: 1fr;
    }
    .xapps-subject-profile__layout {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 480px) {
    .xapps-subject-profile__card {
      padding: 14px;
      border-radius: 14px;
    }
    .xapps-subject-profile__candidate {
      padding: 12px;
    }
    .xapps-subject-profile__form-actions {
      flex-direction: column;
    }
    .xapps-subject-profile__form-actions .xapps-subject-profile__button {
      width: 100%;
      justify-content: center;
      text-align: center;
    }
  }
`;

export function createSubjectProfileOverlay(options?: {
  locale?: string;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
}): {
  root: HTMLElement;
  overlay: HTMLElement;
  destroy: () => void;
} {
  const locale = readString(options?.locale);
  const isRo = readLower(locale).startsWith("ro");
  const titleText =
    readString(options?.title) || (isRo ? "Profil de facturare" : "Billing profile");
  const subtitleText =
    readString(options?.subtitle) ||
    (isRo
      ? "Alege un profil existent sau completează detaliile necesare pentru facturare."
      : "Choose an existing billing profile or complete the required invoicing details.");
  const onClose = typeof options?.onClose === "function" ? options.onClose : null;

  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(15,23,42,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    overflow: "auto",
    zIndex: "2147483000",
    backdropFilter: "blur(6px)",
  });
  (overlay.style as any).webkitBackdropFilter = "blur(6px)";

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    width: "min(1080px, 96vw)",
    maxWidth: "1080px",
    maxHeight: "min(88vh, 740px)",
    background: "#ffffff",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: "18px",
    boxShadow: "0 2px 6px rgba(15,23,42,0.03), 0 24px 60px rgba(15,23,42,0.2)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "16px 18px",
    borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
    flexShrink: "0",
  });

  const titleWrap = document.createElement("div");
  const titleEl = document.createElement("div");
  titleEl.textContent = titleText;
  Object.assign(titleEl.style, {
    font: '700 1.05rem/1.25 "IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
    color: "#0f172a",
    letterSpacing: "-0.01em",
  });
  const subtitleEl = document.createElement("div");
  subtitleEl.textContent = subtitleText;
  Object.assign(subtitleEl.style, {
    marginTop: "4px",
    font: "400 0.82rem/1.5 system-ui,sans-serif",
    color: "#64748b",
  });
  titleWrap.appendChild(titleEl);
  titleWrap.appendChild(subtitleEl);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "\u00d7";
  closeBtn.setAttribute("aria-label", isRo ? "Închide" : "Close");
  Object.assign(closeBtn.style, {
    padding: "4px 10px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    cursor: "pointer",
    font: "400 1.4rem/1 system-ui,sans-serif",
    color: "#64748b",
    transition: "background 180ms ease, color 180ms ease",
    flexShrink: "0",
  });
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.background = "#f1f5f9";
    closeBtn.style.color = "#0f172a";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "#64748b";
  });

  const body = document.createElement("div");
  Object.assign(body.style, {
    padding: "18px",
    flex: "1 1 auto",
    minHeight: "0",
    overflow: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: "rgba(148,163,184,0.3) transparent",
  });

  const root = document.createElement("div");
  body.appendChild(root);

  closeBtn.addEventListener("click", () => onClose?.());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) onClose?.();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") onClose?.();
  };
  document.addEventListener("keydown", onKeyDown);

  header.appendChild(titleWrap);
  header.appendChild(closeBtn);
  panel.appendChild(header);
  panel.appendChild(body);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  return {
    root,
    overlay,
    destroy() {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    },
  };
}

export function renderSubjectProfileGuardSurface(
  root: Element,
  input: unknown,
  options: {
    locale?: unknown;
    title?: unknown;
    subtitle?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
    interactive?: boolean;
    onResolve?: ((payload: Record<string, unknown>) => void) | null;
    onCancel?: (() => void) | null;
    onRefreshSource?:
      | ((input: {
          providerKey: string;
          source: string;
          toolName: string;
          payload: Record<string, unknown>;
        }) => Promise<unknown> | unknown)
      | null;
  } = {},
): { destroy: () => void } {
  let currentDescriptor = readGuardDescriptor(input);
  let currentRemediation = readRemediation(currentDescriptor);
  let selectedCandidateId = "";
  let activeFamily =
    readString(readFormDescriptor(currentDescriptor).family) ||
    readAvailableFamilies(currentDescriptor)[0] ||
    "";
  let currentError = readString(options.error);
  let currentNotice = readString(options.notice);
  let formMode: "hidden" | "create_new" | "update_existing" = "hidden";
  let formCandidate: Record<string, unknown> | null = null;
  let formProfile: Record<string, unknown> = {};

  const locale = options.locale;
  const interactive = options.interactive !== false;
  const onResolve = typeof options.onResolve === "function" ? options.onResolve : null;
  const onCancel = typeof options.onCancel === "function" ? options.onCancel : null;
  const onRefreshSource =
    typeof options.onRefreshSource === "function" ? options.onRefreshSource : null;

  function t(
    key: keyof (typeof i18nCatalog)["en"],
    fallback?: string,
    params?: Record<string, string | number | boolean | null | undefined>,
  ) {
    const base = translate(locale, key, fallback);
    return params ? replaceTemplate(base, params) : base;
  }

  function currentCandidates() {
    const family = readLower(activeFamily);
    return listCandidates(currentDescriptor).filter((candidate) => {
      if (!family || family === "all") return true;
      return readLower(candidate.profile_family) === family;
    });
  }

  function openCreateForm() {
    formMode = "create_new";
    formCandidate = null;
    formProfile = { ...(readRecord(readFormDescriptor(currentDescriptor).initial_data) || {}) };
    render();
  }

  function openEditForm(candidate: Record<string, unknown>) {
    selectedCandidateId = readString(candidate.candidate_id);
    formCandidate = candidate;
    formProfile = { ...(candidateEditableProfile(candidate) || {}) };
    formMode =
      readString(candidate.source) === "subject_self_profile" ? "update_existing" : "create_new";
    if (!activeFamily) {
      activeFamily = readString(formProfile.profile_family) || readString(candidate.profile_family);
    }
    render();
  }

  function buildFormTitle(): string {
    if (formMode === "update_existing") return t("edit_billing_profile", "Edit billing profile");
    if (formCandidate && readString(formCandidate.source) === "platform_fallback_identity") {
      return t("create_from_current_identity", "Create from current identity");
    }
    if (formCandidate) return t("create_private_copy", "Create private copy");
    return t("new_billing_profile", "New billing profile");
  }

  function readActiveForm(): Record<string, unknown> {
    const family =
      readString(activeFamily) || readString(readFormDescriptor(currentDescriptor).family);
    return readFamilyForm(currentDescriptor, family);
  }

  async function refreshSource(entry: Record<string, unknown>) {
    if (!onRefreshSource) return;
    const action = readRecord(readRecord(entry.action));
    const toolName = readString(action?.tool_name);
    if (!toolName) return;
    currentError = "";
    currentNotice = "";
    render();
    const result = await onRefreshSource({
      providerKey: readString(entry.provider_key),
      source: readString(entry.source),
      toolName,
      payload: readRecord(action?.payload) || {},
    });
    const nextDescriptor = readGuardDescriptor(result);
    if (readString(nextDescriptor.contract_version) === "subject_profile_guard_ui_v1") {
      currentDescriptor = nextDescriptor;
      currentRemediation = readRemediation(nextDescriptor);
      currentNotice = "";
      currentError = "";
      render();
      return;
    }
    const resultRecord = readRecord(result);
    const refreshedCandidates = Array.isArray(resultRecord?.candidates)
      ? resultRecord.candidates
          .map((item) => readRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item))
      : [];
    if (refreshedCandidates.length > 0) {
      currentDescriptor = mergeRefreshedCandidates(currentDescriptor, {
        source: readString(resultRecord?.source) || readString(entry.source),
        candidates: refreshedCandidates,
      });
      currentRemediation = readRemediation(currentDescriptor);
      render();
      return;
    }
    currentError = "Refresh failed.";
    render();
  }

  function submitForm(formEl: HTMLFormElement) {
    const activeForm = readActiveForm();
    const schema = readRecord(activeForm.schema) || {};
    const properties = readRecord(schema.properties) || {};
    const required = Array.isArray(schema.required)
      ? schema.required.map((item) => readString(item)).filter(Boolean)
      : Object.keys(properties);
    const nextProfile: Record<string, unknown> = {
      profile_family:
        readString(
          (formEl.querySelector('[name="profile_family"]') as HTMLInputElement | null)?.value,
        ) || readString(activeForm.family),
    };
    for (const field of required) {
      if (!field || field === "profile_family") continue;
      const inputEl = formEl.querySelector(`[name="${field.replace(/"/g, '\\"')}"]`) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null;
      const value = readString(inputEl?.value);
      if (!value) {
        currentError = t("please_complete_field", "Please complete {field}.", { field });
        render();
        return;
      }
      nextProfile[field] = value;
    }
    const profileLabel = readString(
      (formEl.querySelector('[name="profile_label"]') as HTMLInputElement | null)?.value,
    );
    const setAsDefault = Boolean(
      (formEl.querySelector('[name="set_as_default"]') as HTMLInputElement | null)?.checked,
    );
    const privateProfile: Record<string, unknown> = {
      mode: formMode === "update_existing" ? "update_existing" : "create_new",
      set_as_default: setAsDefault,
    };
    if (profileLabel) privateProfile.label = profileLabel;
    if (formMode === "update_existing" && formCandidate && readString(formCandidate.candidate_id)) {
      nextProfile.selection = {
        source: "subject_self_profile",
        candidate_id: readString(formCandidate.candidate_id),
      };
      nextProfile.selected_profile_source = "subject_self_profile";
      nextProfile.selected_profile_id = readString(formCandidate.candidate_id);
    }
    nextProfile.private_profile = privateProfile;
    onResolve?.({
      customerProfile: nextProfile,
    });
  }

  function render() {
    const candidates = currentCandidates();
    const allCandidates = listCandidates(currentDescriptor);
    const refreshSources = listRefreshSources(currentDescriptor);
    const showHeader = options.showHeader !== false;
    const currentCandidate =
      allCandidates.find((candidate) => candidate.selected === true) ||
      allCandidates.find((candidate) => candidate.is_default === true) ||
      null;
    const readyCount = allCandidates.filter((candidate) => shouldUseCandidate(candidate)).length;
    const activeForm = readActiveForm();
    const showForm = formMode !== "hidden" || allCandidates.length === 0;
    const showCollapsedSources = refreshSources.length > 0 && allCandidates.length > 0;
    const activeSchema = readRecord(activeForm.schema) || {};
    const properties = readRecord(activeSchema.properties) || {};
    const orderedFields = Array.isArray((readRecord(activeForm.ui_schema) || {}).elements)
      ? (((readRecord(activeForm.ui_schema) || {}).elements as unknown[]) || [])
          .map((entry) => {
            const scope = readString(readRecord(entry)?.scope);
            return scope.startsWith("#/properties/") ? scope.slice("#/properties/".length) : "";
          })
          .filter(Boolean)
      : [];
    const formFields = Array.from(
      new Set(
        [...orderedFields, ...Object.keys(properties)].filter(
          (field) => field !== "profile_family",
        ),
      ),
    );
    root.innerHTML = `
      ${options.includeStyles !== false ? `<style>${subjectProfileGuardSurfaceStyles}</style>` : ""}
      <section class="xapps-subject-profile ${showForm ? "is-form-open" : "is-choice-mode"}">
        ${
          showHeader
            ? `<div class="xapps-subject-profile__header">
                <h3 class="xapps-subject-profile__title">${escapeHtml(
                  readString(options.title) ||
                    readLocalizedText(currentRemediation.title, locale) ||
                    t("title", "Billing profile"),
                )}</h3>
                <div class="xapps-subject-profile__subtitle">${escapeHtml(
                  readString(options.subtitle) ||
                    readLocalizedText(currentRemediation.description, locale) ||
                    t(
                      "subtitle",
                      "Choose an existing profile or complete the required invoicing details.",
                    ),
                )}</div>
              </div>`
            : ""
        }
        <div class="xapps-subject-profile__summary">
          <section class="xapps-subject-profile__summary-card">
            <div class="xapps-subject-profile__summary-label">${escapeHtml(
              t("available_profiles", "Available profiles"),
            )}</div>
            <div class="xapps-subject-profile__summary-title">${escapeHtml(
              t("profiles_summary", "{count} saved · {ready} ready to use", {
                count: allCandidates.length,
                ready: readyCount,
              }),
            )}</div>
            <div class="xapps-subject-profile__chips">
              ${
                activeFamily
                  ? `<span class="xapps-subject-profile__chip">${escapeHtml(
                      familyLabel(activeFamily, locale),
                    )}</span>`
                  : ""
              }
              ${
                refreshSources.length
                  ? `<span class="xapps-subject-profile__chip">${escapeHtml(
                      `${refreshSources.length} ${t("profile_sources", "Profile sources").toLowerCase()}`,
                    )}</span>`
                  : ""
              }
            </div>
          </section>
          <section class="xapps-subject-profile__summary-card">
            <div class="xapps-subject-profile__summary-label">${escapeHtml(
              t("current_profile", "Current profile"),
            )}</div>
            <div class="xapps-subject-profile__summary-title">${escapeHtml(
              currentCandidate
                ? candidateLabel(currentCandidate, locale)
                : t("current_profile_missing", "No current billing profile selected yet"),
            )}</div>
            <div class="xapps-subject-profile__summary-meta">${escapeHtml(
              currentCandidate
                ? t("current_profile_ready", "Ready to continue")
                : t("current_profile_review", "Review saved profiles or create a new one below."),
            )}</div>
          </section>
        </div>
        ${currentNotice ? `<div class="xapps-subject-profile__notice">${escapeHtml(currentNotice)}</div>` : ""}
        ${currentError ? `<div class="xapps-subject-profile__error">${escapeHtml(currentError)}</div>` : ""}
        <div class="xapps-subject-profile__layout">
          <section class="xapps-subject-profile__card">
            <div class="xapps-subject-profile__toolbar">
              <div class="xapps-subject-profile__toolbar-copy">
                <h4 class="xapps-subject-profile__section-title">${escapeHtml(
                  t("available_profiles", "Available profiles"),
                )}</h4>
                <div class="xapps-subject-profile__section-meta">${escapeHtml(
                  t("profiles_summary", "{count} saved · {ready} ready to use", {
                    count: allCandidates.length,
                    ready: readyCount,
                  }),
                )}</div>
              </div>
              <div class="xapps-subject-profile__toolbar-actions">
                ${
                  interactive && !showForm
                    ? `<button type="button" class="xapps-subject-profile__button" data-action="new-profile" data-kind="subtle">${escapeHtml(
                        t("new_profile", "New profile"),
                      )}</button>`
                    : ""
                }
              </div>
            </div>
            ${
              refreshSources.length
                ? showCollapsedSources
                  ? `<details class="xapps-subject-profile__sources-disclosure">
                      <summary>
                        <span class="xapps-subject-profile__section-title">${escapeHtml(
                          t("profile_sources", "Profile sources"),
                        )}</span>
                      </summary>
                      <div class="xapps-subject-profile__sources-disclosure-body">
                        <div class="xapps-subject-profile__refresh-panel">
                          <div class="xapps-subject-profile__toolbar-actions" data-role="refresh-primary"></div>
                          ${
                            refreshSources.length > 1
                              ? `<div class="xapps-subject-profile__toolbar-actions">
                                  <button type="button" class="xapps-subject-profile__button" data-action="toggle-more-sources" data-kind="subtle">${escapeHtml(
                                    t("more_sources", "More sources"),
                                  )}</button>
                                  <div class="xapps-subject-profile__secondary-sources" data-role="refresh-secondary"></div>
                                </div>`
                              : ""
                          }
                        </div>
                      </div>
                    </details>`
                  : `<div class="xapps-subject-profile__refresh-panel">
                      <div class="xapps-subject-profile__toolbar">
                        <div>
                          <div class="xapps-subject-profile__section-title">${escapeHtml(
                            t("profile_sources", "Profile sources"),
                          )}</div>
                        </div>
                        <div class="xapps-subject-profile__toolbar-actions" data-role="refresh-primary"></div>
                      </div>
                      ${
                        refreshSources.length > 1
                          ? `<div class="xapps-subject-profile__toolbar-actions">
                              <button type="button" class="xapps-subject-profile__button" data-action="toggle-more-sources" data-kind="subtle">${escapeHtml(
                                t("more_sources", "More sources"),
                              )}</button>
                              <div class="xapps-subject-profile__secondary-sources" data-role="refresh-secondary"></div>
                            </div>`
                          : ""
                      }
                    </div>`
                : ""
            }
            <div class="xapps-subject-profile__candidate-list">
              ${
                candidates.length
                  ? candidates
                      .map((candidate) => {
                        const candidateId = readString(candidate.candidate_id);
                        const detailSummary = summarizeDetailRows(candidate);
                        const badges = (
                          [
                            readString(candidate.profile_family)
                              ? {
                                  text: familyLabel(readString(candidate.profile_family), locale),
                                  type: "family",
                                }
                              : null,
                            shouldUseCandidate(candidate)
                              ? { text: t("ready", "ready"), type: "ready" }
                              : null,
                            candidate.is_default
                              ? { text: t("default", "default"), type: "default" }
                              : null,
                            candidate.selected
                              ? { text: t("current", "Current"), type: "current" }
                              : null,
                            formCandidate &&
                            readString(formCandidate.candidate_id) &&
                            readString(formCandidate.candidate_id) === candidateId
                              ? { text: t("editing", "editing"), type: "editing" }
                              : null,
                          ] as Array<{ text: string; type: string } | null>
                        ).filter(
                          (b): b is { text: string; type: string } => b !== null && Boolean(b.text),
                        );
                        return `<article class="xapps-subject-profile__candidate ${
                          candidateId && candidateId === selectedCandidateId ? "is-selected" : ""
                        }" data-candidate-id="${escapeHtml(candidateId)}">
                          <div class="xapps-subject-profile__candidate-main">
                          <div class="xapps-subject-profile__candidate-head">
                            <div>
                              <div class="xapps-subject-profile__candidate-title">${escapeHtml(
                                candidateLabel(candidate, locale),
                              )}</div>
                              <div class="xapps-subject-profile__candidate-meta">${escapeHtml(
                                readProfileSummary(candidate),
                              )}</div>
                            </div>
                            ${
                              badges.length
                                ? `<div class="xapps-subject-profile__candidate-badges">${badges
                                    .map(
                                      (badge) =>
                                        `<span class="xapps-subject-profile__badge" data-badge="${escapeHtml(badge.type)}">${escapeHtml(badge.text)}</span>`,
                                    )
                                    .join("")}</div>`
                                : ""
                            }
                          </div>
                          ${
                            detailSummary.visible.length
                              ? `<div class="xapps-subject-profile__candidate-details">${detailSummary.visible
                                  .map(
                                    (row) =>
                                      `<span class="xapps-subject-profile__detail">${escapeHtml(row)}</span>`,
                                  )
                                  .join("")}${
                                  detailSummary.hiddenCount
                                    ? `<span class="xapps-subject-profile__detail">${escapeHtml(
                                        t("more_details_count", "+{count} more", {
                                          count: detailSummary.hiddenCount,
                                        }),
                                      )}</span>`
                                    : ""
                                }</div>`
                              : ""
                          }
                          ${
                            buildOriginText(candidate)
                              ? `<div class="xapps-subject-profile__candidate-origin">${escapeHtml(
                                  buildOriginText(candidate),
                                )}</div>`
                              : ""
                          }
                          ${
                            interactive
                              ? `<div class="xapps-subject-profile__candidate-actions">
                                  ${
                                    shouldUseCandidate(candidate)
                                      ? `<button type="button" class="xapps-subject-profile__button" data-action="use-candidate" data-candidate-id="${escapeHtml(
                                          candidateId,
                                        )}" data-kind="primary">${escapeHtml(
                                          t("use_profile", "Use this profile"),
                                        )}</button>`
                                      : ""
                                  }
                                  ${
                                    shouldEditCandidate(candidate)
                                      ? `<button type="button" class="xapps-subject-profile__button" data-action="edit-candidate" data-candidate-id="${escapeHtml(
                                          candidateId,
                                        )}" data-kind="subtle">${escapeHtml(
                                          readString(candidate.source) === "subject_self_profile"
                                            ? t("edit", "Edit")
                                            : t("edit_copy", "Edit copy"),
                                        )}</button>`
                                      : ""
                                  }
                                </div>`
                              : ""
                          }
                          </div>
                        </article>`;
                      })
                      .join("")
                  : `<div class="xapps-subject-profile__empty">${escapeHtml(
                      t(
                        "no_profiles",
                        "No reusable subject profiles yet. Load a source or create a new profile.",
                      ),
                    )}</div>`
              }
            </div>
          </section>
          <section class="xapps-subject-profile__card">
            ${
              showForm
                ? `<div class="xapps-subject-profile__form-shell">
                    <div>
                    <h4 class="xapps-subject-profile__section-title">${escapeHtml(buildFormTitle())}</h4>
                    <div class="xapps-subject-profile__section-meta">${escapeHtml(
                      readLocalizedText(activeForm.description, locale) ||
                        t(
                          "complete_required_profile_help",
                          "This flow needs a complete billing profile before it can continue.",
                        ),
                    )}</div>
                  </div>
                  <form class="xapps-subject-profile__form" data-role="form">
              ${
                readAvailableFamilies(currentDescriptor).length > 1
                  ? `<div class="xapps-subject-profile__field">
                      <label for="xapps-subject-profile-family">${escapeHtml(
                        t("profile_type", "Profile type"),
                      )}</label>
                      <select id="xapps-subject-profile-family" name="profile_family">
                        ${readAvailableFamilies(currentDescriptor)
                          .map(
                            (family) =>
                              `<option value="${escapeHtml(family)}" ${
                                readString(activeFamily) === family ? "selected" : ""
                              }>${escapeHtml(familyLabel(family, locale))}</option>`,
                          )
                          .join("")}
                      </select>
                      <div class="xapps-subject-profile__field-help">${escapeHtml(
                        t(
                          "profile_type_help",
                          "Choose whether this billing profile is for an individual or a business.",
                        ),
                      )}</div>
                    </div>`
                  : `<input type="hidden" name="profile_family" value="${escapeHtml(
                      readString(activeFamily) || readString(activeForm.family),
                    )}" />`
              }
              ${formFields
                .map((field) => {
                  const fieldSchema = readRecord(properties[field]) || {};
                  const value =
                    readString(formProfile[field]) ||
                    readString((readRecord(activeForm.initial_data) || {})[field]);
                  const isSelect = Array.isArray(fieldSchema.enum);
                  const inputId = `xapps-subject-profile-${field}`;
                  return `<div class="xapps-subject-profile__field">
                    <label for="${escapeHtml(inputId)}">${escapeHtml(
                      readString(fieldSchema.title) || field,
                    )}</label>
                    ${
                      isSelect
                        ? `<select id="${escapeHtml(inputId)}" name="${escapeHtml(field)}">
                            <option value="">${escapeHtml(t("select", "Select"))}</option>
                            ${((fieldSchema.enum as unknown[]) || [])
                              .map((entry) => {
                                const optionValue = readString(entry);
                                return `<option value="${escapeHtml(optionValue)}" ${
                                  value === optionValue ? "selected" : ""
                                }>${escapeHtml(optionValue)}</option>`;
                              })
                              .join("")}
                          </select>`
                        : readString(fieldSchema.format) === "textarea" ||
                            readString(fieldSchema.type) === "textarea"
                          ? `<textarea id="${escapeHtml(inputId)}" name="${escapeHtml(field)}" rows="3">${escapeHtml(
                              value,
                            )}</textarea>`
                          : `<input id="${escapeHtml(inputId)}" name="${escapeHtml(
                              field,
                            )}" type="${readString(fieldSchema.format) === "email" ? "email" : "text"}" value="${escapeHtml(
                              value,
                            )}" />`
                    }
                    ${
                      readString(fieldSchema.description)
                        ? `<div class="xapps-subject-profile__field-help">${escapeHtml(
                            readString(fieldSchema.description),
                          )}</div>`
                        : ""
                    }
                  </div>`;
                })
                .join("")}
              <div class="xapps-subject-profile__field">
                <label for="xapps-subject-profile-label">${escapeHtml(
                  t("profile_label", "Profile label"),
                )}</label>
                <input
                  id="xapps-subject-profile-label"
                  name="profile_label"
                  type="text"
                  value="${escapeHtml(readString(formCandidate?.label))}"
                />
                <div class="xapps-subject-profile__field-help">${escapeHtml(
                  t(
                    "profile_label_help",
                    "Optional label shown when the user chooses between saved profiles.",
                  ),
                )}</div>
              </div>
              <div class="xapps-subject-profile__field">
                <label for="xapps-subject-profile-default">${escapeHtml(
                  t("set_as_default", "Set as default"),
                )}</label>
                <input
                  id="xapps-subject-profile-default"
                  name="set_as_default"
                  type="checkbox"
                  ${formCandidate?.is_default ? "checked" : ""}
                />
                <div class="xapps-subject-profile__field-help">${escapeHtml(
                  t(
                    "default_profile_help",
                    "Default profile stays available for later sessions and invoicing.",
                  ),
                )}</div>
              </div>
              ${
                interactive
                  ? `<div class="xapps-subject-profile__form-actions xapps-subject-profile__form-actions--sticky">
                      <button type="submit" class="xapps-subject-profile__button" data-kind="primary">${escapeHtml(
                        formMode === "update_existing"
                          ? t("save_and_continue", "Save and continue")
                          : t("create_and_continue", "Create and continue"),
                      )}</button>
                      <button type="button" class="xapps-subject-profile__button" data-action="reset-form" data-kind="subtle">${escapeHtml(
                        t("back_to_list", "Back to list"),
                      )}</button>
                    </div>`
                  : ""
              }
                  </form>
                  </div>`
                : `<div class="xapps-subject-profile__focus-card">
                    <div class="xapps-subject-profile__focus-copy">
                      <h4 class="xapps-subject-profile__section-title">${escapeHtml(
                        currentCandidate
                          ? t("continue_with_current_profile", "Continue with the current profile")
                          : t("complete_required_profile", "Complete the required profile"),
                      )}</h4>
                      <div class="xapps-subject-profile__section-meta">${escapeHtml(
                        currentCandidate
                          ? t(
                              "continue_with_current_profile_help",
                              "You can continue immediately with the selected billing profile, edit it, or create another one.",
                            )
                          : t(
                              "create_profile_hint",
                              "Create a new billing profile only if the saved profiles are not the right fit.",
                            ),
                      )}</div>
                    </div>
                    ${
                      currentCandidate
                        ? `<div class="xapps-subject-profile__summary-card">
                            <div class="xapps-subject-profile__summary-label">${escapeHtml(
                              t("current_profile", "Current profile"),
                            )}</div>
                            <div class="xapps-subject-profile__summary-title">${escapeHtml(
                              candidateLabel(currentCandidate, locale),
                            )}</div>
                            <div class="xapps-subject-profile__summary-meta">${escapeHtml(
                              readProfileSummary(currentCandidate) ||
                                t("current_profile_ready", "Ready to continue"),
                            )}</div>
                          </div>`
                        : ""
                    }
                    <div class="xapps-subject-profile__form-actions">
                      ${
                        currentCandidate && shouldUseCandidate(currentCandidate)
                          ? `<button type="button" class="xapps-subject-profile__button" data-action="use-current-profile" data-kind="primary">${escapeHtml(
                              t("use_current_profile", "Use current profile"),
                            )}</button>`
                          : ""
                      }
                      ${
                        !currentCandidate ||
                        (!shouldUseCandidate(currentCandidate) &&
                          !shouldEditCandidate(currentCandidate))
                          ? `<button type="button" class="xapps-subject-profile__button" data-action="new-profile" data-kind="primary">${escapeHtml(
                              t("new_profile", "New profile"),
                            )}</button>`
                          : ""
                      }
                      ${
                        currentCandidate && shouldEditCandidate(currentCandidate)
                          ? `<button type="button" class="xapps-subject-profile__button" data-action="edit-current-profile" data-kind="subtle">${escapeHtml(
                              t("edit", "Edit"),
                            )}</button>`
                          : ""
                      }
                    </div>
                  </div>`
            }
          </section>
        </div>
        ${
          interactive && onCancel
            ? `<div class="xapps-subject-profile__footer">
                <button type="button" class="xapps-subject-profile__button" data-action="cancel" data-kind="subtle">${escapeHtml(
                  t("cancel", "Cancel"),
                )}</button>
              </div>`
            : ""
        }
      </section>
    `;

    const form = root.querySelector("form[data-role='form']") as HTMLFormElement | null;
    const familyInput = root.querySelector(
      "#xapps-subject-profile-family",
    ) as HTMLSelectElement | null;
    familyInput?.addEventListener("change", () => {
      activeFamily = readString(familyInput.value);
      render();
    });
    for (const button of Array.from(root.querySelectorAll("[data-action='new-profile']"))) {
      button.addEventListener("click", () => {
        openCreateForm();
      });
    }
    root.querySelector("[data-action='use-current-profile']")?.addEventListener("click", () => {
      if (!currentCandidate) return;
      const payload = buildUseCandidatePayload(currentCandidate);
      if (!payload) return;
      onResolve?.(payload);
    });
    root.querySelector("[data-action='edit-current-profile']")?.addEventListener("click", () => {
      if (!currentCandidate) return;
      openEditForm(currentCandidate);
    });
    root.querySelector("[data-action='reset-form']")?.addEventListener("click", () => {
      formMode = "hidden";
      formCandidate = null;
      formProfile = {};
      currentError = "";
      render();
    });
    root.querySelector("[data-action='cancel']")?.addEventListener("click", () => {
      onCancel?.();
    });
    for (const button of Array.from(root.querySelectorAll("[data-action='use-candidate']"))) {
      button.addEventListener("click", () => {
        const candidateId = readString((button as HTMLElement).dataset.candidateId);
        const candidate = listCandidates(currentDescriptor).find(
          (item) => readString(item.candidate_id) === candidateId,
        );
        if (!candidate) return;
        const payload = buildUseCandidatePayload(candidate);
        if (!payload) return;
        onResolve?.(payload);
      });
    }
    for (const button of Array.from(root.querySelectorAll("[data-action='edit-candidate']"))) {
      button.addEventListener("click", () => {
        const candidateId = readString((button as HTMLElement).dataset.candidateId);
        const candidate = listCandidates(currentDescriptor).find(
          (item) => readString(item.candidate_id) === candidateId,
        );
        if (!candidate) return;
        openEditForm(candidate);
      });
    }
    const secondaryToggle = root.querySelector(
      "[data-action='toggle-more-sources']",
    ) as HTMLButtonElement | null;
    const secondaryContainer = root.querySelector(
      "[data-role='refresh-secondary']",
    ) as HTMLElement | null;
    secondaryToggle?.addEventListener("click", () => {
      const nextOpen = !secondaryContainer?.classList.contains("is-open");
      secondaryContainer?.classList.toggle("is-open", Boolean(nextOpen));
      secondaryToggle.textContent = nextOpen
        ? t("hide_more_sources", "Hide additional sources")
        : t("more_sources", "More sources");
    });
    const primaryContainer = root.querySelector(
      "[data-role='refresh-primary']",
    ) as HTMLElement | null;
    if (primaryContainer) {
      const primary = refreshSources[0] || null;
      if (primary) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "xapps-subject-profile__button";
        button.dataset.kind = "subtle";
        button.textContent =
          readLocalizedText(primary.label, locale) || t("refreshing", "Refreshing...");
        button.addEventListener("click", async () => {
          if (!interactive) return;
          const original = button.textContent;
          button.disabled = true;
          button.textContent = t("refreshing", "Refreshing...");
          try {
            await refreshSource(primary);
          } finally {
            button.disabled = false;
            button.textContent = original || "";
          }
        });
        primaryContainer.appendChild(button);
      }
    }
    if (secondaryContainer) {
      for (const entry of refreshSources.slice(1)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "xapps-subject-profile__button";
        button.dataset.kind = "subtle";
        button.textContent =
          readLocalizedText(entry.label, locale) || readString(entry.provider_key);
        button.addEventListener("click", async () => {
          if (!interactive) return;
          const original = button.textContent;
          button.disabled = true;
          button.textContent = t("refreshing", "Refreshing...");
          try {
            await refreshSource(entry);
          } finally {
            button.disabled = false;
            button.textContent = original || "";
          }
        });
        secondaryContainer.appendChild(button);
      }
    }
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(form);
    });
  }

  render();
  return {
    destroy() {
      root.innerHTML = "";
    },
  };
}
