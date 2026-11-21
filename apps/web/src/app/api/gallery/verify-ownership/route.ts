import type { NextRequest } from "next/server";
import { api, assertSameOrigin, HttpError, json, rateLimit } from "@/lib/http";
import { requireUser, profileOf } from "@/lib/auth";
import { keyBytes } from "@/lib/env";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, sniff } from "@/lib/magic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readWatermark } from "@/lib/server/images";

export const runtime = "nodejs";

/**
 * Extracts and authenticates the invisible watermark from an image file. Works on exact copies of
 * a Humagination master; heavy re-compression or resizing destroys it (stated in the UI).
 */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("upload", user.id);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach a file");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "Too large");
  const t = sniff(bytes);
  if (!t || !IMAGE_TYPES.has(t)) throw new HttpError(415, "PNG, JPEG or WebP only");
  const wm = await readWatermark(bytes, keyBytes("HM_WATERMARK_KEY")).catch(() => null);
  if (!wm) return json({ found: false, message: "No intact Humagination watermark found. (Resizing or lossy re-compression removes it.)" });
  const { data: work } = await supabaseAdmin().from("gallery_works").select("id, owner_id, title").eq("id", wm.workId).maybeSingle();
  const owner = await profileOf(wm.ownerId);
  return json({
    found: true,
    workId: wm.workId,
    owner: owner?.username ?? null,
    title: work?.title ?? null,
    embeddedAt: new Date(wm.timestamp * 1000).toISOString(),
    matchesRecord: !!work && work.owner_id === wm.ownerId,
    confidence: wm.confidence,
  });
});
