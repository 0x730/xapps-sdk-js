export type XappsMessageType =
  | "XAPPS_WIDGET_READY"
  | "XAPPS_WIDGET_CONTEXT_REQUEST"
  | "XAPPS_WIDGET_CONTEXT"
  | "XAPPS_REQUEST_CREATE"
  | "XAPPS_REQUEST_CREATE_RESULT"
  | "XAPPS_REQUEST_CREATE_MULTIPART"
  | "XAPPS_REQUEST_CREATE_MULTIPART_RESULT"
  | "XAPPS_REQUEST_GET"
  | "XAPPS_REQUEST_GET_RESULT"
  | "XAPPS_REQUEST_RESPONSE"
  | "XAPPS_REQUEST_RESPONSE_RESULT"
  | "XAPPS_REQUEST_EVENTS"
  | "XAPPS_REQUEST_EVENTS_RESULT"
  | "XAPPS_REQUEST_ARTIFACTS"
  | "XAPPS_REQUEST_ARTIFACTS_RESULT"
  | "XAPPS_REQUEST_ARTIFACT_ATTACH"
  | "XAPPS_REQUEST_ARTIFACT_ATTACH_RESULT"
  | "XAPPS_REQUEST_SUBSCRIBE"
  | "XAPPS_REQUEST_SUBSCRIBE_RESULT"
  | "XAPPS_REQUEST_UNSUBSCRIBE"
  | "XAPPS_REQUEST_UNSUBSCRIBE_RESULT"
  | "XAPPS_REQUEST_STATUS_UPDATE"
  | "XAPPS_UPLOAD_CREATE"
  | "XAPPS_UPLOAD_CREATE_RESULT"
  | "XAPPS_UPLOAD_MULTIPART_CREATE"
  | "XAPPS_UPLOAD_MULTIPART_CREATE_RESULT"
  | "XAPPS_UPLOAD_MULTIPART_PUT_PART"
  | "XAPPS_UPLOAD_MULTIPART_PUT_PART_RESULT"
  | "XAPPS_UPLOAD_MULTIPART_LIST_PARTS"
  | "XAPPS_UPLOAD_MULTIPART_LIST_PARTS_RESULT"
  | "XAPPS_UPLOAD_MULTIPART_STATUS"
  | "XAPPS_UPLOAD_MULTIPART_STATUS_RESULT"
  | "XAPPS_UPLOAD_MULTIPART_COMPLETE"
  | "XAPPS_UPLOAD_MULTIPART_COMPLETE_RESULT"
  | "XAPPS_UI_NOTIFICATION"
  | "XAPPS_UI_NAVIGATE"
  | "XAPPS_UI_ALERT"
  | "XAPPS_UI_REFRESH"
  | "XAPPS_UI_MODAL_OPEN"
  | "XAPPS_UI_MODAL_CLOSE"
  | "XAPPS_UI_STATE_UPDATE"
  | "XAPPS_UI_GET_CONTEXT"
  | "XAPPS_UI_GET_CONTEXT_RESULT"
  | "XAPPS_UI_EXPAND_REQUEST"
  | "XAPPS_UI_EXPAND_RESULT"
  | "XAPPS_OPEN_WIDGET"
  | "XAPPS_OPEN_OPERATIONAL_SURFACE"
  | "XAPPS_IFRAME_RESIZE"
  | "XAPPS_TOKEN_REFRESH_REQUEST"
  | "XAPPS_TOKEN_REFRESH"
  | "XAPPS_SESSION_EXPIRED"
  | "XAPPS_THEME_CHANGED"
  | "XAPPS_LOCALE_CHANGED"
  | "XAPPS_SIGN_REQUEST"
  | "XAPPS_SIGN_RESULT"
  | "XAPPS_VENDOR_ASSERTION_REQUEST"
  | "XAPPS_VENDOR_ASSERTION_RESULT"
  | "XAPPS_TOOLS_LIST"
  | "XAPPS_TOOLS_LIST_RESULT"
  | "XAPPS_GUARD_STATUS"
  | "XAPPS_GUARD_REQUEST"
  | "XAPPS_GUARD_RESULT"
  | "XAPPS_FOCUS_TRAP"
  | "XAPPS_FOCUS_REQUEST"
  | "XAPPS_ERROR";

