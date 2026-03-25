import { base64urlToBuf, bufToBase64url } from "./base64url.js";
import { sha256 } from "./crypto.js";

export function parseSubjectActionPayload(subjectActionPayloadB64u) {
  const bytes = base64urlToBuf(subjectActionPayloadB64u);
  const json = bytes.toString("utf8");
  const action = JSON.parse(json);
  return { bytes, action };
}

export function computeWebauthnChallengeFromSubjectActionBytes(subjectActionBytes) {
  // Normative challenge binding:
  // expectedChallenge = base64url(sha256(subjectActionBytes))
  return bufToBase64url(sha256(subjectActionBytes));
}
