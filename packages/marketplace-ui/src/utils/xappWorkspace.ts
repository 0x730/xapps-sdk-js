import { resolveMarketplaceText } from "../i18n";
import { asRecord, readString } from "./readers";

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function readDefaultWidgetMeta(
  detail: unknown,
  locale: string,
  fallbackLabel: string,
): {
  widgetCount: number;
  widgetId: string;
  widgetName: string;
  toolName: string;
} | null {
  const widgets = Array.isArray(asRecord(detail).widgets)
    ? (asRecord(detail).widgets as unknown[])
    : [];
  const records = widgets
    .map((entry) => asRecord(entry))
    .filter((entry) => Object.keys(entry).length > 0);
  if (!records.length) return null;
  const selected = records.find((entry) => readBoolean(entry.default, false)) || records[0] || null;
  if (!selected) return null;
  const widgetId = readString(selected.id);
  if (!widgetId) return null;
  return {
    widgetCount: records.length,
    widgetId,
    widgetName:
      resolveMarketplaceText(selected.title as any, locale) ||
      readString(selected.widget_name) ||
      readString(selected.name) ||
      fallbackLabel,
    toolName: readString(selected.bind_tool_name),
  };
}
