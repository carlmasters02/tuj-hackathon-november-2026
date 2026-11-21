import type { NextRequest } from "next/server";
import { verifyMedia } from "@hm/shared/gallery/signedUrl";
import { api, HttpError, rateLimit, UUID } from "@/lib/http";
import { profileOf, requireUser } from "@/lib/auth";
import { keyBytes } from "@/lib/env";
import { download } from "@/lib/server/storage";
import { noteMediaFetch, viewableWork } from "@/lib/server/gallery";
import { viewerWatermark } from "@/lib/server/images";

export const runtime = "nodejs";

const PROTECTED_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noai, noimageai, noindex",
  "tdm-reservation": "1",
  "X-Content-Type-Options": "nosniff",
  "Content-Disposition": "inline",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/**
 * Serves an art preview to a logged-in viewer through a 5-minute HMAC-signed URL bound to that
 * viewer. The preview is fetched from the private bucket with the service role and stamped with
 * the viewer's username + date before streaming. Originals are never served.
 */
export const GET = api(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  await rateLimit("media", user.id);
  const id = UUID.parse((await ctx.params).id);
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  const check = verifyMedia(keyBytes("HM_MEDIA_HMAC_KEY"), id, user.id, exp, sig);
  if (check === "expired") throw new HttpError(410, "This link expired — reload the page.");
  if (check !== "ok") throw new HttpError(403, "Invalid media link");
  const work = await viewableWork(id, user.id);
  if (work.kind !== "art" || !work.preview_key) throw new HttpError(404, "Not found");
  await noteMediaFetch(user.id);
  const viewer = (await profileOf(user.id))?.username ?? user.id.slice(0, 8);
  const preview = await download("art-previews", work.preview_key);
  const stamped = await viewerWatermark(preview, `@${viewer}`, new Date().toISOString().slice(0, 10));
  return new Response(new Uint8Array(stamped), { headers: { ...PROTECTED_HEADERS, "Content-Type": "image/webp" } });
});
