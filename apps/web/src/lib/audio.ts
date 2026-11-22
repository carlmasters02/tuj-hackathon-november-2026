export const MAX_SECONDS = 180;
export const MAX_BYTES = 25 * 1024 * 1024;

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function pickMimeType(isSupported: (t: string) => boolean): string | undefined {
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find(isSupported);
}

export function micErrorMessage(e: unknown): string {
  const name = (e as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access is blocked. Allow it in your browser’s site settings and try again.";
  if (name === "NotFoundError") return "No microphone found. Plug one in and try again.";
  if (name === "NotReadableError") return "Another app is using your microphone. Close it and try again.";
  return "Couldn’t start the microphone. Try again.";
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** True only for the exact 44-byte-header mono PCM WAV shape produced by encodeWav (no hidden chunks). */
export function isCanonicalMonoPcmWav(bytes: Uint8Array | ArrayBuffer): boolean {
  const length = bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
  if (length < 46) return false;
  const view = bytes instanceof ArrayBuffer ? new DataView(bytes) : new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, text: string) => [...text].every((char, i) => view.getUint8(offset + i) === char.charCodeAt(0));
  if (!ascii(0, "RIFF") || !ascii(8, "WAVE") || !ascii(12, "fmt ") || !ascii(36, "data")) return false;
  if (view.getUint32(4, true) !== length - 8 || view.getUint32(16, true) !== 16) return false;
  const rate = view.getUint32(24, true);
  const dataBytes = view.getUint32(40, true);
  return view.getUint16(20, true) === 1 && view.getUint16(22, true) === 1 && rate > 0 && view.getUint32(28, true) === rate * 2 && view.getUint16(32, true) === 2 && view.getUint16(34, true) === 16 && dataBytes === length - 44 && dataBytes > 0 && dataBytes % 2 === 0;
}

// Browsers record webm or mp4. WAV is the safest format to hand to an upload pipeline.
export async function toWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const mono = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < d.length; i++) mono[i] += d[i] / audio.numberOfChannels;
    }
    return encodeWav(mono, audio.sampleRate);
  } finally {
    await ctx.close();
  }
}