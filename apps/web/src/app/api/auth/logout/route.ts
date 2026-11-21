import type { NextRequest } from "next/server";
import { api, assertSameOrigin, json } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const sb = await supabaseServer();
  await sb.auth.signOut();
  return json({ ok: true });
});
