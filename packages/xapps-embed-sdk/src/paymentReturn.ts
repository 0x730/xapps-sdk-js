export type XappsPaymentReturnEvidence = {
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
};

export type XappsPaymentReturnState = {
  evidence: XappsPaymentReturnEvidence | null;
  paymentParams: URLSearchParams;
  hasPaymentParams: boolean;
  resumeToken: string | null;
};

export type XappsPaymentResumeRoute = {
  installationId: string;
  widgetId: string;
  xappId: string | null;
  toolName: string | null;
  returnUrl: string | null;
  raw: Record<string, unknown>;
};

export type XappsPaymentReturnResolvedContext = {
  resume: XappsPaymentResumeRoute | null;
  paymentParams: URLSearchParams;
  hasPaymentParams: boolean;
  cleanedUrl: string;
  buildHostReturnUrl: (input?: {
    baseUrl?: string;
    paymentParams?: URLSearchParams | null;
  }) => string;
};

export type ResolveGatewayBaseUrlOptions = {
  override?: string | null | undefined;
  currentUrl?: string | null | undefined;
  defaultPort?: string | null | undefined;
  storageKey?: string | null | undefined;
  storage?: Pick<Storage, "getItem"> | null | undefined;
};

export function resolveGatewayBaseUrl(options?: ResolveGatewayBaseUrlOptions): string {
  const defaultPort = String(options?.defaultPort || "3000").trim() || "3000";
  const storageKey = String(options?.storageKey || "gatewayBaseUrl").trim() || "gatewayBaseUrl";
  const storage =
    typeof options?.storage !== "undefined"
      ? options.storage || null
      : typeof window !== "undefined"
        ? window.localStorage
        : null;
  const overrideFromStorage =
    !options || options.override === undefined
      ? String((storage && storage.getItem ? storage.getItem(storageKey) : "") || "").trim()
      : "";
  const override = String(options?.override || overrideFromStorage || "").trim();
  if (override) return override.replace(/\/+$/, "");
  try {
    const currentUrl =
      String(
        options?.currentUrl ||
          (typeof window !== "undefined" && window.location ? window.location.href : ""),
      ).trim() || `http://localhost:${defaultPort}`;
    const parsed = new URL(currentUrl);
    parsed.port = defaultPort;
    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return `http://localhost:${defaultPort}`;
  }
}

function toUrlSearchParams(search: string): URLSearchParams {
  const normalized = String(search || "");
  const withoutQuestion = normalized.startsWith("?") ? normalized.slice(1) : normalized;
  return new URLSearchParams(withoutQuestion);
}

export function readPaymentReturnParams(search: string): URLSearchParams {
  const source = toUrlSearchParams(search);
  const out = new URLSearchParams();
  for (const [k, v] of source.entries()) {
    if (k.startsWith("xapps_payment_")) out.set(k, v);
  }
  return out;
}

export function parsePaymentReturnFromSearch(search: string): XappsPaymentReturnState {
  const params = toUrlSearchParams(search);
  const paymentParams = readPaymentReturnParams(search);
  const resumeToken = String(params.get("xapps_resume") || "").trim() || null;

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
  const complete = Boolean(
    contract &&
    paymentSessionId &&
    status &&
    receiptId &&
    amount &&
    currency &&
    ts &&
    issuer &&
    sig,
  );

  return {
    evidence: complete
      ? {
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
        }
      : null,
    paymentParams,
    hasPaymentParams: Array.from(paymentParams.keys()).length > 0,
    resumeToken,
  };
}

