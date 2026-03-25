import crypto from "node:crypto";
import { compactVerify, importJWK } from "jose";
import { base64urlToBuf, bufToBase64url } from "./base64url.js";

export async function verifyJwsSubjectProof(input) {
  const subjectActionPayload = String(input?.subjectActionPayload || "");
  const jws = String(input?.jws || "");
  const expectedKid = String(input?.expectedKid || "");
  const publicKeyB64u = String(input?.ed25519PublicKey || "");

  if (!subjectActionPayload) return { ok: false, reason: "missing_subjectActionPayload" };
  if (!jws) return { ok: false, reason: "missing_jws" };
  if (!expectedKid) return { ok: false, reason: "missing_expectedKid" };
  if (!publicKeyB64u) return { ok: false, reason: "missing_ed25519_publicKey" };

  const pkBytes = base64urlToBuf(publicKeyB64u);
  if (pkBytes.length !== 32) return { ok: false, reason: "invalid_ed25519_publicKey_length" };

  const jwk = {
    kty: "OKP",
    crv: "Ed25519",
    x: bufToBase64url(pkBytes),
    kid: expectedKid,
  };

  let verified;
  try {
    const key = await importJWK(jwk, "EdDSA");
    verified = await compactVerify(jws, key);
  } catch (err) {
    return { ok: false, reason: "jws_verify_failed" };
  }

  if (verified.protectedHeader?.alg !== "EdDSA") {
    return { ok: false, reason: "jws_alg_mismatch" };
  }
  if (String(verified.protectedHeader?.kid || "") !== expectedKid) {
    return { ok: false, reason: "jws_kid_mismatch" };
  }

  const expectedBytes = base64urlToBuf(subjectActionPayload);
  const actualBytes = Buffer.from(verified.payload);
  if (expectedBytes.length !== actualBytes.length) {
    return { ok: false, reason: "jws_payload_mismatch" };
  }
  if (!crypto.timingSafeEqual(expectedBytes, actualBytes)) {
    return { ok: false, reason: "jws_payload_mismatch" };
  }

  return { ok: true };
}
