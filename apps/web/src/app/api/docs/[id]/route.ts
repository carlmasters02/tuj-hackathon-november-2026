import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, json, parseJson, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dec, enc, ownedDoc } from "@/lib/server/docs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const id = UUID.parse((await ctx.params).id);
  const d = await ownedDoc(id, user.id);
  return json({
    id: d.id,
    title: dec(id, "title", d.title_enc),
    content: JSON.parse(dec(id, "content", d.content_enc)),
    status: d.status,
    headHash: d.head_hash,
    lastSeq: d.last_seq,
  });
});

const Patch = z.object({ title: z.string().trim().min(1).max(200) }).strict();

export const PATCH = api(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  rateLimit("api", user.id);
  const id = UUID.parse((await ctx.params).id);
  await ownedDoc(id, user.id);
  const { title } = await parseJson(req, Patch, 2_000);
  const { error } = await supabaseAdmin().from("documents").update({ title_enc: enc(id, "title", title), updated_at: new Date().toISOString() }).eq("id", id).eq("owner_id", user.id);
  if (error) throw error;
  return json({ ok: true });
});

export const DELETE = api(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const id = UUID.parse((await ctx.params).id);
  await ownedDoc(id, user.id);
  const { error } = await supabaseAdmin().from("documents").delete().eq("id", id).eq("owner_id", user.id);
  if (error) throw error;
  return json({ ok: true });
});
