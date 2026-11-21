import { describe, expect, it } from "vitest";
import { canonicalJSON } from "@hm/shared/canonicalJson";
import { computeStats, diffRange, replay, verdictFor, verifyChain, type DocEvent } from "@hm/shared/provenance/index";
import { contentHash, signCertificate, verifyCertificateSignature, type CertificatePayload } from "@hm/shared/certificate";
import { typeText, toBatches } from "./helpers";

const DOC = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const PARA = "The quick brown fox jumps over the lazy dog. It was not quick enough, so I rewrote it.";

describe("canonical JSON", () => {
  it("sorts keys and drops undefined", () => {
    expect(canonicalJSON({ b: 1, a: [2, { d: undefined, c: "x" }] })).toBe('{"a":[2,{"c":"x"}],"b":1}');
  });
});

describe("diffRange", () => {
  it("produces a single minimal edit", () => {
    expect(diffRange("hello world", "hello brave world")).toEqual({ from: 6, to: 6, text: "brave " });
    expect(diffRange("abc", "ac")).toEqual({ from: 1, to: 2, text: "" });
    expect(diffRange("same", "same")).toBeNull();
  });
});

describe("hash chain", () => {
  it("verifies an untouched log", () => {
    const batches = toBatches(DOC, SESSION, typeText(PARA));
    const r = verifyChain(DOC, batches);
    expect(r.ok).toBe(true);
  });
  it("detects a tampered event (tamper test)", () => {
    const batches = toBatches(DOC, SESSION, typeText(PARA));
    const victim = batches[1].events[3];
    batches[1].events[3] = { ...victim, text: "Z" };
    const r = verifyChain(DOC, batches);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("hash chain broken");
  });
  it("detects deleted events and reordering", () => {
    const b1 = toBatches(DOC, SESSION, typeText(PARA));
    b1[0].events.splice(2, 1);
    expect(verifyChain(DOC, b1).ok).toBe(false);
    const b2 = toBatches(DOC, SESSION, typeText(PARA));
    [b2[0], b2[1]] = [b2[1], b2[0]];
    expect(verifyChain(DOC, b2).ok).toBe(false);
  });
  it("detects a forged genesis (log moved to another document)", () => {
    const batches = toBatches(DOC, SESSION, typeText(PARA));
    expect(verifyChain("33333333-3333-4333-8333-333333333333", batches).ok).toBe(false);
  });
});

describe("replay", () => {
  it("reproduces the final text exactly", () => {
    const ev: DocEvent[] = [...typeText("Hello wrld")];
    ev.push({ seq: ev.length, t: 5000, type: "insert", from: 7, to: 7, text: "o", len: 1 });
    ev.push({ seq: ev.length, t: 5200, type: "delete", from: 0, to: 6, len: 0 });
    expect(replay(ev)).toBe("world");
  });
  it("rejects out-of-range events", () => {
    expect(() => replay([{ seq: 0, t: 0, type: "delete", from: 0, to: 3, len: 0 }])).toThrow();
  });
});

