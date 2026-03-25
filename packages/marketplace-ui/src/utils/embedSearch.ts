export function readHostReturnUrl(search: string): string {
  const qs = new URLSearchParams(String(search || ""));
  return String(qs.get("xapps_host_return_url") || qs.get("xappsHostReturnUrl") || "").trim();
}

export function buildTokenSearch(token: string, search: string): string {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  const hostReturnUrl = readHostReturnUrl(search);
  if (hostReturnUrl) params.set("xapps_host_return_url", hostReturnUrl);
  const out = params.toString();
  return out ? `?${out}` : "";
}
