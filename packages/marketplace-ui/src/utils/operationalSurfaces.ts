import type {
  CatalogXappDetail,
  MarketplaceClient,
  MarketplaceEnv,
  OperationalSurfacePlacement,
  OperationalSurfacesDescriptor,
} from "../types";

export type OperationalSurfaceKey = keyof OperationalSurfacesDescriptor;

function readPathEmbedded(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/embed");
}

export function getOperationalSurfaces(
  detail: CatalogXappDetail | null | undefined,
): OperationalSurfacesDescriptor | null {
  const value = detail?.operational_surfaces;
  if (!value || typeof value !== "object") return null;
  return value;
}

function readOperationalSurfaceMode(input: {
  env?: MarketplaceEnv;
  isEmbedded: boolean;
}): "contract" | "testing_all" {
  const policy = input.env?.operationalSurfacesVisibility;
  return input.isEmbedded ? (policy?.embed ?? "contract") : (policy?.portal ?? "contract");
}

export function isOperationalSurfaceVisible(
  detail: CatalogXappDetail | null | undefined,
  surface: OperationalSurfaceKey,
  options?: { isEmbedded?: boolean },
): boolean {
  const surfaces = getOperationalSurfaces(detail);
  const descriptor = surfaces?.[surface];
  if (!descriptor?.enabled) return false;
  const isEmbedded = options?.isEmbedded ?? readPathEmbedded();
  return isEmbedded ? descriptor.visibility.embed : descriptor.visibility.portal;
}

export function surfaceClientAvailable(
  client: MarketplaceClient,
  surface: OperationalSurfaceKey,
): boolean {
  if (surface === "requests") return typeof client.listMyRequests === "function";
  if (surface === "payments") return typeof client.listMyPaymentSessions === "function";
  if (surface === "invoices") return typeof client.listMyInvoices === "function";
  if (surface === "notifications") return typeof client.listMyNotifications === "function";
  return false;
}

export function buildOperationalSurfaceHref(input: {
  surface: OperationalSurfaceKey;
  xappId: string;
  installationId?: string;
  requestId?: string;
  paymentSessionId?: string;
  invoiceId?: string;
  notificationId?: string;
  token?: string;
  isEmbedded?: boolean;
}): string {
  const isEmbedded = input.isEmbedded ?? readPathEmbedded();
  const params = new URLSearchParams({
    xappId: input.xappId,
    ...(input.installationId ? { installationId: input.installationId } : {}),
    ...(input.paymentSessionId ? { paymentSessionId: input.paymentSessionId } : {}),
    ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
    ...(input.notificationId ? { notificationId: input.notificationId } : {}),
    ...(input.token ? { token: input.token } : {}),
  });
  const base = isEmbedded ? `/${input.surface}` : `/marketplace/${input.surface}`;
  const detailSegment =
    input.surface === "requests" && input.requestId
      ? `/${encodeURIComponent(input.requestId)}`
      : "";
  return `${base}${detailSegment}?${params.toString()}`;
}

export function getVisibleOperationalSurfaces(input: {
  detail: CatalogXappDetail | null | undefined;
  client: MarketplaceClient;
  env?: MarketplaceEnv;
  isEmbedded?: boolean;
}): OperationalSurfaceKey[] {
  const isEmbedded = input.isEmbedded ?? readPathEmbedded();
  const mode = readOperationalSurfaceMode({
    env: input.env,
    isEmbedded,
  });
  const allSurfaces = [
    "requests",
    "payments",
    "invoices",
    "notifications",
  ] as OperationalSurfaceKey[];
  if (mode === "testing_all") {
    return allSurfaces.filter((surface) => {
      if (surface === "requests" && input.env?.requestsEnabled === false) return false;
      return surfaceClientAvailable(input.client, surface);
    });
  }
  const surfaces = getOperationalSurfaces(input.detail);
  if (!surfaces) return [];
  return allSurfaces.filter(
    (surface) =>
      surfaceClientAvailable(input.client, surface) &&
      isOperationalSurfaceVisible(input.detail, surface, { isEmbedded }),
  );
}

export function getOperationalSurfaceLabel(surface: OperationalSurfaceKey): string {
  if (surface === "requests") return "Requests";
  if (surface === "payments") return "Payments";
  if (surface === "invoices") return "Invoices";
  return "Notifications";
}

export function resolveOperationalSurfacePlacement(input: {
  env?: MarketplaceEnv;
  surface: OperationalSurfaceKey;
  isEmbedded?: boolean;
}): OperationalSurfacePlacement {
  const isEmbedded = input.isEmbedded ?? readPathEmbedded();
  const policy = input.env?.operationalSurfacePlacement;
  const scopePolicy = isEmbedded ? policy?.embed : policy?.portal;
  const bySurface = scopePolicy?.bySurface?.[input.surface];
  if (bySurface) return bySurface;
  return scopePolicy?.default ?? "in_router";
}

export async function discoverOperationalSurfaceData(input: {
  client: MarketplaceClient;
  xappId: string;
  installationId?: string | null;
}): Promise<OperationalSurfaceKey[]> {
  const xappId = String(input.xappId || "").trim();
  const installationId = String(input.installationId || "").trim();
  if (!xappId) return [];

  const queryBase = {
    xappId,
    ...(installationId ? { installationId } : {}),
  };

  const checks = await Promise.all([
    (async (): Promise<OperationalSurfaceKey | null> => {
      if (typeof input.client.listMyPaymentSessions !== "function") return null;
      try {
        const res = await input.client.listMyPaymentSessions({
          ...queryBase,
          limit: 1,
        });
        return Array.isArray(res?.items) && res.items.length > 0 ? "payments" : null;
      } catch {
        return null;
      }
    })(),
    (async (): Promise<OperationalSurfaceKey | null> => {
      if (typeof input.client.listMyInvoices !== "function") return null;
      try {
        const res = await input.client.listMyInvoices({
          ...queryBase,
          page: 1,
          pageSize: 1,
        });
        return Array.isArray(res?.items) && res.items.length > 0 ? "invoices" : null;
      } catch {
        return null;
      }
    })(),
    (async (): Promise<OperationalSurfaceKey | null> => {
      if (typeof input.client.listMyNotifications !== "function") return null;
      try {
        const res = await input.client.listMyNotifications({
          ...queryBase,
          limit: 1,
        });
        return (Array.isArray(res?.items) && res.items.length > 0) ||
          Number(res?.unread_count || 0) > 0
          ? "notifications"
          : null;
      } catch {
        return null;
      }
    })(),
  ]);

  return checks.filter((surface): surface is OperationalSurfaceKey => Boolean(surface));
}
