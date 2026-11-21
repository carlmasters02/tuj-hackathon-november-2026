import * as ed from "@noble/ed25519";
import { z } from "zod";
import { canonicalJSON } from "./canonicalJson";
import { bytesToHex, hexToBytes, sha256Hex, utf8ToBytes } from "./hash";
import type { DocStats, Verdict } from "./provenance/stats";

export interface CertificatePayload {
  v: 1;
  certId: string;
  docId: string;
  author: string; // username at issue time
  title: string;
  contentHash: string; // sha256 of the plain-text projection
  logHeadHash: string; // last hash of the provenance chain
  stats: DocStats;
  verdict: Verdict;
  issuedAt: string; // ISO
}

export interface SignedCertificate {
  payload: CertificatePayload;
  signature: string; // hex Ed25519 signature over canonicalJSON(payload)
  publicKey: string; // hex, for convenience; verifiers should pin the published key
}

export const SignedCertificateSchema = z.object({
  payload: z
    .object({
      v: z.literal(1),
      certId: z.string().uuid(),
      docId: z.string().uuid(),
      author: z.string().max(40),
      title: z.string().max(300),
      contentHash: z.string().regex(/^[0-9a-f]{64}$/),
      logHeadHash: z.string().regex(/^[0-9a-f]{64}$/),
      stats: z.record(z.string(), z.unknown()),
      verdict: z.enum(["human_verified", "mostly_human", "unverified"]),
      issuedAt: z.string().max(40),
    })
    .passthrough(),
  signature: z.string().regex(/^[0-9a-f]{128}$/),
  publicKey: z.string().regex(/^[0-9a-f]{64}$/),
});

export async function publicKeyFromSeed(seed: Uint8Array): Promise<string> {
  return bytesToHex(await ed.getPublicKeyAsync(seed));
}

export async function signCertificate(payload: CertificatePayload, seed: Uint8Array): Promise<SignedCertificate> {
  const msg = utf8ToBytes(canonicalJSON(payload));
  const sig = await ed.signAsync(msg, seed);
  return { payload, signature: bytesToHex(sig), publicKey: await publicKeyFromSeed(seed) };
}

/** Verifies the signature against `trustedPublicKey` (hex). Never trust cert.publicKey alone. */
export async function verifyCertificateSignature(cert: SignedCertificate, trustedPublicKey: string): Promise<boolean> {
  try {
    const msg = utf8ToBytes(canonicalJSON(cert.payload));
    return await ed.verifyAsync(hexToBytes(cert.signature), msg, hexToBytes(trustedPublicKey));
  } catch {
    return false;
  }
}

export function contentHash(text: string): string {
  return sha256Hex(text);
}
