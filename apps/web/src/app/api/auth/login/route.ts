import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, clientIp, json, parseJson, rateLimit } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { clearFailures, lockedUntil, LOCK_MINUTES, MAX_FAILURES, recordFailure } from "@/lib/lockout";
import { accountStatus, authFail, detailedAuthErrors, fmtWait } from "@/lib/authErrors";

const Body = z.object({ email: z.string().max(254).default(""), password: z.string().max(128).default("") }).strict();
const GENERIC = "Email or password is incorrect.";

/**
 * Email + password login. Every failure has a reason code (logged server-side, never with the
 * email or password). With HM_DETAILED_AUTH_ERRORS=true the user sees exactly what went wrong.
 */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  await rateLimit("loginIp", `ip:${ip}`, (s) =>
    `Too many login attempts from your network: more than 30 in the last minute. Everyone on the same Wi-Fi or network shares this limit. Try again in ${fmtWait(s)}.`,
  );
  const raw = await parseJson(req, Body, 10_000);
  const email = raw.email.trim().toLowerCase();
  const password = raw.password;

  if (!email) authFail(400, "login.missing_email", "Enter your email address.", "Enter your email address.", ip);
  if (!z.email().safeParse(email).success)
    authFail(400, "login.invalid_email", `"${email}" isn't a valid email address. Check for typos, spaces or a missing "@".`, "Enter a valid email address.", ip);
  if (!password) authFail(400, "login.missing_password", "Enter your password.", "Enter your password.", ip);

  await rateLimit("login", `email:${email}`, (s) =>
    detailedAuthErrors()
      ? `Too many login attempts for ${email}: more than 5 in the last minute. Wait ${fmtWait(s)}, then try again.`
      : `Too many attempts. Try again in ${fmtWait(s)}.`,
  );

  const until = await lockedUntil(email);
  if (until) {
    const mins = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
    authFail(
      429,
      "login.locked",
      `This account is temporarily locked because the password was entered wrong ${MAX_FAILURES} times in a row. It unlocks at ${until.toISOString().slice(11, 16)} UTC (in about ${mins} minute${mins === 1 ? "" : "s"}).`,
      `Too many failed attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`,
      ip,
    );
  }

  const sb = await supabaseServer();
  let result: Awaited<ReturnType<typeof sb.auth.signInWithPassword>>;
  try {
    result = await sb.auth.signInWithPassword({ email, password });
  } catch {
    authFail(503, "login.auth_unreachable", "Couldn't reach the sign-in service (Supabase). It may be down, or this server's Supabase settings are wrong. Try again in a minute.", "Sign-in is temporarily unavailable. Try again in a minute.", ip);
  }
  const { error } = result;
  if (!error) {
    await clearFailures(email);
    return json({ ok: true });
  }

  const code = error.code ?? "";
  if (code === "email_not_confirmed")
    authFail(
      403,
      "login.email_not_confirmed",
      "This account exists, but its email address was never confirmed. Accounts created while email confirmation was switched on stay unconfirmed. Ask the project admin to confirm it (Supabase → Authentication → Users → the user → Confirm email), or delete it so you can sign up again.",
      "Confirm your email first — check your inbox.",
      ip,
    );
  if (code === "user_banned") authFail(403, "login.banned", "This account has been suspended by an administrator.", GENERIC, ip);
  if (code === "over_request_rate_limit" || error.status === 429)
    authFail(429, "login.supabase_rate_limit", "Supabase's own sign-in limit was reached (too many logins through this server in a short time). Wait a minute and try again.", "Too many attempts. Try again in a minute.", ip);

  if (code === "invalid_credentials" || error.status === 400) {
    if (detailedAuthErrors()) {
      const st = await accountStatus(email);
      if (!st)
        authFail(
          401,
          "login.no_account",
          `There's no Humagination account for ${email}. Check the spelling, or sign up first. Accounts don't carry over from other projects or from someone's local copy of the app.`,
          GENERIC,
          ip,
        );
      if (st.banned) authFail(403, "login.banned", "This account has been suspended by an administrator.", GENERIC, ip);
      if (!st.has_password)
        authFail(
          401,
          "login.no_password",
          `${email} was created with ${st.providers.join(", ") || "another sign-in method"} and has no password. Use that sign-in method instead.`,
          GENERIC,
          ip,
        );
    }
    const f = await recordFailure(email);
    const left = MAX_FAILURES - f.failures;
    authFail(
      401,
      "login.wrong_password",
      f.lockedUntil
        ? `Wrong password. That was the ${MAX_FAILURES}th wrong attempt in a row, so this account is now locked for ${LOCK_MINUTES} minutes.`
        : `Wrong password for ${email}. Passwords are case-sensitive, so check Caps Lock. ${left} more wrong attempt${left === 1 ? "" : "s"} will lock this account for ${LOCK_MINUTES} minutes.`,
      GENERIC,
      ip,
    );
  }

  authFail(502, `login.unexpected.${code || error.status}`, `Sign-in failed with an unexpected error from Supabase: ${code || error.status} — ${error.message}`, "Sign-in failed. Try again in a minute.", ip);
});
