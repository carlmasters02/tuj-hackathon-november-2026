import type { NextRequest } from "next/server";
import { z } from "zod";
import { DocEventSchema, EventBatchSchema, applyEvent, chainHead, genesisHash, ReplayError } from "@hm/shared/provenance/index";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dec, enc, ownedDoc } from "@/lib/server/docs";
import { contentToText } from "@/lib/server/pm";
import { contentFingerprint } from "@hm/shared/contentFingerprint";

// An empty event list is a content-only save for formatting, citations and other changes that
// deliberately add nothing to the provenance text projection. It never creates a log batch.
const Body = EventBatchSchema.extend({
  events: z.array(DocEventSchema).max(5000),
  content: z.unknown(),
  baseContentHash: z.string().regex(/^[0-9a-f]{64}$/),
});

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
  const storedContent = JSON.parse(dec(id, "content", doc.content_enc));
  // Sequence alone cannot detect two formatting-only saves. Every request therefore carries
  // its last confirmed content revision; a competing save in either direction becomes a 409.
  if (contentFingerprint(storedContent) !== body.baseContentHash) throw new HttpError(409, "Document content changed elsewhere. Reload before editing.");

  const hasEvents = body.events.length > 0;
  const seqStart = hasEvents ? body.events[0].seq : doc.last_seq + 1;
  if (hasEvents && seqStart !== doc.last_seq + 1) throw new HttpError(409, "Out of sync with the server (another tab?). Reload the document.", { lastSeq: doc.last_seq });
  body.events.forEach((e, i) => {
    if (e.seq !== seqStart + i) throw new HttpError(400, "Events must have consecutive seq numbers");
  });

  // For a content-only save this proves the client is still on the same chain head. No new
  // sequence number or batch is needed because the projected text cannot have changed.
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
  const seqEnd = hasEvents ? body.events[body.events.length - 1].seq : doc.last_seq;
  if (hasEvents) {
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
  }
  const update: Record<string, string | number | null> = {
    content_enc: enc(id, "content", JSON.stringify(body.content)),
    updated_at: new Date().toISOString(),
  };
  if (hasEvents) Object.assign(update, {
    head_hash: head,
    last_seq: seqEnd,
    first_session_id: doc.first_session_id ?? body.sessionId,
    text_enc: enc(id, "text", text),
  });
  const { data: upd, error: updErr } = await sb
    .from("documents")
    .update(update)
    .eq("id", id)
    .eq("last_seq", doc.last_seq) // sequence CAS for text edits
    .eq("content_enc", doc.content_enc) // content CAS, including formatting-only edits
    .select("id");
  if (updErr || !upd?.length) {
    // The batch insert and document update aren't a SQL transaction. Don't leave an orphaned
    // batch behind if the content CAS loses a race with another text or formatting save.
    if (hasEvents) {
      const { error: rollbackErr } = await sb.from("doc_event_batches").delete().eq("doc_id", id).eq("session_id", body.sessionId).eq("seq_start", seqStart).eq("seq_end", seqEnd).eq("head_hash", head);
      if (rollbackErr) throw rollbackErr;
    }
    if (updErr) throw updErr;
    throw new HttpError(409, "Concurrent edit detected. Reload the document.");
  }
  return json({ ok: true, headHash: head, lastSeq: seqEnd });
});
