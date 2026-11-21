import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, json, parseJson, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { viewableWork } from "@/lib/server/gallery";

const Body = z.object({ reason: z.enum(["stolen", "ai_generated", "offensive", "spam", "other"]), details: z.string().trim().max(1000).optional() }).strict();

export const POST = api(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("upload", `report:${user.id}`);
  const id = UUID.parse((await ctx.params).id);
  await viewableWork(id, user.id);
  const b = await parseJson(req, Body, 3_000);
  const { error } = await (await supabaseServer()).from("reports").insert({ reporter_id: user.id, work_id: id, reason: b.reason, details: b.details ?? null });
  if (error) throw error;
  return json({ ok: true });
});
