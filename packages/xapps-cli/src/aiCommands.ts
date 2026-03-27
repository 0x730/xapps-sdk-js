import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { parseXappManifest } from "@xapps-platform/server-sdk";

type CliArgsLike = Record<string, string | boolean>;
type DevRefLike = { key: string; path: string; exists: boolean };
type PlanRendererFamily = "publisher-rendered" | "jsonforms" | "platform";
type MockAssetKind = "image" | "json" | "text" | "other";
type MockAssetRef = { path: string; name: string; kind: MockAssetKind; bytes?: number };

type AiPlanPayload = {
  schema_version: "xapps.ai.plan.v1";
  ok: boolean;
  mode: "internal";
  read_only: true;
  source: {
    manifest_path: string;
    manifest_sha256?: string;
  };
  context: {
    summary: Record<string, unknown>;
    refs: DevRefLike[];
  };
  actions: Array<Record<string, unknown>>;
  warnings: string[];
  errors: Array<Record<string, unknown>>;
};

type AiCheckPolicy = {
  schema_version?: string;
  require_read_only?: boolean;
  max_actions?: number;
  allow_action_kinds?: string[];
};

type CliErrorFactory = (code: string, message: string, details?: Record<string, unknown>) => Error;

type AiCommandDeps = {
  argString: (args: CliArgsLike, ...keys: string[]) => string | undefined;
  argFlag: (args: CliArgsLike, key: string) => boolean;
  findRepoRoot: (startDir?: string) => string | null;
  parseManifestFromFile: (from: string) => {
    manifest: ReturnType<typeof parseXappManifest>;
    filePath: string;
  };
  buildContextExportPayload: (
    manifest: ReturnType<typeof parseXappManifest>,
    filePath: string,
  ) => Record<string, unknown>;
  buildDevRefs: (repoRoot: string) => DevRefLike[];
  buildInternalV1ContextPreset: (repoRoot: string) => Record<string, unknown>;
  readJsonFile: (filePath: string) => unknown;
  makeCliError: CliErrorFactory;
};
type ParsedManifest = ReturnType<typeof parseXappManifest>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseAiMode(args: CliArgsLike, deps: AiCommandDeps): "internal" {
  const mode = String(deps.argString(args, "mode") || "internal")
    .trim()
    .toLowerCase();
  if (mode !== "internal") {
    throw deps.makeCliError(
      "CLI_AI_MODE_UNSUPPORTED",
      `Unsupported --mode: ${mode} (only internal is implemented in this phase)`,
      { label: "--mode", value: mode, supported: ["internal"] },
    );
  }
  return "internal";
}

function parsePositiveIntOptionOrThrow(
  value: string | undefined,
  fallback: number,
  label: string,
  deps: AiCommandDeps,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw deps.makeCliError(
      "CLI_INVALID_OPTION",
      `Invalid ${label}: ${value} (expected positive integer)`,
      { label, value },
    );
  }
  return parsed;
}

function detectPlanRendererFamilies(manifest: ParsedManifest): PlanRendererFamily[] {
  const found = new Set<PlanRendererFamily>();
  for (const widget of manifest.widgets || []) {
    const renderer = String((widget as any).renderer || "")
      .trim()
      .toLowerCase();
    if (renderer === "publisher") {
      found.add("publisher-rendered");
      continue;
    }
    if (renderer === "json-forms") {
      found.add("jsonforms");
      continue;
    }
    if (renderer === "platform") found.add("platform");
  }
  return Array.from(found.values()).sort();
}

function normalizeLowerSet(values: string[]): Set<string> {
  return new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean));
}

function inferMockAssetKind(fileName: string): MockAssetKind {
  const lower = fileName.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)) return "image";
  if (/\.json$/.test(lower)) return "json";
  if (/\.(txt|md|yaml|yml)$/.test(lower)) return "text";
  return "other";
}

function listMockAssets(
  manifestFilePath: string,
  args: CliArgsLike,
  deps: AiCommandDeps,
): MockAssetRef[] {
  const rawMockDirs = [
    deps.argString(args, "mocks"),
    deps.argString(args, "mocks-dir"),
    path.join(path.dirname(manifestFilePath), "mocks"),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const seenDirs = normalizeLowerSet([]);
  const out: MockAssetRef[] = [];
  for (const rawDir of rawMockDirs) {
    const dirPath = path.resolve(process.cwd(), rawDir);
    const dedupeKey = dirPath.toLowerCase();
    if (seenDirs.has(dedupeKey)) continue;
    seenDirs.add(dedupeKey);
    if (!fs.existsSync(dirPath)) continue;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const absPath = path.join(dirPath, entry.name);
      let size: number | undefined;
      try {
        size = fs.statSync(absPath).size;
      } catch {
        size = undefined;
      }
      out.push({
        path: path.relative(process.cwd(), absPath),
        name: entry.name,
        kind: inferMockAssetKind(entry.name),
        ...(typeof size === "number" ? { bytes: size } : {}),
      });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function readAiGuidance(args: CliArgsLike, deps: AiCommandDeps): string | undefined {
  const inline = deps.argString(args, "guidance");
  const file = deps.argString(args, "guidance-file");
  if (inline && file) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Use either --guidance <text> or --guidance-file <path>, not both",
    );
  }
  const raw = file
    ? fs.readFileSync(path.resolve(process.cwd(), file), "utf8")
    : typeof inline === "string"
      ? inline
      : "";
  const guidance = String(raw || "").trim();
  return guidance || undefined;
}

function getToolByName(manifest: ParsedManifest, toolName: string): Record<string, any> | null {
  for (const tool of manifest.tools || []) {
    if (String((tool as any).tool_name || "") === toolName) return tool as any;
  }
  return null;
}

function collectUiElements(uiSchema: any): any[] {
  if (!uiSchema || typeof uiSchema !== "object") return [];
  const stack: any[] = [uiSchema];
  const out: any[] = [];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    out.push(node);
    const elements = Array.isArray((node as any).elements) ? (node as any).elements : [];
    for (const child of elements) stack.push(child);
  }
  return out;
}

