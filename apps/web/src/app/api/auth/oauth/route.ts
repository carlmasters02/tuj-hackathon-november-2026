import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, clientIp, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

const Body = z.object({ provider: z.literal("google"), next: z.string().max(200).optional() }).strict();

/**
 * Starts "Sign in with Google". The server creates the PKCE verifier (stored in an httpOnly
 * cookie by @supabase/ssr) and returns Supabase's authorize URL; the browser then navigates there.
 */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  if (process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH !== "true") throw new HttpError(404, "Google sign-in isn't enabled.");
  await rateLimit("login", `ip:${clientIp(req)}`);
  const { provider, next } = await parseJson(req, Body, 1_000);
  const origin = req.headers.get("origin")!;
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) throw new HttpError(502, "Google sign-in isn't available right now.");
  // only ever send the browser to our own Supabase project
  if (new URL(data.url).host !== new URL(env().NEXT_PUBLIC_SUPABASE_URL).host) throw new HttpError(502, "Unexpected sign-in URL");
  return json({ url: data.url });
});
