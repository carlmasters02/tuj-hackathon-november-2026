import type { NextRequest } from "next/server";
import { z } from "zod";
import { passwordProblem, PasswordSchema, UsernameSchema } from "@hm/shared/passwords";
import { api, assertSameOrigin, clientIp, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254), username: UsernameSchema, password: PasswordSchema }).strict();

export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  rateLimit("signup", `ip:${ip}`);
  const body = await parseJson(req, Body, 10_000);
  rateLimit("signup", `user:${body.username}`);

  const problem = passwordProblem(body.password, body.username);
  if (problem) throw new HttpError(400, problem);

  const { data: taken } = await supabaseAdmin().from("profiles").select("id").eq("username", body.username).maybeSingle();
  if (taken) throw new HttpError(409, "That username is taken.");

  const sb = await supabaseServer();
  const origin = req.headers.get("origin")!;
  const { error } = await sb.auth.signUp({
    email: body.email,
    password: body.password,
    options: { data: { username: body.username }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    // Supabase's leaked-password protection and its own policy errors surface here.
    if (/password/i.test(error.message)) throw new HttpError(400, error.message);
    // Don't reveal whether an email is already registered.
    console.warn("[signup] rejected:", error.code ?? error.status);
  }
  return json({ ok: true, message: "If that email can be used, a confirmation link is on its way." });
});
