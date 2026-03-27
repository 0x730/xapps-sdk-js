# `@xapps-platform/cli`

Developer CLI for Xapps manifest workflows.

Current source/package note:

- monorepo source path: `packages/xapps-cli`
- workspace package name: `@xapps-platform/cli`
- public release name: `@xapps-platform/cli`

## Supported Surface

Public/stable publish workflow subset:

- `xapps import --from <openapi> --out <manifest.json> [--fetch-timeout-ms <n>]`
- `xapps init --out <directory>`
- `xapps validate --from <manifest.json>`
- `xapps test --from <manifest.json> --vectors <vectors.json>`
- `xapps publish --from <manifest.json> [--yes] [--out <file-or-dir>] [--dry-run] [--publish-url <url>] [--publisher-gateway-url <url>] [--target-client-slug <slug>] [--token <token>] [--api-key <key>] [--signing-key <key>] [--version-conflict <fail|allow>] [--release-channel <name>] [--registry-target <name>] [--idempotency-key <key>] [--timeout-ms <n>] [--retry-attempts <n>] [--retry-backoff-ms <n>]`
- `xapps logs [--from <bundle.json> | --dir <path>] [--limit <n>] [--json] [--logs-url <url>] [--token <token>] [--api-key <key>] [--cursor <value>] [--lease-id <value>] [--checkpoint <value>] [--severity <value>] [--since <iso>] [--until <iso>] [--follow] [--follow-interval-ms <n>] [--follow-max-cycles <n>] [--follow-cursor-file <path>] [--timeout-ms <n>] [--retry-attempts <n>] [--retry-backoff-ms <n>]`
- `xapps publisher endpoint credential set --gateway-url <url> [--endpoint-id <id> | --xapp-slug <slug> --env <env>] --auth-type <api-key|...> --header-name <name> (--secret-env <ENV> | --secret-stdin | --secret-ref <ref>) [--api-key <key> | --token <token>] [--json]`
- `xapps publisher endpoint credential ensure --gateway-url <url> [--endpoint-id <id> | --xapp-slug <slug> --env <env>] --auth-type <api-key|...> --header-name <name> (--secret-env <ENV> | --secret-stdin | --secret-ref <ref>) [--api-key <key> | --token <token>] [--json]`

Repo-only/internal helpers stay available but are not part of the supported public package contract.

Current proven checkpoint:

- Repo automation currently depends on:
  - `xapps validate`
  - `xapps publish`
  - `xapps publisher endpoint credential ensure`
- Built-package smoke currently verifies:
  - `xapps init`
  - `xapps import`
  - `xapps validate`
  - `xapps test`
  - `xapps publish`
  - `xapps logs`
- Packed-artifact smoke now verifies the same local publish subset from the packed tarball entrypoint and also exercises the remote publisher/gateway flow for:
  - `xapps publish --publisher-gateway-url ... --target-client-slug ...`
  - `xapps publisher endpoint credential ensure --gateway-url ... --xapp-slug ... --target-client-slug ...`
- Manifest validation on the supported surface now comes from the shared `@xapps-platform/xapp-manifest` package, re-exported through `@xapps-platform/server-sdk`.
- Source-level CLI tests already cover:
  - `xapps import`
  - `xapps test`
  - `xapps logs`
  - `xapps publisher endpoint credential set`
- `xapps publisher endpoint credential ensure`

Smoke commands:

```bash
npm run smoke --workspace packages/xapps-cli
npm run smoke:packed --workspace packages/xapps-cli
```

## Install

```bash
npm install -D @xapps-platform/cli
```

Note:

- This package is now in first public release-candidate shape for the supported non-breaking publish subset.
- This README documents only that supported external contract; it does not claim the whole CLI surface is public/stable.

## Commands (baseline)

