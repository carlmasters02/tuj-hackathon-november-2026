import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { computeStats, verdictFor, verifyChain, ReplayError, VERDICT_LABEL } from "@hm/shared/provenance/index";
import { contentHash, signCertificate, type CertificatePayload } from "@hm/shared/certificate";
import { pointsFor } from "@hm/shared/scoring";
import { api, assertSameOrigin, HttpError, json, rateLimit, UUID } from "@/lib/http";
import { profileOf, requireUser } from "@/lib/auth";
import { keyBytes } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dec, ownedDoc } from "@/lib/server/docs";
import { contentToText } from "@/lib/server/pm";
import { loadBatches } from "@/lib/server/certs";
import { addHumanTime, awardPoints } from "@/lib/server/points";

/**
 * Finalize: replay the entire stored log from an empty document, verify the hash chain end to end,
 * confirm the replay reproduces the saved content exactly, compute authenticity statistics, and
 * issue an Ed25519-signed certificate.
 */
export const POST = api(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const id = UUID.parse((await ctx.params).id);
  const doc = await ownedDoc(id, user.id);
  const profile = await profileOf(user.id);
  if (!profile) throw new HttpError(400, "Profile missing");

  const batches = await loadBatches(id);
  if (!batches.length) throw new HttpError(400, "Nothing to certify yet — write something first.");

  const chain = verifyChain(id, batches);
  let replayed: ReturnType<typeof computeStats>;
  try {
    replayed = computeStats(batches);
  } catch (e) {
    if (e instanceof ReplayError) throw new HttpError(409, "The event log can't be replayed — this document can't be certified.");
    throw e;
  }
  const storedText = dec(id, "text", doc.text_enc);
  const contentText = contentToText(JSON.parse(dec(id, "content", doc.content_enc)));
  const hash = contentHash(replayed.text);
  const integrityOk = chain.ok && chain.head === doc.head_hash && hash === contentHash(storedText) && hash === contentHash(contentText);
  if (!integrityOk) replayed.stats.flags.unshift("Integrity check failed: the log does not reproduce the saved document");
  if (replayed.stats.finalWords < 1) throw new HttpError(400, "The document is empty.");

  const verdict = verdictFor(replayed.stats, integrityOk);
  const certId = randomUUID();
  const payload: CertificatePayload = {
    v: 1,
    certId,
    docId: id,
    author: profile.username,
    title: dec(id, "title", doc.title_enc).slice(0, 300),
    contentHash: hash,
    logHeadHash: chain.ok ? chain.head : (doc.head_hash ?? "0".repeat(64)),
    stats: replayed.stats,
    verdict,
    issuedAt: new Date().toISOString(),
  };
  const signed = await signCertificate(payload, keyBytes("HM_SIGNING_KEY"));

  const sb = supabaseAdmin();
  const { error } = await sb.from("certificates").insert({
    id: certId,
    doc_id: id,
    owner_id: user.id,
    title: payload.title,
    verdict,
    payload,
    signature: signed.signature,
    public_key: signed.publicKey,
    events_json: batches,
  });
  if (error) throw error;

  // credit newly-written active time (only once per second written) and points
  const newSeconds = Math.max(0, replayed.stats.activeSeconds - doc.credited_seconds);
  if (verdict !== "unverified" && newSeconds > 0) {
    await addHumanTime(user.id, "writing", newSeconds);
  }
  await sb.from("documents").update({ status: "finalized", credited_seconds: Math.max(doc.credited_seconds, replayed.stats.activeSeconds) }).eq("id", id);
  let points = 0;
  const eligible = pointsFor("document", { words: replayed.stats.finalWords });
  if (verdict === "human_verified" && eligible > 0) points = await awardPoints(user.id, "document", id, eligible);

  return json({ certId, verdict, label: VERDICT_LABEL[verdict], points });
});