export interface XappsBridgeMessage<T = unknown> {
  type: XappsMessageType;
  id?: string | null;
  ok?: boolean;
  data?: T;
  error?: {
    message?: string;
    code?: string;
    status?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface XappsWidgetContext {
  type: "XAPPS_WIDGET_CONTEXT";
  token: string;
  baseUrl: string;
  hostOrigin?: string | null;
  installationId: string;
  clientId: string;
  xappId: string;
  subjectId: string | null;
  publisherUserId: string | null;
  email: string | null;
  bindToolName: string | null;
  theme?: unknown;
  locale?: string | null;
}

export interface XappsBridgeOptions {
  targetOrigin?: string;
  requestTimeoutMs?: number;
  parentWindow?: Window;
  autoHandshake?: boolean;
  standaloneContext?: Partial<Omit<XappsWidgetContext, "type">>;
}

export type XappsUiExpandStage = "inline" | "focus" | "fullscreen";

export interface XappsUiExpandRequest {
  expanded: boolean;
  source?: string;
  widgetId?: string;
  mode?: "expand" | "collapse";
  stage?: XappsUiExpandStage;
  suggested?: Record<string, unknown>;
}

export interface XappsUiExpandResult {
  hostManaged: boolean;
  expanded: boolean;
  stage: XappsUiExpandStage;
  nativeFullscreen?: boolean;
}

export type ExpandResultCallback = (result: XappsUiExpandResult, raw: XappsBridgeMessage) => void;
export type ExpandControllerChange = (state: XappsUiExpandControllerState) => void;

export interface XappsUiExpandControllerState {
  stage: XappsUiExpandStage;
  expanded: boolean;
  hostManaged: boolean;
  nativeFullscreen: boolean;
}

export interface XappsUiExpandController {
  getState(): XappsUiExpandControllerState;
  onChange(callback: ExpandControllerChange): () => void;
  enterFocus(): void;
  enterFullscreen(): void;
  exit(): void;
  toggle(): void;
  destroy(): void;
}

export interface XappsRequestCreateInput {
  installationId?: string;
  toolName: string;
  subjectId?: string | null;
  clientRequestRef?: string;
  externalRequestId?: string;
  payload?: unknown;
}

export interface XappsRequestCreateMultipartInput {
  installationId?: string;
  toolName: string;
  subjectId?: string | null;
  clientRequestRef?: string;
  externalRequestId?: string;
  payload?: unknown;
  files?: Array<{
    fieldPath: string;
    filename: string;
    mimeType: string;
    base64: string;
  }>;
}

export interface XappsUploadMultipartPutPartInput {
  uploadId: string;
  partNumber: number;
  base64: string;
}

export interface XappsUploadMultipartCompleteInput {
  uploadId: string;
  parts: unknown[];
}

export interface XappsSignActionInput {
  toolName: string;
  payloadHash: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface XappsVendorAssertionInput {
  scopes?: string[];
  [key: string]: unknown;
}

export interface XappsGuardRequestInput {
  guardSlug: string;
  trigger?: string;
  context?: Record<string, unknown>;
  config?: Record<string, unknown> | null;
}

export type XappsOperationalSurfaceKey = "requests" | "payments" | "invoices" | "notifications";

export interface XappsOpenOperationalSurfaceInput {
  surface: XappsOperationalSurfaceKey;
  placement?: "in_router" | "side_panel" | "full_page";
  xappId?: string;
  installationId?: string;
  requestId?: string;
  paymentSessionId?: string;
  invoiceId?: string;
  notificationId?: string;
}

export interface XappsToolDescriptor {
  toolName: string;
  title?: string;
  async?: boolean;
  manualResponse?: boolean;
  inputSchema?: unknown;
  outputSchema?: unknown;
  [key: string]: unknown;
}

export interface XappsToolsListResult {
  tools: XappsToolDescriptor[];
  [key: string]: unknown;
}

export interface XappsGuardBlockedPayload {
  guardSlug: string;
  guard_slug: string;
  trigger: string;
  reason?: string;
  message?: string;
  details?: Record<string, unknown>;
  action?: Record<string, unknown>;
  guard?: Record<string, unknown>;
}

export interface XappsPaymentGuardRefResolution {
  payment_guard_ref?: string;
  definition_name?: string | null;
  source?: "consumer_manifest" | "owner_manifest" | string;
  [key: string]: unknown;
}

export const XAPPS_PAYMENT_GUARD_REASON_OVERRIDE_NOT_ALLOWED =
  "payment_guard_override_not_allowed" as const;
export const XAPPS_PAYMENT_GUARD_REASON_PRICING_FLOOR_VIOLATION =
  "payment_guard_pricing_floor_violation" as const;

export function isPaymentGuardGovernanceReason(reason: unknown): boolean {
  const normalized = String(reason || "")
    .trim()
    .toLowerCase();
  return (
    normalized === XAPPS_PAYMENT_GUARD_REASON_OVERRIDE_NOT_ALLOWED ||
    normalized === XAPPS_PAYMENT_GUARD_REASON_PRICING_FLOOR_VIOLATION
  );
}

export interface XappsPaymentEvidence {
  contract: string;
  payment_session_id: string;
  status: string;
  receipt_id: string;
  amount: string;
  currency: string;
  ts: string;
  issuer: string;
  xapp_id?: string;
  tool_name?: string;
  authority_lane?: string;
  signing_lane?: string;
  resolver_source?: string;
  subject_id?: string;
  installation_id?: string;
  client_id?: string;
  sig: string;
}

export interface XappsPaymentEvidenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PAYMENT_EVIDENCE_CONSUMED_PREFIX = "xapps.payment_evidence.consumed:";

export type TokenRefreshCallback = (token: string, raw: XappsBridgeMessage) => void;
export type SessionExpiredCallback = (payload: unknown) => void;
export type RequestStatusCallback = (payload: unknown) => void;
export type GuardStatusCallback = (payload: unknown) => void;
export type ThemeChangedCallback = (payload: unknown) => void;
export type LocaleChangedCallback = (locale: string | null, raw: XappsBridgeMessage) => void;
export type FocusRequestCallback = (payload: unknown) => void;
export type FocusTrapCallback = (payload: unknown) => void;

export class XappsBridgeError extends Error {
  code?: string;
  status?: number;
  data?: unknown;

  constructor(message: string, details?: { code?: string; status?: number; data?: unknown }) {
    super(message);
    this.name = "XappsBridgeError";
    this.code = details?.code;
    this.status = details?.status;
    this.data = details?.data;
  }
}

export function getGuardBlockedDetails(error: unknown): XappsGuardBlockedPayload | null {
  if (!(error instanceof XappsBridgeError)) return null;
  if (String(error.code || "").toUpperCase() !== "GUARD_BLOCKED") return null;
  const payload = asRecord(error.data);
  const guardSlug = String(payload.guardSlug ?? payload.guard_slug ?? "").trim();
  if (!guardSlug) return null;
  const trigger = String(payload.trigger ?? "before:tool_run").trim() || "before:tool_run";
  const reason = String(payload.reason ?? "").trim();
  const message = String(payload.message ?? "").trim();
  const details = asRecord(payload.details);
  const action = asRecord(payload.action);
  const guard = asRecord(payload.guard);
  return {
    guardSlug,
    guard_slug: guardSlug,
    trigger,
    ...(reason ? { reason } : {}),
    ...(message ? { message } : {}),
    ...(Object.keys(details).length ? { details } : {}),
    ...(Object.keys(action).length ? { action } : {}),
    ...(Object.keys(guard).length ? { guard } : {}),
  };
}

export function isGuardBlockedError(error: unknown): error is XappsBridgeError {
  return getGuardBlockedDetails(error) !== null;
}

export function getPaymentGuardRefResolution(
  error: unknown,
): XappsPaymentGuardRefResolution | null {
  const guardBlocked = getGuardBlockedDetails(error);
  if (!guardBlocked) return null;
  const details = asRecord(guardBlocked.details);
  const refResolution = asRecord(details.payment_guard_ref_resolution);
  if (Object.keys(refResolution).length === 0) return null;
  return {
    ...refResolution,
    ...(typeof refResolution.source === "string" ? { source: refResolution.source } : {}),
  } as XappsPaymentGuardRefResolution;
}

function isPaymentGuardKind(rawKind: string): boolean {
  const kind = String(rawKind || "")
    .trim()
    .toLowerCase();
  return kind === "complete_payment" || kind === "payment_required";
}

function getGuardSlugFromUnknown(input: unknown): string {
  const payload = asRecord(input);
  return String(
    payload.guardSlug ?? payload.guard_slug ?? asRecord(payload.guard).slug ?? "",
  ).trim();
}

function getGuardActionKind(input: unknown): string {
  const payload = asRecord(input);
  const action = asRecord(payload.action);
  const detailsAction = asRecord(asRecord(payload.details).action);
  const guardAction = asRecord(asRecord(payload.guard).action);
  return String(action.kind ?? detailsAction.kind ?? guardAction.kind ?? payload.reason ?? "")
    .trim()
    .toLowerCase();
}

function getPaymentEvidenceStorage(
  storage?: XappsPaymentEvidenceStorage | null,
): XappsPaymentEvidenceStorage | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function paymentEvidenceCacheKey(evidence: XappsPaymentEvidence): string {
  return (
    PAYMENT_EVIDENCE_CONSUMED_PREFIX +
    [
      String(evidence.contract || "").trim(),
      String(evidence.issuer || "").trim(),
      String(evidence.payment_session_id || "").trim(),
      String(evidence.receipt_id || "").trim(),
    ].join(":")
  );
}

function isPaidPaymentEvidence(evidence: XappsPaymentEvidence | null | undefined): boolean {
  if (!evidence || typeof evidence !== "object") return false;
  return (
    String(evidence.status || "")
      .trim()
      .toLowerCase() === "paid"
  );
}

export function readPaymentEvidenceFromSearch(search: string): XappsPaymentEvidence | null {
  const normalized = String(search || "");
  const withoutQuestion = normalized.startsWith("?") ? normalized.slice(1) : normalized;
  const params = new URLSearchParams(withoutQuestion);
  const contract = String(params.get("xapps_payment_contract") || "").trim();
  const paymentSessionId = String(params.get("xapps_payment_session_id") || "").trim();
  const status = String(params.get("xapps_payment_status") || "")
    .trim()
    .toLowerCase();
  const receiptId = String(params.get("xapps_payment_receipt_id") || "").trim();
  const amount = String(params.get("xapps_payment_amount") || "").trim();
  const currency = String(params.get("xapps_payment_currency") || "")
    .trim()
    .toUpperCase();
  const ts = String(params.get("xapps_payment_ts") || "").trim();
  const issuer = String(params.get("xapps_payment_issuer") || "")
    .trim()
    .toLowerCase();
  const xappId = String(params.get("xapp_id") || params.get("xapps_payment_xapp_id") || "").trim();
  const toolName = String(
    params.get("tool_name") || params.get("xapps_payment_tool_name") || "",
  ).trim();
  const authorityLane = String(params.get("xapps_payment_authority_lane") || "")
    .trim()
    .toLowerCase();
  const signingLane = String(params.get("xapps_payment_signing_lane") || "")
    .trim()
    .toLowerCase();
  const resolverSource = String(params.get("xapps_payment_resolver_source") || "").trim();
  const subjectId = String(params.get("xapps_payment_subject_id") || "").trim();
  const installationId = String(params.get("xapps_payment_installation_id") || "").trim();
  const clientId = String(params.get("xapps_payment_client_id") || "").trim();
  const sig = String(params.get("xapps_payment_sig") || "").trim();
  if (
    !contract ||
    !paymentSessionId ||
    !status ||
    !receiptId ||
    !amount ||
    !currency ||
    !ts ||
    !issuer ||
    !sig
  )
    return null;
  return {
    contract,
    payment_session_id: paymentSessionId,
    status,
    receipt_id: receiptId,
    amount,
    currency,
    ts,
    issuer,
    ...(xappId ? { xapp_id: xappId } : {}),
    ...(toolName ? { tool_name: toolName } : {}),
    ...(authorityLane ? { authority_lane: authorityLane } : {}),
    ...(signingLane ? { signing_lane: signingLane } : {}),
    ...(resolverSource ? { resolver_source: resolverSource } : {}),
    ...(subjectId ? { subject_id: subjectId } : {}),
    ...(installationId ? { installation_id: installationId } : {}),
    ...(clientId ? { client_id: clientId } : {}),
    sig,
  };
}

export function readPaymentEvidenceFromLocation(search?: string): XappsPaymentEvidence | null {
  if (typeof search === "string") return readPaymentEvidenceFromSearch(search);
  if (typeof window === "undefined" || !window.location) return null;
  return readPaymentEvidenceFromSearch(window.location.search || "");
}

export function hasPaymentEvidence(search?: string): boolean {
  return Boolean(readPaymentEvidenceFromLocation(search));
}

export function markPaymentEvidenceConsumed(input: {
  evidence?: XappsPaymentEvidence | null;
  search?: string;
  storage?: XappsPaymentEvidenceStorage | null;
}): boolean {
  const evidence =
    input.evidence && typeof input.evidence === "object"
      ? input.evidence
      : readPaymentEvidenceFromLocation(input.search);
  if (!evidence) return false;
  const storage = getPaymentEvidenceStorage(input.storage);
  if (!storage) return false;
  try {
    storage.setItem(paymentEvidenceCacheKey(evidence), "1");
    return true;
  } catch {
    return false;
  }
}

export function isPaymentEvidenceConsumed(input: {
  evidence?: XappsPaymentEvidence | null;
  search?: string;
  storage?: XappsPaymentEvidenceStorage | null;
}): boolean {
  const evidence =
    input.evidence && typeof input.evidence === "object"
      ? input.evidence
      : readPaymentEvidenceFromLocation(input.search);
  if (!evidence) return false;
  const storage = getPaymentEvidenceStorage(input.storage);
  if (!storage) return false;
  try {
    return storage.getItem(paymentEvidenceCacheKey(evidence)) === "1";
  } catch {
    return false;
  }
}

export function hasUsablePaymentEvidence(input?: {
  search?: string;
  storage?: XappsPaymentEvidenceStorage | null;
}): boolean {
  const evidence = readPaymentEvidenceFromLocation(input?.search);
  if (!evidence) return false;
  if (!isPaidPaymentEvidence(evidence)) return false;
  return !isPaymentEvidenceConsumed({ evidence, storage: input?.storage });
}

function extractGuardBlockedPayload(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  if (input instanceof XappsBridgeError) {
    if (String(input.code || "").toUpperCase() !== "GUARD_BLOCKED") return null;
    return asRecord(input.data);
  }
  const payload = asRecord(input);
  const code = String(payload.code || "")
    .trim()
    .toUpperCase();
  if (code !== "GUARD_BLOCKED") return null;
  return asRecord(payload.data);
}

export function reconcilePaymentEvidenceFromGuardBlocked(input: {
  error: unknown;
  search?: string;
  storage?: XappsPaymentEvidenceStorage | null;
}): boolean {
  const payload = extractGuardBlockedPayload(input.error);
  if (!payload) return false;
  const rawGuard = asRecord(payload.guard);
  const reason = String(payload.reason ?? rawGuard.reason ?? "")
    .trim()
    .toLowerCase();
  if (reason !== "payment_receipt_already_used") return false;
  const actionKind = String(
    asRecord(payload.action).kind ??
      asRecord(asRecord(payload.details).action).kind ??
      asRecord(rawGuard.action).kind ??
      "",
  )
    .trim()
    .toLowerCase();
  if (actionKind && !isPaymentGuardKind(actionKind)) return false;
  return markPaymentEvidenceConsumed({ search: input.search, storage: input.storage });
}

export function attachPaymentEvidenceToGuardOrchestration(input: {
  guardOrchestration?: Record<string, unknown> | null;
  guard: unknown;
  evidence?: XappsPaymentEvidence | null;
  search?: string;
}): Record<string, unknown> {
  const base =
    input.guardOrchestration && typeof input.guardOrchestration === "object"
      ? { ...input.guardOrchestration }
      : {};
  const guardSlug = getGuardSlugFromUnknown(input.guard);
  if (!guardSlug) return base;
  const actionKind = getGuardActionKind(input.guard);
  if (!isPaymentGuardKind(actionKind)) return base;
  const evidence =
    input.evidence && typeof input.evidence === "object"
      ? input.evidence
      : readPaymentEvidenceFromLocation(input.search);
  if (!evidence) return base;
  if (!isPaidPaymentEvidence(evidence)) return base;
  if (isPaymentEvidenceConsumed({ evidence })) return base;
  const current = asRecord((base as Record<string, unknown>)[guardSlug]);
  return {
    ...base,
    [guardSlug]: {
      ...current,
      payment: evidence,
    },
  };
}

export function resolveGuardPrimaryActionLabel(input: {
  guard: unknown;
  submitLabel?: string;
  payLabel?: string;
  search?: string;
}): string {
  const actionKind = getGuardActionKind(input.guard);
  const submitLabel = String(input.submitLabel || "Submit Request");
  if (!isPaymentGuardKind(actionKind)) return submitLabel;
  return hasUsablePaymentEvidence({ search: input.search })
    ? submitLabel
    : String(input.payLabel || "Pay");
}

function randomId() {
  return `xmsg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isWindowLike(value: unknown): value is Window {
  return (
    !!value && typeof value === "object" && "postMessage" in (value as Record<string, unknown>)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeGuardBlockedPayload(input: unknown): Record<string, unknown> | null {
  const payload = asRecord(input);
  const rawGuard = asRecord(payload.guard);
  const guardSlug = String(payload.guardSlug ?? payload.guard_slug ?? rawGuard.slug ?? "").trim();
  if (!guardSlug) return null;
  const trigger = String(payload.trigger ?? rawGuard.trigger ?? "before:tool_run").trim();
  const reason = String(payload.reason ?? rawGuard.reason ?? "").trim();
  const details = asRecord(payload.details);
  const mergedDetails = Object.keys(details).length > 0 ? details : asRecord(rawGuard.details);
  const actionCandidate = payload.action ?? rawGuard.action;
  const action =
    actionCandidate && typeof actionCandidate === "object" ? actionCandidate : undefined;
  const message = String(payload.message ?? rawGuard.message ?? "").trim();
  return {
    guardSlug,
    guard_slug: guardSlug,
    trigger,
    reason,
    ...(message ? { message } : {}),
    ...(Object.keys(mergedDetails).length > 0 ? { details: mergedDetails } : {}),
    ...(action ? { action } : {}),
    guard: {
      ...rawGuard,
      slug: guardSlug,
      ...(trigger ? { trigger } : {}),
      ...(reason ? { reason } : {}),
      ...(message ? { message } : {}),
      ...(Object.keys(mergedDetails).length > 0 ? { details: mergedDetails } : {}),
      ...(action ? { action } : {}),
    },
  };
}

function normalizeGuardStatusPayload(input: unknown): unknown {
  const payload = asRecord(input);
  const guardSlug = String(
    payload.guardSlug ?? payload.guard_slug ?? asRecord(payload.guard).slug ?? "",
  ).trim();
  if (!guardSlug) return input;
  const trigger = String(
    payload.trigger ?? asRecord(payload.guard).trigger ?? "before:tool_run",
  ).trim();
  return {
    ...payload,
    guardSlug,
    guard_slug: guardSlug,
    trigger,
  };
}

function toWidgetContext(message: XappsBridgeMessage): XappsWidgetContext | null {
  if (message.type !== "XAPPS_WIDGET_CONTEXT") return null;
  if (typeof message.token !== "string") return null;
  if (typeof message.baseUrl !== "string") return null;
  if (typeof message.installationId !== "string") return null;
  if (typeof message.clientId !== "string") return null;
  if (typeof message.xappId !== "string") return null;
  return {
    type: "XAPPS_WIDGET_CONTEXT",
    token: message.token,
    baseUrl: message.baseUrl,
    hostOrigin: typeof message.hostOrigin === "string" ? message.hostOrigin : null,
    installationId: message.installationId,
    clientId: message.clientId,
    xappId: message.xappId,
    subjectId: typeof message.subjectId === "string" ? message.subjectId : null,
    publisherUserId: typeof message.publisherUserId === "string" ? message.publisherUserId : null,
    email: typeof message.email === "string" ? message.email : null,
    bindToolName: typeof message.bindToolName === "string" ? message.bindToolName : null,
    theme: message.theme,
    locale: typeof message.locale === "string" ? message.locale : null,
  };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  expectedType: XappsMessageType;
  timer?: ReturnType<typeof setTimeout>;
}

export interface XappsBridge {
  isEmbedded(): boolean;
  getContext(): Promise<XappsWidgetContext>;
  createRequest(input: XappsRequestCreateInput): Promise<unknown>;
  createMultipartRequest(input: XappsRequestCreateMultipartInput): Promise<unknown>;
  getMultipartUpload(uploadId: string): Promise<unknown>;
  createUpload(input: Record<string, unknown>): Promise<unknown>;
  createMultipartUpload(input: Record<string, unknown>): Promise<unknown>;
  putMultipartUploadPart(input: XappsUploadMultipartPutPartInput): Promise<unknown>;
  listMultipartUploadParts(uploadId: string): Promise<unknown>;
  completeMultipartUpload(input: XappsUploadMultipartCompleteInput): Promise<unknown>;
  getRequest(requestId: string): Promise<unknown>;
  getResponse(requestId: string): Promise<unknown>;
  getRequestEvents(requestId: string): Promise<unknown>;
  getRequestArtifacts(requestId: string): Promise<unknown>;
  attachRequestArtifact(requestId: string, input: Record<string, unknown>): Promise<unknown>;
  getTools<T = XappsToolsListResult>(): Promise<T>;
  listTools<T = XappsToolsListResult>(): Promise<T>;
  subscribeRequest(requestId: string): Promise<unknown>;
  unsubscribeRequest(requestId: string): Promise<unknown>;
  getVendorAssertion(input?: XappsVendorAssertionInput): Promise<unknown>;
  signAction(input: XappsSignActionInput): Promise<unknown>;
  requestGuard(
    inputOrGuardSlug: XappsGuardRequestInput | string,
    trigger?: string,
    context?: Record<string, unknown>,
    config?: Record<string, unknown> | null,
  ): Promise<unknown>;
  openOperationalSurface(input: XappsOpenOperationalSurfaceInput): void;
  notify(message: string, level?: "info" | "success" | "warning" | "error"): void;
  navigate(path: string, replace?: boolean): void;
  refresh(): void;
  onTokenRefresh(callback: TokenRefreshCallback): () => void;
  onSessionExpired(callback: SessionExpiredCallback): () => void;
  onRequestStatusUpdate(callback: RequestStatusCallback): () => void;
  onGuardStatus(callback: GuardStatusCallback): () => void;
  onExpandResult(callback: ExpandResultCallback): () => void;
  onThemeChanged(callback: ThemeChangedCallback): () => void;
  onLocaleChanged(callback: LocaleChangedCallback): () => void;
  onFocusRequest(callback: FocusRequestCallback): () => void;
  onFocusTrap(callback: FocusTrapCallback): () => void;
  requestTokenRefresh(): Promise<unknown>;
  requestExpand(input: XappsUiExpandRequest): void;
  destroy(): void;
}

export function createExpandController(
  bridge: Pick<XappsBridge, "requestExpand" | "onExpandResult">,
  options: {
    source?: string;
    widgetId?: string;
    suggested?: Record<string, unknown>;
    initialState?: Partial<XappsUiExpandControllerState>;
  } = {},
): XappsUiExpandController {
  let state: XappsUiExpandControllerState = {
    stage: options.initialState?.stage ?? "inline",
    expanded: options.initialState?.expanded ?? false,
    hostManaged: options.initialState?.hostManaged ?? false,
    nativeFullscreen: options.initialState?.nativeFullscreen ?? false,
  };
  const listeners = new Set<ExpandControllerChange>();

  function emit() {
    for (const cb of listeners) {
      try {
        cb({ ...state });
      } catch {}
    }
  }

  function request(stage: XappsUiExpandStage, expanded: boolean) {
    bridge.requestExpand({
      expanded,
      stage,
      ...(options.source ? { source: options.source } : {}),
      ...(options.widgetId ? { widgetId: options.widgetId } : {}),
      ...(options.suggested ? { suggested: options.suggested } : {}),
    });
  }

  const offExpandResult = bridge.onExpandResult((result) => {
    state = {
      stage: result.stage,
      expanded: Boolean(result.expanded),
      hostManaged: Boolean(result.hostManaged),
      nativeFullscreen: Boolean(result.nativeFullscreen),
    };
    emit();
  });

  return {
    getState() {
      return { ...state };
    },
    onChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    enterFocus() {
      request("focus", true);
    },
    enterFullscreen() {
      request("fullscreen", true);
    },
    exit() {
      request("inline", false);
    },
    toggle() {
      if (!state.expanded || state.stage === "inline") {
        request("focus", true);
        return;
      }
      if (state.stage === "focus") {
        request("fullscreen", true);
        return;
      }
      request("inline", false);
    },
    destroy() {
      offExpandResult();
      listeners.clear();
    },
  };
}

export function createBridge(options: XappsBridgeOptions = {}): XappsBridge {
  if (typeof window === "undefined") {
    throw new Error("@xapps-platform/widget-sdk requires a browser window");
  }

  const parentWindow = isWindowLike(options.parentWindow) ? options.parentWindow : window.parent;
  const targetOrigin = options.targetOrigin ?? "*";
  const requestTimeoutMs = Math.max(1_000, options.requestTimeoutMs ?? 15_000);
  const embedded = parentWindow !== window;

  let destroyed = false;
  const pending = new Map<string, PendingRequest>();
  const tokenRefreshListeners = new Set<TokenRefreshCallback>();
  const sessionExpiredListeners = new Set<SessionExpiredCallback>();
  const statusListeners = new Set<RequestStatusCallback>();
  const guardStatusListeners = new Set<GuardStatusCallback>();
  const expandResultListeners = new Set<ExpandResultCallback>();
  const themeChangedListeners = new Set<ThemeChangedCallback>();
  const localeChangedListeners = new Set<LocaleChangedCallback>();
  const focusRequestListeners = new Set<FocusRequestCallback>();
  const focusTrapListeners = new Set<FocusTrapCallback>();
  let contextCache: XappsWidgetContext | null = null;
  let contextPromise: Promise<XappsWidgetContext> | null = null;
  let resolveContext: ((ctx: XappsWidgetContext) => void) | null = null;
  let rejectContext: ((err: Error) => void) | null = null;

  const standaloneContext: XappsWidgetContext = {
    type: "XAPPS_WIDGET_CONTEXT",
    token: options.standaloneContext?.token ?? "",
    baseUrl: options.standaloneContext?.baseUrl ?? window.location.origin,
    hostOrigin:
      typeof options.standaloneContext?.hostOrigin === "string"
        ? options.standaloneContext.hostOrigin
        : null,
    installationId: options.standaloneContext?.installationId ?? "",
    clientId: options.standaloneContext?.clientId ?? "",
    xappId: options.standaloneContext?.xappId ?? "",
    subjectId: options.standaloneContext?.subjectId ?? null,
    publisherUserId: options.standaloneContext?.publisherUserId ?? null,
    email: options.standaloneContext?.email ?? null,
    bindToolName: options.standaloneContext?.bindToolName ?? null,
    theme: options.standaloneContext?.theme,
    locale: options.standaloneContext?.locale ?? null,
  };

  function failPending(error: Error) {
    for (const [id, request] of pending.entries()) {
      if (request.timer) clearTimeout(request.timer);
      request.reject(error);
      pending.delete(id);
    }
  }

  function post(message: unknown) {
    if (!embedded || destroyed) return;
    parentWindow.postMessage(message, targetOrigin);
  }

  function sendRequest(type: XappsMessageType, data: unknown, expectedType: XappsMessageType) {
    if (!embedded) {
      return Promise.reject(
        new XappsBridgeError("Bridge unavailable outside iframe context", {
          code: "BRIDGE_UNAVAILABLE",
        }),
      );
    }
    const id = randomId();
    const payload: XappsBridgeMessage = { type, id, data };
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(
          new XappsBridgeError(`Bridge request timed out: ${type}`, { code: "BRIDGE_TIMEOUT" }),
        );
      }, requestTimeoutMs);
      pending.set(id, { resolve, reject, expectedType, timer });
      post(payload);
    });
  }

  function ensureHandshake() {
    if (!embedded || destroyed) return;
    post("XAPPS_WIDGET_READY");
    post({ type: "XAPPS_WIDGET_CONTEXT_REQUEST" });
  }

  function onMessage(event: MessageEvent<unknown>) {
    if (destroyed || !event?.data) return;
    const data = event.data;
    if (typeof data !== "object" || !("type" in data)) return;
    const message = data as XappsBridgeMessage;

    if (message.type === "XAPPS_WIDGET_CONTEXT") {
      const context = toWidgetContext(message);
      if (!context) return;
      contextCache = context;
      if (resolveContext) {
        resolveContext(contextCache);
        resolveContext = null;
        rejectContext = null;
      }
      return;
    }

    if (message.type === "XAPPS_TOKEN_REFRESH") {
      const token =
        typeof message.data === "object" &&
        message.data &&
        "token" in (message.data as Record<string, unknown>)
          ? String((message.data as Record<string, unknown>).token ?? "")
          : "";
      if (token && contextCache) contextCache = { ...contextCache, token };
      for (const callback of tokenRefreshListeners) callback(token, message);
      return;
    }

    if (message.type === "XAPPS_SESSION_EXPIRED") {
      for (const callback of sessionExpiredListeners) callback(message.data);
      return;
    }

    if (message.type === "XAPPS_REQUEST_STATUS_UPDATE") {
      for (const callback of statusListeners) callback(message.data);
      return;
    }

    if (message.type === "XAPPS_GUARD_STATUS") {
      const normalized = normalizeGuardStatusPayload(message.data);
      for (const callback of guardStatusListeners) callback(normalized);
      return;
    }

    if (message.type === "XAPPS_UI_EXPAND_RESULT") {
      const dataRecord =
        message.data && typeof message.data === "object"
          ? (message.data as Record<string, unknown>)
          : {};
      const stageRaw = String(dataRecord.stage ?? "")
        .trim()
        .toLowerCase();
      const stage: XappsUiExpandStage =
        stageRaw === "focus" || stageRaw === "fullscreen" || stageRaw === "inline"
          ? (stageRaw as XappsUiExpandStage)
          : "inline";
      const result: XappsUiExpandResult = {
        hostManaged: Boolean(dataRecord.hostManaged),
        expanded: Boolean(dataRecord.expanded),
        stage,
        ...(typeof dataRecord.nativeFullscreen === "boolean"
          ? { nativeFullscreen: dataRecord.nativeFullscreen }
          : {}),
      };
      for (const callback of expandResultListeners) callback(result, message);
      return;
    }

    if (message.type === "XAPPS_THEME_CHANGED") {
      for (const callback of themeChangedListeners) callback(message.data);
      return;
    }

    if (message.type === "XAPPS_LOCALE_CHANGED") {
      const locale =
        typeof message.data === "object" &&
        message.data &&
        "locale" in (message.data as Record<string, unknown>)
          ? String((message.data as Record<string, unknown>).locale ?? "").trim() || null
          : null;
      if (contextCache) contextCache = { ...contextCache, locale };
      for (const callback of localeChangedListeners) callback(locale, message);
      return;
    }

    if (message.type === "XAPPS_FOCUS_REQUEST") {
      for (const callback of focusRequestListeners) callback(message.data);
      return;
    }

    if (message.type === "XAPPS_FOCUS_TRAP") {
      for (const callback of focusTrapListeners) callback(message.data);
      return;
    }

    const correlationId = typeof message.id === "string" ? message.id : "";
    if (!correlationId || !pending.has(correlationId)) return;
    const request = pending.get(correlationId);
    if (!request) return;

    if (request.timer) clearTimeout(request.timer);
    pending.delete(correlationId);

    if (message.type === "XAPPS_ERROR") {
      if (message.error?.code === "GUARD_BLOCKED") {
        reconcilePaymentEvidenceFromGuardBlocked({
          error: message.error,
          search:
            typeof window !== "undefined" && window.location ? window.location.search || "" : "",
        });
      }
      const errorPayload = message.error ?? {};
      const normalizedGuard =
        message.error?.code === "GUARD_BLOCKED"
          ? normalizeGuardBlockedPayload(asRecord(message.error).data)
          : null;
      request.reject(
        new XappsBridgeError(message.error?.message || "Bridge request failed", {
          code: message.error?.code,
          status: message.error?.status,
          data:
            normalizedGuard && typeof errorPayload === "object"
              ? { ...errorPayload, ...normalizedGuard }
              : message.error,
        }),
      );
      return;
    }

    if (message.type !== request.expectedType) {
      request.reject(
        new XappsBridgeError(
          `Unexpected bridge response type ${message.type}; expected ${request.expectedType}`,
          {
            code: "BRIDGE_UNEXPECTED_RESPONSE",
            data: message,
          },
        ),
      );
      return;
    }

    if (message.ok === false) {
      request.reject(
        new XappsBridgeError(message.error?.message || "Bridge request rejected", {
          code: message.error?.code,
          status: message.error?.status,
          data: message.error,
        }),
      );
      return;
    }

    request.resolve(message.data);
  }

  window.addEventListener("message", onMessage);

  if (options.autoHandshake !== false) {
    ensureHandshake();
  }

  return {
    isEmbedded() {
      return embedded;
    },
    async getContext() {
      if (contextCache) return contextCache;
      if (!embedded) return standaloneContext;
      if (!contextPromise) {
        contextPromise = new Promise<XappsWidgetContext>((resolve, reject) => {
          resolveContext = resolve;
          rejectContext = reject;
        });
      }
      ensureHandshake();
      return contextPromise;
    },
    createRequest(input) {
      return sendRequest(
        "XAPPS_REQUEST_CREATE",
        {
          installationId: input.installationId,
          toolName: input.toolName,
          subjectId: input.subjectId,
          clientRequestRef: input.clientRequestRef,
          externalRequestId: input.externalRequestId,
          payload: input.payload ?? {},
        },
        "XAPPS_REQUEST_CREATE_RESULT",
      );
    },
    createMultipartRequest(input) {
      return sendRequest(
        "XAPPS_REQUEST_CREATE_MULTIPART",
        {
          installationId: input.installationId,
          toolName: input.toolName,
          subjectId: input.subjectId,
          clientRequestRef: input.clientRequestRef,
          externalRequestId: input.externalRequestId,
          payload: input.payload ?? {},
          files: Array.isArray(input.files) ? input.files : [],
        },
        "XAPPS_REQUEST_CREATE_MULTIPART_RESULT",
      );
    },
    getMultipartUpload(uploadId) {
      return sendRequest(
        "XAPPS_UPLOAD_MULTIPART_STATUS",
        { uploadId },
        "XAPPS_UPLOAD_MULTIPART_STATUS_RESULT",
      );
    },
    createUpload(input) {
      return sendRequest("XAPPS_UPLOAD_CREATE", input || {}, "XAPPS_UPLOAD_CREATE_RESULT");
    },
    createMultipartUpload(input) {
      return sendRequest(
        "XAPPS_UPLOAD_MULTIPART_CREATE",
        input || {},
        "XAPPS_UPLOAD_MULTIPART_CREATE_RESULT",
      );
    },
    putMultipartUploadPart(input) {
      return sendRequest(
        "XAPPS_UPLOAD_MULTIPART_PUT_PART",
        {
          uploadId: input.uploadId,
          partNumber: input.partNumber,
          base64: input.base64,
        },
        "XAPPS_UPLOAD_MULTIPART_PUT_PART_RESULT",
      );
    },
    listMultipartUploadParts(uploadId) {
      return sendRequest(
        "XAPPS_UPLOAD_MULTIPART_LIST_PARTS",
        { uploadId },
        "XAPPS_UPLOAD_MULTIPART_LIST_PARTS_RESULT",
      );
    },
    completeMultipartUpload(input) {
      return sendRequest(
        "XAPPS_UPLOAD_MULTIPART_COMPLETE",
        {
          uploadId: input.uploadId,
          parts: Array.isArray(input.parts) ? input.parts : [],
        },
        "XAPPS_UPLOAD_MULTIPART_COMPLETE_RESULT",
      );
    },
    getRequest(requestId) {
      return sendRequest("XAPPS_REQUEST_GET", { requestId }, "XAPPS_REQUEST_GET_RESULT");
    },
    getResponse(requestId) {
      return sendRequest("XAPPS_REQUEST_RESPONSE", { requestId }, "XAPPS_REQUEST_RESPONSE_RESULT");
    },
    getRequestEvents(requestId) {
      return sendRequest("XAPPS_REQUEST_EVENTS", { requestId }, "XAPPS_REQUEST_EVENTS_RESULT");
    },
    getRequestArtifacts(requestId) {
      return sendRequest(
        "XAPPS_REQUEST_ARTIFACTS",
        { requestId },
        "XAPPS_REQUEST_ARTIFACTS_RESULT",
      );
    },
    attachRequestArtifact(requestId, input) {
      return sendRequest(
        "XAPPS_REQUEST_ARTIFACT_ATTACH",
        {
          requestId,
          ...(input && typeof input === "object" ? input : {}),
        },
        "XAPPS_REQUEST_ARTIFACT_ATTACH_RESULT",
      );
    },
    getTools<T = XappsToolsListResult>() {
      return sendRequest("XAPPS_TOOLS_LIST", {}, "XAPPS_TOOLS_LIST_RESULT") as Promise<T>;
    },
    listTools<T = XappsToolsListResult>() {
      return this.getTools<T>();
    },
    subscribeRequest(requestId) {
      return sendRequest(
        "XAPPS_REQUEST_SUBSCRIBE",
        { requestId },
        "XAPPS_REQUEST_SUBSCRIBE_RESULT",
      );
    },
    unsubscribeRequest(requestId) {
      return sendRequest(
        "XAPPS_REQUEST_UNSUBSCRIBE",
        { requestId },
        "XAPPS_REQUEST_UNSUBSCRIBE_RESULT",
      );
    },
    getVendorAssertion(input = {}) {
      return sendRequest("XAPPS_VENDOR_ASSERTION_REQUEST", input, "XAPPS_VENDOR_ASSERTION_RESULT");
    },
    signAction(input) {
      return sendRequest("XAPPS_SIGN_REQUEST", input, "XAPPS_SIGN_RESULT");
    },
    requestGuard(
      inputOrGuardSlug: XappsGuardRequestInput | string,
      trigger = "before:tool_run",
      context: Record<string, unknown> = {},
      config: Record<string, unknown> | null = null,
    ) {
      const normalizedInput: XappsGuardRequestInput =
        typeof inputOrGuardSlug === "string"
          ? {
              guardSlug: inputOrGuardSlug,
              trigger,
              context,
              config,
            }
          : inputOrGuardSlug;
      return sendRequest(
        "XAPPS_GUARD_REQUEST",
        {
          guardSlug: normalizedInput.guardSlug,
          trigger: normalizedInput.trigger ?? "before:tool_run",
          context: normalizedInput.context ?? {},
          config: normalizedInput.config ?? null,
        },
        "XAPPS_GUARD_RESULT",
      );
    },
    openOperationalSurface(input) {
      const payload = input && typeof input === "object" ? input : { surface: "requests" };
      post({
        type: "XAPPS_OPEN_OPERATIONAL_SURFACE",
        data: {
          surface: String((payload as any).surface || "requests"),
          ...(typeof (payload as any).placement === "string"
            ? { placement: (payload as any).placement }
            : {}),
          ...(typeof (payload as any).xappId === "string"
            ? { xappId: (payload as any).xappId }
            : {}),
          ...(typeof (payload as any).installationId === "string"
            ? { installationId: (payload as any).installationId }
            : {}),
          ...(typeof (payload as any).requestId === "string"
            ? { requestId: (payload as any).requestId }
            : {}),
          ...(typeof (payload as any).paymentSessionId === "string"
            ? { paymentSessionId: (payload as any).paymentSessionId }
            : {}),
          ...(typeof (payload as any).invoiceId === "string"
            ? { invoiceId: (payload as any).invoiceId }
            : {}),
          ...(typeof (payload as any).notificationId === "string"
            ? { notificationId: (payload as any).notificationId }
            : {}),
        },
      });
    },
    notify(message, level = "info") {
      post({ type: "XAPPS_UI_NOTIFICATION", data: { message, level } });
    },
    navigate(path, replace = false) {
      post({ type: "XAPPS_UI_NAVIGATE", data: { path, replace } });
    },
    refresh() {
      post({ type: "XAPPS_UI_REFRESH", data: {} });
    },
    onTokenRefresh(callback) {
      tokenRefreshListeners.add(callback);
      return () => tokenRefreshListeners.delete(callback);
    },
    onSessionExpired(callback) {
      sessionExpiredListeners.add(callback);
      return () => sessionExpiredListeners.delete(callback);
    },
    onRequestStatusUpdate(callback) {
      statusListeners.add(callback);
      return () => statusListeners.delete(callback);
    },
    onGuardStatus(callback) {
      guardStatusListeners.add(callback);
      return () => guardStatusListeners.delete(callback);
    },
    onExpandResult(callback) {
      expandResultListeners.add(callback);
      return () => expandResultListeners.delete(callback);
    },
    onThemeChanged(callback) {
      themeChangedListeners.add(callback);
      return () => themeChangedListeners.delete(callback);
    },
    onLocaleChanged(callback) {
      localeChangedListeners.add(callback);
      return () => localeChangedListeners.delete(callback);
    },
    onFocusRequest(callback) {
      focusRequestListeners.add(callback);
      return () => focusRequestListeners.delete(callback);
    },
    onFocusTrap(callback) {
      focusTrapListeners.add(callback);
      return () => focusTrapListeners.delete(callback);
    },
    requestTokenRefresh() {
      return sendRequest("XAPPS_TOKEN_REFRESH_REQUEST", {}, "XAPPS_TOKEN_REFRESH");
    },
    requestExpand(input) {
      const normalized = input && typeof input === "object" ? input : { expanded: true };
      const expanded = Boolean((normalized as any).expanded);
      const stageRaw = String((normalized as any).stage || "")
        .trim()
        .toLowerCase();
      const stage: XappsUiExpandStage =
        stageRaw === "focus" || stageRaw === "fullscreen" || stageRaw === "inline"
          ? (stageRaw as XappsUiExpandStage)
          : expanded
            ? "focus"
            : "inline";
      post({
        type: "XAPPS_UI_EXPAND_REQUEST",
        data: {
          expanded,
          mode: expanded ? "expand" : "collapse",
          stage,
          ...(typeof (normalized as any).source === "string"
            ? { source: (normalized as any).source }
            : {}),
          ...(typeof (normalized as any).widgetId === "string"
            ? { widgetId: (normalized as any).widgetId }
            : {}),
          ...((normalized as any).suggested && typeof (normalized as any).suggested === "object"
            ? { suggested: (normalized as any).suggested }
            : {}),
        },
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener("message", onMessage);
      failPending(new XappsBridgeError("Bridge destroyed", { code: "BRIDGE_DESTROYED" }));
      if (rejectContext && !contextCache) {
        rejectContext(new XappsBridgeError("Bridge destroyed", { code: "BRIDGE_DESTROYED" }));
      }
      contextPromise = null;
      resolveContext = null;
      rejectContext = null;
      tokenRefreshListeners.clear();
      sessionExpiredListeners.clear();
      statusListeners.clear();
      guardStatusListeners.clear();
      expandResultListeners.clear();
      themeChangedListeners.clear();
      localeChangedListeners.clear();
      focusRequestListeners.clear();
      focusTrapListeners.clear();
    },
  };
}
