import "server-only";
import { sha256 } from "./crypto";
import { supabaseAdmin } from "./supabase/admin";

export const MAX_FAILURES = 10;
export const LOCK_MINUTES = 15;

const keyFor = (email: string) => sha256("login|" + email.trim().toLowerCase());

export async function lockedUntil(email: string): Promise<Date | null> {
  const { data } = await supabaseAdmin().from("login_attempts").select("locked_until").eq("key", keyFor(email)).maybeSingle();
  const t = data?.locked_until ? new Date(data.locked_until) : null;
  return t && t > new Date() ? t : null;
}

export async function recordFailure(email: string): Promise<{ failures: number; lockedUntil: Date | null }> {
  const key = keyFor(email);
  const sb = supabaseAdmin();
  const { data } = await sb.from("login_attempts").select("failures, locked_until").eq("key", key).maybeSingle();
  // a lock that has expired starts a fresh count
  const expired = data?.locked_until && new Date(data.locked_until) <= new Date();
  const failures = (expired ? 0 : (data?.failures ?? 0)) + 1;
  const locked_until = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
  await sb.from("login_attempts").upsert({ key, failures: locked_until ? 0 : failures, locked_until, updated_at: new Date().toISOString() });
  return { failures, lockedUntil: locked_until ? new Date(locked_until) : null };
}

export async function clearFailures(email: string): Promise<void> {
  await supabaseAdmin().from("login_attempts").delete().eq("key", keyFor(email));
}
