import "server-only";
import { publicKeyFromSeed } from "@hm/shared/certificate";
import type { StoredBatch } from "@hm/shared/provenance/types";
import { keyBytes } from "../env";
import { supabaseAdmin } from "../supabase/admin";

let pk: string | null = null;
export async function serverPublicKey(): Promise<string> {
  return (pk ??= await publicKeyFromSeed(keyBytes("HM_SIGNING_KEY")));
}

export async function loadBatches(docId: string): Promise<StoredBatch[]> {
  const out: StoredBatch[] = [];
  const sb = supabaseAdmin();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("doc_event_batches")
      .select("session_id, seq_start, seq_end, events_json, head_hash, received_at")
      .eq("doc_id", docId)
      .order("seq_start", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    for (const b of data ?? [])
      out.push({ sessionId: b.session_id, seqStart: b.seq_start, seqEnd: b.seq_end, events: b.events_json, headHash: b.head_hash, receivedAt: b.received_at });
    if (!data || data.length < 1000) break;
  }
  return out;
}