function hasStepperUiSchema(uiSchema: any): boolean {
  if (!uiSchema || typeof uiSchema !== "object") return false;
  if (String((uiSchema as any).type || "") !== "Categorization") return false;
  const options = (uiSchema as any).options;
  return (
    options &&
    typeof options === "object" &&
    String((options as any).variant || "").toLowerCase() === "stepper"
  );
}

function hasPreviewSections(uiSchema: any): boolean {
  return collectUiElements(uiSchema).some(
    (node) =>
      String((node as any).type || "") === "XAppsDisplayPanel" ||
      String((node as any).component || "")
        .toLowerCase()
        .includes("preview"),
  );
}

function buildControlScope(propertyName: string) {
  return `#/properties/${propertyName}`;
}

function buildStepperUiSchemaSuggestion(
  inputSchema: any,
  options?: { includePreviewPanel?: boolean },
) {
  const props =
    inputSchema &&
    typeof inputSchema === "object" &&
    inputSchema.properties &&
    typeof inputSchema.properties === "object"
      ? (inputSchema.properties as Record<string, any>)
      : {};
  const propertyNames = Object.keys(props);
  const nonAttachments: string[] = [];
  const attachments: string[] = [];
  for (const key of propertyNames) {
    const prop = props[key] || {};
    const isBinaryArray =
      String(prop.type || "") === "array" &&
      prop.items &&
      typeof prop.items === "object" &&
      String((prop.items as any).format || "").toLowerCase() === "binary";
    const isBinary = String(prop.format || "").toLowerCase() === "binary";
    if (isBinary || isBinaryArray) attachments.push(key);
    else nonAttachments.push(key);
  }

  const splitIndex =
    nonAttachments.length > 3 ? Math.ceil(nonAttachments.length / 2) : nonAttachments.length;
  const primary = nonAttachments.slice(0, splitIndex);
  const secondary = nonAttachments.slice(splitIndex);
  const categories: any[] = [];
  if (primary.length) {
    const elements = primary.map((key) => ({ type: "Control", scope: buildControlScope(key) }));
    if (options?.includePreviewPanel) {
      const previewScope = buildControlScope(attachments[0] || primary[0]);
      elements.push({
        type: "XAppsDisplayPanel",
        component: "json-preview",
        label: attachments[0] ? "Attachments Preview" : "Form Preview",
        scope: previewScope,
      });
    }
    categories.push({
      type: "Category",
      label: "Basic Info",
      elements,
    });
  }
  if (secondary.length) {
    categories.push({
      type: "Category",
      label: "Details",
      elements: secondary.map((key) => ({ type: "Control", scope: buildControlScope(key) })),
    });
  }
  if (attachments.length) {
    categories.push({
      type: "Category",
      label: "Attachments",
      elements: attachments.map((key) => ({ type: "Control", scope: buildControlScope(key) })),
    });
  }
  if (!categories.length) {
    categories.push({
      type: "Category",
      label: "Form",
      elements: options?.includePreviewPanel
        ? [
            {
              type: "XAppsDisplayPanel",
              component: "json-preview",
              label: "Form Preview",
              scope: "#",
            },
          ]
        : [],
    });
  }
  return {
    type: "Categorization",
    options: { variant: "stepper" },
    elements: categories,
  };
}

function buildPreviewSectionSuggestion(inputSchema: any) {
  const props =
    inputSchema &&
    typeof inputSchema === "object" &&
    inputSchema.properties &&
    typeof inputSchema.properties === "object"
      ? (inputSchema.properties as Record<string, any>)
      : {};
  const names = Object.keys(props);
  const attachmentKey = names.find((key) => {
    const prop = props[key] || {};
    return (
      (String(prop.type || "") === "array" &&
        prop.items &&
        typeof prop.items === "object" &&
        String((prop.items as any).format || "").toLowerCase() === "binary") ||
      String(prop.format || "").toLowerCase() === "binary"
    );
  });
  const fallbackKey = attachmentKey || names[0];
  return [
    {
      type: "XAppsDisplayPanel",
      component: "json-preview",
      label: attachmentKey ? "Attachments Preview" : "Form Preview",
      ...(fallbackKey ? { scope: buildControlScope(fallbackKey) } : { scope: "#" }),
    },
  ];
}

