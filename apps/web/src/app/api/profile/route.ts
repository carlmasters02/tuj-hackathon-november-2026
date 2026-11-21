import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, json, parseJson, rateLimit } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

const Body = z
  .object({
    displayName: z.string().trim().max(50).optional(),
    bio: z.string().trim().max(280).optional(),
    isPublic: z.boolean().optional(),
    leaderboardOptIn: z.boolean().optional(),
  })
  .strict();

export const PATCH = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  rateLimit("api", user.id);
  const b = await parseJson(req, Body, 5_000);
  // user-scoped client: RLS + column grants restrict this to the caller's own allowed columns
  const sb = await supabaseServer();
  const patch: Record<string, unknown> = {};
  if (b.displayName !== undefined) patch.display_name = b.displayName || null;
  if (b.bio !== undefined) patch.bio = b.bio || null;
  if (b.isPublic !== undefined) patch.is_public = b.isPublic;
  if (b.leaderboardOptIn !== undefined) patch.leaderboard_opt_in = b.leaderboardOptIn;
  const { error } = await sb.from("profiles").update(patch).eq("id", user.id);
  if (error) throw error;
  return json({ ok: true });
});
