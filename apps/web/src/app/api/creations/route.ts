import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, json, parseJson, rateLimit } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ kind: z.enum(["art", "music"]), title: z.string().trim().min(1).max(120).default("Untitled") }).strict();

/** Starts a new studio drawing or composer piece. */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const { kind, title } = await parseJson(req, Body, 1_000);
  const { data, error } = await supabaseAdmin().from("creations").insert({ owner_id: user.id, kind, title }).select("id").single();
  if (error) throw error;
  return json({ id: data.id });
});
