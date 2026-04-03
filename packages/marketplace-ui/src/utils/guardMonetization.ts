function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function readGuardMonetizationState(input: unknown): Record<string, unknown> | null {
  const root = asRecord(input);
  const details = asRecord(root.details);
  const guard = asRecord(root.guard);
  const guardDetails = asRecord(guard.details);
  const candidates = [
    asRecord(root.monetization_state),
    asRecord(details.monetization_state),
    asRecord(guardDetails.monetization_state),
  ];
  for (const candidate of candidates) {
    if (Object.keys(candidate).length > 0) return candidate;
  }
  return null;
}

export function readGuardHasCurrentAccess(input: unknown): boolean | null {
  const value = readGuardMonetizationState(input)?.has_current_access;
  return typeof value === "boolean" ? value : null;
}

export function describeGuardCurrentAccess(
  input: unknown,
  labels: { available: string; unavailable: string },
): string {
  const hasCurrentAccess = readGuardHasCurrentAccess(input);
  if (hasCurrentAccess === null) return "";
  return hasCurrentAccess ? labels.available : labels.unavailable;
}
