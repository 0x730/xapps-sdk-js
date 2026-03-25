import crypto from "node:crypto";

export function sha256(buf) {
  return crypto.createHash("sha256").update(Buffer.from(buf)).digest();
}

export function sha256Hex(buf) {
  return sha256(buf).toString("hex");
}
