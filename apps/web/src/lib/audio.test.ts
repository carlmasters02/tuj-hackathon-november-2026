import { describe, expect, it } from "vitest";
import { encodeWav, micErrorMessage, mmss, pickMimeType } from "./audio";

describe("audio helpers", () => {
  it("formats time", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(125)).toBe("2:05");
  });
  it("picks the first supported type", () => {
    expect(pickMimeType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickMimeType(() => false)).toBeUndefined();
  });
  it("encodes a valid WAV file", async () => {
    const blob = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 8000);
    const buf = await blob.arrayBuffer();
    expect(blob.size).toBe(44 + 8);
    expect(String.fromCharCode(...new Uint8Array(buf, 0, 4))).toBe("RIFF");
    expect(new DataView(buf).getUint32(24, true)).toBe(8000);
  });
  it("explains microphone errors", () => {
    expect(micErrorMessage({ name: "NotAllowedError" })).toContain("blocked");
    expect(micErrorMessage({ name: "NotFoundError" })).toContain("No microphone");
    expect(micErrorMessage(new Error("x"))).toContain("Couldn’t start");
  });
});