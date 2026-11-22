import type { NextRequest } from "next/server";
import { api, assertSameOrigin, json, rateLimit, UUID } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownedCreation } from "@/lib/server/creations";
import { deletePublishedFrom } from "@/lib/server/gallery";

/**
 * Owner deletes a drawing or composition: the published piece (and its files) if it was finished,
 * then the creation and its event log. Certificates stay valid: they carry their own copy of the log.
 */
export const DELETE = api(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const id = UUID.parse((await ctx.params).id);
  await ownedCreation(id, user.id); // 404 unless it's yours
  await deletePublishedFrom(id, user.id);
  const { error } = await supabaseAdmin().from("creations").delete().eq("id", id).eq("owner_id", user.id);
  if (error) throw error;
  return json({ ok: true });
});
