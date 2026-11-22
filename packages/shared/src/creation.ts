/**
 * Provenance for the drawing studio (art) and the composer (music): same idea as the writing
 * editor — every edit is an event in a SHA-256 hash chain, batched to the server, which stamps
 * receipt times. The final artwork/score is *derived* from the events, so the certificate proves
 * exactly how it was made. Pure functions, unit-tested.
 */
import { z } from "zod";
import { canonicalJSON } from "./canonicalJson";
import { sha256Hex } from "./hash";

export type CreationKind = "art" | "music";

// ── events ────────────────────────────────────────────────────────────────
export const CANVAS_W = 1200;
export const CANVAS_H = 900;
export const MAX_STROKE_POINTS = 2000;

const base = { seq: z.number().int().nonnegative(), t: z.number().int().nonnegative().max(86_400_000) };
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

/** Two-point tools: pts is exactly [x0, y0, x1, y1] (start and end of the drag). */
export const SHAPE_TOOLS = ["line", "rect", "ellipse"] as const;
/** Pixel mode cell sizes; each divides both canvas sides so the grid tiles the page exactly. */
export const PIXEL_SIZES = [10, 15, 20, 30] as const;

const ArtEventUnion = z.discriminatedUnion("type", [
  z
    .object({
      ...base,
      type: z.literal("stroke"),
      // pen/marker/eraser: freehand polyline · line/rect/ellipse: two points · pixel: top-left corner of each painted grid cell
      tool: z.enum(["pen", "marker", "eraser", "line", "rect", "ellipse", "pixel"]),
      color: hex,
      size: z.number().int().min(1).max(80),
      // flat [x0, y0, x1, y1, ...] in canvas pixels
      pts: z.array(z.number().int().min(-50).max(Math.max(CANVAS_W, CANVAS_H) + 50)).min(2).max(MAX_STROKE_POINTS * 2).refine((a) => a.length % 2 === 0, "odd point list"),
      dur: z.number().int().min(0).max(600_000), // ms from pointer down to up
    })
    .strict(),
  z.object({ ...base, type: z.literal("undo") }).strict(),
  z.object({ ...base, type: z.literal("clear") }).strict(),
]);
export const ArtEventSchema = ArtEventUnion.superRefine((e, ctx) => {
  if (e.type !== "stroke") return;
  if ((SHAPE_TOOLS as readonly string[]).includes(e.tool) && e.pts.length !== 4) ctx.addIssue({ code: "custom", message: "shapes need exactly two points" });
  if (e.tool === "pixel") {
    if (!(PIXEL_SIZES as readonly number[]).includes(e.size)) ctx.addIssue({ code: "custom", message: "unsupported pixel size" });
    for (let i = 0; i < e.pts.length; i += 2) {
      const [x, y] = [e.pts[i], e.pts[i + 1]];
      if (x % e.size || y % e.size || x < 0 || y < 0 || x >= CANVAS_W || y >= CANVAS_H) {
        ctx.addIssue({ code: "custom", message: "pixel cells must sit on the grid inside the canvas" });
        return;
      }
    }
  }
});
export type ArtEvent = z.infer<typeof ArtEventUnion>;

export const STEPS = 16;
export const ROWS = 12;
export const MusicEventSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("toggle"), step: z.number().int().min(0).max(STEPS - 1), row: z.number().int().min(0).max(ROWS - 1) }).strict(),
  z.object({ ...base, type: z.literal("tempo"), bpm: z.number().int().min(60).max(200) }).strict(),
  z.object({ ...base, type: z.literal("clear") }).strict(),
]);
export type MusicEvent = z.infer<typeof MusicEventSchema>;

export type CreationEvent = ArtEvent | MusicEvent;