describe("stats & verdict", () => {
  it("typed text is Human-Verified", () => {
    const ev = typeText(PARA);
    // a few revisions
    ev.push({ seq: ev.length, t: ev.length * 150, type: "delete", from: PARA.length - 1, to: PARA.length, len: 0 });
    ev.push({ seq: ev.length, t: ev.length * 150, type: "insert", from: PARA.length - 1, to: PARA.length - 1, text: ".", len: 1 });
    const { text, stats } = computeStats(toBatches(DOC, SESSION, ev));
    expect(text).toBe(PARA);
    expect(stats.typedPct).toBe(100);
    expect(stats.flags).toEqual([]);
    expect(verdictFor(stats, true)).toBe("human_verified");
  });

  it("an external paste lowers typed % and is listed", () => {
    const ev = typeText("My own words. ");
    const pasted = "Artificial intelligence has transformed numerous industries in recent years.";
    ev.push({ seq: ev.length, t: ev.length * 150 + 500, type: "paste", from: 14, to: 14, text: pasted, len: pasted.length, src: "external" });
    const { stats } = computeStats(toBatches(DOC, SESSION, ev));
    expect(stats.typedPct).toBeLessThan(50);
    expect(stats.largePastes).toHaveLength(1);
    expect(verdictFor(stats, true)).toBe("unverified");
  });

  it("undo + redo of a paste stays attributed to the paste", () => {
    const ev = typeText("Mine. ");
    const pasted = "This sentence was copied from somewhere else entirely, word for word.";
    const at = 6;
    ev.push({ seq: ev.length, t: 2000, type: "paste", from: at, to: at, text: pasted, len: pasted.length, src: "external" });
    ev.push({ seq: ev.length, t: 3000, type: "undo", from: at, to: at + pasted.length, len: 0 });
    ev.push({ seq: ev.length, t: 4000, type: "redo", from: at, to: at, text: pasted, len: pasted.length });
    const { stats } = computeStats(toBatches(DOC, SESSION, ev));
    expect(stats.typedPct).toBeLessThan(20);
  });

  it("flags injection bursts (text inserted without a paste event)", () => {
    const ev = typeText("Start. ");
    let pos = 7;
    let t = 5000;
    for (let i = 0; i < 3; i++) {
      const chunk = "this text appeared instantly from a script ";
      ev.push({ seq: ev.length, t, type: "insert", from: pos, to: pos, text: chunk, len: chunk.length });
      pos += chunk.length;
      t += 3000;
    }
    const { stats } = computeStats(toBatches(DOC, SESSION, ev));
    expect(stats.injectionBursts.length).toBe(3);
    expect(stats.flags.join(" ")).toMatch(/injection/);
    expect(verdictFor(stats, true)).not.toBe("human_verified");
  });

  it("flags superhuman sustained typing speed", () => {
    const long = "word ".repeat(300);
    const { stats } = computeStats(toBatches(DOC, SESSION, typeText(long, { msPerChar: 40 })));
    expect(stats.maxWpm60s).toBeGreaterThan(120);
    expect(stats.flags.join(" ")).toMatch(/wpm/);
  });

  it("flags near-zero revisions over long text as possible transcription", () => {
    const words = Array.from({ length: 160 }, (_, i) => `w${i}`).join(" ");
    const { stats } = computeStats(toBatches(DOC, SESSION, typeText(words, { msPerChar: 200 })));
    expect(stats.flags.join(" ")).toMatch(/transcription/);
  });

  it("flags a timeline that claims more time than the server observed", () => {
    const batches = toBatches(DOC, SESSION, typeText(PARA.repeat(3)));
    // pretend every batch arrived within one second (an offline-fabricated log dumped at once)
    const t = Date.parse(batches[0].receivedAt);
    batches.forEach((b, i) => (b.receivedAt = new Date(t + i * 10).toISOString()));
    const { stats } = computeStats(batches);
    expect(stats.time.ok).toBe(false);
  });

  it("integrity failure is always Unverified", () => {
    const { stats } = computeStats(toBatches(DOC, SESSION, typeText(PARA)));
    expect(verdictFor(stats, false)).toBe("unverified");
  });
});

describe("certificate signatures", () => {
  it("signs and verifies; any change breaks the signature", async () => {
    const seed = new Uint8Array(32).fill(7);
    const { stats } = computeStats(toBatches(DOC, SESSION, typeText(PARA)));
    const payload: CertificatePayload = {
      v: 1, certId: "44444444-4444-4444-8444-444444444444", docId: DOC, author: "alice", title: "Fox",
      contentHash: contentHash(PARA), logHeadHash: "a".repeat(64), stats, verdict: "human_verified", issuedAt: "2026-11-21T00:00:00.000Z",
    };
    const cert = await signCertificate(payload, seed);
    expect(await verifyCertificateSignature(cert, cert.publicKey)).toBe(true);
    const forged = { ...cert, payload: { ...payload, verdict: "human_verified" as const, author: "mallory" } };
    expect(await verifyCertificateSignature(forged, cert.publicKey)).toBe(false);
    const other = await signCertificate(payload, new Uint8Array(32).fill(9));
    expect(await verifyCertificateSignature(other, cert.publicKey)).toBe(false);
  });
});
