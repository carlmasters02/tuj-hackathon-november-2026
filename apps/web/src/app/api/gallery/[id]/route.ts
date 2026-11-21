import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deleteWorkFiles, type WorkRow } from "@/lib/server/gallery";

type Ctx = { params: Promise<{ id: string }> };

async function ownWork(id: string, userId: string): Promise<WorkRow> {
  const { data } = await supabaseAdmin().from("gallery_works").select("*").eq("id", id).eq("owner_id", userId).maybeSingle();
  if (!data) throw new HttpError(404, "Not found");
  return data as WorkRow;
}

const Patch = z.object({ published: z.boolean().optional(), title: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(1000).optional() }).strict();

export const PATCH = api(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  rateLimit("api", user.id);
  const id = UUID.parse((await ctx.params).id);
  await ownWork(id, user.id);
  const b = await parseJson(req, Patch, 5_000);
  const { error } = await supabaseAdmin().from("gallery_works").update(b).eq("id", id).eq("owner_id", user.id);
  if (error) throw error;
  return json({ ok: true });
});

/** Owner deletes a work: files first (original + preview), then the row. */
export const DELETE = api(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const id = UUID.parse((await ctx.params).id);
  const w = await ownWork(id, user.id);
  await deleteWorkFiles(w);
  const { error } = await supabaseAdmin().from("gallery_works").delete().eq("id", id).eq("owner_id", user.id);
  if (error) throw error;
  return json({ ok: true });
});
