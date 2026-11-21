import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

let admin: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS — only for tamper-sensitive writes and server-side reads
 * that have already been authorized in code. Never import this from a client component.
 */
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const e = env();
  admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
