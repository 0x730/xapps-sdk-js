export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function readString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function readFirstString(...values: unknown[]): string {
  for (const value of values) {
    const candidate = readString(value);
    if (candidate) return candidate;
  }
  return "";
}

export function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (isRecord(value)) {
    const secondsValue = value.seconds ?? value._seconds;
    const nanosValue = value.nanoseconds ?? value._nanoseconds;
    const seconds = typeof secondsValue === "number" ? secondsValue : Number(secondsValue);
    const nanos = typeof nanosValue === "number" ? nanosValue : Number(nanosValue || 0);
    if (Number.isFinite(seconds)) {
      const parsed = new Date(seconds * 1000 + (Number.isFinite(nanos) ? nanos / 1_000_000 : 0));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  const text = readString(value);
  if (!text) return null;

  const candidates = new Set<string>([text]);
  if (/^\d+$/.test(text)) {
    const asMs = new Date(Number(text));
    if (!Number.isNaN(asMs.getTime())) return asMs;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(text)) {
    candidates.add(text.replace(" ", "T"));
    candidates.add(`${text.replace(" ", "T")}Z`);
  }
  if (text.endsWith(" UTC")) {
    candidates.add(`${text.slice(0, -4)}Z`);
  }

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

export function formatDateTime(value: unknown): string {
  const parsed = parseDateValue(value);
  return parsed ? parsed.toLocaleString() : "";
}

export function normalizeExpandStage(
  value: unknown,
  expanded: boolean,
): "inline" | "focus" | "fullscreen" {
  return value === "inline" || value === "focus" || value === "fullscreen"
    ? value
    : expanded
      ? "focus"
      : "inline";
}
