import fs from "node:fs";
import http, { type IncomingMessage } from "node:http";
import path from "node:path";
import {
  buildDevFlowInitTemplate as buildDevFlowInitTemplateBase,
  lintDevFlowDefinition,
  parseDevFlowObject,
} from "../devFlow.js";
import { buildBuiltInDevCheckFlows, executeDevCheckFlowCommands } from "../devCheckFlow.js";
import { runAiCheckCommand, runAiPlanCommand } from "../aiCommands.js";
import { runDevCheckV1Command, runDevStatusRefsCommand } from "../devStatus.js";
import { buildContextExportPayload, buildInternalV1ContextPreset } from "../contextCommands.js";
import {
  runPublisherEndpointCredentialEnsureCommand,
  runPublisherEndpointCredentialSetCommand,
} from "../publisherCommands.js";

type CliArgValue = string | boolean | string[];
type CliArgs = Record<string, CliArgValue>;

type ParsedManifest = {
  slug: string;
  tools: Array<unknown>;
  widgets: Array<unknown>;
};

type DevCommandDeps = {
  argString: (args: CliArgs, ...keys: string[]) => string | undefined;
  argFlag: (args: CliArgs, key: string) => boolean;
  shellEscapeArg: (value: string) => string;
  applyFlowCommandTemplates: (command: string, params: { artifactsDir: string }) => string;
  findRepoRoot: (startDir?: string) => string | null;
  readJsonFile: (file: string) => unknown;
  parseManifestFromFile: (from: string) => { manifest: ParsedManifest; filePath: string };
  runDryRun: (args: CliArgs, manifest: ParsedManifest) => void;
  buildDevRefs: (input: { repoRoot: string; manifestPath?: string | null }) => string[];
  canonicalizeJson: (value: unknown) => unknown;
  readRequestBody: (req: IncomingMessage) => Promise<unknown>;
  makeCliError: (code: string, message: string, details?: Record<string, unknown>) => Error;
};

export function runDevStatusRefsCliCommand(args: CliArgs, deps: DevCommandDeps) {
  runDevStatusRefsCommand(args, {
    argFlag: deps.argFlag,
    findRepoRoot: deps.findRepoRoot,
    makeCliError: deps.makeCliError,
  });
}

export function runDevCheckV1CliCommand(args: CliArgs, deps: DevCommandDeps) {
  runDevCheckV1Command(args, {
    argFlag: deps.argFlag,
    findRepoRoot: deps.findRepoRoot,
    makeCliError: deps.makeCliError,
  });
}

