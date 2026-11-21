import type { NextRequest } from "next/server";
import { z } from "zod";
import { isCommonPassword, MIN_PASSWORD_LENGTH } from "@hm/shared/passwords";
import { api, assertSameOrigin, clientIp, json, parseJson, rateLimit } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accountStatus, authFail, detailedAuthErrors, fmtWait } from "@/lib/authErrors";

const Body = z.object({ email: z.string().max(254).default(""), username: z.string().max(60).default(""), password: z.string().max(200).default("") }).strict();

/** Explains exactly which username rule failed. */
function usernameProblem(u: string): string | null {
  if (!u) return "Choose a username.";
  if (u.length < 3) return `"${u}" is ${u.length} character${u.length === 1 ? "" : "s"} long; usernames need 3–20 characters.`;
  if (u.length > 20) return `That username is ${u.length} characters long; the maximum is 20.`;
  const bad = [...new Set(u.replace(/[a-z0-9_]/g, ""))];
  if (bad.length) return `Usernames can only use lowercase letters, digits and underscores. Remove: ${bad.map((c) => (c === " " ? "spaces" : `"${c}"`)).join(", ")}.`;
  return null;
}

export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  await rateLimit("signupIp", `ip:${ip}`, (s) =>
    `Too many sign-ups from your network: more than 10 in the last minute. Everyone on the same Wi-Fi shares this limit. Try again in ${fmtWait(s)}.`,
  );
  const raw = await parseJson(req, Body, 10_000);
  const email = raw.email.trim().toLowerCase();
  const username = raw.username.trim().toLowerCase();
  const password = raw.password;

  if (!email) authFail(400, "signup.missing_email", "Enter your email address.", "Enter your email address.", ip);
  if (!z.email().safeParse(email).success)
    authFail(400, "signup.invalid_email", `"${email}" isn't a valid email address. Check for typos, spaces or a missing "@".`, "Enter a valid email address.", ip);
  const uProblem = usernameProblem(username);
  if (uProblem) authFail(400, "signup.invalid_username", uProblem, uProblem, ip);

  // password rules — always explained (they reveal nothing about other users)
  if (password.length < MIN_PASSWORD_LENGTH)
    authFail(400, "signup.password_too_short", `Your password is ${password.length} characters; it needs at least ${MIN_PASSWORD_LENGTH}. A short sentence works well.`, `Use at least ${MIN_PASSWORD_LENGTH} characters.`, ip);
  if (password.length > 128) authFail(400, "signup.password_too_long", "Passwords can be at most 128 characters.", "Passwords can be at most 128 characters.", ip);
  if (isCommonPassword(password))
    authFail(400, "signup.password_common", "That password is one of (or built from) the 10,000 most-used passwords, so it would be guessed quickly. Pick something more personal — a short sentence works well.", "That password is too common.", ip);
  if (password.toLowerCase().includes(username))
    authFail(400, "signup.password_has_username", "Your password contains your username. Choose one that doesn't.", "Don't include your username in your password.", ip);

  await rateLimit("signup", `user:${username}`, (s) => `Too many sign-up attempts for @${username}. Try again in ${fmtWait(s)}.`);

  const { data: taken } = await supabaseAdmin().from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) authFail(409, "signup.username_taken", `The username @${username} is already taken. Pick another one.`, "That username is taken.", ip);

  if (detailedAuthErrors()) {
    const st = await accountStatus(email);
    if (st)
      authFail(
        409,
        "signup.email_exists",
        st.has_password
          ? `An account with ${email} already exists. Log in instead.`
          : `An account with ${email} already exists (created with ${st.providers.join(", ") || "another sign-in method"}). Sign in that way instead.`,
        "Couldn't create the account.",
        ip,
      );
  }

  const sb = await supabaseServer();
  const origin = req.headers.get("origin")!;
  let result: Awaited<ReturnType<typeof sb.auth.signUp>>;
  try {
    result = await sb.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: `${origin}/auth/callback` } });
  } catch {
    authFail(503, "signup.auth_unreachable", "Couldn't reach the sign-up service (Supabase). It may be down, or this server's Supabase settings are wrong. Try again in a minute.", "Sign-up is temporarily unavailable.", ip);
  }
  const { data, error } = result;
  if (error) {
    const code = error.code ?? "";
    if (code === "weak_password" || /pwned|breach|weak and easy/i.test(error.message))
      authFail(400, "signup.password_breached", "That password has appeared in known data breaches (checked with HaveIBeenPwned), so attackers already try it. Choose a different one.", "Choose a stronger password.", ip);
    if (code === "user_already_exists" || /already registered/i.test(error.message))
      authFail(409, "signup.email_exists", `An account with ${email} already exists. Log in instead.`, "Couldn't create the account.", ip);
    if (code === "email_address_invalid")
      authFail(400, "signup.email_rejected", `Supabase rejected ${email} as invalid. It blocks test and reserved domains such as example.com. Use a real address.`, "That email address can't be used.", ip);
    if (code === "signup_disabled")
      authFail(403, "signup.disabled", "New sign-ups are switched off in Supabase (Authentication → Sign In / Providers → Allow new users to sign up).", "Sign-ups are currently closed.", ip);
    if (code === "over_email_send_rate_limit")
      authFail(429, "signup.email_rate_limit", "Supabase's email sending limit was reached, so no confirmation email could be sent. Wait a while, or switch off email confirmation / add custom SMTP in Supabase.", "Try again in a little while.", ip);
    if (code === "over_request_rate_limit" || error.status === 429)
      authFail(429, "signup.supabase_rate_limit", "Supabase's own sign-up limit was reached. Wait a minute and try again.", "Try again in a minute.", ip);
    if (code === "email_address_not_authorized" || /sending|smtp|confirmation email/i.test(error.message))
      authFail(503, "signup.email_send_failed", "Supabase couldn't send the confirmation email (its built-in sender only delivers to the project team's own addresses). Turn off email confirmation or set up custom SMTP in Supabase.", "We couldn't send the confirmation email.", ip);
    if (code === "unexpected_failure" || /database error saving new user/i.test(error.message))
      authFail(409, "signup.profile_create_failed", `Your account couldn't be created: saving your profile failed. Usually the username @${username} was taken a moment ago; try another one.`, "Couldn't create the account.", ip);
    authFail(502, `signup.unexpected.${code || error.status}`, `Sign-up failed with an unexpected error from Supabase: ${code || error.status} — ${error.message}`, "Couldn't create the account. Try again in a minute.", ip);
  }

  // "Confirm email" OFF → Supabase returns a session straight away and we're signed in.
  if (data.session) return json({ ok: true, signedIn: true });
  // Supabase hides existing emails behind a fake success when confirmation is on.
  if (data.user && (data.user.identities?.length ?? 0) === 0)
    authFail(409, "signup.email_exists", `An account with ${email} already exists. Log in instead.`, "Couldn't create the account.", ip);
  return json({
    ok: true,
    signedIn: false,
    message: detailedAuthErrors()
      ? `Account created, but you're not signed in yet: email confirmation is switched ON in Supabase, so a confirmation link was sent to ${email}. Click it, then log in.`
      : "Check your inbox for a confirmation link, then log in.",
  });
});
