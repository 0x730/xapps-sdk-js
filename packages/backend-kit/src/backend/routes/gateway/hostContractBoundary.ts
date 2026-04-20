// @ts-nocheck
function readString(...values) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export function normalizeWidgetSessionInput(body, request) {
  return {
    installationId: body.installationId,
    widgetId: body.widgetId,
    origin: body.origin,
    subjectId: body.subjectId,
    xappId: body.xappId,
    requestId: body.requestId,
    hostReturnUrl: readString(body.hostReturnUrl, request.headers.referer) || undefined,
    resultPresentation: body.resultPresentation,
    guardUi: body.guardUi,
  };
}

export function normalizeBridgeRefreshInput(body, request) {
  return {
    installationId: body.installationId,
    widgetId: body.widgetId,
    origin: body.origin,
    subjectId: body.subjectId,
    hostReturnUrl: readString(body.hostReturnUrl, request.headers.referer) || undefined,
  };
}

export function normalizeBridgeVendorAssertionInput(body) {
  return {
    vendorId: body.vendorId,
    subjectId: body.subjectId,
    installationId: body.installationId,
    data: body,
  };
}
