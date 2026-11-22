import type { NextRequest } from "next/server";
import { z } from "zod";
import { UsernameSchema } from "@hm/shared/passwords";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

const Body = z.object({ username: UsernameSchema, action: z.enum(["invite", "accept", "remove"]) }).strict();

/** Friend invites by username. Writes use the user-scoped client, so RLS enforces who may do what. */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const { username, action } = await parseJson(req, Body, 1_000);
  const { data: other } = await supabaseAdmin().from("profiles").select("id").eq("username", username).maybeSingle();
  if (!other || other.id === user.id) throw new HttpError(404, "We couldn't find that person.");
  const sb = await supabaseServer();
  if (action === "invite") {
    const { error } = await sb.from("friends").upsert({ user_id: user.id, friend_id: other.id, status: "pending" }, { ignoreDuplicates: true });
    if (error) throw error;
  } else if (action === "accept") {
    const { data, error } = await sb.from("friends").update({ status: "accepted" }).eq("user_id", other.id).eq("friend_id", user.id).select("user_id");
    if (error) throw error;
    if (!data?.length) throw new HttpError(404, "There's no pending friend invite from that person.");
  } else {
    await sb.from("friends").delete().eq("user_id", user.id).eq("friend_id", other.id);
    await sb.from("friends").delete().eq("user_id", other.id).eq("friend_id", user.id);
  }
  return json({ ok: true });
});
