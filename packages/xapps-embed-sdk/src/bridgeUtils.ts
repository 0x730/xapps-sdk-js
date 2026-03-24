import { asRecord } from "./guardTakeover";
import type { OpenOperationalSurfaceInput, OperationalSurfaceKey } from "./sharedTypes";

export type BridgeMessageRecord = Record<string, unknown>;

export function readStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readMessageRecord(value: unknown): BridgeMessageRecord {
  return asRecord(value);
}

export function readMessageData(record: BridgeMessageRecord): BridgeMessageRecord {
  const data = asRecord(record.data);
  if (Object.keys(data).length > 0) return data;
  return asRecord(record.payload);
}

export function readRecordString(record: BridgeMessageRecord, key: string): string {
  return readStringValue(record[key]);
}

export function readNestedRecordString(
  record: BridgeMessageRecord,
  key: string,
  nestedKey: string,
): string {
  return readStringValue(asRecord(record[key])[nestedKey]);
}

export function readErrorCode(value: unknown): string {
  const record = asRecord(value);
  return readRecordString(record, "code") || readNestedRecordString(record, "error", "code");
}

export function isAbortError(value: unknown): boolean {
  return readStringValue(asRecord(value).name) === "AbortError";
}

function isOperationalSurfaceKey(value: unknown): value is OperationalSurfaceKey {
  return (
    value === "requests" ||
    value === "payments" ||
    value === "invoices" ||
    value === "notifications"
  );
}

export function normalizeOperationalSurfaceKey(value: unknown): OperationalSurfaceKey | null {
  const normalized = readStringValue(value).toLowerCase();
  return isOperationalSurfaceKey(normalized) ? normalized : null;
}

export function normalizeOperationalSurfacePlacement(
  value: unknown,
): OpenOperationalSurfaceInput["placement"] | undefined {
  return value === "in_router" || value === "side_panel" || value === "full_page"
    ? value
    : undefined;
}

export function normalizeOpenOperationalSurfaceInput(
  value: unknown,
  fallbackSurface?: OperationalSurfaceKey,
): OpenOperationalSurfaceInput | null {
  const record = asRecord(value);
  const surface = normalizeOperationalSurfaceKey(record.surface ?? fallbackSurface);
  if (!surface) return null;

  const next: OpenOperationalSurfaceInput = { surface };
  const placement = normalizeOperationalSurfacePlacement(record.placement);
  if (placement) next.placement = placement;

  const xappId = readRecordString(record, "xappId");
  if (xappId) next.xappId = xappId;
  const installationId = readRecordString(record, "installationId");
  if (installationId) next.installationId = installationId;
  const requestId = readRecordString(record, "requestId");
  if (requestId) next.requestId = requestId;
  const paymentSessionId = readRecordString(record, "paymentSessionId");
  if (paymentSessionId) next.paymentSessionId = paymentSessionId;
  const invoiceId = readRecordString(record, "invoiceId");
  if (invoiceId) next.invoiceId = invoiceId;
  const notificationId = readRecordString(record, "notificationId");
  if (notificationId) next.notificationId = notificationId;

  return next;
}

export function readRecordObject(value: unknown, key: string): Record<string, unknown> {
  return asRecord(asRecord(value)[key]);
}

export function readRecordArray(value: unknown, key: string): unknown[] {
  const result = asRecord(value)[key];
  return Array.isArray(result) ? result : [];
}

export function readInstallationSummary(
  value: unknown,
): { id: string; xappId: string; status: string } | null {
  const record = asRecord(value);
  const id = readRecordString(record, "id");
  const xappId = readRecordString(record, "xapp_id") || readRecordString(record, "xappId");
  if (!id || !xappId) return null;
  return {
    id,
    xappId,
    status: readRecordString(record, "status").toLowerCase(),
  };
}

export function messageFromUnknownError(err: unknown, fallback: string): string {
  const msg = readRecordString(asRecord(err), "message");
  if (msg) return msg;
  if (typeof err === "string" && err.trim()) return err.trim();
  return fallback;
}
