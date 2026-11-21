import "server-only";
import { currentStreak, lastNDates, relianceScore, utcDate, type DayTotals } from "@hm/shared/scoring";
import { supabaseAdmin } from "../supabase/admin";

export interface WeeklyStats {
  days: { date: string; aiMinutes: number; humanMinutes: number }[];
  aiMinutes: number;
  humanMinutes: number;
  relianceScore: number;
  streak: number;
  pointsWeek: number;
  pointsTotal: number;
  domains: { domain: string; minutes: number }[];
  thinkFirst: { redirected: number; bypassed: number };
}

const weekStart = (today: string) => lastNDates(today, 7)[0];

/** Computes the dashboard numbers from the server's own tables (never from client-supplied totals). */
export async function weeklyStats(userId: string): Promise<WeeklyStats> {
  const sb = supabaseAdmin();
  const today = utcDate();
  const history = lastNDates(today, 60);
  const from = history[0];
  const [tracker, human, points, tf] = await Promise.all([
    sb.from("tracker_daily").select("date, domain, seconds").eq("user_id", userId).gte("date", from),
    sb.from("human_time_daily").select("date, tutor_seconds, writing_seconds").eq("user_id", userId).gte("date", from),
    sb.from("points_ledger").select("points, created_at").eq("user_id", userId),
    sb.from("think_first_daily").select("date, redirected, bypassed").eq("user_id", userId).gte("date", weekStart(today)),
  ]);
  const ai = new Map<string, number>();
  const dom = new Map<string, number>();
  const week = new Set(lastNDates(today, 7));
  for (const r of tracker.data ?? []) {
    ai.set(r.date, (ai.get(r.date) ?? 0) + r.seconds);
    if (week.has(r.date)) dom.set(r.domain, (dom.get(r.domain) ?? 0) + r.seconds);
  }
  const hum = new Map<string, number>();
  for (const r of human.data ?? []) hum.set(r.date, (r.tutor_seconds ?? 0) + (r.writing_seconds ?? 0));
  const allDays: DayTotals[] = history.map((d) => ({ date: d, aiMinutes: (ai.get(d) ?? 0) / 60, humanMinutes: (hum.get(d) ?? 0) / 60 }));
  const days = allDays.slice(-7).map((d) => ({ date: d.date, aiMinutes: Math.round(d.aiMinutes), humanMinutes: Math.round(d.humanMinutes) }));
  const aiMinutes = days.reduce((n, d) => n + d.aiMinutes, 0);
  const humanMinutes = days.reduce((n, d) => n + d.humanMinutes, 0);
  const ws = `${weekStart(today)}T00:00:00Z`;
  return {
    days,
    aiMinutes,
    humanMinutes,
    relianceScore: relianceScore(aiMinutes, humanMinutes),
    streak: currentStreak(allDays, today),
    pointsWeek: (points.data ?? []).filter((p) => p.created_at >= ws).reduce((n, p) => n + p.points, 0),
    pointsTotal: (points.data ?? []).reduce((n, p) => n + p.points, 0),
    domains: [...dom.entries()].map(([domain, s]) => ({ domain, minutes: Math.round(s / 60) })).sort((a, b) => b.minutes - a.minutes),
    thinkFirst: (tf.data ?? []).reduce((a, r) => ({ redirected: a.redirected + r.redirected, bypassed: a.bypassed + r.bypassed }), { redirected: 0, bypassed: 0 }),
  };
}

/** Refreshes this user's row in the weekly leaderboard table (shown only if they opted in). */
export async function refreshLeaderboard(userId: string, username: string, s: WeeklyStats) {
  await supabaseAdmin().from("leaderboard_weekly").upsert({
    user_id: userId,
    week_start: weekStart(utcDate()),
    username,
    reliance_score: s.relianceScore,
    streak: s.streak,
    points: s.pointsWeek,
    updated_at: new Date().toISOString(),
  });
}
