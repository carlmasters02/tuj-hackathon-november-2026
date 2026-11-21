import type { DocEvent } from "./types";

export class ReplayError extends Error {}

/** Applies one event to text. Throws ReplayError on an out-of-range event. */
export function applyEvent(text: string, e: DocEvent): string {
  if (e.type === "focus" || e.type === "blur") return text;
  if (e.to > text.length || e.from > e.to) throw new ReplayError(`event ${e.seq} out of range`);
  return text.slice(0, e.from) + (e.text ?? "") + text.slice(e.to);
}

/** Replays the full log from an empty document. */
export function replay(events: DocEvent[]): string {
  let text = "";
  for (const e of events) text = applyEvent(text, e);
  return text;
}

/** Yields every intermediate state — used by the replay player. */
export function* replaySteps(events: DocEvent[]): Generator<{ event: DocEvent; text: string }> {
  let text = "";
  for (const e of events) {
    text = applyEvent(text, e);
    yield { event: e, text };
  }
}

/**
 * Minimal single-range diff between two strings (common prefix + common suffix).
 * Used by the editor to turn each ProseMirror transaction into one DocEvent.
 */
export function diffRange(a: string, b: string): { from: number; to: number; text: string } | null {
  if (a === b) return null;
  let start = 0;
  const minLen = Math.min(a.length, b.length);
  while (start < minLen && a.charCodeAt(start) === b.charCodeAt(start)) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a.charCodeAt(endA - 1) === b.charCodeAt(endB - 1)) {
    endA--;
    endB--;
  }
  return { from: start, to: endA, text: b.slice(start, endB) };
}