- `xapps import --from <openapi> --out <manifest.json> [--fetch-timeout-ms <n>]`
- `xapps init --out <directory>`
- `xapps validate --from <manifest.json>`
- `xapps dev --from <manifest.json> [--dry-run <request.json>]` (local helper; not part of the supported public package contract)
- `xapps dev status refs [--json]` (internal-repo helper)
- `xapps dev check v1 [--json]` (internal-repo helper)
- `xapps dev check flow --name <pay-per-request|guard-orchestration|xplace-certs> [--json] [--run] [--artifacts-dir <dir>]` (internal-repo helper)
- `xapps dev check flow --from <flow.json> [--json] [--run] [--artifacts-dir <dir>]` (custom app-owned flow file)
- `xapps dev check flow init --out <flow.json> --type <ai-artifacts|manual-loop> [--flow-id <id>] [--manifest <path>] [--policy <path>] [--smoke-script <path>] [--json]` (starter template generator)
- `xapps dev check flow lint --from <flow.json> [--json]` (custom flow sanity checks)
- `xapps test --from <manifest.json> --vectors <vectors.json>`
- `xapps publish --from <manifest.json> [--yes] [--out <file-or-dir>] [--dry-run] [--publish-url <url>] [--publisher-gateway-url <url>] [--target-client-slug <slug>] [--token <token>] [--api-key <key>] [--signing-key <key>] [--version-conflict <fail|allow>] [--release-channel <name>] [--registry-target <name>] [--idempotency-key <key>] [--timeout-ms <n>] [--retry-attempts <n>] [--retry-backoff-ms <n>]`
- `xapps logs [--from <bundle.json> | --dir <path>] [--limit <n>] [--json] [--logs-url <url>] [--token <token>] [--api-key <key>] [--cursor <value>] [--lease-id <value>] [--checkpoint <value>] [--severity <value>] [--since <iso>] [--until <iso>] [--follow] [--follow-interval-ms <n>] [--follow-max-cycles <n>] [--follow-cursor-file <path>] [--timeout-ms <n>] [--retry-attempts <n>] [--retry-backoff-ms <n>]`
- `xapps context export --from <manifest.json> [--out <file>] [--preset <internal-v1>]` (internal preset is repo-only)
- `xapps tunnel --target <base-url> [--allow-target-hosts <csv>] [--session-id <id>] [--session-file <path>] [--session-policy <reuse|require|rotate>] [--listen-port <port>] [--host <host>] [--require-auth-token <tok>] [--upstream-timeout-ms <n>] [--retry-attempts <n>] [--retry-backoff-ms <n>]` (local relay helper; not part of the supported public package contract)
- `xapps ai plan --mode internal --from <manifest.json> [--json] [--mocks-dir <dir> | --mocks <csv>] [--guidance <text> | --guidance-file <file> | --ask-guidance] [--llm] [--llm-model <model>] [--llm-api-key <key>] [--llm-base-url <url>] [--llm-timeout-ms <n>] [--apply-manifest-hints]` (mock-aware plan + optional LLM suggestions; apply is optional)
- `xapps ai check --mode internal --plan <plan.json> [--policy <policy.json> | --policy-preset <internal-readonly>] [--json]` (read-only internal check)
- `xapps publisher endpoint credential set --gateway-url <url> [--endpoint-id <id> | --xapp-slug <slug> --env <env>] --auth-type <api-key|...> --header-name <name> (--secret-env <ENV> | --secret-stdin | --secret-ref <ref>) [--api-key <key> | --token <token>] [--json]`
- `xapps publisher endpoint credential ensure --gateway-url <url> [--endpoint-id <id> | --xapp-slug <slug> --env <env>] --auth-type <api-key|...> --header-name <name> (--secret-env <ENV> | --secret-stdin | --secret-ref <ref>) [--api-key <key> | --token <token>] [--json]`

## Notes

- Shared auth profiles are supported via `~/.xapps/config` JSON and per-command `--profile` (or env `XAPPS_CLI_PROFILE`).
- Remote auth supports Bearer (`--token` / `XAPPS_CLI_TOKEN`) and API key (`--api-key` / `XAPPS_CLI_API_KEY`) headers.
- Precedence is `CLI flags > env vars > selected profile`.
- Publish now includes explicit release confirmation; in non-interactive flows use `--yes`.
- Publish is tenant-aware: set `manifest.target_client_id`, or (when using `--publisher-gateway-url`) pass `--target-client-slug <slug>` to resolve the tenant and inject `target_client_id` at publish time.
- Publish can sign remote metadata headers with `--signing-key` and applies explicit version-conflict policy via `--version-conflict`.
- Publish release/registry handoff baseline: `--release-channel` and `--registry-target` are carried in signed metadata, payload release envelope, and remote handoff headers.
  - Env/profile support: `XAPPS_CLI_RELEASE_CHANNEL` and `XAPPS_CLI_REGISTRY_TARGET` with precedence `flags > env > profile`.
