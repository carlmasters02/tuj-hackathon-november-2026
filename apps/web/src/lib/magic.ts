/**
 * File-type detection by magic bytes only — the extension and the browser-supplied MIME type
 * are ignored entirely.
 */
export type Sniffed = "image/png" | "image/jpeg" | "image/webp" | "audio/mpeg" | "audio/ogg" | "audio/wav";

export function sniff(b: Uint8Array): Sniffed | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((x, k) => b[i + k] === x);
  const ascii = (i: number, s: string) => at(i, ...[...s].map((c) => c.charCodeAt(0)));
  if (b.length < 12) return null;
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "audio/wav";
  if (ascii(0, "OggS")) return "audio/ogg";
  if (ascii(0, "ID3")) return "audio/mpeg";
  // MPEG audio frame sync (11 set bits) with a valid layer
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) return "audio/mpeg";
  return null;
}

export const IMAGE_TYPES = new Set<Sniffed>(["image/png", "image/jpeg", "image/webp"]);
export const AUDIO_TYPES = new Set<Sniffed>(["audio/mpeg", "audio/ogg", "audio/wav"]);
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
