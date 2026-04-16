import type { MarketplaceInstallationPolicy } from "../types";

export function shouldHideMarketplaceVersions(input: {
  installationPolicy?: MarketplaceInstallationPolicy | null;
  installationPolicyResolved?: boolean;
  subjectId?: string | null;
}): boolean {
  const installationPolicyResolved = input.installationPolicyResolved !== false;
  if (!installationPolicyResolved) return false;
  return (
    input.installationPolicy?.mode === "auto_available" &&
    input.installationPolicy?.update_mode === "auto_update_compatible"
  );
}
