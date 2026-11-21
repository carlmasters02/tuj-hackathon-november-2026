import type { NextRequest } from "next/server";
import { api, json, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownedDoc } from "@/lib/server/docs";

/** The owner's own event log, for the version-history slider. Never served to anyone else. */
export const GET = api(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  await rateLimit("api", user.id);
  const id = UUID.parse((await ctx.params).id);
  await ownedDoc(id, user.id);
  const { data, error } = await supabaseAdmin()
    .from("doc_event_batches")
    .select("session_id, seq_start, seq_end, events_json, head_hash, received_at")
    .eq("doc_id", id)
    .order("seq_start", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return json({
    batches: (data ?? []).map((b) => ({ sessionId: b.session_id, seqStart: b.seq_start, seqEnd: b.seq_end, events: b.events_json, headHash: b.head_hash, receivedAt: b.received_at })),
  });
});