function buildManifestPatchHints(
  manifest: ParsedManifest,
  mockAssets: MockAssetRef[],
  guidance: string | undefined,
): Array<Record<string, unknown>> {
  const hints: Array<Record<string, unknown>> = [];
  const guidanceLower = String(guidance || "").toLowerCase();
  const wantsStepper = /step(?:s|per)?|wizard/.test(guidanceLower);
  const wantsPreview = /preview|widget[- ]?preview|display panel/.test(guidanceLower);
  const hasImageMocks = mockAssets.some((asset) => asset.kind === "image");

  for (const widget of manifest.widgets || []) {
    const w: any = widget as any;
    if (String(w.renderer || "").toLowerCase() !== "json-forms") continue;
    const toolName = String(w.bind_tool_name || "").trim();
    if (!toolName) continue;
    const tool = getToolByName(manifest, toolName);
    if (!tool) continue;
    const uiSchema = (tool as any).input_ui_schema;
    const inputSchema = (tool as any).input_schema;
    const hasStepper = hasStepperUiSchema(uiSchema);
    const hasPreview = hasPreviewSections(uiSchema);
    const shouldSuggestStepper = !hasStepper && (wantsStepper || hasImageMocks);
    const shouldSuggestPreview = !hasPreview && (wantsPreview || hasImageMocks);
    if (!shouldSuggestStepper && !shouldSuggestPreview) continue;

    const proposedInputUiSchema = shouldSuggestStepper
      ? buildStepperUiSchemaSuggestion(inputSchema, { includePreviewPanel: shouldSuggestPreview })
      : undefined;
    const appendPreviewSections =
      !shouldSuggestStepper && shouldSuggestPreview
        ? buildPreviewSectionSuggestion(inputSchema)
        : undefined;

    hints.push({
      widget_name: String(w.widget_name || ""),
      bind_tool_name: toolName,
      reasons: [
        ...(hasImageMocks ? ["mock_assets_detected"] : []),
        ...(shouldSuggestStepper ? ["missing_stepper_wizard_ui"] : []),
        ...(shouldSuggestPreview ? ["missing_preview_sections"] : []),
      ],
      patch: {
        tool_name: toolName,
        field: "input_ui_schema",
        mode: shouldSuggestStepper ? "replace" : "append_preview_sections",
        ...(proposedInputUiSchema ? { value: proposedInputUiSchema } : {}),
        ...(appendPreviewSections ? { preview_sections: appendPreviewSections } : {}),
      },
      review_notes: [
        "Review inferred step grouping and labels before applying.",
        "Preview panel suggestion is generic; customize component/scope for your UX.",
      ],
    });
  }
  return hints;
}

function mimeTypeForMockAsset(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function toDataUrlFromFile(filePath: string): string {
  const abs = path.resolve(process.cwd(), filePath);
  const data = fs.readFileSync(abs);
  const mime = mimeTypeForMockAsset(filePath);
  return `data:${mime};base64,${data.toString("base64")}`;
}

function extractJsonObjectFromText(text: string): Record<string, unknown> | null {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    // try fenced code blocks
  }
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function buildLlmManifestPatchHints(
  manifest: ParsedManifest,
  mockAssets: MockAssetRef[],
  guidance: string | undefined,
  args: CliArgsLike,
  deps: AiCommandDeps,
): Promise<{
  hints: Array<Record<string, unknown>>;
  provider: string;
  model: string;
}> {
  const apiKey =
    deps.argString(args, "llm-api-key") ||
    process.env.OPENAI_API_KEY ||
    process.env.XAPPS_AI_API_KEY ||
    "";
  if (!apiKey) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Missing LLM API key. Provide --llm-api-key or set OPENAI_API_KEY/XAPPS_AI_API_KEY",
    );
  }
  const baseUrl = String(
    deps.argString(args, "llm-base-url") ||
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com/v1",
  ).replace(/\/+$/, "");
  const model = String(
    deps.argString(args, "llm-model") || process.env.XAPPS_AI_MODEL || "gpt-5.2",
  ).trim();
  const timeoutMs = parsePositiveIntOptionOrThrow(
    deps.argString(args, "llm-timeout-ms") || process.env.XAPPS_AI_TIMEOUT_MS,
    30000,
    "--llm-timeout-ms",
    deps,
  );
  const imageAssets = mockAssets.filter((m) => m.kind === "image").slice(0, 4);
  const userContent: any[] = [
    {
      type: "text",
      text: [
        "Analyze this xapp manifest and mock assets and propose JSON Forms manifest patch hints.",
        "Focus on json-forms widgets and infer complete form fields from mockups/guidance.",
        "When image mockups are provided, BOTH are needed: propose input_schema AND input_ui_schema (wizard + previews).",
        'Return STRICT JSON object only with shape: {"hints": [ ... ]}.',
        "Each hint item must include: widget_name, bind_tool_name, reasons (array), patch (object), review_notes (array).",
        "Patch object must include tool_name, field, mode and target only input_schema or input_ui_schema.",
        "Supported patch modes: replace (for input_schema or input_ui_schema), append_preview_sections (input_ui_schema only).",
        "For image mockups, you MUST attempt complete input_schema inference first (best effort), then align input_ui_schema controls/previews to those fields.",
        "If confidence is low, still provide a best-effort input_schema and explain uncertainty in review_notes.",
        "For image mocks, prefer image-aware preview suggestions (e.g. attachment-scoped preview panels, data-view cards/list/table of image metadata, or publisher_preview-backed preview sections if endpoints already exist) instead of a generic form-level json-preview when possible.",
        "If you suggest preview sections, include component and any options needed (label, scope, options.view/options.dataSource, etc.).",
        "Use only supported preview/display components and views: components=[json-preview, location-map-preview, data-view]; data-view types=[key-value, list, table, badges, cards, json].",
        "Do not modify security/guards/connectivity.",
        guidance ? `User guidance: ${guidance}` : "User guidance: none",
        `Manifest JSON:\n${JSON.stringify(manifest, null, 2)}`,
        `Mock assets summary:\n${JSON.stringify(mockAssets, null, 2)}`,
      ].join("\n\n"),
    },
  ];
  for (const asset of imageAssets) {
    try {
      userContent.push({
        type: "image_url",
        image_url: { url: toDataUrlFromFile(asset.path) },
      });
    } catch {
      // skip unreadable asset
    }
  }

  const payload = {
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an xapps manifest assistant. Propose minimal, safe JSON Forms manifest patch hints (input_schema and input_ui_schema only).",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    temperature: 0.2,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw deps.makeCliError("CLI_RUNTIME_ERROR", `LLM request timed out after ${timeoutMs}ms`, {
        provider: "openai-compatible",
        model,
        timeout_ms: timeoutMs,
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const rawText = await response.text();
  if (!response.ok) {
    throw deps.makeCliError("CLI_RUNTIME_ERROR", `LLM request failed: status=${response.status}`, {
      status: response.status,
      body: rawText.slice(0, 2000),
      provider: "openai-compatible",
      model,
    });
  }
  let parsedResp: any = null;
  try {
    parsedResp = JSON.parse(rawText);
  } catch {
    throw deps.makeCliError("CLI_RUNTIME_ERROR", "LLM returned non-JSON response envelope", {
      provider: "openai-compatible",
      model,
    });
  }
  const content = String(parsedResp?.choices?.[0]?.message?.content || "");
  const llmJson = extractJsonObjectFromText(content);
  if (!llmJson || !Array.isArray((llmJson as any).hints)) {
    throw deps.makeCliError("CLI_RUNTIME_ERROR", "LLM response missing hints[] JSON payload", {
      provider: "openai-compatible",
      model,
    });
  }
  const hints = ((llmJson as any).hints as unknown[]).filter((item) =>
    isPlainObject(item),
  ) as Array<Record<string, unknown>>;
  return { hints, provider: "openai-compatible", model };
}

