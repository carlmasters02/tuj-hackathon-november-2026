import { ReplayError } from "./replay";
import type { StoredBatch } from "./types";

export const LARGE_PASTE_CHARS = 40;
export const IDLE_GAP_MS = 60_000;
export const BURST_WINDOW_MS = 50;
export const BURST_MIN_CHARS = 20;
export const MAX_HUMAN_WPM = 120;
export const TRANSCRIPTION_MIN_WORDS = 150;
export const TRANSCRIPTION_MAX_REVISION_RATIO = 0.02;
export const CLIENT_AHEAD_TOLERANCE_MS = 15_000;
export const MAX_BATCH_SPAN_MS = 90_000;
export const DELAYED_UPLOAD_MS = 120_000;

/** Character origin tags tracked through replay. */
const TYPED = 0;
const EXTERNAL = 1;

export interface DocStats {
  finalChars: number;
  finalWords: number;
  /** Share of the *final* text whose characters were typed here (0–100, one decimal). */
  typedPct: number;
  externalPasteChars: number;
  externalPasteCount: number;
  largePastes: { seq: number; len: number }[];
  internalPasteChars: number;
  activeSeconds: number;
  wpm: number;
  maxWpm60s: number;
  injectionBursts: { seq: number; chars: number }[];
  insertedChars: number;
  deletedChars: number;
  revisionRatio: number;
  sessions: number;
  events: number;
  time: { maxClientAheadMs: number; maxBatchSpanMs: number; delayedBatches: number; ok: boolean };
  flags: string[];
}

export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  // CJK text has no spaces: count each CJK character as a word-equivalent.
  const cjk = text.match(/[぀-ヿ㐀-鿿가-힯]/g);
  const latin = (m ?? []).filter((w) => !/^[぀-ヿ㐀-鿿가-힯]+$/.test(w)).length;
  return latin + (cjk?.length ?? 0);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Replays the log while tracking where every character came from, and derives the
 * authenticity statistics. Throws ReplayError if the log can't be replayed.
 */
