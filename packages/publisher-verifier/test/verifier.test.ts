import { describe, expect, it } from "vitest";
import { CompactSign, exportJWK, generateKeyPair } from "jose";
import {
  computeWebauthnChallengeFromSubjectActionBytes,
  parseSubjectActionPayload,
  verifyJwsSubjectProof,
  verifySubjectProofEnvelope,
} from "../src/index.js";
import { bufToBase64url } from "../src/base64url.js";

async function buildJwsFixture() {
  const action = {
    v: 1,
    subjectId: "sub_123",
    nonce: "nonce_123",
    timestamp: "2026-03-16T12:00:00.000Z",
    payloadHash: "hash_123",
  };
  const payloadBytes = Buffer.from(JSON.stringify(action), "utf8");
  const subjectActionPayload = bufToBase64url(payloadBytes);
  const kid = "kid_test_123";
  const { publicKey, privateKey } = await generateKeyPair("EdDSA");
  const jws = await new CompactSign(payloadBytes)
    .setProtectedHeader({ alg: "EdDSA", kid })
    .sign(privateKey);
  const publicJwk = await exportJWK(publicKey);
  return {
    action,
    payloadBytes,
    subjectActionPayload,
    kid,
    jws,
    publicKeyB64u: String(publicJwk.x || ""),
  };
}

describe("publisher-verifier", () => {
  it("parses subject action payload and computes deterministic WebAuthn challenge", () => {
    const action = { hello: "world", count: 1 };
    const payloadBytes = Buffer.from(JSON.stringify(action), "utf8");
    const subjectActionPayload = bufToBase64url(payloadBytes);

    const parsed = parseSubjectActionPayload(subjectActionPayload);
    const challenge = computeWebauthnChallengeFromSubjectActionBytes(parsed.bytes);

    expect(parsed.action).toEqual(action);
    expect(Buffer.from(parsed.bytes)).toEqual(payloadBytes);
    expect(challenge).toBe("RFJ52-CVdy4h129KhOrJe8pvbvmY7DVy_4KnKf5juZ4");
  });

  it("verifies a valid JWS subject proof", async () => {
    const fixture = await buildJwsFixture();

    await expect(
      verifyJwsSubjectProof({
        subjectActionPayload: fixture.subjectActionPayload,
        jws: fixture.jws,
        expectedKid: fixture.kid,
        ed25519PublicKey: fixture.publicKeyB64u,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects a JWS proof when the expected kid does not match", async () => {
    const fixture = await buildJwsFixture();

    await expect(
      verifyJwsSubjectProof({
        subjectActionPayload: fixture.subjectActionPayload,
        jws: fixture.jws,
        expectedKid: "kid_wrong",
        ed25519PublicKey: fixture.publicKeyB64u,
      }),
    ).resolves.toEqual({ ok: false, reason: "jws_kid_mismatch" });
  });

  it("verifies a valid JWS envelope through the public helper", async () => {
    const fixture = await buildJwsFixture();

    await expect(
      verifySubjectProofEnvelope({
        subjectActionPayload: fixture.subjectActionPayload,
        subjectProof: {
          type: "jws",
          jws: fixture.jws,
        },
        verifier: {
          kid: fixture.kid,
          ed25519: {
            publicKey: fixture.publicKeyB64u,
          },
        },
      }),
    ).resolves.toEqual({ ok: true });
  });
});
