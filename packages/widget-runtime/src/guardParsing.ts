import type { GuardUiDescriptor } from "./types";
import { asRecord, readBool, readFirstString, readTrimmedString } from "./runtimeReaders";

export type GuardBlockedState = {
  guardSlug: string;
  trigger: string;
  message: string;
  uiRequired: boolean;
  action: Record<string, unknown>;
  details: Record<string, unknown>;
  guardUi: GuardUiDescriptor | null;
};

export function readGuardBlocked(input: unknown): GuardBlockedState | null {
  const source = asRecord(input);
  const body = source.data ? asRecord(source.data) : source;
  const envelope = asRecord(body.error);
  const guard = asRecord(body.guard);
  const details = asRecord(body.details);
  const guardDetails = asRecord(guard.details);
  const mergedDetails = Object.keys(details).length ? details : guardDetails;
  const code = readFirstString(body.code, envelope.code, source.code);
  if (code !== "GUARD_BLOCKED") return null;

  const guardSlug = readFirstString(body.guardSlug, body.guard_slug, guard.slug) || "unknown";
  const trigger = readFirstString(body.trigger, guard.trigger) || "before:tool_run";
  const message =
    readFirstString(body.message, envelope.message, source.message) || "Guard action required";

  const action = asRecord(body.action);
  const guardAction = asRecord(guard.action);
  const detailsAction = asRecord(mergedDetails.action);
  const effectiveAction = Object.keys(action).length
    ? action
    : Object.keys(guardAction).length
      ? guardAction
      : detailsAction;
  const actionKind = readTrimmedString(effectiveAction.kind).toLowerCase();
  const uiRequired =
    readBool(mergedDetails.uiRequired) ||
    actionKind === "open_guard" ||
    actionKind === "complete_payment" ||
    actionKind === "confirm_action" ||
    actionKind === "step_up_auth";
  const guardUi = asRecord(mergedDetails.guard_ui);
  const contractVersion = readTrimmedString(guardUi.contract_version);

  return {
    guardSlug,
    trigger,
    message,
    uiRequired,
    action: effectiveAction,
    details: mergedDetails,
    guardUi: contractVersion
      ? ({ ...guardUi, contract_version: contractVersion } as GuardUiDescriptor)
      : null,
  };
}

export function readGuardChallengeToken(details: unknown): string | null {
  const orchestration = asRecord(asRecord(details).orchestration);
  const challenge = orchestration.challenge;
  if (typeof challenge === "string" && challenge.trim()) return challenge.trim();
  if (challenge && typeof challenge === "object") {
    const token = readTrimmedString(asRecord(challenge).token);
    if (token) return token;
  }
  return null;
}