export function runDevCheckFlowCliCommand(args: CliArgs, deps: DevCommandDeps) {
  const repoRoot = deps.findRepoRoot();
  if (!repoRoot) {
    throw deps.makeCliError(
      "CLI_REPO_NOT_FOUND",
      "xapps dev check flow is repo-only and requires the xapps monorepo checkout",
    );
  }
  const flowFile = deps.argString(args, "from");
  const flowName = deps.argString(args, "name");
  if (!flowFile && !flowName) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Missing required argument: --name <flow> or --from <flow.json>",
    );
  }
  if (flowFile && flowName) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Use either --name <flow> or --from <flow.json>, not both",
    );
  }
  const normalized = flowName ? flowName.trim().toLowerCase() : null;
  const artifactsDirRaw = deps.argString(args, "artifacts-dir");
  const artifactsDir = artifactsDirRaw
    ? path.resolve(repoRoot, String(artifactsDirRaw).trim())
    : "/tmp";
  const plans = buildBuiltInDevCheckFlows(artifactsDir);
  let selectedFlow:
    | { key: string; title: string; description: string; commands: string[]; refs: string[] }
    | undefined;
  const readFlowFromFile = (inputFlowFile: string) => {
    const filePath = path.resolve(repoRoot, inputFlowFile);
    const parsed = deps.readJsonFile(filePath);
    const parsedFlow = parseDevFlowObject(parsed, path.basename(filePath));
    if (parsedFlow.errors.length) {
      throw deps.makeCliError(
        "CLI_INVALID_OPTION",
        `Invalid flow file: ${inputFlowFile} (${parsedFlow.errors.join(",")})`,
        {
          label: "--from",
          value: inputFlowFile,
          errors: parsedFlow.errors,
        },
      );
    }
    return {
      filePath,
      flow: parsedFlow.flow,
    };
  };
  if (flowFile) {
    selectedFlow = readFlowFromFile(flowFile).flow;
  } else {
    const plan = normalized ? plans[normalized] : undefined;
    if (!plan) {
      throw deps.makeCliError("CLI_INVALID_OPTION", `Unknown flow: ${flowName}`, {
        label: "--name",
        value: flowName,
        allowed: Object.keys(plans),
      });
    }
    selectedFlow = { key: normalized!, ...plan };
  }
  const resolvedCommands = selectedFlow.commands.map((cmd) =>
    deps.applyFlowCommandTemplates(cmd, { artifactsDir }),
  );
  const payload: Record<string, unknown> = {
    schema_version: "xapps.dev.check.flow.v1",
    ok: true,
    repo_root: repoRoot,
    flow: selectedFlow.key,
    artifacts_dir: artifactsDir,
    title: selectedFlow.title,
    description: selectedFlow.description,
    commands: resolvedCommands,
    refs: selectedFlow.refs,
    ...(flowFile ? { flow_file: path.relative(repoRoot, path.resolve(repoRoot, flowFile)) } : {}),
  };
  if (deps.argFlag(args, "run")) {
    try {
      fs.mkdirSync(artifactsDir, { recursive: true });
    } catch (error) {
      throw deps.makeCliError(
        "CLI_DEV_CHECK_FAILED",
        `Unable to prepare artifacts directory: ${artifactsDir}`,
        {
          flow: normalized || "",
          artifacts_dir: artifactsDir,
          error: String((error as Error)?.message || error),
        },
      );
    }
  }
  if (deps.argFlag(args, "run")) {
    const runs = executeDevCheckFlowCommands(resolvedCommands, repoRoot);
    const runSummary = {
      executed: true,
      ok: runs.every((run) => run.ok),
      runs,
    };
    payload.run = runSummary;
    payload.ok = runSummary.ok;
  }
  if (deps.argFlag(args, "json")) {
    console.log(JSON.stringify(payload, null, 2));
    if (!payload.ok) {
      throw deps.makeCliError(
        "CLI_DEV_CHECK_FAILED",
        `xapps dev check flow failed: ${String(selectedFlow.key || normalized || "unknown")}`,
        {
          flow: String(selectedFlow.key || normalized || ""),
        },
      );
    }
    return;
  }
  console.log(
    [
      `Flow check plan: ${payload.flow}`,
      `Title: ${payload.title}`,
      `Description: ${payload.description}`,
      "Commands:",
      ...(payload.commands as string[]).map((cmd) => `- ${cmd}`),
      ...(payload.run && typeof payload.run === "object" && Array.isArray((payload.run as any).runs)
        ? [
            "Run results:",
            ...((payload.run as any).runs as any[]).map(
              (run) => `- ${run.ok ? "OK" : "FAIL"} (${run.exit_code ?? "?"}) ${run.command}`,
            ),
          ]
        : []),
      "Refs:",
      ...(payload.refs as string[]).map((ref) => `- ${ref}`),
    ].join("\n"),
  );
  if (!payload.ok) {
    throw deps.makeCliError(
      "CLI_DEV_CHECK_FAILED",
      `xapps dev check flow failed: ${String(selectedFlow.key || normalized || "unknown")}`,
      {
        flow: String(selectedFlow.key || normalized || ""),
      },
    );
  }
}

