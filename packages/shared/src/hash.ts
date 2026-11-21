import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export { bytesToHex, hexToBytes, utf8ToBytes };

/** SHA-256 of a UTF-8 string or bytes, as lowercase hex. Works in browser, worker and Node. */
export function sha256Hex(input: string | Uint8Array): string {
  return bytesToHex(sha256(typeof input === "string" ? utf8ToBytes(input) : input));
}

export function hmacSha256(key: Uint8Array, msg: string | Uint8Array): Uint8Array {
  return hmac(sha256, key, typeof msg === "string" ? utf8ToBytes(msg) : msg);
}

/** Constant-time comparison of two equal-length byte arrays / hex strings. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
