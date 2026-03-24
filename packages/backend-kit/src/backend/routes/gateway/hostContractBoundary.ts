// @ts-nocheck
function readString(...values) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

// Keep backward-compat aliases at the HTTP boundary only.
// Tenant implementations should treat the camelCase shape below as canonical.
export function normalizeWidgetSessionInput(body, request) {
  return {
    installationId: body.installationId,
    widgetId: body.widgetId,
    origin: body.origin,
    subjectId: body.subjectId,
    xappId: body.xappId,
    requestId: body.requestId,
    hostReturnUrl:
      readString(body.hostReturnUrl, body.host_return_url, request.headers.referer) || undefined,
    resultPresentation: body.resultPresentation || body.result_presentation,
    guardUi: body.guardUi || body.guard_ui,
  };
}

export function normalizeBridgeRefreshInput(body, request) {
  return {
    installationId: body.installationId,
    widgetId: body.widgetId,
    origin: body.origin,
    subjectId: body.subjectId,
    hostReturnUrl:
      readString(body.hostReturnUrl, body.host_return_url, request.headers.referer) || undefined,
  };
}

export function normalizeBridgeVendorAssertionInput(body) {
  return {
    vendorId: body.vendorId || body.vendor_id,
    subjectId: body.subjectId || body.subject_id,
    installationId: body.installationId || body.installation_id,
    data: body,
  };
}
