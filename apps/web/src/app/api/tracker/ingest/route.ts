import type { NextRequest } from "next/server";
import { IngestSchema, INGEST_MAX_AGE_DAYS } from "@hm/shared/tracker";
import { DAILY_THINK_FIRST_CAP, POINTS, lastNDates, utcDate } from "@hm/shared/scoring";
import { api, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { hashExtensionToken } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { profileOf } from "@/lib/auth";
import { refreshLeaderboard, weeklyStats } from "@/lib/server/stats";
import { awardPoints } from "@/lib/server/points";

/**
 * The extension's only endpoint. Authenticated with a revocable Bearer token (no cookies, so
 * CSRF doesn't apply). Accepts per-day per-domain totals only.
 */
export const POST = api(async (req: NextRequest) => {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer (hm_ext_[A-Za-z0-9_-]{20,100})$/.exec(auth);
  if (!m) throw new HttpError(401, "Missing or malformed token");
  const tokenHash = hashExtensionToken(m[1]);
  await rateLimit("ingest", tokenHash);

  const sb = supabaseAdmin();
  const { data: tok } = await sb.from("extension_tokens").select("id, user_id, revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (!tok || tok.revoked_at) throw new HttpError(401, "Invalid or revoked token");
  const userId = tok.user_id as string;

  const body = await parseJson(req, IngestSchema, 100_000);
  const today = utcDate();
  // allow one day of clock/timezone skew in either direction
  const allowed = new Set(lastNDates(today, INGEST_MAX_AGE_DAYS));
  const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
  allowed.add(tomorrow);

  const rows = body.days.filter((d) => allowed.has(d.date));
  const perDay = new Map<string, number>();
  for (const r of rows) perDay.set(r.date, (perDay.get(r.date) ?? 0) + r.seconds);
  if ([...perDay.values()].some((s) => s > 86400)) throw new HttpError(400, "More than 24 hours in one day");

  if (rows.length) {
    const dates = [...new Set(rows.map((r) => r.date))];
    const { data: existing } = await sb.from("tracker_daily").select("date, domain, seconds").eq("user_id", userId).in("date", dates);
    const prev = new Map((existing ?? []).map((e) => [`${e.date}|${e.domain}`, e.seconds as number]));
    // totals only grow: a reinstall (empty local storage) can't erase recorded time
    const upserts = rows.map((r) => ({ user_id: userId, date: r.date, domain: r.domain, seconds: Math.max(r.seconds, prev.get(`${r.date}|${r.domain}`) ?? 0), updated_at: new Date().toISOString() }));
    const { error } = await sb.from("tracker_daily").upsert(upserts);
    if (error) throw error;
  }

  for (const t of body.thinkFirst.filter((t) => allowed.has(t.date))) {
    await sb.rpc("hm_add_think_first", { p_user: userId, p_date: t.date, p_redirected: t.redirected, p_bypassed: t.bypassed });
    for (let n = 1; n <= Math.min(t.redirected, DAILY_THINK_FIRST_CAP); n++) await awardPoints(userId, "think_first", `${t.date}:${n}`, POINTS.thinkFirstRedirect);
  }

  await sb.from("extension_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tok.id);
  const stats = await weeklyStats(userId);
  const profile = await profileOf(userId);
  if (profile) await refreshLeaderboard(userId, profile.username, stats);
  return json({ ok: true, accepted: rows.length, relianceScore: stats.relianceScore, streak: stats.streak, pointsWeek: stats.pointsWeek });
});