export function decodePaymentResumeToken(token: string): Record<string, unknown> | null {
  try {
    const raw = String(token || "").trim();
    if (!raw) return null;
    const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const bytes = atob(padded);
    const encoded = Array.from(bytes)
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
    const decoded = decodeURIComponent(encoded);
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parsePaymentResumeFromSearch(search: string): XappsPaymentResumeRoute | null {
  const state = parsePaymentReturnFromSearch(search);
  const token = String(state.resumeToken || "").trim();
  if (!token) return null;
  const parsed = decodePaymentResumeToken(token);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const installationId = String(parsed.installation_id ?? parsed.installationId ?? "").trim();
  const widgetId = String(parsed.widget_id ?? parsed.widgetId ?? "").trim();
  if (!installationId || !widgetId) return null;
  const xappId = String(parsed.xapp_id ?? parsed.xappId ?? "").trim();
  const toolName = String(parsed.tool_name ?? parsed.toolName ?? "").trim();
  const returnUrl = String(parsed.return_url ?? parsed.returnUrl ?? "").trim();
  return {
    installationId,
    widgetId,
    xappId: xappId || null,
    toolName: toolName || null,
    returnUrl: returnUrl || null,
    raw: parsed,
  };
}

export function stripPaymentReturnParamsFromUrl(
  urlLike: string,
  options?: { removeResume?: boolean },
): string {
  const raw = String(urlLike || "");
  const removeResume = options?.removeResume !== false;
  const absolutePattern = /^[a-z][a-z0-9+.-]*:\/\//i;
  const isAbsolute = absolutePattern.test(raw);
  const base =
    typeof window !== "undefined" && window.location ? window.location.origin : "http://localhost";
  const parsed = new URL(raw || "/", base);
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (key.startsWith("xapps_payment_")) parsed.searchParams.delete(key);
    if (removeResume && key === "xapps_resume") parsed.searchParams.delete(key);
  }
  if (isAbsolute) return parsed.toString();
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function resolvePaymentReturnContext(urlLike: string): XappsPaymentReturnResolvedContext {
  const absolutePattern = /^[a-z][a-z0-9+.-]*:\/\//i;
  const raw = String(urlLike || "");
  const base =
    typeof window !== "undefined" && window.location ? window.location.origin : "http://localhost";
  const parsedUrl = new URL(raw || "/", base);
  const parsedState = parsePaymentReturnFromSearch(parsedUrl.search || "");
  const resume = parsePaymentResumeFromSearch(parsedUrl.search || "");
  const paymentParams = new URLSearchParams(parsedState.paymentParams.toString());
  const cleanedUrl = stripPaymentReturnParamsFromUrl(parsedUrl.toString());

  return {
    resume,
    paymentParams,
    hasPaymentParams: parsedState.hasPaymentParams,
    cleanedUrl,
    buildHostReturnUrl: (input) => {
      const currentHref =
        typeof window !== "undefined" && window.location && window.location.href
          ? window.location.href
          : parsedUrl.toString();
      const baseUrl = String(input?.baseUrl || currentHref || parsedUrl.toString());
      const normalizedBase = absolutePattern.test(baseUrl)
        ? baseUrl
        : new URL(baseUrl, base).toString();
      const out = new URL(normalizedBase);
      const params =
        input?.paymentParams instanceof URLSearchParams ? input.paymentParams : paymentParams;
      for (const [k, v] of params.entries()) {
        out.searchParams.set(k, v);
      }
      return out.toString();
    },
  };
}

function normalizePaymentParamsInput(
  input?: URLSearchParams | Record<string, unknown> | null,
): URLSearchParams {
  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input.toString());
  }
  const out = new URLSearchParams();
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const [k, v] of Object.entries(input)) {
      const key = String(k || "").trim();
      if (!key || !key.startsWith("xapps_payment_")) continue;
      const value = v == null ? "" : String(v).trim();
      if (!value) continue;
      out.set(key, value);
    }
  }
  return out;
}

export type HostPaymentResumeState = {
  readonly cleanedUrl: string;
  readonly hasInitialPaymentParams: boolean;
  applyCleanedUrl: (options?: {
    windowRef?: Pick<Window, "location" | "history"> | null | undefined;
    replaceState?: (url: string) => void;
  }) => void;
  getPendingPaymentParams: () => URLSearchParams;
  consumePaymentParams: () => URLSearchParams;
  setPaymentParams: (input?: URLSearchParams | Record<string, unknown> | null) => void;
  buildHostReturnUrl: (input?: {
    baseUrl?: string;
    paymentParams?: URLSearchParams | null;
  }) => string;
  getResume: () => XappsPaymentResumeRoute | null;
  consumeResume: () => XappsPaymentResumeRoute | null;
  setResume: (input: XappsPaymentResumeRoute | null) => void;
};

