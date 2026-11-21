import { api, json } from "@/lib/http";
import { serverPublicKey } from "@/lib/server/certs";

/** The Ed25519 public key that signs Humagination certificates (hex). Pin it to verify offline. */
export const GET = api(async () => json({ alg: "Ed25519", publicKey: await serverPublicKey() }, { headers: { "Cache-Control": "public, max-age=3600" } }));