export function computeStats(batches: StoredBatch[]): { text: string; stats: DocStats } {
  let text = "";
  let origin = new Uint8Array(0);
  let graveyardText = ""; // removed text, used to restore origins on undo/redo
  let graveyardOrigin: number[] = [];
  let externalPool = ""; // all externally pasted text

  let externalPasteChars = 0;
  let externalPasteCount = 0;
  let internalPasteChars = 0;
  let insertedChars = 0;
  let deletedChars = 0;
  const largePastes: { seq: number; len: number }[] = [];
  const injectionBursts: { seq: number; chars: number }[] = [];
  let activeMs = 0;
  let maxChars60 = 0;
  let maxClientAheadMs = 0;
  let maxBatchSpanMs = 0;
  let delayedBatches = 0;
  let delayedChars = 0;
  let events = 0;

  // group batches into sessions (a session is contiguous batches sharing sessionId)
  const sessions: StoredBatch[][] = [];
  for (const b of batches) {
    const last = sessions[sessions.length - 1];
    if (last && last[0].sessionId === b.sessionId) last.push(b);
    else sessions.push([b]);
  }

  for (const session of sessions) {
    const sEvents = session.flatMap((b) => b.events);
    if (sEvents.length === 0) continue;
    const t0 = sEvents[0].t;
    const r0 = Date.parse(session[0].receivedAt);

    // server-time consistency
    for (const b of session) {
      if (b.events.length === 0) continue;
      const first = b.events[0].t;
      const last = b.events[b.events.length - 1].t;
      maxBatchSpanMs = Math.max(maxBatchSpanMs, last - first);
      const clientElapsed = last - t0;
      const serverElapsed = Date.parse(b.receivedAt) - r0;
      maxClientAheadMs = Math.max(maxClientAheadMs, clientElapsed - serverElapsed);
      if (serverElapsed - clientElapsed > DELAYED_UPLOAD_MS) {
        delayedBatches++;
        delayedChars += b.events.reduce((n, e) => n + e.len, 0);
      }
    }

    // active time & cadence
    let prevT = t0;
    const typedTimes: { t: number; n: number }[] = [];
    let burst: { start: number; seq: number; chars: number } | null = null;
    const closeBurst = () => {
      if (burst && burst.chars > BURST_MIN_CHARS) injectionBursts.push({ seq: burst.seq, chars: burst.chars });
      burst = null;
    };

    for (const e of sEvents) {
      events++;
      const gap = e.t - prevT;
      if (gap > 0 && gap <= IDLE_GAP_MS) activeMs += gap;
      prevT = Math.max(prevT, e.t);

      if (e.type === "focus" || e.type === "blur") continue;
      if (e.to > text.length || e.from > e.to) throw new ReplayError(`event ${e.seq} out of range`);

      const removedText = text.slice(e.from, e.to);
      const removedOrigin = Array.from(origin.subarray(e.from, e.to));
      const ins = e.text ?? "";
      const insOrigin = new Uint8Array(ins.length);

      const isPaste = e.type === "paste";
      const isHistory = e.type === "undo" || e.type === "redo";
      const isTyping = e.type === "insert" || e.type === "replace" || e.type === "delete" || e.type === "cut";

      if (isPaste && e.src === "external") {
        insOrigin.fill(EXTERNAL);
        externalPasteChars += ins.length;
        externalPasteCount++;
        externalPool += ins;
        if (ins.length > LARGE_PASTE_CHARS) largePastes.push({ seq: e.seq, len: ins.length });
      } else if (isPaste) {
        // internal paste: copy the origins of the first occurrence in the current text
        internalPasteChars += ins.length;
        const at = text.indexOf(ins);
        if (at >= 0) insOrigin.set(origin.subarray(at, at + ins.length));
        else {
          // not actually internal — treat as external (client mislabelled it)
          insOrigin.fill(EXTERNAL);
          externalPasteChars += ins.length;
          externalPasteCount++;
          externalPool += ins;
          if (ins.length > LARGE_PASTE_CHARS) largePastes.push({ seq: e.seq, len: ins.length });
        }
      } else if (isHistory && ins.length) {
        const g = graveyardText.lastIndexOf(ins);
        if (g >= 0) insOrigin.set(graveyardOrigin.slice(g, g + ins.length));
        else if (externalPool.includes(ins)) insOrigin.fill(EXTERNAL);
        // else: typed (default 0)
      }

      if (isTyping) {
        insertedChars += ins.length;
        deletedChars += e.to - e.from;
        if (ins.length) {
          typedTimes.push({ t: e.t, n: ins.length });
          // injection bursts: >20 chars inserted within 50 ms with no paste event
          if (burst && e.t - burst.start <= BURST_WINDOW_MS) burst.chars += ins.length;
          else {
            closeBurst();
            burst = { start: e.t, seq: e.seq, chars: ins.length };
          }
        }
      }

      if (removedText.length) {
        graveyardText += removedText;
        graveyardOrigin = graveyardOrigin.concat(removedOrigin);
        if (graveyardText.length > 1_000_000) {
          graveyardText = graveyardText.slice(-500_000);
          graveyardOrigin = graveyardOrigin.slice(-500_000);
        }
      }

      text = text.slice(0, e.from) + ins + text.slice(e.to);
      const next = new Uint8Array(text.length);
      next.set(origin.subarray(0, e.from), 0);
      next.set(insOrigin, e.from);
      next.set(origin.subarray(e.to), e.from + ins.length);
      origin = next;
    }
    closeBurst();

    // max chars typed in any 60s window
    let j = 0;
    let sum = 0;
    for (let i = 0; i < typedTimes.length; i++) {
      sum += typedTimes[i].n;
      while (typedTimes[i].t - typedTimes[j].t > 60_000) sum -= typedTimes[j++].n;
      maxChars60 = Math.max(maxChars60, sum);
    }
  }

  const finalWords = countWords(text);
  let typed = 0;
  for (let i = 0; i < origin.length; i++) if (origin[i] === TYPED && !/\s/.test(text[i])) typed++;
  const nonSpace = text.replace(/\s/g, "").length;
  const typedPct = nonSpace === 0 ? 100 : round1((100 * typed) / nonSpace);
  const activeSeconds = Math.round(activeMs / 1000);
  const wpm = activeSeconds > 0 ? round1(finalWords / (activeSeconds / 60)) : 0;
  const maxWpm60s = round1(maxChars60 / 5); // standard 5 chars per word
  const revisionRatio = insertedChars > 0 ? round3(deletedChars / insertedChars) : 0;
  const timeOk =
    maxClientAheadMs <= CLIENT_AHEAD_TOLERANCE_MS &&
    maxBatchSpanMs <= MAX_BATCH_SPAN_MS &&
    delayedChars <= Math.max(50, text.length * 0.1);

  const flags: string[] = [];
  if (maxWpm60s > MAX_HUMAN_WPM) flags.push(`Sustained typing above ${MAX_HUMAN_WPM} wpm (${maxWpm60s} wpm peak over 60 s)`);
  if (injectionBursts.length >= 3) flags.push(`${injectionBursts.length} injection bursts (>${BURST_MIN_CHARS} chars in <${BURST_WINDOW_MS} ms without a paste)`);
  if (finalWords >= TRANSCRIPTION_MIN_WORDS && revisionRatio < TRANSCRIPTION_MAX_REVISION_RATIO)
    flags.push(`Almost no revisions over ${finalWords} words (ratio ${revisionRatio}) — possible transcription`);
  if (!timeOk) flags.push("Event timeline is inconsistent with server receipt times");

  return {
    text,
    stats: {
      finalChars: text.length,
      finalWords,
      typedPct,
      externalPasteChars,
      externalPasteCount,
      largePastes,
      internalPasteChars,
      activeSeconds,
      wpm,
      maxWpm60s,
      injectionBursts,
      insertedChars,
      deletedChars,
      revisionRatio,
      sessions: sessions.length,
      events,
      time: { maxClientAheadMs, maxBatchSpanMs, delayedBatches, ok: timeOk },
      flags,
    },
  };
}

export type Verdict = "human_verified" | "mostly_human" | "unverified";

export const VERDICT_LABEL: Record<Verdict, string> = {
  human_verified: "Human-Verified",
  mostly_human: "Mostly Human",
  unverified: "Unverified",
};

export function verdictFor(stats: DocStats, integrityOk: boolean): Verdict {
  if (!integrityOk) return "unverified";
  if (stats.typedPct >= 95 && stats.flags.length === 0) return "human_verified";
  if (stats.typedPct >= 75) return "mostly_human";
  return "unverified";
}
