import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { profileOf, requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { deleteUserFiles } from "@/lib/server/storage";
import { isDemoUser } from "@/lib/demo";

const Body = z.object({ confirmUsername: z.string().max(40) }).strict();

/** Deletes the account: storage files first, then the auth user (all rows cascade). */
export const DELETE = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const { confirmUsername } = await parseJson(req, Body, 1_000);
  if (await isDemoUser(user.id)) throw new HttpError(403, "The shared demo account can't be deleted.");
  const profile = await profileOf(user.id);
  if (!profile || confirmUsername !== profile.username) throw new HttpError(400, "Type your username exactly to confirm.");
  await deleteUserFiles(user.id);
  const { error } = await supabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) throw new HttpError(500, "Your account couldn't be deleted, and nothing was removed. Please try again.");
  await (await supabaseServer()).auth.signOut().catch(() => null);
  return json({ ok: true });
});
