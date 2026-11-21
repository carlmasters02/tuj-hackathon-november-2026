import "server-only";
import { applyDailyCap, utcDate, type PointsReason } from "@hm/shared/scoring";
import { supabaseAdmin } from "../supabase/admin";

/**
 * Awards Human Points once per (user, reason, ref), respecting the daily cap.
 * Returns the points actually granted (0 if capped or already awarded).
 */
export async function awardPoints(userId: string, reason: PointsReason, ref: string, requested: number): Promise<number> {
  const sb = supabaseAdmin();
  const today = utcDate();
  const { data: rows } = await sb.from("points_ledger").select("points").eq("user_id", userId).gte("created_at", `${today}T00:00:00Z`);
  const already = (rows ?? []).reduce((n, r) => n + (r.points as number), 0);
  const points = applyDailyCap(requested, already);
  const { error, data } = await sb
    .from("points_ledger")
    .upsert({ user_id: userId, reason, ref, points }, { onConflict: "user_id,reason,ref", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data && data.length ? points : 0;
}

export async function addHumanTime(userId: string, kind: "tutor" | "writing", seconds: number) {
  const s = Math.max(0, Math.min(Math.round(seconds), 4 * 3600));
  if (!s) return;
  await supabaseAdmin().rpc("hm_add_human_time", { p_user: userId, p_date: utcDate(), p_tutor: kind === "tutor" ? s : 0, p_writing: kind === "writing" ? s : 0 });
}