- CLI failures expose stable machine-readable `error.code` values (for example `CLI_INVALID_OPTION`, `CLI_REMOTE_LOGS_ERROR`, `CLI_CONFIRM_REQUIRED`).
- Remote publish outcome contract baseline: `created`, `updated`, `already_exists` (other outcomes fail with `CLI_REMOTE_PUBLISH_ACK_INVALID`).
- Provider interop baseline: publish ack parser accepts canonical flat or nested (`ack`/`data`/`publish`/`release`) outcome fields and normalizes common aliases (for example `exists` -> `already_exists`).
- CI behavior: version-conflict in `fail` mode exits with code `3` (`[CLI_VERSION_CONFLICT]`).
- Logs durable follow/resume contract: `--follow-cursor-file` persists `next_cursor` state and auto-resumes on subsequent runs.
- Managed logs resume baseline: `lease_id` + `checkpoint` are accepted from remote responses and replayed on next poll/run (via `--follow-cursor-file` or explicit `--lease-id`/`--checkpoint` flags).
- `context export` emits deterministic JSON context (`schema_version=xapps.context.v1`) for automation/agent workflows.
  - Phase-1 internal preset: `--preset internal-v1` adds canonical refs/spec/test anchors for monorepo workflows.
  - Useful with the first publisher path sample: `apps/publishers/xplace/xapps/xplace-certs/manifest.json`
- Tunnel contract now includes explicit target-host allowlist enforcement and stable session identity (`--session-id` / `--session-file`) with runtime status endpoint `GET /__status`.
- Tunnel session lifecycle baseline now supports `--session-policy` (`reuse|require|rotate`) with deterministic conflict/target-mismatch handling for reconnect safety.
- `dev` v0 includes:
  - manifest watch + revalidation
  - local callback simulation for `/v1/requests/:id/events` and `/v1/requests/:id/complete`
  - dry-run payload inspection
  - internal-repo helper subcommands:
    - `status refs` (prints canonical PM/audit/checklist refs)
    - `check v1` (machine-readable V1 baseline repo-check summary)
    - `check flow --name ...` (predefined flow verification command plans)
    - `check flow --from <flow.json>` (load custom app/team flow definitions; preferred for app-specific workflows)
    - optional `--run` executes the predefined flow command set and returns aggregated result
    - optional `--artifacts-dir` redirects generated flow artifacts (for example `xplace-certs` AI plan/check JSON outputs)
    - `xapps dev check flow init` generates starter JSON flow files so custom app workflows live outside CLI core
    - optional prefill flags reduce edits for real app/workspace flows (`--manifest`, `--policy`, `--smoke-script`, `--flow-id`)
    - `xapps dev check flow lint` validates custom flow shape/command hygiene before running it
- `ai` Phase-1 internal-mode baseline includes machine-readable plan/check contracts:
  - `ai plan` emits deterministic machine-readable plan contract (`xapps.ai.plan.v1`)
    - mock-aware for JSON Forms (`--mocks-dir` / `--mocks`) and can emit `suggest.manifest_patch` hints for `input_schema` and `input_ui_schema`
    - `--ask-guidance` prompts for a one-line instruction in TTY mode (for example: infer complete fields from mockups, build a step wizard, add supported preview sections, exclude payment screens handled by guards)
    - `--llm` enables OpenAI-compatible manifest suggestions (default model `gpt-5.2`, override with `--llm-model` or `XAPPS_AI_MODEL`)
    - LLM auth/base URL can be provided via `--llm-api-key` / `--llm-base-url` or env (`OPENAI_API_KEY`, `XAPPS_AI_API_KEY`, `OPENAI_BASE_URL`)
    - remote import fetches default to `--fetch-timeout-ms 10000`; LLM calls default to `--llm-timeout-ms 30000` (or env `XAPPS_AI_TIMEOUT_MS`)
    - if LLM is unavailable or returns incomplete image-mock hints, CLI falls back to heuristic suggestions and reports `llm_error`
    - `--apply-manifest-hints` validates and writes suggested manifest patches (optional; review-only usage is supported by default)
  - `ai check` validates plan contract shape in read-only internal mode (`xapps.ai.check.v1`)
    - use `--policy-preset internal-readonly` for quick internal checks
    - use `--policy <file>` for app-specific stricter allowlists (for example `xplace-certs`)
