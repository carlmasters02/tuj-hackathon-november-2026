import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { artToSvg, creationHasContent, creationStats, creationVerdict, replayArt, verifyCreationChain, type ArtEvent } from "@hm/shared/creation";
import { signCertificate } from "@hm/shared/certificate";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit, UUID } from "@/lib/http";
import { profileOf, requireUser } from "@/lib/auth";
import { keyBytes } from "@/lib/env";
import { encryptBytes, encryptString, sha256 } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadCreationBatches, ownedCreation } from "@/lib/server/creations";
import { dHashOf, makePreview, normalizeImage, watermarkedMaster } from "@/lib/server/images";
import { upload } from "@/lib/server/storage";

export const runtime = "nodejs";
const Body = z.object({ title: z.string().trim().min(1).max(120), publish: z.boolean().default(true), description: z.string().trim().max(1000).optional() }).strict();

/**
 * Finish a studio drawing or composer piece: replay the full log, verify the chain, compute stats,
 * sign a certificate, and publish it to the portfolio. Art is rendered on the server from the
 * strokes themselves, so the published image is exactly what the log describes.
 */
export const POST = api(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("upload", user.id);
  const id = UUID.parse((await ctx.params).id);
  const c = await ownedCreation(id, user.id);
  if (c.status === "finalized") throw new HttpError(409, "Already finished.");
  const { title, publish, description } = await parseJson(req, Body, 3_000);
  const profile = await profileOf(user.id);
  const batches = await loadCreationBatches(id);
  if (!batches.length) throw new HttpError(400, c.kind === "art" ? "Draw something first." : "Add some notes first.");

  const chain = verifyCreationChain(id, batches);
  const integrityOk = chain.ok && chain.head === c.head_hash;
  const { stats, contentHash } = creationStats(c.kind, batches);
  if (!creationHasContent(c.kind, stats)) throw new HttpError(400, c.kind === "art" ? "The final drawing is empty. Add a visible stroke before finishing." : "The final score is empty. Add at least one active note before finishing.");
  if (!integrityOk) stats.flags.unshift("Integrity check failed: the log does not match the stored head");
  const verdict = creationVerdict(c.kind, stats, integrityOk);

  const certId = randomUUID();
  const payload = { v: 1 as const, certId, docId: id, author: profile?.username ?? "unknown", title, contentHash, logHeadHash: chain.ok ? chain.head : "0".repeat(64), stats: stats as any, verdict, issuedAt: new Date().toISOString() };
  const signed = await signCertificate(payload, keyBytes("HM_SIGNING_KEY"));
  const sb = supabaseAdmin();
  const { error: certErr } = await sb.from("certificates").insert({ id: certId, owner_id: user.id, title, verdict, kind: c.kind, payload, signature: signed.signature, public_key: signed.publicKey, events_json: batches });
  if (certErr) throw certErr;

  const workId = randomUUID();
  const row: Record<string, unknown> = { id: workId, owner_id: user.id, kind: c.kind, title, description: description ?? null, cert_id: certId, published: publish };
  if (c.kind === "art") {
    const strokes = replayArt(batches.flatMap((b) => b.events) as ArtEvent[]);
    const png = await sharp(Buffer.from(artToSvg(strokes))).png().toBuffer();
    const norm = await normalizeImage(png);
    const master = await watermarkedMaster(norm.raw, norm.width, norm.height, { workId, ownerId: user.id, timestamp: Math.floor(Date.now() / 1000) }, keyBytes("HM_WATERMARK_KEY"));
    const originalPath = `${user.id}/${workId}.bin`;
    await upload("art-originals", originalPath, encryptBytes(master, `work:${workId}:original`));
    const preview = await makePreview(norm.raw, norm.width, norm.height, profile?.username ?? "artist");
    const previewPath = `${user.id}/${workId}.webp`;
    await upload("art-previews", previewPath, preview.buf, "image/webp");
    Object.assign(row, { sha256: sha256(png), dhash: await dHashOf(norm.raw, norm.width, norm.height), storage_key_enc: encryptString(originalPath, `work:${workId}:key`), preview_key: previewPath, mime: "image/png", width: preview.width, height: preview.height });
  }
  const { error } = await sb.from("gallery_works").insert(row);
  if (error) throw error;
  await sb.from("creations").update({ status: "finalized", title, updated_at: new Date().toISOString() }).eq("id", id);
  return json({ workId, certId, verdict });
});
