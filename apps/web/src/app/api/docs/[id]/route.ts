import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DocMetaSchema } from "@hm/shared/docMeta";
import { dec, docMeta, enc, ownedDoc } from "@/lib/server/docs";

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
    meta: docMeta(d),
  });
});

const Patch = z.object({ title: z.string().trim().min(1).max(200).optional(), meta: DocMetaSchema.optional() }).strict();

export const PATCH = api(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const id = UUID.parse((await ctx.params).id);
  const { title, meta } = await parseJson(req, Patch, 400_000);
  const d = await ownedDoc(id, user.id);
  if (d.status === "finalized" && meta) throw new HttpError(409, "This document is finalized and can't be changed.");
  const update: Record<string, string> = { updated_at: new Date().toISOString() };
  if (title !== undefined) update.title_enc = enc(id, "title", title);
  if (meta !== undefined) update.meta_enc = enc(id, "meta", JSON.stringify(meta));
  const { error } = await supabaseAdmin().from("documents").update(update).eq("id", id).eq("owner_id", user.id);
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
