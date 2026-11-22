import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, HttpError, json, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

/** Deletes a comment. RLS allows only the comment's author or the work's owner. */
export const DELETE = api(async (req: NextRequest, ctx: { params: Promise<{ id: string; commentId: string }> }) => {
  assertSameOrigin(req);
  await requireUser();
  const p = await ctx.params;
  const workId = UUID.parse(p.id);
  const commentId = z.coerce.number().int().positive().parse(p.commentId);
  const { data, error } = await (await supabaseServer()).from("comments").delete().eq("id", commentId).eq("work_id", workId).select("id");
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "That comment no longer exists.");
  return json({ ok: true });
});
