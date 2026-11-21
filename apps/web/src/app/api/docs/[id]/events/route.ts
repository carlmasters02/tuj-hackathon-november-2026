import type { NextRequest } from "next/server";
import { z } from "zod";
import { EventBatchSchema, applyEvent, chainHead, genesisHash, ReplayError } from "@hm/shared/provenance/index";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dec, enc, ownedDoc } from "@/lib/server/docs";
import { contentToText } from "@/lib/server/pm";

const Body = EventBatchSchema.extend({ content: z.unknown() });

/**
 * Accepts one batch of provenance events (sent every ~2 s). The server:
 *  1. checks the batch continues the stored sequence and recomputes the hash chain,
 *  2. replays the events onto its own copy of the text (out-of-range events are rejected),
 *  3. requires the submitted editor content to project to exactly that text,
 *  4. stamps the batch with the server receipt time.
 * So content and log can never drift apart, and a log can't be built offline and dumped later
 * without the receipt times giving it away.
 */
export const POST = api(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const id = UUID.parse((await ctx.params).id);
  const body = await parseJson(req, Body, 1_500_000);
  const doc = await ownedDoc(id, user.id);

  const seqStart = body.events[0].seq;
  if (seqStart !== doc.last_seq + 1) throw new HttpError(409, "Out of sync with the server (another tab?). Reload the document.", { lastSeq: doc.last_seq });
  body.events.forEach((e, i) => {
    if (e.seq !== seqStart + i) throw new HttpError(400, "Events must have consecutive seq numbers");
  });

  const prev = doc.head_hash ?? genesisHash(id, body.sessionId);
  const head = chainHead(prev, body.events);
  if (head !== body.headHash) throw new HttpError(409, "Hash chain mismatch. Reload the document.");

  let text = dec(id, "text", doc.text_enc);
  try {
    for (const e of body.events) text = applyEvent(text, e);
  } catch (e) {
    if (e instanceof ReplayError) throw new HttpError(409, "Event doesn't apply to the document. Reload the document.");
    throw e;
  }
  if (text.length > 500_000) throw new HttpError(413, "Document too long");
  const contentText = contentToText(body.content);
  if (contentText !== text) throw new HttpError(409, "Editor content and event log disagree. Reload the document.");

  const sb = supabaseAdmin();
  const seqEnd = body.events[body.events.length - 1].seq;
  const { error: insErr } = await sb.from("doc_event_batches").insert({
    doc_id: id,
    session_id: body.sessionId,
    seq_start: seqStart,
    seq_end: seqEnd,
    events_json: body.events,
    head_hash: head,
  });
  if (insErr) {
    if (insErr.code === "23505") throw new HttpError(409, "Batch already received. Reload the document.");
    throw insErr;
  }
  const { data: upd, error: updErr } = await sb
    .from("documents")
    .update({
      head_hash: head,
      last_seq: seqEnd,
      first_session_id: doc.first_session_id ?? body.sessionId,
      text_enc: enc(id, "text", text),
      content_enc: enc(id, "content", JSON.stringify(body.content)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("last_seq", doc.last_seq) // optimistic concurrency
    .select("id");
  if (updErr) throw updErr;
  if (!upd?.length) throw new HttpError(409, "Concurrent edit detected. Reload the document.");
  return json({ ok: true, headHash: head, lastSeq: seqEnd });
});
