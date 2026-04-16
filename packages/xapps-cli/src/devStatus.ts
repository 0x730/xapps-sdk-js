import fs from "node:fs";
import path from "node:path";

type CliArgsLike = Record<string, string | boolean>;
type CliErrorFactory = (code: string, message: string, details?: Record<string, unknown>) => Error;

export type DevRefStatus = {
  key: string;
  path: string;
  exists: boolean;
};

type DevStatusDeps = {
  argFlag: (args: CliArgsLike, key: string) => boolean;
  findRepoRoot: (startDir?: string) => string | null;
  makeCliError: CliErrorFactory;
};

export function buildDevRefs(repoRoot: string): DevRefStatus[] {
  const refs = [
    ["pm_readme", "dev/engineering/pm/README.md"],
    ["open_points", "dev/engineering/pm/OPEN_POINTS.md"],
    ["open_list", "dev/engineering/pm/OPEN_LIST.md"],
    ["open_list_v2", "dev/engineering/pm/OPEN_LIST_V2.md"],
    ["sprint_plan", "dev/engineering/pm/SPRINT_PLAN.md"],
    ["next_steps", "dev/engineering/pm/NEXT_STEPS.md"],
    ["done_points", "dev/engineering/pm/DONE_POINTS.md"],
    ["v1_review_audit", "dev/engineering/audits/V1_PRODUCTION_CODEBASE_REVIEW.md"],
    ["open067_phase1_plan", "dev/engineering/audits/OPEN_067_PHASE1_INTERNAL_REPO_PLAN.md"],
    ["sdk_cli_ai_checklist", "dev/engineering/checklists/SDK_CLI_AI_CHECKLIST.md"],
  ] as const;
  return refs.map(([key, rel]) => ({
    key,
    path: rel,
    exists: fs.existsSync(path.join(repoRoot, rel)),
  }));
}

export function runDevStatusRefsCommand(args: CliArgsLike, deps: DevStatusDeps) {
  const repoRoot = deps.findRepoRoot();
  if (!repoRoot) {
    throw deps.makeCliError(
      "CLI_REPO_NOT_FOUND",
      "xapps dev status refs is repo-only and requires the xapps monorepo checkout",
    );
  }
  const refs = buildDevRefs(repoRoot);
  const sampleXplace = {
    publisher: {
      server: "apps/publishers/xplace/backend/server.js",
      readme: "apps/publishers/xplace/backend/README.md",
    },
    xapp: {
      manifest: "apps/publishers/xplace-example/xapps/xplace-certs/manifest.json",
      ai_policy:
        "apps/publishers/xplace-example/xapps/xplace-certs/ai/policy.readonly.internal-v1.json",
    },
  };
  const sampleStatus = {
    xplace_certs: {
      publisher: Object.fromEntries(
        Object.entries(sampleXplace.publisher).map(([key, rel]) => [
          key,
          { path: rel, exists: fs.existsSync(path.join(repoRoot, rel)) },
        ]),
      ),
      xapp: Object.fromEntries(
        Object.entries(sampleXplace.xapp).map(([key, rel]) => [
          key,
          { path: rel, exists: fs.existsSync(path.join(repoRoot, rel)) },
        ]),
      ),
      defaults: {
        publisher_base_url: "http://localhost:3012",
        gateway_base_url: "http://localhost:3000",
      },
    },
  };
  const payload = {
    schema_version: "xapps.dev.status.refs.v1",
    ok: refs.every((ref) => ref.exists),
    repo_root: repoRoot,
    refs,
    samples: sampleStatus,
  };
  if (deps.argFlag(args, "json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    [
      `Repo root: ${repoRoot}`,
      ...refs.map((ref) => `${ref.exists ? "OK" : "MISS"}  ${ref.key} -> ${ref.path}`),
      "Sample refs:",
      ...Object.entries(sampleStatus.xplace_certs.publisher).map(
        ([key, item]) =>
          `${(item as any).exists ? "OK" : "MISS"}  xplace.publisher.${key} -> ${(item as any).path}`,
      ),
      ...Object.entries(sampleStatus.xplace_certs.xapp).map(
        ([key, item]) =>
          `${(item as any).exists ? "OK" : "MISS"}  xplace.xapp.${key} -> ${(item as any).path}`,
      ),
    ].join("\n"),
  );
}

export function runDevCheckV1Command(args: CliArgsLike, deps: DevStatusDeps) {
  const repoRoot = deps.findRepoRoot();
  if (!repoRoot) {
    throw deps.makeCliError(
      "CLI_REPO_NOT_FOUND",
      "xapps dev check v1 is repo-only and requires the xapps monorepo checkout",
    );
  }
  const refs = buildDevRefs(repoRoot);
  const mustRead = (relPath: string) => fs.readFileSync(path.join(repoRoot, relPath), "utf8");
  const openList = mustRead("dev/engineering/pm/OPEN_LIST.md");
  const sprintPlan = mustRead("dev/engineering/pm/SPRINT_PLAN.md");
  const checks = [
    {
      key: "refs_exist",
      ok: refs.every((ref) => ref.exists),
      details: { missing: refs.filter((ref) => !ref.exists).map((ref) => ref.path) },
    },
    {
      key: "v1_list_has_must_have_section",
      ok: /Must Have for First Publisher \/ xplace/i.test(openList),
      details: {},
    },
    {
      key: "sprint_plan_has_scope_rules",
      ok:
        /Scope Proposal Discipline Rule/i.test(sprintPlan) &&
        /Documentation Scope Rule/i.test(sprintPlan),
      details: {},
    },
    {
      key: "pm_readme_exists",
      ok: fs.existsSync(path.join(repoRoot, "dev/engineering/pm/README.md")),
      details: {},
    },
  ];
  const payload = {
    schema_version: "xapps.dev.check.v1",
    ok: checks.every((check) => check.ok),
    repo_root: repoRoot,
    checks,
    suggested_flows: ["pay-per-request", "guard-orchestration", "xplace-certs"],
  };
  if (deps.argFlag(args, "json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    [
      `V1 check: ${payload.ok ? "PASS" : "FAIL"}`,
      ...checks.map((check) => `${check.ok ? "OK" : "FAIL"}  ${check.key}`),
    ].join("\n"),
  );
  if (!payload.ok) {
    throw deps.makeCliError("CLI_DEV_CHECK_FAILED", "xapps dev check v1 failed", { checks });
  }
}
