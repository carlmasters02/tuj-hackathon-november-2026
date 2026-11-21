import "server-only";
import { createHash } from "node:crypto";
import { HttpError } from "./http";
import { supabaseAdmin } from "./supabase/admin";

/**
 * HM_DETAILED_AUTH_ERRORS=true explains every login/signup failure precisely (for debugging and
 * small trusted groups). It makes it possible to learn whether an email has an account, so turn
 * it off for a public launch — then users get the generic message instead.
 */
export const detailedAuthErrors = () => process.env.HM_DETAILED_AUTH_ERRORS === "true";

/** Logs the reason (never emails or passwords) and throws the detailed or generic message. */
export function authFail(status: number, reason: string, detailed: string, generic: string, ip?: string): never {
  const ipTag = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 8) : "-";
  console.warn(`[auth] ${reason} status=${status} net=${ipTag}`);
  const on = detailedAuthErrors();
  throw new HttpError(status, on ? detailed : generic, on ? { reason } : undefined);
}

export interface AccountStatus {
  account_exists: boolean;
  email_confirmed: boolean;
  has_password: boolean;
  providers: string[];
  banned: boolean;
}

/** Server-only lookup (service role → hm_auth_status). null when no account uses this email. */
export async function accountStatus(email: string): Promise<AccountStatus | null> {
  const { data, error } = await supabaseAdmin().rpc("hm_auth_status", { p_email: email });
  if (error) {
    console.warn("[auth] status lookup failed:", error.code);
    return null;
  }
  return (data as AccountStatus[] | null)?.[0] ?? null;
}

export const fmtWait = (s: number) => (s >= 90 ? `${Math.ceil(s / 60)} minutes` : `${s} second${s === 1 ? "" : "s"}`);