export const creationBatchSchema = (kind: CreationKind) =>
  z
    .object({
      sessionId: z.string().uuid(),
      events: z.array(kind === "art" ? ArtEventSchema : MusicEventSchema).min(1).max(500),
      headHash: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .strict();

export interface CreationBatch<E = CreationEvent> {
  sessionId: string;
  seqStart: number;
  seqEnd: number;
  events: E[];
  headHash: string;
  receivedAt: string;
}

// ── hash chain ────────────────────────────────────────────────────────────
export const creationGenesis = (id: string, firstSessionId: string) => sha256Hex(`creation|${id}|${firstSessionId}`);
export const creationNext = (prev: string, ev: CreationEvent) => sha256Hex(prev + canonicalJSON(ev));
export function creationHead(prev: string, events: CreationEvent[]) {
  let h = prev;
  for (const e of events) h = creationNext(h, e);
  return h;
}

export function verifyCreationChain(id: string, batches: CreationBatch[]): { ok: true; head: string } | { ok: false; reason: string } {
  if (!batches.length) return { ok: false, reason: "empty log" };
  let h = creationGenesis(id, batches[0].sessionId);
  let seq = 0;
  for (const b of batches) {
    if (b.seqStart !== seq) return { ok: false, reason: "sequence gap" };
    for (const e of b.events) {
      if (e.seq !== seq++) return { ok: false, reason: "sequence gap" };
      h = creationNext(h, e);
    }
    if (h !== b.headHash) return { ok: false, reason: "hash chain broken" };
  }
  return { ok: true, head: h };
}

// ── replay ────────────────────────────────────────────────────────────────
export type Stroke = Extract<ArtEvent, { type: "stroke" }>;

export function replayArt(events: ArtEvent[]): Stroke[] {
  const strokes: Stroke[] = [];
  for (const e of events) {
    if (e.type === "stroke") strokes.push(e);
    else if (e.type === "undo") strokes.pop();
    else strokes.length = 0;
  }
  return strokes;
}

export interface Score {
  bpm: number;
  cells: string[]; // "step:row", sorted
}

export function replayMusic(events: MusicEvent[]): Score {
  let bpm = 110;
  const on = new Set<string>();
  for (const e of events) {
    if (e.type === "toggle") {
      const k = `${e.step}:${e.row}`;
      if (on.has(k)) on.delete(k);
      else on.add(k);
    } else if (e.type === "tempo") bpm = e.bpm;
    else on.clear();
  }
  return { bpm, cells: [...on].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) };
}

/** Background colour used when rendering — the eraser paints with it. */
export const PAPER = "#fffbf2";

/** Deterministic SVG rendering of strokes (server renders it to PNG; replay players reuse the path maths). */
export function strokePath(pts: number[]): string {
  if (pts.length === 2) return `M${pts[0]} ${pts[1]}l0.01 0`;
  let d = `M${pts[0]} ${pts[1]}`;
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (pts[i] + pts[i + 2]) / 2;
    const my = (pts[i + 1] + pts[i + 3]) / 2;
    d += `Q${pts[i]} ${pts[i + 1]} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  d += `L${pts[pts.length - 2]} ${pts[pts.length - 1]}`;
  return d;
}

/**
 * Geometry for any stroke as SVG path data. The server's PNG render and the browser canvas both
 * draw from this, so the certified image and what the artist saw cannot drift apart.
 * `fill` strokes (pixel cells) are filled squares; everything else is stroked with `size`.
 */
export function strokeShape(s: Pick<Stroke, "tool" | "size">, pts: number[]): { d: string; fill: boolean } {
  if (s.tool === "pixel") {
    let d = "";
    for (let i = 0; i + 1 < pts.length; i += 2) d += `M${pts[i]} ${pts[i + 1]}h${s.size}v${s.size}h-${s.size}Z`;
    return { d, fill: true };
  }
  if ((SHAPE_TOOLS as readonly string[]).includes(s.tool)) {
    const [x0, y0] = pts;
    const [x1, y1] = pts.length >= 4 ? pts.slice(-2) : pts;
    if (s.tool === "line") return { d: `M${x0} ${y0}L${x1} ${y1}`, fill: false };
    if (s.tool === "rect") return { d: `M${x0} ${y0}H${x1}V${y1}H${x0}Z`, fill: false };
    const rx = Math.max(0.5, Math.abs(x1 - x0) / 2);
    const ry = Math.max(0.5, Math.abs(y1 - y0) / 2);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return { d: `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`, fill: false };
  }
  return { d: strokePath(pts), fill: false };
}

export const strokeColor = (s: Pick<Stroke, "tool" | "color">) => (s.tool === "eraser" ? PAPER : s.color);
export const strokeOpacity = (s: Pick<Stroke, "tool">) => (s.tool === "marker" ? 0.55 : 1);

export function artToSvg(strokes: Stroke[]): string {
  const paths = strokes
    .map((s) => {
      const { d, fill } = strokeShape(s, s.pts);
      const color = strokeColor(s);
      return fill
        ? `<path d="${d}" fill="${color}" shape-rendering="crispEdges"/>`
        : `<path d="${d}" stroke="${color}" stroke-width="${s.size}" stroke-opacity="${strokeOpacity(s)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"><rect width="100%" height="100%" fill="${PAPER}"/>${paths}</svg>`;
}

// ── stats & verdict ───────────────────────────────────────────────────────
export interface CreationStats {
  events: number;
  activeSeconds: number;
  sessions: number;
  strokes?: number; // art: strokes drawn (including undone ones)
  finalStrokes?: number;
  undos?: number;
  noteEdits?: number; // music
  finalNotes?: number;
  scriptedStrokes?: number; // strokes drawn implausibly fast
  time: { maxClientAheadMs: number; maxBatchSpanMs: number; ok: boolean };
  flags: string[];
}

export type CreationVerdict = "human_verified" | "mostly_human" | "unverified";

export function creationStats(kind: CreationKind, batches: CreationBatch[]): { stats: CreationStats; contentHash: string } {
  const events = batches.flatMap((b) => b.events);
  let activeMs = 0;
  let maxClientAheadMs = 0;
  let maxBatchSpanMs = 0;
  const sessions = new Set(batches.map((b) => b.sessionId));
  for (const sid of sessions) {
    const sb = batches.filter((b) => b.sessionId === sid);
    const ev = sb.flatMap((b) => b.events);
    const t0 = ev[0]?.t ?? 0;
    const r0 = Date.parse(sb[0].receivedAt);
    for (let i = 1; i < ev.length; i++) {
      const gap = ev[i].t - ev[i - 1].t;
      if (gap > 0 && gap <= 60_000) activeMs += gap;
    }
    for (const b of sb) {
      const last = b.events[b.events.length - 1].t;
      maxBatchSpanMs = Math.max(maxBatchSpanMs, last - b.events[0].t);
      maxClientAheadMs = Math.max(maxClientAheadMs, last - t0 - (Date.parse(b.receivedAt) - r0));
    }
  }
  const timeOk = maxClientAheadMs <= 15_000 && maxBatchSpanMs <= 90_000;
  const flags: string[] = [];
  if (!timeOk) flags.push("Event timeline is inconsistent with server receipt times");

  const stats: CreationStats = { events: events.length, activeSeconds: Math.round(activeMs / 1000), sessions: sessions.size, time: { maxClientAheadMs, maxBatchSpanMs, ok: timeOk }, flags };
  let content: unknown;
  if (kind === "art") {
    const art = events as ArtEvent[];
    const strokes = art.filter((e): e is Stroke => e.type === "stroke");
    // a human hand can't lay down a long, many-point stroke in a few milliseconds
    const scripted = strokes.filter((s) => s.pts.length / 2 > 20 && s.dur < 40).length;
    const final = replayArt(art);
    Object.assign(stats, { strokes: strokes.length, finalStrokes: final.length, undos: art.filter((e) => e.type === "undo").length, scriptedStrokes: scripted });
    if (scripted > 0) flags.push(`${scripted} stroke(s) were drawn faster than a hand can move`);
    if (stats.activeSeconds > 0 && strokes.length / stats.activeSeconds > 4) flags.push("Strokes arrived faster than a person can draw");
    content = final;
  } else {
    const music = events as MusicEvent[];
    const score = replayMusic(music);
    Object.assign(stats, { noteEdits: music.filter((e) => e.type === "toggle").length, finalNotes: score.cells.length });
    if (stats.activeSeconds > 0 && (stats.noteEdits ?? 0) / stats.activeSeconds > 8) flags.push("Notes were entered faster than a person can click");
    content = score;
  }
  return { stats, contentHash: sha256Hex(canonicalJSON(content)) };
}

/** A certificate must describe a non-empty final artifact, not an erased or cleared canvas/score. */
export function creationHasContent(kind: CreationKind, s: CreationStats): boolean {
  return kind === "art" ? (s.finalStrokes ?? 0) > 0 : (s.finalNotes ?? 0) > 0;
}

export function creationVerdict(kind: CreationKind, s: CreationStats, integrityOk: boolean): CreationVerdict {
  // Legacy enum values stay on the wire for certificate compatibility. The displayed badge means
  // "creation record verified": replay integrity and a compatible timeline, not an effort judgment.
  if (!integrityOk || !creationHasContent(kind, s) || s.flags.length > 0) return "unverified";
  return "human_verified";
}

/** C major across two octaves, bottom row first: C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5. */
export const SCALE_HZ = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99];
export const NOTE_NAMES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5"];
