import type { NextRequest } from "next/server";
import { verifyMedia } from "@hm/shared/gallery/signedUrl";
import { api, HttpError, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { keyBytes } from "@/lib/env";
import { download } from "@/lib/server/storage";
import { noteMediaFetch, viewableWork } from "@/lib/server/gallery";

export const runtime = "nodejs";

/** Streams the 64 kbps preview (never the encrypted original) via a viewer-bound signed URL. */
export const GET = api(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  await rateLimit("media", user.id);
  const id = UUID.parse((await ctx.params).id);
  const check = verifyMedia(keyBytes("HM_MEDIA_HMAC_KEY"), id, user.id, Number(req.nextUrl.searchParams.get("exp")), req.nextUrl.searchParams.get("sig") ?? "");
  if (check === "expired") throw new HttpError(410, "This link expired — reload the page.");
  if (check !== "ok") throw new HttpError(403, "Invalid media link");
  const work = await viewableWork(id, user.id);
  if (work.kind !== "music" || !work.preview_key) throw new HttpError(404, "Not found");
  await noteMediaFetch(user.id);
  const buf = await download("audio-previews", work.preview_key);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "X-Robots-Tag": "noai, noimageai, noindex", "tdm-reservation": "1", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
  });
});