export function runDevCheckFlowLintCliCommand(args: CliArgs, deps: DevCommandDeps) {
  const repoRoot = deps.findRepoRoot();
  if (!repoRoot) {
    throw deps.makeCliError(
      "CLI_REPO_NOT_FOUND",
      "xapps dev check flow lint is repo-only and requires the xapps monorepo checkout",
    );
  }
  const flowFile = deps.argString(args, "from");
  if (!flowFile) {
    throw deps.makeCliError("CLI_INVALID_ARGS", "Missing required argument: --from <flow.json>");
  }
  const filePath = path.resolve(repoRoot, flowFile);
  const parsed = deps.readJsonFile(filePath);
  const parsedFlow = parseDevFlowObject(parsed, path.basename(filePath));
  if (parsedFlow.errors.length) {
    throw deps.makeCliError(
      "CLI_INVALID_OPTION",
      `Invalid flow file: ${flowFile} (${parsedFlow.errors.join(",")})`,
      {
        label: "--from",
        value: flowFile,
        errors: parsedFlow.errors,
      },
    );
  }
  const checks = lintDevFlowDefinition(parsedFlow.flow);
  const payload = {
    schema_version: "xapps.dev.check.flow.lint.v1",
    ok: checks.every((c) => c.ok),
    repo_root: repoRoot,
    flow_file: path.relative(repoRoot, filePath),
    flow: parsedFlow.flow.key || null,
    checks,
  };
  if (deps.argFlag(args, "json")) {
    console.log(JSON.stringify(payload, null, 2));
    if (!payload.ok) {
      throw deps.makeCliError("CLI_DEV_CHECK_FAILED", "xapps dev check flow lint failed", {
        flow_file: payload.flow_file,
        checks,
      });
    }
    return;
  }
  console.log(
    [
      `Flow lint: ${payload.ok ? "PASS" : "FAIL"}`,
      `Flow file: ${payload.flow_file}`,
      `Flow: ${payload.flow || "n/a"}`,
      ...checks.map((c) => `${c.ok ? "OK" : "FAIL"}  ${c.key}`),
    ].join("\n"),
  );
  if (!payload.ok) {
    throw deps.makeCliError("CLI_DEV_CHECK_FAILED", "xapps dev check flow lint failed", {
      flow_file: payload.flow_file,
      checks,
    });
  }
}

function buildDevFlowInitTemplate(type: string, makeCliError: DevCommandDeps["makeCliError"]) {
  const template = buildDevFlowInitTemplateBase(type);
  if (template) return template;
  throw makeCliError("CLI_INVALID_OPTION", `Unknown flow template type: ${type}`, {
    label: "--type",
    value: type,
    allowed: ["ai-artifacts", "manual-loop"],
  });
}

