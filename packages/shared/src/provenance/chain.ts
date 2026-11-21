import { canonicalJSON } from "../canonicalJson";
import { sha256Hex } from "../hash";
import type { DocEvent, StoredBatch } from "./types";

/** h_0 = SHA-256(docId || sessionId) where sessionId is the document's *first* session. */
export function genesisHash(docId: string, firstSessionId: string): string {
  return sha256Hex(docId + firstSessionId);
}

/** h_i = SHA-256(h_{i-1} || canonicalJSON(event_i)) */
export function nextHash(prev: string, ev: DocEvent): string {
  return sha256Hex(prev + canonicalJSON(ev));
}

export function chainHead(prev: string, events: DocEvent[]): string {
  let h = prev;
  for (const e of events) h = nextHash(h, e);
  return h;
}

export type ChainCheck =
  | { ok: true; head: string; count: number }
  | { ok: false; reason: string; atSeq?: number };

/**
 * Re-derives the whole chain from genesis across stored batches. Fails on any seq gap,
 * reordering, or batch whose recorded headHash doesn't match the recomputed one.
 */
export function verifyChain(docId: string, batches: StoredBatch[]): ChainCheck {
  if (batches.length === 0) return { ok: false, reason: "empty log" };
  let h = genesisHash(docId, batches[0].sessionId);
  let expectSeq = 0;
  let count = 0;
  for (const b of batches) {
    if (b.seqStart !== expectSeq) return { ok: false, reason: "sequence gap", atSeq: expectSeq };
    for (const e of b.events) {
      if (e.seq !== expectSeq) return { ok: false, reason: "sequence gap", atSeq: expectSeq };
      h = nextHash(h, e);
      expectSeq++;
      count++;
    }
    if (b.seqEnd !== expectSeq - 1) return { ok: false, reason: "batch seqEnd mismatch", atSeq: b.seqEnd };
    if (h !== b.headHash) return { ok: false, reason: "hash chain broken", atSeq: b.seqEnd };
  }
  return { ok: true, head: h, count };
}
