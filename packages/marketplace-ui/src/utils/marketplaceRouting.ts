function trimTrailingSlash(pathname: string): string {
  const normalized = String(pathname || "").trim() || "/";
  if (normalized === "/") return "/";
  return normalized.replace(/\/+$/, "") || "/";
}

const MARKETPLACE_ROUTE_SUFFIX_RE =
  /\/(?:publishers(?:\/[^/]+)?|xapps\/[^/]+(?:\/plans)?|requests(?:\/[^/]+)?|monetization|payments|invoices|notifications|widget\/[^/]+\/[^/]+|widgets\/[^/]+)$/;

export function resolveMarketplaceBasePath(pathname: string): string {
  const normalized = trimTrailingSlash(pathname);
  const stripped = normalized.replace(MARKETPLACE_ROUTE_SUFFIX_RE, "");
  return stripped || "/";
}

export function buildMarketplaceSearch(params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    query.set(key, normalized);
  }
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export function joinMarketplacePath(basePath: string, relativePath = ""): string {
  const normalizedBase = trimTrailingSlash(basePath);
  const normalizedRelative = String(relativePath || "")
    .replace(/^\/+/, "")
    .trim();
  if (!normalizedRelative) return normalizedBase;
  return normalizedBase === "/"
    ? `/${normalizedRelative}`
    : `${normalizedBase}/${normalizedRelative}`;
}

export function buildMarketplaceHref(
  pathname: string,
  relativePath: string,
  params: Record<string, string | null | undefined> = {},
): { pathname: string; search: string } {
  const basePath = resolveMarketplaceBasePath(pathname);
  return {
    pathname: joinMarketplacePath(basePath, relativePath),
    search: buildMarketplaceSearch(params),
  };
}
