import type {
  WidgetExpandStage,
  WidgetOpenOperationalSurfaceInput,
  WidgetResultPresentation,
} from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function readString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function readTrimmedString(value: unknown): string {
  return readString(value).trim();
}

export function readFirstString(...values: unknown[]): string {
  for (const value of values) {
    const candidate = readTrimmedString(value);
    if (candidate) return candidate;
  }
  return "";
}

export function readBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

export function readPath(input: unknown, path: string): unknown {
  if (!input || typeof input !== "object") return undefined;
  const normalized = String(path || "")
    .trim()
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/^\./, "");
  if (!normalized) return undefined;
  const segments = normalized.split(".").filter(Boolean);
  let current: unknown = input;
  for (const segment of segments) {
    if (!current || typeof current !== "object") return undefined;
    current = asRecord(current)[segment];
  }
  return current;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => readTrimmedString(entry)).filter(Boolean);
}

export function normalizeResultPresentation(value: unknown): WidgetResultPresentation | null {
  return value === "runtime_default" || value === "inline" || value === "publisher_managed"
    ? value
    : null;
}

export function normalizeExpandStage(value: unknown, expanded: boolean): WidgetExpandStage {
  const stage = readTrimmedString(value).toLowerCase();
  return stage === "fullscreen" || stage === "focus" || stage === "inline"
    ? stage
    : expanded
      ? "focus"
      : "inline";
}

export function normalizeOperationalSurfacePlacement(
  value: unknown,
): WidgetOpenOperationalSurfaceInput["placement"] | undefined {
  const placement = readTrimmedString(value);
  return placement === "in_router" || placement === "side_panel" || placement === "full_page"
    ? placement
    : undefined;
}

export function readObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}
