import { base64urlToBytes, bytesToBase64url, hashPayload, jcs } from "../../dist/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log("signing-client smoke: start");

const payload = { b: 2, a: 1 };
const canonical = jcs(payload);
assert(canonical === '{"a":1,"b":2}', "JCS canonicalization mismatch");

const hash = await hashPayload(payload);
assert(typeof hash === "string" && hash.length === 64, "hashPayload should return sha256 hex");

const encoded = bytesToBase64url(new Uint8Array([1, 2, 3, 4]));
const decoded = base64urlToBytes(encoded);
assert(decoded.length === 4 && decoded[0] === 1 && decoded[3] === 4, "base64url roundtrip mismatch");

console.log("signing-client smoke: ok");
