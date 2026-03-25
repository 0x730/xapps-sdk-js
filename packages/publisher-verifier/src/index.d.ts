export type SubjectActionPayload = {
  bytes: Buffer;
  action: Record<string, unknown>;
};

export type JwsSubjectProofInput = {
  subjectActionPayload: string;
  jws: string;
  expectedKid: string;
  ed25519PublicKey: string;
};

export type SubjectProofVerificationFailure = {
  ok: false;
  reason: string;
};

export type SubjectProofVerificationSuccess = {
  ok: true;
};

export type JwsSubjectProofVerificationResult =
  | SubjectProofVerificationSuccess
  | SubjectProofVerificationFailure;

export type WebauthnAuthenticationInfo = Record<string, unknown> | null;

export type WebauthnSubjectProofInput = {
  subjectActionPayload: string;
  kid: string;
  webauthn: Record<string, unknown>;
  rpId: string;
  expectedOrigins: string[];
  credentialId: string;
  publicKeyCose: string;
  counter?: number;
  requireUserVerification?: boolean;
};

export type WebauthnSubjectProofVerificationResult =
  | {
      ok: true;
      authenticationInfo: WebauthnAuthenticationInfo;
    }
  | SubjectProofVerificationFailure;

export type SubjectProofEnvelopeInput = {
  subjectActionPayload: string;
  subjectProof:
    | {
        type: "jws";
        jws: string;
      }
    | {
        type: "webauthn";
        kid?: string;
        webauthn: Record<string, unknown>;
      };
  verifier: {
    kid?: string;
    ed25519?: {
      publicKey?: string;
    };
    webauthn?: {
      rpId?: string;
      expectedOrigins?: string[];
      credentialId?: string;
      publicKeyCose?: string;
      signCount?: number;
      counter?: number;
    };
  };
};

export type SubjectProofEnvelopeVerificationResult =
  | SubjectProofVerificationSuccess
  | {
      ok: true;
      authenticationInfo: WebauthnAuthenticationInfo;
    }
  | SubjectProofVerificationFailure;

export function parseSubjectActionPayload(subjectActionPayloadB64u: string): SubjectActionPayload;

export function computeWebauthnChallengeFromSubjectActionBytes(
  subjectActionBytes: Buffer | Uint8Array,
): string;

export function verifyJwsSubjectProof(
  input: JwsSubjectProofInput,
): Promise<JwsSubjectProofVerificationResult>;

export function verifyWebauthnSubjectProof(
  input: WebauthnSubjectProofInput,
): Promise<WebauthnSubjectProofVerificationResult>;

export function verifySubjectProofEnvelope(
  input: SubjectProofEnvelopeInput,
): Promise<SubjectProofEnvelopeVerificationResult>;
