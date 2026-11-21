import { describe, expect, it } from "vitest";
import { contentFingerprint } from "@hm/shared/contentFingerprint";

describe("content fingerprints", () => {
  it("is stable across JSON key order", () => {
    expect(contentFingerprint({ type: "doc", attrs: { a: 1, b: [2, 3] } })).toBe(contentFingerprint({ attrs: { b: [2, 3], a: 1 }, type: "doc" }));
  });
  it("changes when content or formatting changes", () => {
    expect(contentFingerprint({ type: "text", text: "same" })).not.toBe(contentFingerprint({ type: "text", text: "same", marks: [{ type: "bold" }] }));
  });
});
