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
    display: grid;
    gap: 14px;
    color: #0f172a;
    font-family: "IBM Plex Sans", system-ui, sans-serif;
  }
  .xapps-subject-profile__header {
    display: grid;
    gap: 6px;
  }
  .xapps-subject-profile__title {
    margin: 0;
    font: 700 1rem/1.2 "IBM Plex Serif", Georgia, serif;
    color: #0f172a;
  }
  .xapps-subject-profile__subtitle {
    color: #64748b;
    font: 500 0.85rem/1.45 system-ui, sans-serif;
  }
  .xapps-subject-profile__notice,
  .xapps-subject-profile__error {
    border-radius: 14px;
    padding: 12px 14px;
    font: 500 0.82rem/1.45 system-ui, sans-serif;
  }
  .xapps-subject-profile__notice {
    background: #eef6ff;
    border: 1px solid #c7def8;
    color: #0f4c81;
  }
  .xapps-subject-profile__error {
    background: #fff3f2;
    border: 1px solid #f3c1bc;
    color: #b42318;
  }
  .xapps-subject-profile__layout {
    display: grid;
    gap: 14px;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  }
  .xapps-subject-profile__card {
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%);
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
    padding: 16px;
    display: grid;
    gap: 12px;
    min-width: 0;
  }
  .xapps-subject-profile__section-title {
    margin: 0;
    font: 700 0.94rem/1.2 system-ui, sans-serif;
    color: #0f172a;
  }
  .xapps-subject-profile__section-meta {
    color: #64748b;
    font: 500 0.8rem/1.4 system-ui, sans-serif;
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
  .xapps-subject-profile__candidate-list {
    display: grid;
    gap: 10px;
  }
  .xapps-subject-profile__candidate {
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 16px;
    background: #fff;
    padding: 12px 14px;
    display: grid;
    gap: 10px;
  }
  .xapps-subject-profile__candidate.is-selected {
    border-color: rgba(37, 99, 235, 0.42);
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.09);
  }
  .xapps-subject-profile__candidate-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .xapps-subject-profile__candidate-title {
    font: 700 0.9rem/1.25 system-ui, sans-serif;
    color: #0f172a;
  }
  .xapps-subject-profile__candidate-meta,
  .xapps-subject-profile__candidate-origin,
  .xapps-subject-profile__empty {
    color: #64748b;
    font: 500 0.78rem/1.4 system-ui, sans-serif;
  }
  .xapps-subject-profile__candidate-badges,
  .xapps-subject-profile__candidate-details,
  .xapps-subject-profile__chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .xapps-subject-profile__badge,
  .xapps-subject-profile__chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    border-radius: 999px;
    border: 1px solid rgba(37, 99, 235, 0.16);
    background: rgba(37, 99, 235, 0.08);
    color: #1d4ed8;
    padding: 0 9px;
    font: 700 0.7rem/1 system-ui, sans-serif;
    white-space: nowrap;
  }
  .xapps-subject-profile__detail {
    border-radius: 999px;
    border: 1px solid rgba(203, 213, 225, 0.95);
    background: #f8fafc;
    color: #334155;
    padding: 4px 9px;
    font: 600 0.72rem/1.2 system-ui, sans-serif;
  }
  .xapps-subject-profile__button {
    appearance: none;
    border: 1px solid rgba(148, 163, 184, 0.34);
    background: #fff;
    color: #0f172a;
    border-radius: 999px;
    padding: 8px 12px;
    font: 700 0.78rem/1.2 system-ui, sans-serif;
    cursor: pointer;
  }
  .xapps-subject-profile__button:hover {
    border-color: rgba(37, 99, 235, 0.34);
    color: #1d4ed8;
  }
  .xapps-subject-profile__button[data-kind="primary"] {
    border-color: #1d4ed8;
    background: #1d4ed8;
    color: #fff;
  }
  .xapps-subject-profile__button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .xapps-subject-profile__form {
    display: grid;
    gap: 12px;
  }
  .xapps-subject-profile__field {
    display: grid;
    gap: 6px;
  }
  .xapps-subject-profile__field label {
    font: 700 0.78rem/1.2 system-ui, sans-serif;
    color: #334155;
  }
  .xapps-subject-profile__field input,
  .xapps-subject-profile__field select,
  .xapps-subject-profile__field textarea {
    width: 100%;
    border: 1px solid rgba(148, 163, 184, 0.38);
    border-radius: 12px;
    background: #fff;
    padding: 10px 12px;
    color: #0f172a;
    font: 500 0.82rem/1.35 system-ui, sans-serif;
  }
  .xapps-subject-profile__field-help {
    color: #64748b;
    font: 500 0.74rem/1.35 system-ui, sans-serif;
  }
  .xapps-subject-profile__refresh-panel {
    display: grid;
    gap: 8px;
  }
  .xapps-subject-profile__secondary-sources {
    display: none;
    gap: 8px;
    flex-wrap: wrap;
  }
  .xapps-subject-profile__secondary-sources.is-open {
    display: flex;
  }
  @media (max-width: 960px) {
    .xapps-subject-profile__layout {
      grid-template-columns: 1fr;
    }
  }
