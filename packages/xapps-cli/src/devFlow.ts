export type DevFlowDefinition = {
  key: string;
  title: string;
  description: string;
  commands: string[];
  refs: string[];
};

export type DevFlowLintCheck = {
  key: string;
  ok: boolean;
  details?: Record<string, unknown>;
};

export function buildDevFlowInitTemplate(type: string): {
  flow: string;
  title: string;
  description: string;
  commands: string[];
  refs: string[];
} | null {
  const normalized = String(type || "")
    .trim()
    .toLowerCase();
  if (normalized === "ai-artifacts") {
    return {
      flow: "sample-ai-artifacts",
      title: "Sample AI plan/check artifacts workflow",
      description:
        "Edit paths for your app and policy. Uses {{ARTIFACTS_DIR}} for generated plan/check reports.",
      commands: [
        "npm run xapps -- validate --from ./manifest.json",
        "npm run xapps -- ai plan --mode internal --from ./manifest.json --preset internal-v1 --json --out {{ARTIFACTS_DIR}}/xapps.plan.json",
        "npm run xapps -- ai check --mode internal --plan {{ARTIFACTS_DIR}}/xapps.plan.json --policy-preset internal-readonly --json --out {{ARTIFACTS_DIR}}/xapps.check.json",
      ],
      refs: [
        "./manifest.json",
        "./ai/policy.readonly.internal-v1.json",
        "dev/engineering/checklists/SDK_CLI_AI_CHECKLIST.md",
      ],
    };
  }
  if (normalized === "manual-loop") {
    return {
      flow: "sample-manual-loop",
      title: "Sample publisher manual response loop smoke",
      description:
        "Edit the smoke script path for your publisher sample/workspace. Intended for async manual-response callback loops.",
      commands: ["node ./scripts/manual-loop-smoke.mjs"],
      refs: ["./scripts/manual-loop-smoke.mjs", "./README.md"],
    };
  }
  return null;
}

export function parseDevFlowObject(
  raw: unknown,
  fallbackFlowId = "",
): { flow: DevFlowDefinition; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      flow: { key: "", title: "", description: "", commands: [], refs: [] },
      errors: ["expected_object"],
    };
  }
  const source = raw as Record<string, unknown>;
  const key = String(source.flow || source.key || fallbackFlowId || "")
    .trim()
    .toLowerCase();
  const title = String(source.title || "").trim();
  const description = String(source.description || "").trim();
  const commands = Array.isArray(source.commands)
    ? source.commands
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
  const refs = Array.isArray(source.refs)
    ? source.refs
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
  if (!key) errors.push("flow_id_missing");
  if (!title) errors.push("title_missing");
  if (!description) errors.push("description_missing");
  if (!commands.length) errors.push("commands_missing");
  return {
    flow: { key, title, description, commands, refs },
    errors,
  };
}

export function lintDevFlowDefinition(flow: DevFlowDefinition): DevFlowLintCheck[] {
  const commands = Array.isArray(flow.commands) ? flow.commands : [];
  return [
    {
      key: "flow_id_present",
      ok: typeof flow.key === "string" && flow.key.trim().length > 0,
      details: { value: flow.key || null },
    },
    {
      key: "title_present",
      ok: typeof flow.title === "string" && flow.title.trim().length > 0,
      details: { value: flow.title || null },
    },
    {
      key: "description_present",
      ok: typeof flow.description === "string" && flow.description.trim().length > 0,
      details: { value: flow.description || null },
    },
    {
      key: "commands_nonempty",
      ok: commands.length > 0,
      details: { command_count: commands.length },
    },
    {
      key: "commands_prefixed",
      ok: commands.every((cmd) => /^(npm|npx|node|pnpm|yarn|bun)\b/.test(String(cmd).trim())),
      details: {
        invalid_commands: commands.filter(
          (cmd) => !/^(npm|npx|node|pnpm|yarn|bun)\b/.test(String(cmd).trim()),
        ),
      },
    },
  ];
}
