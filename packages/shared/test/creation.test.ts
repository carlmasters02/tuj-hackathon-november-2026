import { describe, expect, it } from "vitest";
import {
  artToSvg, creationGenesis, creationHead, creationStats, creationVerdict, replayArt, replayMusic, verifyCreationChain,
  ArtEventSchema, type ArtEvent, type CreationBatch, type CreationEvent, type MusicEvent,
} from "@hm/shared/creation";

const ID = "55555555-5555-4555-8555-555555555555";
const SID = "66666666-6666-4666-8666-666666666666";

/** Groups events into 2-second upload windows, like the real client. */
function batches(events: CreationEvent[], start = "2026-11-21T00:00:00.000Z"): CreationBatch[] {
  const out: CreationBatch[] = [];
  let prev = creationGenesis(ID, SID);
  const t0 = Date.parse(start);
  let cur: CreationEvent[] = [];
  const flush = () => {
    if (!cur.length) return;
    const head = creationHead(prev, cur);
    out.push({ sessionId: SID, seqStart: cur[0].seq, seqEnd: cur[cur.length - 1].seq, events: cur, headHash: head, receivedAt: new Date(t0 + cur[cur.length - 1].t + 300).toISOString() });
    prev = head;
    cur = [];
  };
  for (const e of events) {
    if (cur.length && e.t - cur[0].t >= 2000) flush();
    cur.push(e);
  }
  flush();
  return out;
}

const humanStroke = (seq: number, t: number): ArtEvent => ({ seq, t, type: "stroke", tool: "pen", color: "#1b2b5e", size: 6, pts: Array.from({ length: 60 }, (_, i) => (i % 2 ? 300 + i * 2 : 100 + i * 3)), dur: 900 });

describe("art provenance", () => {
  const drawing: ArtEvent[] = Array.from({ length: 16 }, (_, i) => humanStroke(i, i * 4000));
  drawing.push({ seq: 16, t: 66_000, type: "undo" });

  it("replays strokes with undo and renders SVG", () => {
    expect(replayArt(drawing)).toHaveLength(15);
    expect(artToSvg(replayArt(drawing))).toMatch(/^<svg[\s\S]*<path d="M100 302Q/);
  });
  it("a drawing with an intact creation record is verified", () => {
    const b = batches(drawing);
    expect(verifyCreationChain(ID, b).ok).toBe(true);
    const { stats } = creationStats("art", b);
    expect(stats.strokes).toBe(16);
    expect(creationVerdict("art", stats, true)).toBe("human_verified");
  });
  it("detects tampering", () => {
    const b = batches(drawing);
    (b[2].events[0] as any).color = "#ff0000"; // one stroke per 2 s window
    expect(verifyCreationChain(ID, b).ok).toBe(false);
  });
  it("flags scripted strokes (many points in a few ms)", () => {
    const fast = drawing.map((e) => (e.type === "stroke" ? { ...e, dur: 5 } : e));
    const { stats } = creationStats("art", batches(fast));
    expect(stats.scriptedStrokes).toBe(16);
    expect(creationVerdict("art", stats, true)).not.toBe("human_verified");
  });
  it("one valid stroke can be verified without a time or count minimum", () => {
    const { stats } = creationStats("art", batches(drawing.slice(0, 1)));
    expect(stats.finalStrokes).toBe(1);
    expect(creationVerdict("art", stats, true)).toBe("human_verified");
  });
  it("an empty replay after undoing every stroke cannot be verified", () => {
    const events = drawing.slice(0, 1).concat({ seq: 1, t: 2000, type: "undo" });
    const { stats } = creationStats("art", batches(events));
    expect(stats.finalStrokes).toBe(0);
    expect(creationVerdict("art", stats, true)).toBe("unverified");
  });
  it("rejects malformed strokes", () => {
    expect(ArtEventSchema.safeParse({ seq: 0, t: 0, type: "stroke", tool: "pen", color: "red", size: 4, pts: [1, 2], dur: 10 }).success).toBe(false);
    expect(ArtEventSchema.safeParse({ seq: 0, t: 0, type: "stroke", tool: "pen", color: "#000000", size: 4, pts: [1, 2, 3], dur: 10 }).success).toBe(false);
  });
});

describe("music provenance", () => {
  const edits: MusicEvent[] = Array.from({ length: 20 }, (_, i) => ({ seq: i, t: i * 3000, type: "toggle", step: i % 16, row: (i * 5) % 12 }) as MusicEvent);
  it("toggles build the score; repeated toggles cancel", () => {
    const s = replayMusic([...edits, { seq: 20, t: 61_000, type: "toggle", step: 0, row: 0 }, { seq: 21, t: 62_000, type: "tempo", bpm: 96 }]);
    expect(s.bpm).toBe(96);
    expect(s.cells).not.toContain("0:0");
  });
  it("a composed piece with an intact creation record is verified", () => {
    const { stats } = creationStats("music", batches(edits));
    expect(stats.noteEdits).toBe(20);
    expect(creationVerdict("music", stats, true)).toBe("human_verified");
  });
  it("one active music cell can be verified without an edit minimum", () => {
    const { stats } = creationStats("music", batches(edits.slice(0, 1)));
    expect(stats.finalNotes).toBe(1);
    expect(creationVerdict("music", stats, true)).toBe("human_verified");
  });
  it("an empty music score cannot be verified", () => {
    const events = edits.slice(0, 1).concat({ seq: 1, t: 2000, type: "clear" });
    const { stats } = creationStats("music", batches(events));
    expect(stats.finalNotes).toBe(0);
    expect(creationVerdict("music", stats, true)).toBe("unverified");
  });
});
