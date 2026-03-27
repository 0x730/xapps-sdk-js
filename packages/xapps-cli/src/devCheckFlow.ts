import { spawnSync } from "node:child_process";
import path from "node:path";
import type { DevFlowDefinition } from "./devFlow.js";

function shellEscapeArg(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

export function buildBuiltInDevCheckFlows(
  artifactsDir: string,
): Record<string, Omit<DevFlowDefinition, "key">> {
  const xplacePlanPath = path.join(artifactsDir, "xapps-xplace-certs.plan.json");
  const xplaceCheckPath = path.join(artifactsDir, "xapps-xplace-certs.check.json");
  return {
    "pay-per-request": {
      title: "Pay-per-request baseline flow",
      description:
        "Verifies guarded payment orchestration baseline across widget/guards/contracts for V1.",
      commands: [
        "npm test -- src/__tests__/guardBeforeToolRun.test.ts",
        "npm test -- src/__tests__/widgetSdk.test.ts src/__tests__/extensionsLabJsonformsPayment.e2e.test.ts",
        "npm test -- src/__tests__/openapiErrorContract.test.ts",
      ],
      refs: [
        "dev/engineering/audits/V1_PRODUCTION_CODEBASE_REVIEW.md",
        "dev/engineering/pm/OPEN_LIST.md",
      ],
    },
    "guard-orchestration": {
      title: "Guard orchestration bridge flow",
      description:
        "Verifies blocked/confirm/payment orchestration bridge behavior across host/embed guard paths.",
      commands: [
        "npm test -- src/__tests__/guardContractParity.test.ts src/__tests__/integrationHostGuardContracts.test.ts",
        "npm test -- src/__tests__/widgetRuntime.guardBridge.test.ts",
        "npx playwright test e2e/extensions-guards.spec.ts --grep orchestration|guard",
      ],
      refs: [
        "dev/engineering/audits/V1_PRODUCTION_CODEBASE_REVIEW.md",
        "dev/engineering/pm/OPEN_POINTS.md",
      ],
    },
    "xplace-certs": {
      title: "xplace certs first-xapp internal workflow",
      description:
        "Validates and inspects the xplace-certs JSON Forms manifest using internal-repo CLI helpers.",
      commands: [
        "npm run xapps -- validate --from apps/publishers/xplace/xapps/xplace-certs/manifest.json",
        `npm run xapps -- ai plan --mode internal --from apps/publishers/xplace/xapps/xplace-certs/manifest.json --preset internal-v1 --flow xplace-certs --json --out ${shellEscapeArg(xplacePlanPath)}`,
        `npm run xapps -- ai check --mode internal --plan ${shellEscapeArg(xplacePlanPath)} --policy apps/publishers/xplace/xapps/xplace-certs/ai/policy.readonly.internal-v1.json --json --out ${shellEscapeArg(xplaceCheckPath)}`,
      ],
      refs: [
        "apps/publishers/xplace/xapps/xplace-certs/manifest.json",
        "apps/publishers/xplace/xapps/xplace-certs/ai/policy.readonly.internal-v1.json",
        "apps/publishers/xplace/backend/server.js",
        "dev/engineering/audits/OPEN_067_PHASE1_INTERNAL_REPO_PLAN.md",
      ],
    },
  };
}

export type DevCheckFlowRunResult = {
  command: string;
  ok: boolean;
  exit_code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error: string | null;
};

export function executeDevCheckFlowCommands(
  commands: string[],
  repoRoot: string,
): DevCheckFlowRunResult[] {
  return commands.map((command) => {
    const parts = String(command).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return {
        command,
        ok: false,
        exit_code: null,
        signal: null,
        stdout: "",
        stderr: "",
        error: "empty_command",
      };
    }
    const result = spawnSync(parts[0], parts.slice(1), {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    return {
      command,
      ok: (result.status ?? 1) === 0 && !result.error,
      exit_code: result.status ?? null,
      signal: result.signal ?? null,
      stdout: String(result.stdout || ""),
      stderr: String(result.stderr || ""),
      error: result.error ? String(result.error.message || result.error) : null,
    };
  });
}
