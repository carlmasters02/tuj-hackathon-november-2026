import type { NextRequest } from "next/server";
import { z } from "zod";
import { UsernameSchema } from "@hm/shared/passwords";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

const Body = z.object({ username: UsernameSchema, follow: z.boolean() }).strict();

export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  rateLimit("api", user.id);
  const { username, follow } = await parseJson(req, Body, 1_000);
  const { data: target } = await supabaseAdmin().from("profiles").select("id, is_public").eq("username", username).maybeSingle();
  if (!target || target.id === user.id) throw new HttpError(404, "User not found");
  const sb = await supabaseServer();
  const { error } = follow
    ? await sb.from("follows").upsert({ follower_id: user.id, followee_id: target.id }, { ignoreDuplicates: true })
    : await sb.from("follows").delete().eq("follower_id", user.id).eq("followee_id", target.id);
  if (error) throw error;
  return json({ ok: true });
});