- `test` baseline validates vectors against manifest schemas and tool names.
- `publish` baseline creates a local `bundle.json` artifact and can optionally POST it to a remote endpoint (`--publish-url`) for CI/CD handoff, with timeout + retry/backoff controls.
- Payment provider credential bundle placeholders are supported via repeated `--replace-env` mappings before publish (for example `payment_provider_credentials_refs` placeholders in policy manifests).
- `logs` baseline reads local publish-bundle history and can optionally query a remote logs endpoint (`--logs-url`) with timeout + retry/backoff controls.
- `tunnel` baseline is a local relay (not a public ngrok-style tunnel yet) and supports optional inbound token enforcement (`--require-auth-token`), local readiness probe (`/__ready`), upstream timeout handling, and transient retries for idempotent methods.
- See DX status/checklist: `docs/guides/14-sdk-cli-ai-checklist.md`.

### Profile Config Schema

Path: `~/.xapps/config`

```json
{
  "version": 1,
  "profiles": {
    "default": { "token": "pat_xxx", "apiKey": "xapps_key_xxx" },
    "ci": { "token": "pat_ci_xxx" }
  }
}
```

Rules:

- `version: 1` is current baseline schema.
- `profiles` is a map keyed by profile name.
- Additive schema evolution is expected; unknown keys are ignored.
- Effective precedence remains `flags > env > profile`.

### Command/Auth Matrix

| Command   | Remote knobs                                                                 | Auth/profile                        | Intended rollout              |
| --------- | ---------------------------------------------------------------------------- | ----------------------------------- | ----------------------------- |
| `publish` | `--publish-url` + release routing (`--release-channel`, `--registry-target`) | flags/env/profile                   | CI release handoff            |
| `logs`    | `--logs-url`                                                                 | flags/env/profile                   | Operator triage follow/resume |
| `tunnel`  | `--target` (+ local relay settings)                                          | profile + inbound auth token policy | Local integration debugging   |

Adoption policy:

1. Document examples for `publish`, `logs`, and `tunnel` together for operator parity.
2. Keep precedence explicit (`flags > env > profile`) in remote examples.
3. Use machine-readable codes/exit behavior for CI branching.

## `ai plan` Examples (Mock-Aware / LLM)

Review-only heuristic suggestions (no API key):

```bash
xapps ai plan \
  --mode internal \
  --from ./manifest.json \
  --mocks-dir ./mocks \
  --ask-guidance \
  --json
```

Review-only LLM suggestions (OpenAI-compatible; default model `gpt-5.2`):

```bash
export OPENAI_API_KEY=...
export XAPPS_AI_MODEL=gpt-5.2
export XAPPS_AI_TIMEOUT_MS=30000

xapps ai plan \
  --mode internal \
  --from ./manifest.json \
  --mocks-dir ./mocks \
  --guidance "Infer the complete form fields from these mockups, build a step wizard, add supported widget preview sections, and exclude payment screens because payment is handled by guards." \
  --llm \
  --llm-timeout-ms 30000 \
  --json
```

Optional provider overrides:

```bash
xapps ai plan \
  --mode internal \
  --from ./manifest.json \
  --mocks-dir ./mocks \
  --llm \
  --llm-model gpt-5.2 \
  --llm-base-url https://api.openai.com/v1 \
  --llm-api-key "$OPENAI_API_KEY" \
  --json
```

Optional apply mode (validates manifest before write):