function evaluateLlmHintCompleteness(
  hints: Array<Record<string, unknown>>,
  options: { requireInputSchema: boolean; requireInputUiSchema: boolean },
): { ok: boolean; missing: string[] } {
  const fields = new Set<string>();
  for (const hint of hints) {
    const patch = isPlainObject(hint.patch) ? (hint.patch as Record<string, unknown>) : null;
    const field = String(patch?.field || "").trim();
    if (field) fields.add(field);
  }
  const missing: string[] = [];
  if (options.requireInputSchema && !fields.has("input_schema")) missing.push("input_schema");
  if (options.requireInputUiSchema && !fields.has("input_ui_schema"))
    missing.push("input_ui_schema");
  return { ok: missing.length === 0, missing };
}

async function readAiGuidanceInteractiveIfRequested(
  args: CliArgsLike,
  deps: AiCommandDeps,
): Promise<string | undefined> {
  const guidance = readAiGuidance(args, deps);
  if (guidance) return guidance;
  if (!deps.argFlag(args, "ask-guidance")) return undefined;
  if (!input.isTTY || !output.isTTY) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "--ask-guidance requires an interactive terminal (TTY) or use --guidance/--guidance-file",
    );
  }
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      "AI guidance (optional). Example: infer complete form fields from mockups, build a step wizard, add supported preview sections, and exclude payment screens because payment is handled by guards.\n> ",
    );
    const trimmed = String(answer || "").trim();
    return trimmed || undefined;
  } finally {
    rl.close();
  }
}