export function runDevCheckFlowInitCliCommand(args: CliArgs, deps: DevCommandDeps) {
  const repoRoot = deps.findRepoRoot();
  if (!repoRoot) {
    throw deps.makeCliError(
      "CLI_REPO_NOT_FOUND",
      "Could not locate repo root for xapps dev check flow init",
    );
  }
  const out = deps.argString(args, "out");
  if (!out) {
    throw deps.makeCliError("CLI_INVALID_ARGS", "Missing required argument: --out <flow.json>");
  }
  const type = deps.argString(args, "type");
  if (!type) {
    throw deps.makeCliError(
      "CLI_INVALID_ARGS",
      "Missing required argument: --type <ai-artifacts|manual-loop>",
    );
  }
  const normalizedType = String(type).trim().toLowerCase();
  const flowTemplate = buildDevFlowInitTemplate(type, deps.makeCliError);
  const flowId = deps.argString(args, "flow-id");
  if (flowId && String(flowId).trim()) {
    flowTemplate.flow = String(flowId).trim();
  }
  const manifestPathArg = deps.argString(args, "manifest");
  const policyPathArg = deps.argString(args, "policy");
  const smokeScriptArg = deps.argString(args, "smoke-script");
  if (normalizedType === "ai-artifacts") {
    const manifestPath = manifestPathArg ? String(manifestPathArg).trim() : "";
    const policyPath = policyPathArg ? String(policyPathArg).trim() : "";
    if (manifestPath) {
      flowTemplate.commands = flowTemplate.commands.map((cmd) =>
        cmd.replaceAll("./manifest.json", manifestPath),
      );
      flowTemplate.refs = flowTemplate.refs.map((ref) =>
        ref === "./manifest.json" ? manifestPath : ref,
      );
    }
    if (policyPath) {
      flowTemplate.commands = flowTemplate.commands.map((cmd) =>
        cmd.replaceAll(
          "--policy-preset internal-readonly",
          `--policy ${deps.shellEscapeArg(policyPath)}`,
        ),
      );
      flowTemplate.refs = flowTemplate.refs.map((ref) =>
        ref === "./ai/policy.readonly.internal-v1.json" ? policyPath : ref,
      );
    }
  }
  if (normalizedType === "manual-loop") {
    const smokeScriptPath = smokeScriptArg ? String(smokeScriptArg).trim() : "";
    if (smokeScriptPath) {
      flowTemplate.commands = [`node ${deps.shellEscapeArg(smokeScriptPath)}`];
      flowTemplate.refs = flowTemplate.refs.map((ref) =>
        ref === "./scripts/manual-loop-smoke.mjs" ? smokeScriptPath : ref,
      );
    }
  }
  const target = path.resolve(process.cwd(), out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const rendered = `${JSON.stringify(flowTemplate, null, 2)}\n`;
  fs.writeFileSync(target, rendered);
  const payload = {
    schema_version: "xapps.dev.check.flow.init.v1",
    ok: true,
    type: String(type).trim().toLowerCase(),
    out: target,
    flow: flowTemplate.flow,
    ...(manifestPathArg ? { manifest: String(manifestPathArg).trim() } : {}),
    ...(policyPathArg ? { policy: String(policyPathArg).trim() } : {}),
    ...(smokeScriptArg ? { smoke_script: String(smokeScriptArg).trim() } : {}),
  };
  if (deps.argFlag(args, "json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`Flow template created: ${target}\nType: ${payload.type}\nFlow: ${payload.flow}`);
}

export async function runAiPlanCliCommand(args: CliArgs, deps: DevCommandDeps) {
  await runAiPlanCommand(args, {
    argString: deps.argString,
    argFlag: deps.argFlag,
    findRepoRoot: deps.findRepoRoot,
    parseManifestFromFile: deps.parseManifestFromFile,
    buildContextExportPayload: (manifest, filePath) =>
      buildContextExportPayload(manifest, filePath, {
        canonicalizeJson: deps.canonicalizeJson,
      }) as Record<string, unknown>,
    buildDevRefs: deps.buildDevRefs,
    buildInternalV1ContextPreset: (repoRoot) =>
      buildInternalV1ContextPreset(repoRoot, { buildDevRefs: deps.buildDevRefs }) as Record<
        string,
        unknown
      >,
    readJsonFile: deps.readJsonFile,
    makeCliError: deps.makeCliError,
  });
}

export async function runAiCheckCliCommand(args: CliArgs, deps: DevCommandDeps) {
  await runAiCheckCommand(args, {
    argString: deps.argString,
    argFlag: deps.argFlag,
    findRepoRoot: deps.findRepoRoot,
    parseManifestFromFile: deps.parseManifestFromFile,
    buildContextExportPayload: (manifest, filePath) =>
      buildContextExportPayload(manifest, filePath, {
        canonicalizeJson: deps.canonicalizeJson,
      }) as Record<string, unknown>,
    buildDevRefs: deps.buildDevRefs,
    buildInternalV1ContextPreset: (repoRoot) =>
      buildInternalV1ContextPreset(repoRoot, { buildDevRefs: deps.buildDevRefs }) as Record<
        string,
        unknown
      >,
    readJsonFile: deps.readJsonFile,
    makeCliError: deps.makeCliError,
  });
}

export async function runPublisherCliCommand(args: CliArgs, deps: DevCommandDeps) {
  const subcommand = deps.argString(args, "_subcommand");
  const subcommand2 = deps.argString(args, "_subcommand2");
  const subcommand3 = deps.argString(args, "_subcommand3");
  if (subcommand === "endpoint" && subcommand2 === "credential" && subcommand3 === "set") {
    await runPublisherEndpointCredentialSetCommand(args, {
      argString: deps.argString,
      argFlag: deps.argFlag,
      makeCliError: deps.makeCliError,
    });
    return;
  }
  if (subcommand === "endpoint" && subcommand2 === "credential" && subcommand3 === "ensure") {
    await runPublisherEndpointCredentialEnsureCommand(args, {
      argString: deps.argString,
      argFlag: deps.argFlag,
      makeCliError: deps.makeCliError,
    });
    return;
  }
  throw deps.makeCliError(
    "CLI_INVALID_ARGS",
    "Missing required subcommand: publisher endpoint credential set|ensure",
  );
}

export async function runDevCommand(args: CliArgs, deps: DevCommandDeps) {
  const subcommand = deps.argString(args, "_subcommand");
  const subcommand2 = deps.argString(args, "_subcommand2");
  if (subcommand === "status" && subcommand2 === "refs") {
    runDevStatusRefsCliCommand(args, deps);
    return;
  }
  if (subcommand === "check" && subcommand2 === "v1") {
    runDevCheckV1CliCommand(args, deps);
    return;
  }
  if (subcommand === "check" && subcommand2 === "flow") {
    if (deps.argString(args, "_subcommand3") === "init") {
      runDevCheckFlowInitCliCommand(args, deps);
      return;
    }
    if (deps.argString(args, "_subcommand3") === "lint") {
      runDevCheckFlowLintCliCommand(args, deps);
      return;
    }
    runDevCheckFlowCliCommand(args, deps);
    return;
  }

  const from = deps.argString(args, "from");
  if (!from) {
    throw new Error("Missing required argument: --from <manifest.json>");
  }

  const once = deps.argFlag(args, "once");
  const watchEnabled = !deps.argFlag(args, "no-watch");
  const host = deps.argString(args, "host") || "127.0.0.1";
  const port = Number(deps.argString(args, "port") || "4011");

  const first = deps.parseManifestFromFile(from);
  console.log(
    `Dev manifest loaded: ${first.filePath}\nSlug: ${first.manifest.slug}\nTools: ${first.manifest.tools.length}\nWidgets: ${first.manifest.widgets.length}`,
  );
  deps.runDryRun(args, first.manifest);

  if (once) return;

  const manifestPath = first.filePath;
  let currentManifest = first.manifest;
  let watchTimer: NodeJS.Timeout | null = null;
  const watcher = watchEnabled
    ? fs.watch(manifestPath, () => {
        if (watchTimer) clearTimeout(watchTimer);
        watchTimer = setTimeout(() => {
          try {
            const parsed = deps.parseManifestFromFile(manifestPath);
            currentManifest = parsed.manifest;
            console.log(
              `Manifest revalidated: ${parsed.filePath}\nSlug: ${parsed.manifest.slug}\nTools: ${parsed.manifest.tools.length}\nWidgets: ${parsed.manifest.widgets.length}`,
            );
          } catch (err: any) {
            console.error(`Manifest validation failed: ${err?.message || String(err)}`);
          }
        }, 120);
      })
    : null;

  const server = http.createServer(async (req, res) => {
    const method = (req.method || "GET").toUpperCase();
    const url = req.url || "/";
    const eventMatch = /^\/v1\/requests\/([^/]+)\/events\/?$/.exec(url);
    const completeMatch = /^\/v1\/requests\/([^/]+)\/complete\/?$/.exec(url);

    if (method === "POST" && (eventMatch || completeMatch)) {
      const requestId = decodeURIComponent((eventMatch || completeMatch)![1]);
      const payload = await deps.readRequestBody(req);
      const kind = eventMatch ? "event" : "complete";
      const payloadText = JSON.stringify(payload);
      console.log(
        `[dev-callback] ${kind} request_id=${requestId} slug=${currentManifest.slug} payload=${payloadText}`,
      );
      const response = {
        ok: true,
        simulated: true,
        kind,
        request_id: requestId,
      };
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(response));
      return;
    }

    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(
    `xapps dev running\nManifest watch: ${watchEnabled ? "on" : "off"}\nMock callbacks: http://${host}:${port}\nEndpoints: POST /v1/requests/:id/events and POST /v1/requests/:id/complete`,
  );

  await new Promise<void>((resolve) => {
    const shutdown = () => {
      if (watchTimer) {
        clearTimeout(watchTimer);
      }
      watcher?.close();
      server.close(() => resolve());
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}
