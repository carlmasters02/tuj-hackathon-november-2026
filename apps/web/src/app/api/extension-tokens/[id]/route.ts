import type { NextRequest } from "next/server";
import { api, assertSameOrigin, HttpError, json, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const DELETE = api(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const id = UUID.parse((await ctx.params).id);
  const { data, error } = await supabaseAdmin()
    .from("extension_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id) // ownership enforced in the query itself
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "Not found");
  return json({ ok: true });
});