export type OwnerManagedPaymentPageSessionLike = Partial<{
  return_url: string | null | undefined;
  returnUrl: string | null | undefined;
  cancel_url: string | null | undefined;
  cancelUrl: string | null | undefined;
}>;

export type OwnerManagedPaymentPageController = {
  readonly paymentSessionId: string | null;
  readonly queryReturnUrl: string | null;
  readonly queryCancelUrl: string | null;
  readonly resumeToken: string | null;
  readonly xappId: string | null;
  readonly toolName: string | null;
  readonly hasReturnedPaymentEvidence: boolean;
  resolveReturnUrl: (session?: OwnerManagedPaymentPageSessionLike | null) => string | null;
  resolveCancelUrl: (input?: {
    session?: OwnerManagedPaymentPageSessionLike | null;
    referrer?: string | null | undefined;
  }) => string | null;
  buildReturnedPaymentUrl: (session?: OwnerManagedPaymentPageSessionLike | null) => string | null;
  redirectReturnedPaymentToHost: (input?: {
    windowRef?: Pick<Window, "location"> | null | undefined;
    session?: OwnerManagedPaymentPageSessionLike | null;
  }) => boolean;
};

export function createHostPaymentResumeState(
  urlLike: string,
  options?: {
    autoCleanUrl?: boolean;
    windowRef?: Pick<Window, "location" | "history"> | null | undefined;
  },
): HostPaymentResumeState {
  const resolved = resolvePaymentReturnContext(urlLike);
  let pendingResume = resolved.resume ? { ...resolved.resume } : null;
  let pendingPaymentParams = new URLSearchParams(resolved.paymentParams.toString());
  const cleanedUrl = resolved.cleanedUrl;
  const hasInitialPaymentParams = resolved.hasPaymentParams;

  const applyCleanedUrl = (input?: {
    windowRef?: Pick<Window, "location" | "history"> | null | undefined;
    replaceState?: (url: string) => void;
  }) => {
    const windowRef =
      input?.windowRef || options?.windowRef || (typeof window !== "undefined" ? window : null);
    if (!windowRef) return;
    try {
      const currentHref = String(windowRef.location?.href || "").trim();
      const normalized = String(cleanedUrl || "").trim();
      if (!normalized || normalized === currentHref) return;
      if (input?.replaceState) {
        input.replaceState(normalized);
        return;
      }
      const parsed = new URL(normalized);
      const next = parsed.pathname + parsed.search + parsed.hash;
      windowRef.history?.replaceState?.({}, "", next);
    } catch {}
  };

  if (options?.autoCleanUrl) {
    applyCleanedUrl();
  }

  return {
    cleanedUrl,
    hasInitialPaymentParams,
    applyCleanedUrl,
    getPendingPaymentParams: () => new URLSearchParams(pendingPaymentParams.toString()),
    consumePaymentParams: () => {
      const out = new URLSearchParams(pendingPaymentParams.toString());
      pendingPaymentParams = new URLSearchParams();
      return out;
    },
    setPaymentParams: (input) => {
      pendingPaymentParams = normalizePaymentParamsInput(input);
    },
    buildHostReturnUrl: (input) => {
      const params =
        input?.paymentParams instanceof URLSearchParams
          ? input.paymentParams
          : pendingPaymentParams;
      return resolved.buildHostReturnUrl({
        baseUrl: input?.baseUrl,
        paymentParams: params,
      });
    },
    getResume: () => (pendingResume ? { ...pendingResume } : null),
    consumeResume: () => {
      const out = pendingResume ? { ...pendingResume } : null;
      pendingResume = null;
      return out;
    },
    setResume: (input) => {
      pendingResume = input ? { ...input } : null;
    },
  };
}

