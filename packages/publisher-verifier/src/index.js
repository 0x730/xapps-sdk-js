export {
  parseSubjectActionPayload,
  computeWebauthnChallengeFromSubjectActionBytes,
} from "./subjectAction.js";
export { verifyJwsSubjectProof } from "./verifyJws.js";
export { verifyWebauthnSubjectProof } from "./verifyWebauthn.js";

/**
 * High-level helper to verify the Gateway-dispatched contract:
 * - `subjectActionPayload`
 * - `subjectProof`
 * - plus verifier material fetched by `kid` from the Gateway.
 *
 * **Important:** This function verifies the cryptographic proof only.
 * Nonce replay protection must be enforced separately by the caller
 * (e.g., via `getAndConsumeNonce(nonce)` on the Gateway API).
 * Without nonce verification, a valid signed proof can be replayed.
 */
export async function verifySubjectProofEnvelope(input) {
  const subjectActionPayload = String(input?.subjectActionPayload || "");
  const subjectProof = input?.subjectProof;
  const verifier = input?.verifier;

  if (!subjectActionPayload) return { ok: false, reason: "missing_subjectActionPayload" };
  if (!subjectProof || typeof subjectProof !== "object")
    return { ok: false, reason: "missing_subjectProof" };
  if (!verifier || typeof verifier !== "object") return { ok: false, reason: "missing_verifier" };

  if (subjectProof.type === "jws") {
    const kid = String((verifier && verifier.kid) || "");
    return await (
      await import("./verifyJws.js")
    ).verifyJwsSubjectProof({
      subjectActionPayload,
      jws: String(subjectProof.jws || ""),
      expectedKid: kid,
      ed25519PublicKey: verifier?.ed25519?.publicKey,
    });
  }

  if (subjectProof.type === "webauthn") {
    return await (
      await import("./verifyWebauthn.js")
    ).verifyWebauthnSubjectProof({
      subjectActionPayload,
      kid: String(subjectProof.kid || verifier.kid || ""),
      webauthn: subjectProof.webauthn,
      rpId: verifier?.webauthn?.rpId,
      expectedOrigins: verifier?.webauthn?.expectedOrigins,
      credentialId: verifier?.webauthn?.credentialId,
      publicKeyCose: verifier?.webauthn?.publicKeyCose,
      counter: verifier?.webauthn?.signCount ?? verifier?.webauthn?.counter ?? 0,
      requireUserVerification: true,
    });
  }

  return { ok: false, reason: `unsupported_subjectProof_type: ${String(subjectProof.type)}` };
}
