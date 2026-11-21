import type { NextRequest } from "next/server";
import { api, assertSameOrigin, json, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { viewableWork } from "@/lib/server/gallery";

type Ctx = { params: Promise<{ id: string }> };

// user-scoped client: RLS guarantees a user can only like/unlike as themselves
export const POST = api(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const id = UUID.parse((await ctx.params).id);
  await viewableWork(id, user.id);
  const { error } = await (await supabaseServer()).from("likes").upsert({ user_id: user.id, work_id: id }, { ignoreDuplicates: true });
  if (error) throw error;
  return json({ ok: true });
});

export const DELETE = api(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const id = UUID.parse((await ctx.params).id);
  const { error } = await (await supabaseServer()).from("likes").delete().eq("user_id", user.id).eq("work_id", id);
  if (error) throw error;
  return json({ ok: true });
});