```bash
xapps ai plan \
  --mode internal \
  --from ./manifest.json \
  --mocks-dir ./mocks \
  --guidance "Infer the complete form fields from these mockups, build a step wizard, add supported widget preview sections, and exclude payment screens because payment is handled by guards." \
  --llm \
  --apply-manifest-hints \
  --json
```

## CI Cookbook

### Provider credential bundle placeholders

When manifests contain provider credential ref placeholders (for example in
`payment_provider_credentials_refs`), resolve them at publish time:

```bash
xapps publish \
  --yes \
  --from ./manifest.json \
  --replace-env __GATEWAY_STRIPE_SECRET_REF__=GATEWAY_STRIPE_SECRET_REF \
  --replace-env __GATEWAY_STRIPE_WEBHOOK_SECRET_REF__=GATEWAY_STRIPE_WEBHOOK_SECRET_REF \
  --replace-env __GATEWAY_PAYPAL_CHECKOUT_BASE_URL_REF__=GATEWAY_PAYPAL_CHECKOUT_BASE_URL_REF
```

### 1) Strict release (fail on existing version)

```bash
xapps publish \
  --yes \
  --from ./manifest.json \
  --publish-url "$PUBLISH_URL" \
  --token "$XAPPS_CLI_TOKEN" \
  --version-conflict fail
```

Note: publish is tenant-aware. For `--publish-url`, set `target_client_id` in the manifest. For `--publisher-gateway-url`, you can alternatively use `--target-client-slug <tenant-slug>`.

Behavior:

- Exit `0` on success (`created` or `updated`).
- Exit `3` on `already_exists` conflict (`[CLI_VERSION_CONFLICT]`).

### 2) Idempotent release (allow existing version)

```bash
xapps publish \
  --yes \
  --from ./manifest.json \
  --publish-url "$PUBLISH_URL" \
  --token "$XAPPS_CLI_TOKEN" \
  --version-conflict allow
```

Note: publish is tenant-aware. For `--publish-url`, set `target_client_id` in the manifest. For `--publisher-gateway-url`, you can alternatively use `--target-client-slug <tenant-slug>`.

Behavior:

- Exit `0` on `created`, `updated`, or `already_exists`.

### 3) Conflict-aware shell flow

```bash
set +e
xapps publish --yes --from ./manifest.json --publish-url "$PUBLISH_URL" --version-conflict fail
status=$?
set -e

if [ "$status" -eq 3 ]; then
  echo "Version already exists, skipping release step."
elif [ "$status" -ne 0 ]; then
  echo "Publish failed with code $status"
  exit "$status"
fi
```

### 4) Machine-Readable Error Codes

| Code                                 | Meaning                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `CLI_UNKNOWN_COMMAND`                | Command is not recognized.                                                          |
| `CLI_INVALID_ARGS`                   | Required args are missing.                                                          |
| `CLI_INVALID_OPTION`                 | Option value is invalid.                                                            |
| `CLI_INVALID_JSON`                   | JSON file/payload parse failure.                                                    |
| `CLI_CONFIG_INVALID`                 | Profile config file is malformed.                                                   |
| `CLI_PROFILE_NOT_FOUND`              | Selected profile is missing in config.                                              |
| `CLI_CONFIRM_REQUIRED`               | `publish` needs confirmation in non-interactive mode (`--yes`).                     |
| `CLI_CONFIRM_DECLINED`               | Interactive publish confirmation was declined.                                      |
| `CLI_VERSION_CONFLICT`               | Remote publish returned `already_exists` with conflict mode `fail` (exit code `3`). |
| `CLI_REMOTE_PUBLISH_ERROR`           | Remote publish request/response failed.                                             |
| `CLI_REMOTE_PUBLISH_ACK_INVALID`     | Remote publish ack had unsupported outcome contract.                                |
| `CLI_REMOTE_LOGS_ERROR`              | Remote logs request/response failed.                                                |
| `CLI_BUNDLE_NOT_FOUND`               | Local publish bundle path/directory had no usable entries.                          |
| `CLI_CURSOR_STATE_IO`                | Cursor state file read/write failure for logs follow-resume.                        |
| `CLI_TUNNEL_TARGET_NOT_ALLOWED`      | Tunnel target host is outside allowlist policy.                                     |
| `CLI_TUNNEL_SESSION_IO`              | Tunnel session file read/write failure.                                             |
| `CLI_TUNNEL_SESSION_REQUIRED`        | `--session-policy require` used without persisted or explicit session id.           |
| `CLI_TUNNEL_SESSION_CONFLICT`        | Explicit `--session-id` conflicts with persisted session identity.                  |
| `CLI_TUNNEL_SESSION_TARGET_MISMATCH` | Persisted session target differs from current `--target` under strict policy.       |
| `CLI_RUNTIME_ERROR`                  | Fallback unexpected runtime error.                                                  |

