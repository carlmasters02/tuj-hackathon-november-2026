import { describe, expect, it } from "vitest";
import { encodeWav, isCanonicalMonoPcmWav, micErrorMessage, mmss, pickMimeType } from "../src/lib/audio";

describe("audio helpers", () => {
  it("formats time", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(125)).toBe("2:05");
  });
  it("picks the first supported type", () => {
    expect(pickMimeType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickMimeType(() => false)).toBeUndefined();
  });
  it("encodes a valid WAV file with a canonical header", async () => {
    const blob = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 8000);
    const buf = await blob.arrayBuffer();
    expect(blob.size).toBe(44 + 8);
    const view = new DataView(buf);
    expect(String.fromCharCode(...new Uint8Array(buf, 0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...new Uint8Array(buf, 8, 4))).toBe("WAVE");
    expect(String.fromCharCode(...new Uint8Array(buf, 12, 4))).toBe("fmt ");
    expect(String.fromCharCode(...new Uint8Array(buf, 36, 4))).toBe("data");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(28, true)).toBe(16000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect([0, 0.5, -0.5, 1].map((_, i) => view.getInt16(44 + i * 2, true))).toEqual([0, 16383, -16384, 32767]);
    expect(isCanonicalMonoPcmWav(buf)).toBe(true);
  });
  it("clips extreme samples to signed 16-bit PCM without wrapping", async () => {
    const buf = await encodeWav(new Float32Array([-1, -2, 1, 2]), 22050).arrayBuffer();
    const view = new DataView(buf);
    expect([-1, -2, 1, 2].map((_, i) => view.getInt16(44 + i * 2, true))).toEqual([-32768, -32768, 32767, 32767]);
  });
  it("rejects extra chunks, bogus data sizes and empty samples as non-canonical", async () => {
    const valid = new Uint8Array(await encodeWav(new Float32Array([0, 0.5]), 8000).arrayBuffer());
    const dataSize = new DataView(valid.buffer).getUint32(40, true);
    expect(isCanonicalMonoPcmWav(valid)).toBe(true);
    const withHiddenChunk = new Uint8Array([...valid, 99, 98]);
    expect(isCanonicalMonoPcmWav(withHiddenChunk)).toBe(false);
    const bogusSize = valid.slice();
    new DataView(bogusSize.buffer).setUint32(40, dataSize + 2, true);
    expect(isCanonicalMonoPcmWav(bogusSize)).toBe(false);
    expect(isCanonicalMonoPcmWav(await encodeWav(new Float32Array(), 8000).arrayBuffer())).toBe(false);
  });
  it("explains microphone errors", () => {
    expect(micErrorMessage({ name: "NotAllowedError" })).toContain("blocked");
    expect(micErrorMessage({ name: "NotFoundError" })).toContain("No microphone");
    expect(micErrorMessage(new Error("x"))).toContain("Couldn’t start");
  });
});