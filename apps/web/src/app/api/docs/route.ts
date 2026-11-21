import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { api, assertSameOrigin, json, parseJson, rateLimit } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dec, enc } from "@/lib/server/docs";
import { EMPTY_DOC } from "@/lib/server/pm";

export const GET = api(async () => {
  const user = await requireUser();
  const { data, error } = await supabaseAdmin().from("documents").select("id, title_enc, status, updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  return json({ docs: (data ?? []).map((d) => ({ id: d.id, title: dec(d.id, "title", d.title_enc), status: d.status, updatedAt: d.updated_at })) });
});

const Body = z.object({ title: z.string().trim().max(200).default("Untitled") }).strict();

export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const { title } = await parseJson(req, Body, 2_000);
  const id = randomUUID();
  const { error } = await supabaseAdmin().from("documents").insert({
    id,
    owner_id: user.id,
    title_enc: enc(id, "title", title || "Untitled"),
    content_enc: enc(id, "content", JSON.stringify(EMPTY_DOC)),
    text_enc: enc(id, "text", ""),
  });
  if (error) throw error;
  return json({ id });
});