`;

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
    const refreshSources = listRefreshSources(currentDescriptor);
    const showHeader = options.showHeader !== false;
    const activeForm = readActiveForm();
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
      <section class="xapps-subject-profile">
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
        ${currentNotice ? `<div class="xapps-subject-profile__notice">${escapeHtml(currentNotice)}</div>` : ""}
        ${currentError ? `<div class="xapps-subject-profile__error">${escapeHtml(currentError)}</div>` : ""}
        <div class="xapps-subject-profile__layout">
          <section class="xapps-subject-profile__card">
            <div class="xapps-subject-profile__toolbar">
              <div>
                <h4 class="xapps-subject-profile__section-title">${escapeHtml(t("title", "Billing profile"))}</h4>
                <div class="xapps-subject-profile__section-meta">${escapeHtml(
                  readLocalizedText(currentRemediation.description, locale) ||
                    t(
                      "subtitle",
                      "Choose an existing profile or complete the required invoicing details.",
                    ),
                )}</div>
              </div>
              <div class="xapps-subject-profile__toolbar-actions">
                ${
                  interactive
                    ? `<button type="button" class="xapps-subject-profile__button" data-action="new-profile">${escapeHtml(
                        t("new_profile", "New profile"),
                      )}</button>`
                    : ""
                }
              </div>
            </div>
            ${
              refreshSources.length
                ? `<div class="xapps-subject-profile__refresh-panel">
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
                            <button type="button" class="xapps-subject-profile__button" data-action="toggle-more-sources">${escapeHtml(
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
                        const badges = [
                          readString(candidate.profile_family)
                            ? familyLabel(readString(candidate.profile_family), locale)
                            : "",
                          shouldUseCandidate(candidate) ? t("ready", "ready") : "",
                          candidate.is_default ? t("default", "default") : "",
                          candidate.selected ? t("current", "Current") : "",
                          formCandidate &&
                          readString(formCandidate.candidate_id) &&
                          readString(formCandidate.candidate_id) === candidateId
                            ? t("editing", "editing")
                            : "",
                        ].filter(Boolean);
                        return `<article class="xapps-subject-profile__candidate ${
                          candidateId && candidateId === selectedCandidateId ? "is-selected" : ""
                        }" data-candidate-id="${escapeHtml(candidateId)}">
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
                                        `<span class="xapps-subject-profile__badge">${escapeHtml(badge)}</span>`,
                                    )
                                    .join("")}</div>`
                                : ""
                            }
                          </div>
                          ${
                            listDetailRows(candidate).length
                              ? `<div class="xapps-subject-profile__candidate-details">${listDetailRows(
                                  candidate,
                                )
                                  .map(
                                    (row) =>
                                      `<span class="xapps-subject-profile__detail">${escapeHtml(row)}</span>`,
                                  )
                                  .join("")}</div>`
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
                                        )}">${escapeHtml(
                                          readString(candidate.source) === "subject_self_profile"
                                            ? t("edit", "Edit")
                                            : t("edit_copy", "Edit copy"),
                                        )}</button>`
                                      : ""
                                  }
                                </div>`
                              : ""
                          }
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
            <div>
              <h4 class="xapps-subject-profile__section-title">${escapeHtml(buildFormTitle())}</h4>
              <div class="xapps-subject-profile__section-meta">${escapeHtml(
                readLocalizedText(activeForm.description, locale) || "",
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
                  ? `<div class="xapps-subject-profile__form-actions">
                      <button type="submit" class="xapps-subject-profile__button" data-kind="primary">${escapeHtml(
                        formMode === "update_existing"
                          ? t("save_and_continue", "Save and continue")
                          : t("create_and_continue", "Create and continue"),
                      )}</button>
                      <button type="button" class="xapps-subject-profile__button" data-action="reset-form">${escapeHtml(
                        t("back_to_list", "Back to list"),
                      )}</button>
                    </div>`
                  : ""
              }
            </form>
          </section>
        </div>
        ${
          interactive && onCancel
            ? `<div class="xapps-subject-profile__footer">
                <button type="button" class="xapps-subject-profile__button" data-action="cancel">${escapeHtml(
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
    root.querySelector("[data-action='new-profile']")?.addEventListener("click", () => {
      openCreateForm();
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
