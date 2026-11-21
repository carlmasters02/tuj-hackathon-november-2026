import { bytesToHex, hmacSha256, timingSafeEqualStr } from "../hash";

export const MEDIA_URL_TTL_SECONDS = 300;

/** Signature binds media id + expiry + the viewer it was issued to, so a leaked URL is useless to others. */
export function signMedia(key: Uint8Array, id: string, viewerId: string, exp: number): string {
  return bytesToHex(hmacSha256(key, `media|${id}|${viewerId}|${exp}`));
}

export function mediaUrl(key: Uint8Array, id: string, viewerId: string, nowSec = Math.floor(Date.now() / 1000), base = "/api/media"): string {
  const exp = nowSec + MEDIA_URL_TTL_SECONDS;
  return `${base}/${id}?exp=${exp}&sig=${signMedia(key, id, viewerId, exp)}`;
}

export function verifyMedia(key: Uint8Array, id: string, viewerId: string, exp: number, sig: string, nowSec = Math.floor(Date.now() / 1000)): "ok" | "expired" | "bad_signature" {
  if (!Number.isInteger(exp) || exp < nowSec) return "expired";
  if (exp > nowSec + MEDIA_URL_TTL_SECONDS + 5) return "bad_signature";
  return timingSafeEqualStr(signMedia(key, id, viewerId, exp), sig) ? "ok" : "bad_signature";
}
