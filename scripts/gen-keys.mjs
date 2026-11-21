#!/usr/bin/env node
// Prints fresh application secrets. Paste the output into apps/web/.env.local.
import { randomBytes, generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ed25519");
// raw 32-byte Ed25519 seed from the PKCS8 DER (last 32 bytes)
const der = privateKey.export({ format: "der", type: "pkcs8" });
const seed = der.subarray(der.length - 32);

const b64 = (b) => Buffer.from(b).toString("base64");
console.log(`# Generated ${new Date().toISOString()} — keep these secret; never commit them.`);
console.log(`HM_MASTER_KEY=${b64(randomBytes(32))}`);
console.log(`HM_SIGNING_KEY=${b64(seed)}`);
console.log(`HM_MEDIA_HMAC_KEY=${b64(randomBytes(32))}`);
console.log(`HM_EXT_TOKEN_PEPPER=${b64(randomBytes(32))}`);
console.log(`HM_WATERMARK_KEY=${b64(randomBytes(32))}`);
