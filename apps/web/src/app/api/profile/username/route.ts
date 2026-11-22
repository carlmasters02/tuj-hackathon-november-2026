import type { NextRequest } from "next/server";
import { z } from "zod";
import { UsernameSchema } from "@hm/shared/passwords";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { profileOf, requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ username: UsernameSchema }).strict();

/**
 * One-time username choice for accounts created through Google. Usernames are public identities
 * (gallery credits, certificates), so after this they can't be changed.
 */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("signup", `username:${user.id}`);
  const { username } = await parseJson(req, Body, 500);
  const profile = await profileOf(user.id);
  if (!profile) throw new HttpError(404, "We couldn't find that person.");
  if (profile.username_chosen) throw new HttpError(403, "Your username is already set.");
  const sb = supabaseAdmin();
  const { data: taken } = await sb.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken && taken.id !== user.id) throw new HttpError(409, "That username is taken.");
  const { data, error } = await sb
    .from("profiles")
    .update({ username, username_chosen: true })
    .eq("id", user.id)
    .eq("username_chosen", false) // can't race into a second change
    .select("id");
  if (error?.code === "23505") throw new HttpError(409, "That username is taken.");
  if (error) throw error;
  if (!data?.length) throw new HttpError(403, "Your username is already set.");
  return json({ ok: true });
});