function applySingleManifestPatchHint(
  manifest: Record<string, any>,
  hint: Record<string, unknown>,
): { changed: boolean; summary: string } {
  const patch = isPlainObject(hint.patch) ? (hint.patch as Record<string, unknown>) : null;
  if (!patch) return { changed: false, summary: "skip: missing patch object" };
  const toolName = String(patch.tool_name || "").trim();
  const field = String(patch.field || "").trim();
  const mode = String(patch.mode || "").trim();
  if (!toolName || (field !== "input_ui_schema" && field !== "input_schema") || !mode) {
    return {
      changed: false,
      summary: `skip: unsupported patch target (${toolName || "?"}:${field}:${mode})`,
    };
  }
  const tools = Array.isArray((manifest as any).tools) ? ((manifest as any).tools as any[]) : [];
  const tool = tools.find((t) => String(t?.tool_name || "") === toolName);
  if (!tool || typeof tool !== "object") {
    return { changed: false, summary: `skip: tool not found (${toolName})` };
  }

  if (mode === "replace") {
    if (!isPlainObject(patch.value)) {
      return { changed: false, summary: `skip: replace patch missing object value (${toolName})` };
    }
    const before = JSON.stringify((tool as any)[field] ?? null);
    (tool as any)[field] = patch.value;
    const after = JSON.stringify((tool as any)[field] ?? null);
    return { changed: before !== after, summary: `replace ${toolName}.${field}` };
  }

  if (mode === "append_preview_sections") {
    if (field !== "input_ui_schema") {
      return {
        changed: false,
        summary: `skip: append_preview_sections only supports input_ui_schema (${toolName})`,
      };
    }
    const previewSections = Array.isArray(patch.preview_sections)
      ? (patch.preview_sections.filter((s) => isPlainObject(s)) as Record<string, unknown>[])
      : [];
    if (!previewSections.length) {
      return { changed: false, summary: `skip: no preview_sections (${toolName})` };
    }
    const ui = isPlainObject((tool as any)[field])
      ? ((tool as any)[field] as Record<string, any>)
      : null;
    if (!ui) {
      (tool as any)[field] = { type: "VerticalLayout", elements: [...previewSections] };
      return { changed: true, summary: `create ${toolName}.${field} with preview sections` };
    }
    const uiType = String((ui as any).type || "");
    if (uiType === "Categorization" && Array.isArray((ui as any).elements)) {
      const categories = (ui as any).elements as any[];
      const attachmentCategory = categories.find((cat) => {
        if (!cat || typeof cat !== "object") return false;
        const label = String((cat as any).label || "").toLowerCase();
        if (label.includes("attachment")) return true;
        const els = Array.isArray((cat as any).elements) ? (cat as any).elements : [];
        return els.some(
          (el: any) =>
            String(el?.type || "") === "Control" &&
            String(el?.scope || "")
              .toLowerCase()
              .includes("/attachments"),
        );
      });
      if (attachmentCategory) {
        if (!Array.isArray((attachmentCategory as any).elements))
          (attachmentCategory as any).elements = [];
        const targetEls = (attachmentCategory as any).elements as any[];
        const before = JSON.stringify(targetEls);
        for (const section of previewSections) targetEls.push(section);
        return {
          changed: before !== JSON.stringify(targetEls),
          summary: `append preview sections to attachment category in ${toolName}.${field}`,
        };
      }
      categories.push({
        type: "Category",
        label: "Preview",
        elements: [...previewSections],
      });
      return { changed: true, summary: `append Preview category to ${toolName}.${field}` };
    }
    if (!Array.isArray((ui as any).elements)) (ui as any).elements = [];
    const targetEls = (ui as any).elements as any[];
    const before = JSON.stringify(targetEls);
    for (const section of previewSections) targetEls.push(section);
    return {
      changed: before !== JSON.stringify(targetEls),
      summary: `append preview sections to ${toolName}.${field}`,
    };
  }

  return { changed: false, summary: `skip: unsupported patch mode (${mode})` };
}

function renderSimpleJsonDiff(beforeText: string, afterText: string): string {
  if (beforeText === afterText) return "(no changes)";
  const before = beforeText.split("\n");
  const after = afterText.split("\n");
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix])
    prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const beforeMid = before.slice(prefix, before.length - suffix);
  const afterMid = after.slice(prefix, after.length - suffix);
  const outLines: string[] = [];
  const startLine = prefix + 1;
  outLines.push(`@@ manifest.json:${startLine} @@`);
  for (const line of beforeMid) outLines.push(`- ${line}`);
  for (const line of afterMid) outLines.push(`+ ${line}`);
  return outLines.join("\n");
}

function applyManifestPatchHintsToFile(
  filePath: string,
  manifest: ParsedManifest,
  hints: Array<Record<string, unknown>>,
): {
  applied: boolean;
  changed: boolean;
  file: string;
  applied_count: number;
  summaries: string[];
  diff: string;
} {
  const beforeObj = JSON.parse(JSON.stringify(manifest)) as Record<string, any>;
  const beforeText = `${JSON.stringify(beforeObj, null, 2)}\n`;
  const workObj = JSON.parse(beforeText) as Record<string, any>;
  const summaries: string[] = [];
  let appliedCount = 0;
  let changed = false;
  for (const hint of hints) {
    const result = applySingleManifestPatchHint(workObj, hint);
    summaries.push(result.summary);
    if (result.summary.startsWith("skip:")) continue;
    appliedCount += 1;
    changed = changed || result.changed;
  }
  const afterText = `${JSON.stringify(workObj, null, 2)}\n`;
  if (changed) {
    // validate before write
    parseXappManifest(workObj);
    fs.writeFileSync(filePath, afterText, "utf8");
  }
  return {
    applied: true,
    changed,
    file: filePath,
    applied_count: appliedCount,
    summaries,
    diff: renderSimpleJsonDiff(beforeText, afterText),
  };
}

function parseAiCheckPolicy(
  rawPolicy: unknown,
  policyFile: string,
  deps: AiCommandDeps,
): AiCheckPolicy {
  if (!isPlainObject(rawPolicy)) {
    throw deps.makeCliError("CLI_AI_POLICY_INVALID", "Invalid AI policy JSON: expected object", {
      file: policyFile,
    });
  }
  const policy = rawPolicy as Record<string, unknown>;
  const schemaVersion =
    typeof policy.schema_version === "string" ? String(policy.schema_version).trim() : "";
  if (schemaVersion && schemaVersion !== "xapps.ai.policy.v1") {
    throw deps.makeCliError(
      "CLI_AI_POLICY_INVALID",
      `Invalid AI policy schema_version: ${schemaVersion} (expected xapps.ai.policy.v1)`,
      { file: policyFile, schema_version: schemaVersion },
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(policy, "require_read_only") &&
    typeof policy.require_read_only !== "boolean"
  ) {
    throw deps.makeCliError(
      "CLI_AI_POLICY_INVALID",
      "AI policy require_read_only must be boolean",
      {
        file: policyFile,
      },
    );
  }
  if (Object.prototype.hasOwnProperty.call(policy, "max_actions")) {
    const value = policy.max_actions;
    if (!Number.isInteger(value) || Number(value) < 0) {
      throw deps.makeCliError(
        "CLI_AI_POLICY_INVALID",
        "AI policy max_actions must be a non-negative integer",
        { file: policyFile },
      );
    }
  }
  if (Object.prototype.hasOwnProperty.call(policy, "allow_action_kinds")) {
    const value = policy.allow_action_kinds;
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== "string" || !String(item).trim())
    ) {
      throw deps.makeCliError(
        "CLI_AI_POLICY_INVALID",
        "AI policy allow_action_kinds must be an array of non-empty strings",
        { file: policyFile },
      );
    }
  }
  return rawPolicy as AiCheckPolicy;
}

