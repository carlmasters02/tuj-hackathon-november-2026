import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { keyBytes } from "./env";

/**
 * App-level encryption at rest (on top of Supabase disk encryption): AES-256-GCM, random 96-bit IV
 * per value, 128-bit tag. Format: base64(iv | tag | ciphertext). A leaked DB dump or bucket is
 * unreadable without HM_MASTER_KEY. Never log keys or plaintext.
 */
const VERSION = 1;

export function encryptBytes(plain: Buffer | Uint8Array, aad = ""): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyBytes("HM_MASTER_KEY"), iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, c.getAuthTag(), ct]);
}

export function decryptBytes(blob: Buffer | Uint8Array, aad = ""): Buffer {
  const b = Buffer.from(blob);
  if (b[0] !== VERSION) throw new Error("unknown ciphertext version");
  const iv = b.subarray(1, 13);
  const tag = b.subarray(13, 29);
  const d = createDecipheriv("aes-256-gcm", keyBytes("HM_MASTER_KEY"), iv);
  if (aad) d.setAAD(Buffer.from(aad));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(b.subarray(29)), d.final()]);
}

/** String helpers; `aad` binds a ciphertext to its row (e.g. the document id) so it can't be swapped. */
export const encryptString = (s: string, aad = "") => encryptBytes(Buffer.from(s, "utf8"), aad).toString("base64");
export const decryptString = (s: string, aad = "") => decryptBytes(Buffer.from(s, "base64"), aad).toString("utf8");

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export function hashExtensionToken(token: string): string {
  return createHash("sha256").update(keyBytes("HM_EXT_TOKEN_PEPPER")).update(token).digest("hex");
}