## Operator Cookbook

### Supported tenant/publisher workflow

Supported external operator subset:

- `xapps init`
- `xapps import`
- `xapps validate`
- `xapps test`
- `xapps publish`
- `xapps logs`
- `xapps publisher endpoint credential set`
- `xapps publisher endpoint credential ensure`

Repo-only helpers (`dev`, `ai`, `context export --preset internal-v1`, `tunnel`) stay available
but are not part of the supported tenant/publisher publish contract.

### Recommended sequence

1. Create or import a manifest.
2. Validate it.
3. Run `xapps test` when you have contract vectors.
4. Publish locally or to the remote gateway/publish target.
5. Ensure endpoint credentials for secured publisher endpoints.
6. Use `xapps logs` for local bundle history or remote triage.

### Authoring baseline

```bash
xapps init --out ./my-xapp
xapps validate --from ./my-xapp/manifest.json
```

### OpenAPI import baseline

```bash
xapps import --from ./openapi.yaml --out ./manifest.json
xapps validate --from ./manifest.json
```

### A) Local Handoff (no remote services)

```bash
# 1) Generate and validate
xapps import --from ./openapi.yaml --out ./manifest.json
xapps validate --from ./manifest.json
xapps test --from ./manifest.json --vectors ./vectors.json

# 2) Package local artifact
xapps publish --from ./manifest.json --out ./artifacts/xapps-publish/bundle.json

# 3) Inspect local history
xapps logs --from ./artifacts/xapps-publish/bundle.json --json
```

Note: local bundle packaging still enforces tenant-aware publish requirements (`target_client_id` in the manifest).

### B) CI Handoff (remote publish)

```bash
xapps publish \
  --yes \
  --from ./manifest.json \
  --publish-url "$PUBLISH_URL" \
  --token "$XAPPS_CLI_TOKEN" \
  --idempotency-key "$CI_PIPELINE_ID" \
  --version-conflict fail
```

Use `--version-conflict allow` for idempotent release semantics.

### B.1) Internal Local Gateway Publish (publisher routes)

```bash
xapps publish \
  --yes \
  --from ./manifest.json \
  --publisher-gateway-url http://localhost:3000 \
  --target-client-slug xconect \
  --api-key "$PUBLISHER_API_KEY"
```

This uses the gateway publisher API routes (`/publisher/import-manifest` and
`/publisher/xapp-versions/:id/publish`) and still writes the local `bundle.json` artifact.
`--target-client-slug` resolves the tenant via `/v1/publisher/clients` and injects `target_client_id` for the publish payload/bundle.

### B.2) Internal Publisher Endpoint Credential Ensure (`PUBLISHER_APP` auth)

Preferred normal operator path after publish:

```bash
export XPLACE_XAPP_INGEST_API_KEY=xplace-dev-api-key

xapps publisher endpoint credential ensure \
  --gateway-url http://localhost:3000 \
  --api-key xplace-dev-api-key \
  --xapp-slug xplace-weather-now \
  --env prod \
  --auth-type api-key \
  --header-name x-xplace-api-key \
  --secret-env XPLACE_XAPP_INGEST_API_KEY \
  --json
```

### B.3) Internal Publisher Endpoint Credential Setup (`PUBLISHER_APP` auth)

Use this after publishing an xapp version to configure the gateway-side endpoint credential
used for `PUBLISHER_APP` dispatch auth.