function buildAiCheckPolicyPreset(name: string, deps: AiCommandDeps): AiCheckPolicy {
  const normalized = String(name || "")
    .trim()
    .toLowerCase();
  if (normalized !== "internal-readonly") {
    throw deps.makeCliError(
      "CLI_INVALID_OPTION",
      `Unknown --policy-preset: ${name} (expected internal-readonly)`,
      { label: "--policy-preset", value: name, allowed: ["internal-readonly"] },
    );
  }
  return {
    schema_version: "xapps.ai.policy.v1",
    require_read_only: true,
    max_actions: 16,
    allow_action_kinds: [
      "analyze.manifest",
      "suggest.flow_checks",
      "analyze.renderers",
      "suggest.renderer_checks",
      "suggest.manifest_patch",
      "suggest.context_refresh",
      "suggest.ai_policy_check",
      "suggest.flow_run",
    ],
  };
}

export async function runAiPlanCommand(args: CliArgsLike, deps: AiCommandDeps) {
  const subcommand = deps.argString(args, "_subcommand");
  if (subcommand !== "plan") {
    throw deps.makeCliError("CLI_INVALID_ARGS", "Missing required subcommand: ai plan|check");
  }
  const mode = parseAiMode(args, deps);
  const from = deps.argString(args, "from");
  if (!from) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Missing required argument: --from <manifest.json>",
    );
  }
  const repoRoot = deps.findRepoRoot();
  if (!repoRoot) {
    throw deps.makeCliError(
      "CLI_REPO_NOT_FOUND",
      "xapps ai plan --mode internal is repo-only and requires the xapps monorepo checkout",
    );
  }
  const { manifest, filePath } = deps.parseManifestFromFile(from);
  const mockAssets = listMockAssets(filePath, args, deps);
  const guidance = await readAiGuidanceInteractiveIfRequested(args, deps);
  const context = deps.buildContextExportPayload(manifest, filePath);
  const refs = deps.buildDevRefs(repoRoot);
  const rendererFamilies = detectPlanRendererFamilies(manifest);
  const preset = deps.argString(args, "preset");
  let presetPayload: Record<string, unknown> | undefined;
  if (preset) {
    const normalizedPreset = preset.trim().toLowerCase();
    if (normalizedPreset !== "internal-v1") {
      throw deps.makeCliError(
        "CLI_INVALID_OPTION",
        `Invalid --preset: ${preset} (expected internal-v1)`,
        {
          label: "--preset",
          value: preset,
        },
      );
    }
    presetPayload = deps.buildInternalV1ContextPreset(repoRoot);
  }
  const flow = deps.argString(args, "flow");
  const normalizedFlow = flow ? flow.trim().toLowerCase() : undefined;
  const supportedFlows = new Set(["pay-per-request", "guard-orchestration", "xplace-certs"]);
  if (normalizedFlow && !supportedFlows.has(normalizedFlow)) {
    throw deps.makeCliError("CLI_INVALID_OPTION", `Unknown --flow: ${flow}`, {
      label: "--flow",
      value: flow,
      allowed: Array.from(supportedFlows),
    });
  }

  const actions: Array<Record<string, unknown>> = [
    {
      kind: "analyze.manifest",
      status: "proposed",
      description: "Review manifest/tools/widgets against V1 baseline contracts",
    },
    {
      kind: "suggest.flow_checks",
      status: "proposed",
      flows: ["pay-per-request", "guard-orchestration", "xplace-certs"],
    },
    {
      kind: "analyze.renderers",
      status: "proposed",
      renderers: rendererFamilies,
      description:
        "Classify widget renderer families and map to V1 checks (publisher-rendered, jsonforms, platform)",
    },
  ];
  if (rendererFamilies.includes("jsonforms")) {
    actions.push({
      kind: "suggest.renderer_checks",
      status: "proposed",
      renderer: "jsonforms",
      command:
        "npm test -- src/__tests__/jsonformsEmbed.test.ts src/__tests__/jsonformsStepDispatch.test.ts src/__tests__/jsonformsFiles.test.ts",
    });
  }
  if (rendererFamilies.includes("publisher-rendered")) {
    actions.push({
      kind: "suggest.renderer_checks",
      status: "proposed",
      renderer: "publisher-rendered",
      command:
        "npm test -- src/__tests__/embedWidgets.test.ts src/__tests__/guardContractParity.test.ts src/__tests__/integrationHostGuardContracts.test.ts",
    });
  }
  if (presetPayload) {
    actions.push({
      kind: "suggest.context_refresh",
      status: "proposed",
      command: `xapps context export --from ${filePath} --preset internal-v1`,
    });
    actions.push({
      kind: "suggest.ai_policy_check",
      status: "proposed",
      command: "xapps ai check --mode internal --plan <plan.json> --policy <policy.json> --json",
    });
  }
  if (normalizedFlow) {
    actions.push({
      kind: "suggest.flow_run",
      status: "proposed",
      flow: normalizedFlow,
      command: `xapps dev check flow --name ${normalizedFlow} --run --json`,
    });
  }
  const heuristicManifestPatchHints = buildManifestPatchHints(manifest, mockAssets, guidance);
  let manifestPatchHints = heuristicManifestPatchHints;
  let llmInfo:
    | {
        provider: string;
        model: string;
        enabled: true;
        used: boolean;
      }
    | undefined;
  if (deps.argFlag(args, "llm")) {
    llmInfo = { provider: "openai-compatible", model: "unknown", enabled: true, used: false };
    try {
      const llmHints = await buildLlmManifestPatchHints(manifest, mockAssets, guidance, args, deps);
      llmInfo = {
        provider: llmHints.provider,
        model: llmHints.model,
        enabled: true,
        used: true,
      };
      if (llmHints.hints.length > 0) {
        const hasImageMocks = mockAssets.some((m) => m.kind === "image");
        const completeness = evaluateLlmHintCompleteness(llmHints.hints, {
          requireInputSchema: hasImageMocks,
          requireInputUiSchema: hasImageMocks,
        });
        if (!completeness.ok && hasImageMocks) {
          (heuristicManifestPatchHints as any).__llm_error =
            `LLM hints incomplete for image mocks (missing: ${completeness.missing.join(", ")})`;
        } else {
          manifestPatchHints = llmHints.hints;
        }
      }
    } catch (err: any) {
      // Preserve deterministic plan output with a warning + fallback heuristic hints.
      const msg = String(err?.message || err || "LLM manifest hint generation failed");
      llmInfo = {
        ...(llmInfo || { provider: "openai-compatible", model: "unknown", enabled: true }),
        used: false,
      };
      (manifestPatchHints as any).__llm_error = msg;
    }
  }
  if (manifestPatchHints.length > 0) {
    actions.push({
      kind: "suggest.manifest_patch",
      status: "proposed",
      target: "manifest.json",
      description:
        "Mock-aware JSON Forms manifest upgrade hints (stepper wizard + preview sections) generated for review",
      hints: manifestPatchHints,
      ...(llmInfo
        ? {
            source: llmInfo.used ? "llm" : "heuristic_fallback",
            llm: llmInfo,
          }
        : { source: "heuristic" }),
      ...(((manifestPatchHints as any).__llm_error as string | undefined)
        ? { llm_error: (manifestPatchHints as any).__llm_error }
        : {}),
    });
  }

  const payload: AiPlanPayload = {
    schema_version: "xapps.ai.plan.v1",
    ok: true,
    mode,
    read_only: true,
    source: {
      manifest_path: filePath,
      manifest_sha256:
        context &&
        isPlainObject(context.source) &&
        typeof context.source.manifest_sha256 === "string"
          ? context.source.manifest_sha256
          : undefined,
    },
    context: {
      summary: isPlainObject(context.summary) ? (context.summary as Record<string, unknown>) : {},
      refs,
      ...(guidance
        ? {
            ai_inputs: {
              guidance,
            },
          }
        : {}),
      ...(mockAssets.length > 0
        ? {
            mock_assets: {
              count: mockAssets.length,
              kinds: Array.from(new Set(mockAssets.map((item) => item.kind))).sort(),
              items: mockAssets,
            },
          }
        : {}),
      ...(llmInfo ? { llm: llmInfo } : {}),
      ...(presetPayload ? { preset: presetPayload } : {}),
    },
    actions,
    warnings: [
      ...(refs.every((ref) => ref.exists) ? [] : ["Some internal engineering refs are missing"]),
      ...(((manifestPatchHints as any).__llm_error as string | undefined)
        ? [
            `LLM manifest hint generation failed, heuristic fallback used: ${(manifestPatchHints as any).__llm_error}`,
          ]
        : []),
    ],
    errors: [],
  };
  if (normalizedFlow) (payload as any).flow = normalizedFlow;
  (payload as any).coverage = {
    renderers: rendererFamilies,
    flows_supported: Array.from(supportedFlows.values()),
    flow_selected: normalizedFlow || null,
    preset_selected: presetPayload ? "internal-v1" : null,
  };

  if (deps.argFlag(args, "apply-manifest-hints")) {
    const patchAction = actions.find((a) => a.kind === "suggest.manifest_patch");
    const hints = Array.isArray((patchAction as any)?.hints)
      ? (((patchAction as any).hints as unknown[]).filter((h) => isPlainObject(h)) as Array<
          Record<string, unknown>
        >)
      : [];
    if (!hints.length) {
      (payload as any).manifest_apply = {
        applied: true,
        changed: false,
        file: filePath,
        applied_count: 0,
        summaries: ["skip: no manifest patch hints available"],
        diff: "(no changes)",
      };
    } else {
      (payload as any).manifest_apply = applyManifestPatchHintsToFile(filePath, manifest, hints);
    }
  }

  const outPath = deps.argString(args, "out");
  const rendered = `${JSON.stringify(payload, null, 2)}\n`;
  if (outPath) {
    const target = path.resolve(process.cwd(), outPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, rendered);
    console.log(`AI plan exported: ${target}`);
    return;
  }
  if (deps.argFlag(args, "json")) {
    console.log(rendered.trimEnd());
    return;
  }
  if ((payload as any).manifest_apply) {
    const apply = (payload as any).manifest_apply as Record<string, unknown>;
    console.log(
      [
        "Manifest hints apply:",
        `File: ${String(apply.file || filePath)}`,
        `Changed: ${String(Boolean(apply.changed))}`,
        `Applied hints: ${String(apply.applied_count || 0)}`,
        ...(Array.isArray(apply.summaries)
          ? (apply.summaries as unknown[]).map((s) => `- ${String(s)}`)
          : []),
        "Diff:",
        String(apply.diff || "(no diff)"),
        "",
      ].join("\n"),
    );
  }
  console.log(
    [
      `AI plan (${mode}, read-only)`,
      `Manifest: ${payload.source.manifest_path}`,
      `Slug: ${String(payload.context.summary.slug || "n/a")}`,
      `Proposed actions: ${payload.actions.length}`,
    ].join("\n"),
  );
}

