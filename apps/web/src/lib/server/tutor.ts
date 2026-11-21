import "server-only";
import { supabaseAdmin } from "../supabase/admin";

export interface TutorProgress {
  failed_attempts: number;
  hint_tier: number;
  hints_used: number;
  active_seconds: number;
  last_check_at: string | null;
  solved_at: string | null;
}

export async function getProgress(userId: string, problemId: string): Promise<TutorProgress> {
  const { data } = await supabaseAdmin().from("tutor_progress").select("failed_attempts, hint_tier, hints_used, active_seconds, last_check_at, solved_at").eq("user_id", userId).eq("problem_id", problemId).maybeSingle();
  return (data as TutorProgress) ?? { failed_attempts: 0, hint_tier: 1, hints_used: 0, active_seconds: 0, last_check_at: null, solved_at: null };
}

/**
 * Active seconds claimed by the browser are clamped to the wall-clock time since the last check
 * (max 10 minutes), so time-on-task can't be inflated by a modified client.
 */
export function clampActiveSeconds(claimed: number, lastCheckAt: string | null): number {
  const sinceLast = lastCheckAt ? (Date.now() - Date.parse(lastCheckAt)) / 1000 : 600;
  return Math.max(0, Math.min(Math.round(claimed), Math.round(sinceLast) + 2, 600));
}
