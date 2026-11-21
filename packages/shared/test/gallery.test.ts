import { describe, expect, it } from "vitest";
import { dHashFromGray, hammingDistance } from "@hm/shared/gallery/dhash";
import { embedWatermark, extractWatermark } from "@hm/shared/gallery/watermark";
import { mediaUrl, verifyMedia } from "@hm/shared/gallery/signedUrl";

const gradient = (f: (x: number, y: number) => number) => Uint8Array.from({ length: 72 }, (_, i) => f(i % 9, Math.floor(i / 9)));

describe("dHash", () => {
  it("is stable, sensitive to structure, tolerant of brightness", () => {
    const a = gradient((x, y) => (x * 25 + y * 3) % 256);
    const brighter = a.map((v) => Math.min(255, v + 10));
    const other = gradient((x, y) => ((8 - x) * 25 + y * 7) % 256);
    expect(dHashFromGray(a)).toMatch(/^[0-9a-f]{16}$/);
    expect(hammingDistance(dHashFromGray(a), dHashFromGray(brighter))).toBeLessThanOrEqual(6);
    expect(hammingDistance(dHashFromGray(a), dHashFromGray(other))).toBeGreaterThan(6);
  });
  it("hamming distance", () => {
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4);
    expect(hammingDistance("ffffffffffffffff", "0000000000000000")).toBe(64);
  });
});

describe("LSB watermark", () => {
  const key = new Uint8Array(32).fill(3);
  const data = { workId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", ownerId: "11111111-2222-4333-8444-555555555555", timestamp: 1_790_000_000 };
  const img = () => Uint8Array.from({ length: 200 * 200 * 4 }, (_, i) => (i * 7919) % 256);

  it("round-trips", () => {
    const px = img();
    embedWatermark(px, 4, data, key);
    const out = extractWatermark(px, 4, key);
    expect(out).toMatchObject(data);
    expect(out!.confidence).toBe(1);
  });
  it("survives 10% random bit noise via repetition coding", () => {
    const px = img();
    embedWatermark(px, 4, data, key);
    let r = 12345;
    for (let p = 0; p < px.length / 4; p++) {
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      if (r % 10 === 0) px[p * 4 + 2] ^= 1; // ~10% of pixels
    }
    expect(extractWatermark(px, 4, key)).toMatchObject(data);
  });
  it("rejects the wrong key and unmarked images", () => {
    const px = img();
    embedWatermark(px, 4, data, key);
    expect(extractWatermark(px, 4, new Uint8Array(32).fill(4))).toBeNull();
    expect(extractWatermark(img(), 4, key)).toBeNull();
  });
});

describe("signed media URLs", () => {
  const key = new Uint8Array(32).fill(1);
  it("valid for the issuing viewer only, and expire after 5 minutes", () => {
    const now = 1_800_000_000;
    const url = new URL("http://x" + mediaUrl(key, "work1", "viewerA", now));
    const exp = Number(url.searchParams.get("exp"));
    const sig = url.searchParams.get("sig")!;
    expect(verifyMedia(key, "work1", "viewerA", exp, sig, now + 10)).toBe("ok");
    expect(verifyMedia(key, "work1", "viewerB", exp, sig, now + 10)).toBe("bad_signature");
    expect(verifyMedia(key, "work2", "viewerA", exp, sig, now + 10)).toBe("bad_signature");
    expect(verifyMedia(key, "work1", "viewerA", exp, sig, now + 301)).toBe("expired");
  });
});
