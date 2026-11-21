import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, clientIp, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { clearFailures, lockedUntil, recordFailure } from "@/lib/lockout";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(128) }).strict();

export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  await rateLimit("login", `ip:${ip}`);
  const { email, password } = await parseJson(req, Body, 10_000);
  await rateLimit("login", `email:${email}`);

  const until = await lockedUntil(email);
  if (until) throw new HttpError(429, `Too many failed attempts. Try again after ${until.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`, { retryAfter: Math.ceil((until.getTime() - Date.now()) / 1000) });

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) throw new HttpError(403, "Confirm your email first — check your inbox.");
    await recordFailure(email);
    throw new HttpError(401, "Email or password is incorrect.");
  }
  await clearFailures(email);
  return json({ ok: true });
});
