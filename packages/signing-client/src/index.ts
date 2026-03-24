import { canonicalize } from "json-canonicalize";

export interface SubjectAction {
  v: number;
  clientId: string;
  installationId: string;
  xappId: string;
  toolName: string;
  subjectId: string;
  nonce: string;
  timestamp: string;
  payloadHash: string;
}

/**
 * Compact JWS proof produced by Ed25519 signing.
 */
export interface SubjectProofJWS {
  type: "jws";
  jws: string;
}

/**
 * WebAuthn assertion proof returned by the browser authenticator flow.
 */
export interface SubjectProofWebAuthn {
  type: "webauthn";
  kid: string;
  webauthn: any;
}

/**
 * Subject proof envelope accepted by the platform verifier flow.
 */
export type SubjectProof = SubjectProofJWS | SubjectProofWebAuthn;

/**
 * Canonicalizes a payload using JCS (RFC 8785).
 */
export function jcs(obj: any): string {
  return canonicalize(obj);
}

/**
 * Computes SHA-256 hash of a string, returning a hex string.
 */
export async function sha256Hex(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes SHA-256 hash of canonicalized JSON payload.
 */
export async function hashPayload(payload: any): Promise<string> {
  return sha256Hex(jcs(payload));
}

/**
 * Helper to encode bytes to base64url (no padding).
 */
export function bytesToBase64url(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    const binString = Array.from(bytes, (x) => String.fromCharCode(x)).join("");
    return btoa(binString).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } else {
    // Node.js fallback for tests
    return Buffer.from(bytes).toString("base64url");
  }
}

/**
 * Helper to decode base64url to Uint8Array.
 */
export function base64urlToBytes(b64u: string): Uint8Array {
  // Prefer Node.js Buffer when available. Modern Node exposes `atob`, but it is stricter
  // and we don't want runtime differences between Node and browsers.
  // This also avoids the vague `Invalid character` errors seen from Node's `atob()`.
  const hasBuffer = typeof Buffer !== "undefined";
  if (hasBuffer) {
    return new Uint8Array(Buffer.from(String(b64u || ""), "base64url"));
  }

  // Browser path
  let b64 = String(b64u || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  // Add required padding for atob (length must be a multiple of 4)
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  else if (pad !== 0) {
    throw new Error("Invalid base64url string");
  }
  const binString = atob(b64);
  return Uint8Array.from(binString, (m) => m.charCodeAt(0));
}

/**
 * Signs a subject action using Ed25519 (Web Crypto API).
 */
export async function signActionEd25519(
  action: SubjectAction,
  privateKey: CryptoKey,
  keyId: string,
): Promise<SubjectProofJWS> {
  const actionBytes = new TextEncoder().encode(jcs(action));

  // JWS signing input is ASCII bytes of: BASE64URL(UTF8(header)) + '.' + BASE64URL(payload)
  // Signature must be computed over that signing input, not over the raw payload bytes.
  const header = {
    alg: "EdDSA",
    kid: keyId,
  };

  const encodedHeader = bytesToBase64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = bytesToBase64url(actionBytes);
  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign("Ed25519", privateKey, signingInput);
  const encodedSignature = bytesToBase64url(new Uint8Array(signature));

  return {
    type: "jws",
    jws: `${encodedHeader}.${encodedPayload}.${encodedSignature}`,
  };
}

/**
 * Generates an Ed25519 keypair using Web Crypto API.
 */
export async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: "Ed25519",
    },
    true,
    ["sign", "verify"],
  );
}

/**
 * Exports public key as base64url.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", publicKey);
  return bytesToBase64url(new Uint8Array(exported));
}

/**
 * Signs a subject action using WebAuthn.
 * This is a thin wrapper around navigator.credentials.get.
 */
export async function signActionWebAuthn(
  action: SubjectAction,
  keyId: string,
  credentialId: string,
): Promise<SubjectProofWebAuthn> {
  const actionBytes = new TextEncoder().encode(jcs(action));

  // expectedChallenge = base64url(sha256(subjectActionBytes))
  // The browser wants a BufferSource for challenge.
  const challengeBuffer = await crypto.subtle.digest("SHA-256", actionBytes);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challengeBuffer,
      allowCredentials: [
        {
          id: base64urlToBytes(credentialId).buffer as ArrayBuffer,
          type: "public-key",
          // Prefer on-device authenticators (Windows Hello, TouchID) when possible
          transports: ["internal"],
        },
      ],
      userVerification: "required",
    },
  })) as any;

  if (!assertion) {
    throw new Error("WebAuthn assertion failed");
  }

  return {
    type: "webauthn",
    kid: keyId, // Using the opaque keyId as kid for Gateway lookup
    webauthn: {
      id: assertion.id,
      rawId: bytesToBase64url(new Uint8Array(assertion.rawId)),
      type: assertion.type,
      response: {
        authenticatorData: bytesToBase64url(new Uint8Array(assertion.response.authenticatorData)),
        clientDataJSON: bytesToBase64url(new Uint8Array(assertion.response.clientDataJSON)),
        signature: bytesToBase64url(new Uint8Array(assertion.response.signature)),
        userHandle: assertion.response.userHandle
          ? bytesToBase64url(new Uint8Array(assertion.response.userHandle))
          : null,
      },
      authenticatorAttachment: assertion.authenticatorAttachment,
      clientExtensionResults: assertion.getClientExtensionResults
        ? assertion.getClientExtensionResults()
        : {},
    },
  };
}

/**
 * Formats a WebAuthn registration response for the Gateway.
 */
export async function formatWebAuthnRegistration(attestation: any): Promise<any> {
  return {
    id: attestation.id,
    rawId: bytesToBase64url(new Uint8Array(attestation.rawId)),
    type: attestation.type,
    response: {
      attestationObject: bytesToBase64url(new Uint8Array(attestation.response.attestationObject)),
      clientDataJSON: bytesToBase64url(new Uint8Array(attestation.response.clientDataJSON)),
      getTransports: attestation.response.getTransports
        ? attestation.response.getTransports()
        : undefined,
      publicKeyAlgorithm: attestation.response.getPublicKeyAlgorithm
        ? attestation.response.getPublicKeyAlgorithm()
        : undefined,
      publicKey: attestation.response.getPublicKey
        ? bytesToBase64url(new Uint8Array(attestation.response.getPublicKey()))
        : undefined,
      authenticatorData: attestation.response.getAuthenticatorData
        ? bytesToBase64url(new Uint8Array(attestation.response.getAuthenticatorData()))
        : undefined,
    },
    authenticatorAttachment: attestation.authenticatorAttachment,
    clientExtensionResults: attestation.getClientExtensionResults
      ? attestation.getClientExtensionResults()
      : {},
  };
}
