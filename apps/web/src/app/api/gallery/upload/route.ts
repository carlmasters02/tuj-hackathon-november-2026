import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { z } from "zod";
import { hammingDistance, DUPLICATE_THRESHOLD } from "@hm/shared/gallery/dhash";
import { api, assertSameOrigin, HttpError, json, rateLimit } from "@/lib/http";
import { profileOf, requireUser } from "@/lib/auth";
import { keyBytes } from "@/lib/env";
import { encryptBytes, encryptString, sha256 } from "@/lib/crypto";
import { AUDIO_TYPES, IMAGE_TYPES, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, sniff } from "@/lib/magic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dHashOf, makePreview, normalizeImage, watermarkedMaster } from "@/lib/server/images";
import { upload } from "@/lib/server/storage";

export const runtime = "nodejs";

const Meta = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  publish: z.enum(["true", "false"]).transform((v) => v === "true"),
});

class NoFfmpeg extends Error {}

/** 64 kbps MP3 preview via ffmpeg (argument array, no shell; 60 s timeout; stdin → stdout). */
function transcodePreview(input: Buffer): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    let p: ReturnType<typeof spawn>;
    try {
      p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vn", "-map_metadata", "-1", "-ac", "2", "-b:a", "64k", "-f", "mp3", "pipe:1"], { stdio: ["pipe", "pipe", "ignore"] });
    } catch {
      return resolve(null);
    }
    const out: Buffer[] = [];
    const t = setTimeout(() => p.kill("SIGKILL"), 60_000);
    p.on("error", (e: NodeJS.ErrnoException) => (e.code === "ENOENT" ? reject(new NoFfmpeg()) : resolve(null)));
    p.stdout!.on("data", (d: Buffer) => out.push(d));
    p.on("close", (code) => {
      clearTimeout(t);
      resolve(code === 0 && out.length ? Buffer.concat(out) : null);
    });
    p.stdin!.on("error", () => {});
    p.stdin!.end(input);
  });
}

export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("upload", user.id);
  await rateLimit("upload", `ip:${req.headers.get("x-real-ip") ?? "local"}`);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_AUDIO_BYTES + 100_000) throw new HttpError(413, "File too large");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach a file");
  const meta = Meta.parse({ title: form.get("title"), description: form.get("description") || undefined, publish: form.get("publish") ?? "false" });
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes); // magic bytes only — the filename and browser MIME are ignored
  if (!type) throw new HttpError(415, "Unsupported file. Images: PNG, JPEG, WebP. Audio: MP3, OGG, WAV.");
  const profile = await profileOf(user.id);
  if (!profile) throw new HttpError(400, "Profile missing");
  const sb = supabaseAdmin();
  const workId = randomUUID();
  const fileSha = sha256(bytes);

  if (IMAGE_TYPES.has(type)) {
    if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "Images can be at most 15 MB");
    let norm;
    try {
      norm = await normalizeImage(bytes);
    } catch {
      throw new HttpError(415, "That image couldn't be decoded");
    }
    if (norm.width < 64 || norm.height < 64) throw new HttpError(400, "Images must be at least 64×64 pixels");
    const dhash = await dHashOf(norm.raw, norm.width, norm.height);

    // re-upload detection: exact SHA-256 or perceptual near-match of someone else's work
    const { data: others } = await sb.from("gallery_works").select("id, owner_id, sha256, dhash").eq("kind", "art").neq("owner_id", user.id).limit(20000);
    const dup = (others ?? []).find((o) => o.sha256 === fileSha || (o.dhash && hammingDistance(o.dhash, dhash) <= DUPLICATE_THRESHOLD));
    if (dup) {
      const owner = await profileOf(dup.owner_id);
      console.warn(`[gallery] blocked possible duplicate upload of work ${dup.id}`);
      throw new HttpError(409, `This looks like a possible duplicate of @${owner?.username ?? "another user"}'s work, so it was blocked. If it's yours, contact them or report it.`, { duplicateOf: dup.id });
    }

    const master = await watermarkedMaster(norm.raw, norm.width, norm.height, { workId, ownerId: user.id, timestamp: Math.floor(Date.now() / 1000) }, keyBytes("HM_WATERMARK_KEY"));
    const originalPath = `${user.id}/${workId}.bin`;
    await upload("art-originals", originalPath, encryptBytes(master, `work:${workId}:original`));
    const preview = await makePreview(norm.raw, norm.width, norm.height, profile.username);
    const previewPath = `${user.id}/${workId}.webp`;
    await upload("art-previews", previewPath, preview.buf, "image/webp");
    const { error } = await sb.from("gallery_works").insert({
      id: workId, owner_id: user.id, kind: "art", title: meta.title, description: meta.description ?? null, sha256: fileSha, dhash,
      storage_key_enc: encryptString(originalPath, `work:${workId}:key`), preview_key: previewPath, mime: "image/png", width: preview.width, height: preview.height, published: meta.publish,
    });
    if (error) throw error;
    return json({ id: workId });
  }

  if (AUDIO_TYPES.has(type)) {
    if (bytes.length > MAX_AUDIO_BYTES) throw new HttpError(413, "Audio can be at most 25 MB");
    const { data: same } = await sb.from("gallery_works").select("id, owner_id").eq("kind", "music").eq("sha256", fileSha).neq("owner_id", user.id).maybeSingle();
    if (same) throw new HttpError(409, "This exact file was already uploaded by another user, so it was blocked.");
    const preview = await transcodePreview(bytes).catch((e) => {
      if (e instanceof NoFfmpeg) throw new HttpError(503, "Music uploads aren't available on this server yet (ffmpeg is missing).");
      throw e;
    });
    if (!preview) throw new HttpError(415, "That audio file couldn't be decoded");
    const originalPath = `${user.id}/${workId}.bin`;
    await upload("audio", originalPath, encryptBytes(bytes, `work:${workId}:original`));
    const previewPath = `${user.id}/${workId}.mp3`;
    await upload("audio-previews", previewPath, preview, "audio/mpeg");
    const { error } = await sb.from("gallery_works").insert({
      id: workId, owner_id: user.id, kind: "music", title: meta.title, description: meta.description ?? null, sha256: fileSha,
      storage_key_enc: encryptString(originalPath, `work:${workId}:key`), preview_key: previewPath, mime: type, published: meta.publish,
    });
    if (error) throw error;
    return json({ id: workId });
  }
  throw new HttpError(415, "Unsupported file");
});
