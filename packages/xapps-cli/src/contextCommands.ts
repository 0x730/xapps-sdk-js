import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { parseXappManifest } from "@xapps-platform/server-sdk";
import type { DevRefStatus } from "./devStatus.js";

type CliArgsLike = Record<string, string | boolean>;
type CliErrorFactory = (code: string, message: string, details?: Record<string, unknown>) => Error;

type ContextToolSummary = {
  tool_name: string;
  title: string;
  input_required: string[];
  output_properties: string[];
};

type ContextWidgetSummary = {
  widget_name: string;
  type: string;
  renderer: string;
  bind_tool_name?: string;
};

type ContextDeps = {
  argString: (args: CliArgsLike, ...keys: string[]) => string | undefined;
  findRepoRoot: (startDir?: string) => string | null;
  parseManifestFromFile: (from: string) => {
    manifest: ReturnType<typeof parseXappManifest>;
    filePath: string;
  };
  buildDevRefs: (repoRoot: string) => DevRefStatus[];
  canonicalizeJson: (value: unknown) => unknown;
  makeCliError: CliErrorFactory;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectContextTools(manifest: ReturnType<typeof parseXappManifest>): ContextToolSummary[] {
  return manifest.tools
    .map((tool) => {
      const inputSchema =
        tool.input_schema && typeof tool.input_schema === "object" ? tool.input_schema : {};
      const outputSchema =
        tool.output_schema && typeof tool.output_schema === "object" ? tool.output_schema : {};
      const requiredRaw = Array.isArray((inputSchema as any).required)
        ? ((inputSchema as any).required as unknown[])
        : [];
      const outputProps = isPlainObject((outputSchema as any).properties)
        ? Object.keys((outputSchema as any).properties)
        : [];
      return {
        tool_name: tool.tool_name,
        title: tool.title || "",
        input_required: requiredRaw
          .filter((item): item is string => typeof item === "string")
          .sort(),
        output_properties: outputProps.sort(),
      };
    })
    .sort((a, b) => a.tool_name.localeCompare(b.tool_name));
}

function collectContextWidgets(
  manifest: ReturnType<typeof parseXappManifest>,
): ContextWidgetSummary[] {
  return manifest.widgets
    .map((widget) => ({
      widget_name: widget.widget_name,
      type: widget.type || "",
      renderer: widget.renderer || "",
      ...(widget.bind_tool_name ? { bind_tool_name: widget.bind_tool_name } : {}),
    }))
    .sort((a, b) => a.widget_name.localeCompare(b.widget_name));
}

export function buildContextExportPayload(
  manifest: ReturnType<typeof parseXappManifest>,
  filePath: string,
  deps: Pick<ContextDeps, "canonicalizeJson">,
): Record<string, unknown> {
  const manifestJson = JSON.stringify(manifest);
  const manifestSha256 = createHash("sha256").update(manifestJson).digest("hex");
  const tools = collectContextTools(manifest);
  const widgets = collectContextWidgets(manifest);
  return {
    schema_version: "xapps.context.v1",
    source: {
      manifest_path: filePath,
      manifest_sha256: manifestSha256,
    },
    summary: {
      name: manifest.name,
      slug: manifest.slug,
      version: manifest.version,
      tools: manifest.tools.length,
      widgets: manifest.widgets.length,
    },
    indexes: {
      tools,
      widgets,
    },
    manifest: deps.canonicalizeJson(manifest),
  };
}

export function buildInternalV1ContextPreset(
  repoRoot: string,
  deps: Pick<ContextDeps, "buildDevRefs">,
): Record<string, unknown> {
  return {
    name: "internal-v1",
    refs: deps.buildDevRefs(repoRoot),
    anchors: {
      specs: [
        "docs/specifications/01-publisher-rendered-integration.md",
        "docs/specifications/02-platform-rendered-integration.md",
        "docs/specifications/04-guard-xapps.md",
        "docs/specifications/10-data-sharing-graph-policy-v2.md",
        "docs/specifications/13-ai-agent-xapp-authoring.md",
      ],
      audits: [
        "dev/engineering/audits/V1_PRODUCTION_CODEBASE_REVIEW.md",
        "dev/engineering/audits/OPEN_067_PHASE1_INTERNAL_REPO_PLAN.md",
      ],
      tests: [
        "src/__tests__/xappsCli.test.ts",
        "src/__tests__/guardBeforeToolRun.test.ts",
        "src/__tests__/openapiErrorContract.test.ts",
      ],
    },
  };
}

export function runContextExportCommand(args: CliArgsLike, deps: ContextDeps) {
  const from = deps.argString(args, "from");
  if (!from) {
    throw new Error("Missing required argument: --from <manifest.json>");
  }
  const { manifest, filePath } = deps.parseManifestFromFile(from);
  const payload = buildContextExportPayload(manifest, filePath, deps) as Record<string, unknown>;
  const preset = deps.argString(args, "preset");
  if (preset) {
    const normalized = preset.trim().toLowerCase();
    if (normalized !== "internal-v1") {
      throw deps.makeCliError(
        "CLI_INVALID_OPTION",
        `Invalid --preset: ${preset} (expected internal-v1)`,
        {
          label: "--preset",
          value: preset,
        },
      );
    }
    const repoRoot = deps.findRepoRoot();
    if (!repoRoot) {
      throw deps.makeCliError(
        "CLI_REPO_NOT_FOUND",
        "xapps context export --preset internal-v1 is repo-only and requires the xapps monorepo checkout",
      );
    }
    payload.preset = buildInternalV1ContextPreset(repoRoot, deps);
  }
  const outPath = deps.argString(args, "out");
  const rendered = `${JSON.stringify(payload, null, 2)}\n`;
  if (outPath) {
    const target = path.resolve(process.cwd(), outPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, rendered);
    console.log(`Context exported: ${target}`);
    return;
  }
  process.stdout.write(rendered);
}
