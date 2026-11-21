import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/http";
import { safeNext } from "@/lib/safeNext";
import { demoMode, ensureDemoUser } from "@/lib/demo";

/**
 * DEMO MODE ONLY: signs the visitor in to the shared demo account. The server mints a one-time
 * magic-link token with the service role and redeems it immediately, so no email or password is
 * involved. Returns 404 whenever demo mode is off.
 */
export async function GET(req: NextRequest) {
  if (!demoMode()) return new NextResponse("Not found", { status: 404 });
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  try {
    await rateLimit("login", `demo:${clientIp(req)}`);
    const email = await ensureDemoUser();
    const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data.properties?.hashed_token) throw error ?? new Error("no token");
    const sb = await supabaseServer();
    const { error: vErr } = await sb.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
    if (vErr) throw vErr;
    return NextResponse.redirect(new URL(next, req.nextUrl.origin));
  } catch (e) {
    console.error("[demo] sign-in failed:", e instanceof Error ? e.message : e);
    return new NextResponse("Demo sign-in failed — check the server logs (is SUPABASE_SERVICE_ROLE_KEY set?).", { status: 500 });
  }
}
