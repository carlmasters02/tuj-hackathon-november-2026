import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { hashExtensionToken } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const GET = api(async () => {
  const user = await requireUser();
  const sb = await supabaseServer();
  const { data, error } = await sb.from("extension_tokens").select("id, label, created_at, last_used_at, revoked_at").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) throw error;
  return json({ tokens: data });
});

const Body = z.object({ label: z.string().trim().min(1).max(40).default("Chrome extension") }).strict();

/** Creates a token, returns it ONCE. Only SHA-256(pepper || token) is stored. */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const { label } = await parseJson(req, Body, 2_000);
  const admin = supabaseAdmin();
  const { count } = await admin.from("extension_tokens").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("revoked_at", null);
  if ((count ?? 0) >= 5) throw new HttpError(400, "You already have 5 active tokens — revoke one first.");
  const token = "hm_ext_" + randomBytes(32).toString("base64url");
  const { error } = await admin.from("extension_tokens").insert({ user_id: user.id, label, token_hash: hashExtensionToken(token) });
  if (error) throw error;
  return json({ token });
});
