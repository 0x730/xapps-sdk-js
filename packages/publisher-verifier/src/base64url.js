export function base64urlToBuf(s) {
  // Accept unpadded base64url.
  const str = String(s || "");
  if (!str) return Buffer.alloc(0);
  if (str.length % 4 === 1) throw new Error("Invalid base64url length");
  const pad = str.length % 4 === 2 ? "==" : str.length % 4 === 3 ? "=" : "";
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

export function bufToBase64url(buf) {
  return Buffer.from(buf || Buffer.alloc(0))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
