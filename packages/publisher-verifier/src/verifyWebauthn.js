import { base64urlToBuf } from "./base64url.js";
import {
  computeWebauthnChallengeFromSubjectActionBytes,
  parseSubjectActionPayload,
} from "./subjectAction.js";

// Lazy import: keep lightweight for publishers that only support JWS.
let simpleWebAuthn = null;

export async function verifyWebauthnSubjectProof(input) {
  const subjectActionPayload = String(input?.subjectActionPayload || "");
  const kid = String(input?.kid || "");
  const webauthn = input?.webauthn;

  const rpId = String(input?.rpId || "");
  const expectedOrigins = input?.expectedOrigins;
  const credentialId = String(input?.credentialId || "");
  const publicKeyCoseB64u = String(input?.publicKeyCose || "");
  const counter = Number(input?.counter ?? 0);
  const requireUserVerification = input?.requireUserVerification !== false;

  if (!subjectActionPayload) return { ok: false, reason: "missing_subjectActionPayload" };
  if (!kid) return { ok: false, reason: "missing_kid" };
  if (!webauthn || typeof webauthn !== "object") return { ok: false, reason: "missing_webauthn" };
  if (!rpId) return { ok: false, reason: "missing_rpId" };
  if (!Array.isArray(expectedOrigins) || expectedOrigins.length === 0) {
    return { ok: false, reason: "missing_expectedOrigins" };
  }
  if (!credentialId) return { ok: false, reason: "missing_credentialId" };
  if (!publicKeyCoseB64u) return { ok: false, reason: "missing_publicKeyCose" };

  const { bytes: subjectActionBytes } = parseSubjectActionPayload(subjectActionPayload);
  const expectedChallenge = computeWebauthnChallengeFromSubjectActionBytes(subjectActionBytes);

  if (!simpleWebAuthn) {
    simpleWebAuthn = await import("@simplewebauthn/server");
  }

  try {
    const verification = await simpleWebAuthn.verifyAuthenticationResponse({
      response: webauthn,
      expectedChallenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpId,
      credential: {
        id: credentialId,
        publicKey: base64urlToBuf(publicKeyCoseB64u),
        counter,
      },
      requireUserVerification,
    });

    if (!verification.verified) {
      return { ok: false, reason: "webauthn_not_verified" };
    }

    return {
      ok: true,
      authenticationInfo: verification.authenticationInfo ?? null,
    };
  } catch (err) {
    return { ok: false, reason: "webauthn_verify_failed" };
  }
}
