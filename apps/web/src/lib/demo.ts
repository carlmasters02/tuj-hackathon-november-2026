import "server-only";
import { supabaseAdmin } from "./supabase/admin";

/**
 * DEMO MODE — for testing only. When HM_DEMO_MODE=true, signed-out visitors are signed in to one
 * shared, pre-confirmed "demo" account (no login form, no email). Everything else — sessions,
 * RLS, rate limits — behaves exactly as in production. Never enable this where real users sign up.
 */
export const demoMode = () => process.env.HM_DEMO_MODE === "true";
export const DEMO_USERNAME = "demo";
const demoEmail = () => process.env.HM_DEMO_EMAIL || "demo@humagination.app";

/** Returns the demo account's email, creating the (confirmed) account on first use. */
export async function ensureDemoUser(): Promise<string> {
  const sb = supabaseAdmin();
  const { data: profile } = await sb.from("profiles").select("id").eq("username", DEMO_USERNAME).maybeSingle();
  if (profile) {
    const { data } = await sb.auth.admin.getUserById(profile.id);
    if (data.user?.email) return data.user.email;
  }
  const email = demoEmail();
  const { error } = await sb.auth.admin.createUser({
    email,
    email_confirm: true, // no confirmation email is sent
    user_metadata: { username: DEMO_USERNAME, display_name: "Demo Student" },
  });
  if (error && !/already/i.test(error.message)) throw new Error(`demo user: ${error.message} (set HM_DEMO_EMAIL to another address if this one is rejected)`);
  return email;
}

export async function isDemoUser(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("profiles").select("username").eq("id", userId).maybeSingle();
  return data?.username === DEMO_USERNAME;
}
