type TranslationParams = Record<string, string | number | boolean | null | undefined>;

const catalogs = {
  en: {
    continue: "Continue",
    cancel: "Cancel",
    alert: "Alert",
    modal: "Modal",
    confirmation: "Confirmation",
    guard_action_required: "Guard Action Required",
    guard_requirements_not_satisfied: "Guard requirements are not satisfied",
    confirmation_required_before_continuing: "Confirmation required before continuing",
    step_up_authentication_required: "Step-up authentication required",
    payment_required_before_continuing: "Payment required before continuing",
    subscription_tier_insufficient: "Subscription tier is insufficient",
    unsupported_guard: "Unsupported guard: {guardSlug}",
    expand_handling_failed: "Expand handling failed",
    confirmation_failed: "Confirmation failed",
    guard_evaluation_failed: "Guard evaluation failed",
    continue_prompt: "Continue?",
    subject_profile_completion_canceled: "Subject profile completion canceled.",
    guard_ui_unavailable: "Guard UI is not available for this widget host.",
    missing_tool_name: "Missing tool name",
    request_id_missing_from_response: "Request id missing from response",
    request_failed: "Request failed",
    ui_kit_widget: "UI Kit widget",
    missing_ui_kit_config: "Missing `widget.config.ui_kit`.",
    widget_title_fallback: "Widget",
    app_tab_fallback: "App tab",
    app_shell_tab_missing_widget_reference: "App shell tab is missing widget reference",
    tab_fallback: "Tab",
    select_placeholder: "-- Select --",
    no_items: "No items.",
    untitled: "(untitled)",
    retry: "Retry",
    widget_unavailable: "Widget unavailable",
    widget_took_too_long_to_start:
      "The widget is taking longer than expected to start. Please retry.",
    embedded_widget_could_not_be_loaded: "The embedded widget could not be loaded. Please retry.",
    embedded_widget_load_timed_out: "The embedded widget took too long to load. Please retry.",
    loading: "Loading…",
    working: "Working…",
    submit: "Submit",
    run: "Run",
    error_prefix: "Error: {message}",
    subject_profile_guard: "Subject profile guard",
    debug_widget_state: "Debug: Widget State",
    action_upgrade_subscription: "Action: upgrade subscription{suffix}",
    action_complete_payment: "Action: complete payment{suffix}",
    action_open_monetization_plans: "Action: open plans{suffix}",
    action_complete_step_up_authentication: "Action: complete step-up authentication{suffix}",
    action_confirm_action: "Action: confirm action",
    action_confirm_action_message: "Action: confirm action ({message})",
    action_complete_subject_profile: "Action: complete subject profile",
    action_custom: "Action: {title}",
    payment_confirmed_refresh_retry: "Payment confirmed. Refresh and retry.",
    payment_pending_retry_confirm: "Payment still pending at provider. Retry confirm shortly.",
    payment_not_settled_new_attempt: "Payment not settled. Complete a new payment attempt.",
    payment_requires_additional_action:
      "Payment requires additional action. Complete payment to continue.",
    payment_attempt_failed: "Last payment attempt failed. Complete payment to continue.",
    payment_evidence_used: "Payment evidence already used. Start a new payment attempt.",
    payment_required_for_request: "Payment is required before this request can proceed.",
    xms_insufficient_credits_for_request:
      "You do not have enough credits to continue. Choose a plan or top up credits.",
    xms_usage_policy_not_available:
      "This action is not available right now because its XMS usage policy is missing.",
    xms_usage_policy_tool_missing:
      "This action is not available right now because its XMS configuration is incomplete.",
    invalid_hex_string: "Invalid hex string",
    subject_signature_requires_subject_id:
      "Subject signature required by policy (ed25519), but widget session has no subjectId.",
    subject_signature_dev_key_not_supported_in_production:
      "Subject signature via localStorage dev key is not supported in production.",
    subject_signature_dev_key_required:
      "Subject signature required by policy (ed25519). Configure a dev signing key in localStorage as XAPPS_DEV_ED25519_PRIVATE_KEY_HEX.",
    failed_to_resolve_subject_key: "Failed to resolve subject key ({status})",
    missing_subject_key_id: "Missing keyId from /v1/signing/subject-keys/active",
    failed_to_mint_nonce: "Failed to mint nonce ({status})",
    missing_signing_nonce: "Missing nonce from /v1/signing/nonces",
  },
  ro: {
    continue: "Continuă",
    cancel: "Anulează",
    alert: "Alertă",
    modal: "Fereastră",
    confirmation: "Confirmare",
    guard_action_required: "Acțiune necesară",
    guard_requirements_not_satisfied: "Cerințele de gardă nu sunt îndeplinite",
    confirmation_required_before_continuing: "Este necesară confirmarea înainte de continuare",
    step_up_authentication_required: "Este necesară autentificarea suplimentară",
    payment_required_before_continuing: "Plata este necesară înainte de continuare",
    subscription_tier_insufficient: "Nivelul abonamentului este insuficient",
    unsupported_guard: "Gardă nesuportată: {guardSlug}",
    expand_handling_failed: "Gestionarea extinderii a eșuat",
    confirmation_failed: "Confirmarea a eșuat",
    guard_evaluation_failed: "Evaluarea gărzii a eșuat",
    continue_prompt: "Continuați?",
    subject_profile_completion_canceled: "Completarea profilului subiectului a fost anulată.",
    guard_ui_unavailable: "Interfața pentru gardă nu este disponibilă pentru acest host widget.",
    missing_tool_name: "Lipsește numele instrumentului",
    request_id_missing_from_response: "Lipsește ID-ul cererii din răspuns",
    request_failed: "Cererea a eșuat",
    ui_kit_widget: "Widget UI Kit",
    missing_ui_kit_config: "Lipsește `widget.config.ui_kit`.",
    widget_title_fallback: "Widget",
    app_tab_fallback: "Tab aplicație",
    app_shell_tab_missing_widget_reference: "Tabul App Shell nu are referință către widget",
    tab_fallback: "Tab",
    select_placeholder: "-- Selectează --",
    no_items: "Nu există elemente.",
    untitled: "(fără titlu)",
    retry: "Reîncearcă",
    widget_unavailable: "Widget indisponibil",
    widget_took_too_long_to_start: "Widgetul pornește mai greu decât era de așteptat. Reîncercați.",
    embedded_widget_could_not_be_loaded: "Widgetul integrat nu a putut fi încărcat. Reîncercați.",
    embedded_widget_load_timed_out:
      "Încărcarea widgetului integrat a durat prea mult. Reîncercați.",
    loading: "Se încarcă…",
    working: "Se procesează…",
    submit: "Trimite",
    run: "Rulează",
    error_prefix: "Eroare: {message}",
    subject_profile_guard: "Gardă profil subiect",
    debug_widget_state: "Depanare: stare widget",
    action_upgrade_subscription: "Acțiune: actualizați abonamentul{suffix}",
    action_complete_payment: "Acțiune: finalizați plata{suffix}",
    action_open_monetization_plans: "Acțiune: deschideți planurile{suffix}",
    action_complete_step_up_authentication:
      "Acțiune: finalizați autentificarea suplimentară{suffix}",
    action_confirm_action: "Acțiune: confirmați acțiunea",
    action_confirm_action_message: "Acțiune: confirmați acțiunea ({message})",
    action_complete_subject_profile: "Acțiune: completați profilul subiectului",
    action_custom: "Acțiune: {title}",
    payment_confirmed_refresh_retry: "Plata este confirmată. Reîmprospătați și reîncercați.",
    payment_pending_retry_confirm:
      "Plata este încă în așteptare la procesator. Reîncercați confirmarea în scurt timp.",
    payment_not_settled_new_attempt:
      "Plata nu este finalizată. Finalizați o nouă încercare de plată.",
    payment_requires_additional_action:
      "Plata necesită o acțiune suplimentară. Finalizați plata pentru a continua.",
    payment_attempt_failed:
      "Ultima încercare de plată a eșuat. Finalizați plata pentru a continua.",
    payment_evidence_used: "Dovada plății a fost deja folosită. Porniți o nouă încercare.",
    payment_required_for_request:
      "Plata este necesară înainte ca această cerere să poată continua.",
    xms_insufficient_credits_for_request:
      "Nu aveți suficiente credite pentru a continua. Alegeți un plan sau alimentați soldul.",
    xms_usage_policy_not_available:
      "Această acțiune nu este disponibilă acum deoarece politica XMS de utilizare lipsește.",
    xms_usage_policy_tool_missing:
      "Această acțiune nu este disponibilă acum deoarece configurația XMS este incompletă.",
    invalid_hex_string: "Șir hex invalid",
    subject_signature_requires_subject_id:
      "Semnătura subiectului este cerută de politică (ed25519), dar sesiunea widget nu are subjectId.",
    subject_signature_dev_key_not_supported_in_production:
      "Semnătura subiectului prin cheia dev din localStorage nu este suportată în producție.",
    subject_signature_dev_key_required:
      "Semnătura subiectului este cerută de politică (ed25519). Configurați o cheie de semnare dev în localStorage ca XAPPS_DEV_ED25519_PRIVATE_KEY_HEX.",
    failed_to_resolve_subject_key: "Rezolvarea cheii subiectului a eșuat ({status})",
    missing_subject_key_id: "Lipsește keyId din /v1/signing/subject-keys/active",
    failed_to_mint_nonce: "Generarea nonce-ului a eșuat ({status})",
    missing_signing_nonce: "Lipsește nonce-ul din /v1/signing/nonces",
  },
} as const;

