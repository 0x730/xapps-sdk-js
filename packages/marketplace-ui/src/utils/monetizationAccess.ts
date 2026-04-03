import type { MarketplaceMonetizationAccessProjection } from "../types";
import { readString } from "./readers";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readCurrentAccessFlag(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

export function hasMarketplaceCatalogMonetization(manifest: unknown): boolean {
  const manifestRecord = asRecord(manifest);
  const monetization = asRecord(manifestRecord?.monetization);
  if (!monetization) return false;
  return ["products", "offerings", "packages", "prices"].some((key) => {
    const items = monetization[key];
    return Array.isArray(items) && items.length > 0;
  });
}

export function hasMarketplaceCurrentAccess(
  projection: MarketplaceMonetizationAccessProjection | null | undefined,
): boolean {
  if (!projection) return false;
  if (readCurrentAccessFlag(projection.has_current_access)) return true;

  const entitlementState = readString(projection.entitlement_state);
  const balanceState = readString(projection.balance_state);
  return (
    entitlementState === "active" ||
    entitlementState === "grace_period" ||
    balanceState === "sufficient"
  );
}

export function resolveMarketplaceAccessState(input: {
  projection: MarketplaceMonetizationAccessProjection | null | undefined;
  hasCatalogMonetization?: boolean;
  availableLabel: string;
}): string | null {
  const entitlementState = readString(input.projection?.entitlement_state);
  if (entitlementState && entitlementState !== "inactive") return entitlementState;
  return hasMarketplaceCurrentAccess(input.projection)
    ? input.availableLabel
    : entitlementState || null;
}

export function resolveMarketplaceDefaultAccessState(input: {
  projection: MarketplaceMonetizationAccessProjection | null | undefined;
  hasCatalogMonetization?: boolean;
  availableLabel: string;
}): string | null {
  const resolved = resolveMarketplaceAccessState(input);
  if (resolved && resolved !== "inactive") return resolved;
  if (input.projection && input.hasCatalogMonetization === false) {
    return input.availableLabel;
  }
  return resolved;
}
