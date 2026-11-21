import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit, UUID } from "@/lib/http";
import { profileOf, requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { viewableWork } from "@/lib/server/gallery";

const Body = z.object({ body: z.string().trim().min(1, "Write something first").max(500) }).strict();

/**
 * Posts a comment. The insert runs on the user's own session, so row-level security enforces
 * "only as yourself, only on works you can see". React escapes the text when rendering.
 */
export const POST = api(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("upload", `comment:${user.id}`); // 10 comments/minute per user
  const workId = UUID.parse((await ctx.params).id);
  await viewableWork(workId, user.id);
  const { body } = await parseJson(req, Body, 4_000);
  const { data, error } = await (await supabaseServer())
    .from("comments")
    .insert({ work_id: workId, author_id: user.id, body })
    .select("id, body, created_at")
    .single();
  if (error) throw new HttpError(403, "You can't comment on this work.");
  const me = await profileOf(user.id);
  return json({ comment: { id: data.id, body: data.body, createdAt: data.created_at, author: me?.username ?? "you", mine: true } });
});
