import { hmacSha256 } from "../hash";

/**
 * Invisible ownership watermark in the least-significant bit of the blue channel.
 *
 * Payload (55 bytes = 440 bits):  "HM" | version(1) | workId(16) | ownerId(16) | unixSeconds(4) | HMAC-SHA256(…)[0..16]
 * Repetition code: every pixel carries one payload bit, chosen by a fixed pseudo-random sequence
 * (so periodic damage can't wipe out one bit's copies); each bit is stored ~N/440 times and decoded
 * by majority vote. Survives exact copies and lossless re-saves; it does
 * NOT survive resizing or lossy re-compression (said honestly in the UI).
 */
const MAGIC = [0x48, 0x4d]; // "HM"
const VERSION = 1;
const PAYLOAD_BYTES = 2 + 1 + 16 + 16 + 4 + 16;
export const WATERMARK_BITS = PAYLOAD_BYTES * 8;

export interface WatermarkData {
  workId: string;
  ownerId: string;
  timestamp: number; // unix seconds
}

/** Deterministic pseudo-random bit index per pixel (mulberry32). */
function* bitLayout(n: number): Generator<number> {
  let seed = 0x484d0001;
  for (let p = 0; p < n; p++) {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    yield (((t ^ (t >>> 14)) >>> 0) % WATERMARK_BITS);
  }
}

function uuidToBytes(u: string): Uint8Array {
  const hex = u.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error("bad uuid");
  return Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)));
}
function bytesToUuid(b: Uint8Array): string {
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function buildPayload(d: WatermarkData, key: Uint8Array): Uint8Array {
  const body = new Uint8Array(PAYLOAD_BYTES - 16);
  body.set(MAGIC, 0);
  body[2] = VERSION;
  body.set(uuidToBytes(d.workId), 3);
  body.set(uuidToBytes(d.ownerId), 19);
  new DataView(body.buffer).setUint32(35, d.timestamp >>> 0);
  const mac = hmacSha256(key, body).subarray(0, 16);
  const out = new Uint8Array(PAYLOAD_BYTES);
  out.set(body, 0);
  out.set(mac, body.length);
  return out;
}

/** Writes the watermark into `pixels` (raw interleaved, `channels` = 3 or 4) in place. */
export function embedWatermark(pixels: Uint8Array, channels: number, d: WatermarkData, key: Uint8Array): void {
  const n = Math.floor(pixels.length / channels);
  if (n < WATERMARK_BITS * 5) throw new Error("image too small to watermark robustly");
  const payload = buildPayload(d, key);
  let p = 0;
  for (const bitIndex of bitLayout(n)) {
    const bit = (payload[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
    const i = p * channels + 2; // blue channel
    pixels[i] = (pixels[i] & 0xfe) | bit;
    p++;
  }
}

/** Reads and authenticates the watermark. Returns null if absent, damaged or forged. */
export function extractWatermark(pixels: Uint8Array, channels: number, key: Uint8Array): (WatermarkData & { confidence: number }) | null {
  const n = Math.floor(pixels.length / channels);
  if (n < WATERMARK_BITS) return null;
  const ones = new Uint32Array(WATERMARK_BITS);
  const total = new Uint32Array(WATERMARK_BITS);
  let p = 0;
  for (const b of bitLayout(n)) {
    ones[b] += pixels[p * channels + 2] & 1;
    total[b]++;
    p++;
  }
  const payload = new Uint8Array(PAYLOAD_BYTES);
  let agreement = 0;
  for (let b = 0; b < WATERMARK_BITS; b++) {
    const bit = ones[b] * 2 > total[b] ? 1 : 0;
    agreement += Math.max(ones[b], total[b] - ones[b]) / total[b];
    payload[b >> 3] |= bit << (7 - (b & 7));
  }
  if (payload[0] !== MAGIC[0] || payload[1] !== MAGIC[1] || payload[2] !== VERSION) return null;
  const body = payload.subarray(0, PAYLOAD_BYTES - 16);
  const mac = payload.subarray(PAYLOAD_BYTES - 16);
  const expect = hmacSha256(key, body).subarray(0, 16);
  let diff = 0;
  for (let i = 0; i < 16; i++) diff |= mac[i] ^ expect[i];
  if (diff !== 0) return null;
  return {
    workId: bytesToUuid(body.subarray(3, 19)),
    ownerId: bytesToUuid(body.subarray(19, 35)),
    timestamp: new DataView(body.buffer, body.byteOffset).getUint32(35),
    confidence: Math.round((agreement / WATERMARK_BITS) * 1000) / 1000,
  };
}
