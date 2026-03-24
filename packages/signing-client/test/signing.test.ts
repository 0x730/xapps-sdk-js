import { describe, it, expect } from "vitest";
import {
  jcs,
  sha256Hex,
  hashPayload,
  bytesToBase64url,
  base64urlToBytes,
  generateEd25519KeyPair,
  signActionEd25519,
  exportPublicKey,
} from "../src/index";

describe("signing-client", () => {
  it("should canonicalize JSON with JCS", () => {
    const obj = { b: 2, a: 1, c: { e: 5, d: 4 } };
    expect(jcs(obj)).toBe('{"a":1,"b":2,"c":{"d":4,"e":5}}');
  });

  it("should compute sha256 hex", async () => {
    const hash = await sha256Hex("hello");
    // sha256('hello') = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("should hash payload (JCS + sha256)", async () => {
    const payload = { b: 2, a: 1 };
    const hash = await hashPayload(payload);
    const expected = await sha256Hex('{"a":1,"b":2}');
    expect(hash).toBe(expected);
  });

  it("should encode/decode base64url", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const b64u = bytesToBase64url(bytes);
    expect(b64u).toBe("SGVsbG8");
    expect(base64urlToBytes(b64u)).toEqual(bytes);
  });

  it("should generate and sign with Ed25519", async () => {
    const keyPair = await generateEd25519KeyPair();
    const action = {
      v: 1,
      clientId: "client-1",
      installationId: "inst-1",
      xappId: "xapp-1",
      toolName: "tool-1",
      subjectId: "sub-1",
      nonce: "nonce-1",
      timestamp: new Date().toISOString(),
      payloadHash: "hash-1",
    };

    const keyId = "key-1";
    const proof = await signActionEd25519(action, keyPair.privateKey, keyId);

    expect(proof.type).toBe("jws");
    expect(proof.jws).toContain(".");

    const [headerB64, payloadB64, sigB64] = proof.jws.split(".");

    const header = JSON.parse(new TextDecoder().decode(base64urlToBytes(headerB64)));
    expect(header.alg).toBe("EdDSA");
    expect(header.kid).toBe(keyId);

    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    expect(payload).toEqual(action);

    // Ensure the JWS signature is valid for the JWS signing input.
    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64urlToBytes(sigB64);
    const ok = await crypto.subtle.verify("Ed25519", keyPair.publicKey, signature, signingInput);
    expect(ok).toBe(true);
  });

  it("should export public key", async () => {
    const keyPair = await generateEd25519KeyPair();
    const pk = await exportPublicKey(keyPair.publicKey);
    expect(typeof pk).toBe("string");
    expect(pk.length).toBeGreaterThan(10);
  });
});
