import type { NextRequest } from "next/server";
import { creationBatchSchema, creationGenesis, creationHead } from "@hm/shared/creation";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownedCreation } from "@/lib/server/creations";

/** One batch of studio/composer events: schema-checked, chain recomputed, receipt time stamped. */
export const POST = api(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const id = UUID.parse((await ctx.params).id);
  const c = await ownedCreation(id, user.id);
  if (c.status === "finalized") throw new HttpError(409, "This piece is finished and can't be changed.");
  const body = await parseJson(req, creationBatchSchema(c.kind), 2_000_000);
  const seqStart = body.events[0].seq;
  if (seqStart !== c.last_seq + 1) throw new HttpError(409, "This is open in another tab or window. Reload the page to continue with the latest version.", { lastSeq: c.last_seq });
  body.events.forEach((e, i) => {
    if (e.seq !== seqStart + i) throw new HttpError(400, "Your latest changes got out of step with the saved copy. Reload the page; everything saved so far is safe.");
  });
  const head = creationHead(c.head_hash ?? creationGenesis(id, body.sessionId), body.events);
  if (head !== body.headHash) throw new HttpError(409, "Your latest changes got out of step with the saved copy. Reload the page; everything saved so far is safe.");
  const sb = supabaseAdmin();
  const seqEnd = body.events[body.events.length - 1].seq;
  const { error } = await sb.from("creation_event_batches").insert({ creation_id: id, session_id: body.sessionId, seq_start: seqStart, seq_end: seqEnd, events_json: body.events, head_hash: head });
  if (error) throw error.code === "23505" ? new HttpError(409, "This change was already saved. Reload the page to continue.") : error;
  const { data: upd } = await sb
    .from("creations")
    .update({ head_hash: head, last_seq: seqEnd, first_session_id: c.first_session_id ?? body.sessionId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("last_seq", c.last_seq)
    .select("id");
  if (!upd?.length) throw new HttpError(409, "This is open in another tab or window. Reload the page to continue with the latest version.");
  return json({ ok: true, headHash: head, lastSeq: seqEnd });
});
