import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

/**
 * Lands here after Google sign-in (PKCE `code`) or an email-confirmation link (`code` or
 * `token_hash`). Exchanges it for a session cookie and redirects to a same-site path only.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  if (url.searchParams.get("error")) return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const sb = await supabaseServer();
  if (code) {
    if (!(await sb.auth.exchangeCodeForSession(code)).error) return NextResponse.redirect(new URL(next, url.origin));
    // Supabase has already verified the email before redirecting here. The exchange fails when
    // the link is opened in a different browser/device than the one used to sign up (the PKCE
    // verifier cookie lives in the original browser), so send them to log in instead of erroring.
    return NextResponse.redirect(new URL(`/login?confirmed=1&next=${encodeURIComponent(next)}`, url.origin));
  }
  if (tokenHash && type && !(await sb.auth.verifyOtp({ type, token_hash: tokenHash })).error) return NextResponse.redirect(new URL(next, url.origin));
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