```bash
export XPLACE_XAPP_INGEST_API_KEY=xplace-dev-api-key

xapps publisher endpoint credential set \
  --gateway-url http://localhost:3000 \
  --api-key xplace-dev-api-key \
  --xapp-slug xplace-weather-now \
  --env prod \
  --auth-type api-key \
  --header-name x-xplace-api-key \
  --secret-env XPLACE_XAPP_INGEST_API_KEY \
  --json
```

This stores the endpoint credential in the gateway (not in the manifest). The CLI redacts secret
material in output and reports only endpoint/credential identifiers and metadata.

### C) Managed Remote Logs Handoff

```bash
xapps logs \
  --logs-url "$LOGS_URL" \
  --token "$XAPPS_CLI_TOKEN" \
  --follow \
  --follow-cursor-file ./.xapps/log-cursor.json \
  --lease-id "$LOG_LEASE_ID" \
  --checkpoint "$LOG_CHECKPOINT" \
  --severity warn \
  --since "2026-01-01T00:00:00Z"
```

### D) Local Tunnel Relay Ops

```bash
# Start relay with stable identity
xapps tunnel \
  --target http://127.0.0.1:9999 \
  --listen-port 4041 \
  --session-file ./.xapps/tunnel-session.json \
  --session-policy reuse \
  --allow-target-hosts 127.0.0.1,localhost

# Runtime status
curl http://127.0.0.1:4041/__status
```

### Recovery Playbook (deterministic)

1. `CLI_VERSION_CONFLICT` (exit `3`)
   - Keep `fail` in strict release pipelines.
   - Switch to `--version-conflict allow` for idempotent promotion jobs.
2. `CLI_REMOTE_PUBLISH_ACK_INVALID`
   - Treat as provider contract drift; do not auto-retry blindly.
   - Capture raw provider response and fail the job.
3. `CLI_REMOTE_LOGS_ERROR`
   - Check retryability metadata and remote status.
   - Keep cursor file unchanged when follow loop fails unexpectedly.
4. `CLI_CURSOR_STATE_IO`
   - Verify cursor path permissions and parent directory existence.
   - Retry after fixing filesystem state.
5. `CLI_TUNNEL_TARGET_NOT_ALLOWED` / `CLI_TUNNEL_SESSION_IO`
   - Update explicit allowlist (`--allow-target-hosts`) or session-file path.
   - Re-run tunnel with corrected policy/path.

### CI Error Handling Pattern

```bash
set +e
output="$(xapps publish --yes --from ./manifest.json --publish-url "$PUBLISH_URL" --version-conflict fail 2>&1)"
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "publish_ok"
elif [ "$status" -eq 3 ] || echo "$output" | grep -q "CLI_VERSION_CONFLICT"; then
  echo "publish_conflict_already_exists"
  exit 0
elif echo "$output" | grep -q "CLI_REMOTE_PUBLISH_ACK_INVALID"; then
  echo "publish_provider_contract_drift"
  exit 1
elif echo "$output" | grep -q "CLI_REMOTE_PUBLISH_ERROR"; then
  echo "publish_remote_transport_failure"
  exit 1
else
  echo "$output"
  exit "$status"
fi
```

## Real-world Flows (Publisher + Tenant)

### 1) Publisher release handoff (conflict-tolerant)

```bash
xapps publish \
  --yes \
  --from ./manifest.json \
  --publish-url "$PUBLISH_URL" \
  --token "$XAPPS_CLI_TOKEN" \
  --release-channel stable \
  --registry-target tenant-a \
  --version-conflict allow
```

### 2) Tenant/operator logs follow resume (multi-run continuity)

```bash
xapps logs \
  --logs-url "$LOGS_URL" \
  --token "$XAPPS_CLI_TOKEN" \
  --follow \
  --follow-cursor-file ./.xapps/logs.state \
  --severity error
```

### 3) Local integration callback debugging (stable tunnel identity)

```bash
xapps tunnel \
  --target http://127.0.0.1:9999 \
  --session-file ./.xapps/tunnel-session.json \
  --session-policy reuse
```