export function normalizeWidgetRuntimeLocale(input: unknown): string {
  const raw = String(input || "")
    .trim()
    .replace(/_/g, "-");
  if (!raw) return "en";
  const [language, ...rest] = raw.split("-").filter(Boolean);
  if (!language) return "en";
  return [language.toLowerCase(), ...rest.map((part) => part.toUpperCase())].join("-");
}

function getLocaleCandidates(input: unknown): string[] {
  const normalized = normalizeWidgetRuntimeLocale(input);
  const out = new Set<string>([normalized]);
  const dash = normalized.indexOf("-");
  if (dash > 0) out.add(normalized.slice(0, dash));
  out.add("en");
  return Array.from(out);
}

export function getDefaultWidgetRuntimeLocale(): string {
  if (typeof navigator === "undefined") return "en";
  return normalizeWidgetRuntimeLocale(navigator.language || "en");
}

export function resolveWidgetRuntimeText(
  value: unknown,
  locale?: string | null,
  fallback = "",
): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const effectiveLocale = locale || getDefaultWidgetRuntimeLocale();
  for (const candidate of getLocaleCandidates(effectiveLocale)) {
    const resolved = record[candidate];
    if (typeof resolved === "string" && resolved.trim()) {
      return resolved.trim();
    }
  }
  for (const resolved of Object.values(record)) {
    if (typeof resolved === "string" && resolved.trim()) {
      return resolved.trim();
    }
  }
  return fallback;
}

export function translateWidgetRuntime(
  key: keyof typeof catalogs.en,
  locale?: string | null,
  params?: TranslationParams,
): string {
  const fallbackLocale = locale || getDefaultWidgetRuntimeLocale();
  let template = "";
  for (const candidate of getLocaleCandidates(fallbackLocale)) {
    const catalog = catalogs[candidate as keyof typeof catalogs];
    if (catalog && typeof catalog[key] === "string") {
      template = catalog[key];
      break;
    }
  }
  const resolved = template || catalogs.en[key] || String(key);
  return resolved.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name) => {
    const value = params?.[name];
    return value == null ? "" : String(value);
  });
}