function readOwnerManagedSessionField(
  session: OwnerManagedPaymentPageSessionLike | null | undefined,
  ...keys: Array<keyof OwnerManagedPaymentPageSessionLike>
): string {
  for (const key of keys) {
    const value = String(session?.[key] || "").trim();
    if (value) return value;
  }
  return "";
}

export function createOwnerManagedPaymentPageController(
  urlLike: string,
): OwnerManagedPaymentPageController {
  const absolutePattern = /^[a-z][a-z0-9+.-]*:\/\//i;
  const raw = String(urlLike || "");
  const base =
    typeof window !== "undefined" && window.location ? window.location.origin : "http://localhost";
  const parsedUrl = new URL(raw || "/", base);
  const state = parsePaymentReturnFromSearch(parsedUrl.search || "");
  const resolved = resolvePaymentReturnContext(parsedUrl.toString());
  const queryReturnUrl = String(parsedUrl.searchParams.get("return_url") || "").trim() || null;
  const queryCancelUrl = String(parsedUrl.searchParams.get("cancel_url") || "").trim() || null;
  const paymentSessionId =
    String(parsedUrl.searchParams.get("payment_session_id") || "").trim() || null;
  const xappId = String(parsedUrl.searchParams.get("xapp_id") || "").trim() || null;
  const toolName = String(parsedUrl.searchParams.get("tool_name") || "").trim() || null;
  const resumeToken = state.resumeToken || null;

  const resolveReturnUrl = (session?: OwnerManagedPaymentPageSessionLike | null): string | null => {
    const fromResume = String(resolved.resume?.returnUrl || "").trim();
    const fromSession = readOwnerManagedSessionField(session, "return_url", "returnUrl");
    return queryReturnUrl || fromResume || fromSession || null;
  };

  const resolveCancelUrl = (input?: {
    session?: OwnerManagedPaymentPageSessionLike | null;
    referrer?: string | null | undefined;
  }): string | null => {
    const fromSession = readOwnerManagedSessionField(
      input?.session,
      "cancel_url",
      "cancelUrl",
      "return_url",
      "returnUrl",
    );
    const referrer = String(input?.referrer || "").trim();
    return queryCancelUrl || queryReturnUrl || fromSession || referrer || null;
  };

  const buildReturnedPaymentUrl = (
    session?: OwnerManagedPaymentPageSessionLike | null,
  ): string | null => {
    if (!state.evidence) return null;
    const effectiveReturnUrl = resolveReturnUrl(session);
    if (!effectiveReturnUrl) return null;
    const normalizedBase = absolutePattern.test(effectiveReturnUrl)
      ? effectiveReturnUrl
      : new URL(effectiveReturnUrl, base).toString();
    const target = new URL(normalizedBase);
    for (const [key, value] of resolved.paymentParams.entries()) {
      target.searchParams.set(key, value);
    }
    if (resumeToken) target.searchParams.set("xapps_resume", resumeToken);
    if (xappId) target.searchParams.set("xapp_id", xappId);
    if (toolName) target.searchParams.set("tool_name", toolName);
    return target.toString();
  };

  const redirectReturnedPaymentToHost = (input?: {
    windowRef?: Pick<Window, "location"> | null | undefined;
    session?: OwnerManagedPaymentPageSessionLike | null;
  }): boolean => {
    const target = buildReturnedPaymentUrl(input?.session);
    const windowRef = input?.windowRef || (typeof window !== "undefined" ? window : null);
    if (!target || !windowRef?.location) return false;
    windowRef.location.replace(target);
    return true;
  };

  return {
    paymentSessionId,
    queryReturnUrl,
    queryCancelUrl,
    resumeToken,
    xappId,
    toolName,
    hasReturnedPaymentEvidence: Boolean(state.evidence),
    resolveReturnUrl,
    resolveCancelUrl,
    buildReturnedPaymentUrl,
    redirectReturnedPaymentToHost,
  };
}