export function runAiCheckCommand(args: CliArgsLike, deps: AiCommandDeps) {
  const subcommand = deps.argString(args, "_subcommand");
  if (subcommand !== "check") {
    throw deps.makeCliError("CLI_INVALID_ARGS", "Missing required subcommand: ai plan|check");
  }
  const mode = parseAiMode(args, deps);
  const planFile = deps.argString(args, "plan");
  if (!planFile) {
    throw deps.makeCliError("CLI_INVALID_ARGS", "Missing required argument: --plan <plan.json>");
  }
  const payload = deps.readJsonFile(planFile);
  const policyFile = deps.argString(args, "policy");
  const policyPreset = deps.argString(args, "policy-preset");
  if (policyFile && policyPreset) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Use either --policy <policy.json> or --policy-preset <name>, not both",
    );
  }
  let policy: AiCheckPolicy | null = null;
  if (policyFile) {
    policy = parseAiCheckPolicy(deps.readJsonFile(policyFile), policyFile, deps);
  } else if (policyPreset) {
    policy = buildAiCheckPolicyPreset(policyPreset, deps);
  }

  const checks: Array<{ key: string; ok: boolean; details?: Record<string, unknown> }> = [];
  const plan = isPlainObject(payload) ? payload : {};
  checks.push({
    key: "schema_version",
    ok: plan.schema_version === "xapps.ai.plan.v1",
    details: { actual: plan.schema_version || null },
  });
  checks.push({
    key: "mode",
    ok: plan.mode === mode,
    details: { actual: plan.mode || null, expected: mode },
  });
  checks.push({
    key: "read_only",
    ok: plan.read_only === true,
    details: { actual: plan.read_only ?? null },
  });
  checks.push({
    key: "actions_array",
    ok: Array.isArray(plan.actions),
    details: { actualType: Array.isArray(plan.actions) ? "array" : typeof plan.actions },
  });

  if (policy) {
    const requireReadOnly = policy.require_read_only !== false;
    checks.push({
      key: "policy_require_read_only",
      ok: !requireReadOnly || plan.read_only === true,
      details: { required: requireReadOnly, actual: plan.read_only ?? null },
    });
    if (typeof policy.max_actions === "number" && Number.isFinite(policy.max_actions)) {
      const actionCount = Array.isArray(plan.actions) ? plan.actions.length : 0;
      checks.push({
        key: "policy_max_actions",
        ok: actionCount <= policy.max_actions,
        details: { max_actions: policy.max_actions, actual: actionCount },
      });
    }
    if (Array.isArray(policy.allow_action_kinds)) {
      const allowed = new Set(
        policy.allow_action_kinds
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean),
      );
      const disallowedKinds = Array.isArray(plan.actions)
        ? plan.actions
            .filter((item): item is Record<string, unknown> => isPlainObject(item))
            .map((item) => String(item.kind || "").trim())
            .filter((kind) => kind && !allowed.has(kind))
        : [];
      checks.push({
        key: "policy_allow_action_kinds",
        ok: disallowedKinds.length === 0,
        details: { disallowed_kinds: disallowedKinds },
      });
    }
  }

  const result = {
    schema_version: "xapps.ai.check.v1",
    ok: checks.every((check) => check.ok),
    mode,
    read_only: true,
    checks,
    errors: checks
      .filter((check) => !check.ok)
      .map((check) => ({ code: "CLI_AI_PLAN_INVALID", check: check.key })),
    ...(policy
      ? {
          policy: {
            applied: true,
            ...(policyFile ? { source: path.resolve(process.cwd(), policyFile) } : {}),
            ...(policyPreset ? { preset: String(policyPreset).trim().toLowerCase() } : {}),
          },
        }
      : {}),
  };
  const outPath = deps.argString(args, "out");
  const rendered = `${JSON.stringify(result, null, 2)}\n`;
  if (outPath) {
    const target = path.resolve(process.cwd(), outPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, rendered);
    console.log(`AI check exported: ${target}`);
  } else if (deps.argFlag(args, "json")) {
    console.log(rendered.trimEnd());
  } else {
    console.log(
      [
        `AI check (${mode}) ${result.ok ? "PASS" : "FAIL"}`,
        ...checks.map((check) => `${check.ok ? "OK" : "FAIL"}  ${check.key}`),
      ].join("\n"),
    );
  }
  if (!result.ok) {
    throw deps.makeCliError("CLI_AI_PLAN_INVALID", "xapps ai check failed: invalid plan contract", {
      checks,
    });
  }
}
