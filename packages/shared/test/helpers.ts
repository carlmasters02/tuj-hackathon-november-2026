import { chainHead, genesisHash, type DocEvent, type StoredBatch } from "@hm/shared/provenance/index";

/** Simulates a human typing `text` one char at a time, ~150 ms apart, uploaded in 2 s batches. */
export function typeText(text: string, opts: { start?: string; msPerChar?: number; startT?: number; seq0?: number } = {}): DocEvent[] {
  const ms = opts.msPerChar ?? 150;
  let pos = 0;
  let seq = opts.seq0 ?? 0;
  const t0 = opts.startT ?? 0;
  return [...text].map((ch, i) => ({ seq: seq++, t: t0 + i * ms, type: "insert" as const, from: pos, to: pos++, text: ch, len: ch.length }));
}

export function toBatches(docId: string, sessionId: string, events: DocEvent[], startIso = "2026-11-21T00:00:00.000Z", batchMs = 2000): StoredBatch[] {
  const out: StoredBatch[] = [];
  let prev = genesisHash(docId, sessionId);
  const t0 = Date.parse(startIso);
  let cur: DocEvent[] = [];
  let windowEnd = (events[0]?.t ?? 0) + batchMs;
  const flush = () => {
    if (!cur.length) return;
    const head = chainHead(prev, cur);
    out.push({ sessionId, seqStart: cur[0].seq, seqEnd: cur[cur.length - 1].seq, events: cur, headHash: head, receivedAt: new Date(t0 + cur[cur.length - 1].t + 300).toISOString() });
    prev = head;
    cur = [];
  };
  for (const e of events) {
    if (e.t >= windowEnd) {
      flush();
      windowEnd = e.t + batchMs;
    }
    cur.push(e);
  }
  flush();
  return out;
}
