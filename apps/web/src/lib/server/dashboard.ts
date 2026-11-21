import "server-only";
import { MATH_PROBLEMS, getMathProblem } from "@hm/shared/math/index";
import { EXERCISES, getExercise } from "@hm/shared/code/exercises";
import { DAILY_POINTS_CAP, levelFor, utcDate, type PointsReason } from "@hm/shared/scoring";
import { MATH_SUBJECTS } from "../sitemap";
import { supabaseAdmin } from "../supabase/admin";
import { dec } from "./docs";

export interface ContinueItem {
  href: string;
  title: string;
  note: string;
  at: string;
}

export interface DashboardExtras {
  points: { total: number; today: number; cap: number; byReason: Record<PointsReason, number>; level: ReturnType<typeof levelFor> };
  tutor: { mathSolved: number; mathTotal: number; codeSolved: number; codeTotal: number; certified: number };
  portfolio: { works: number; sealed: number; likes: number; comments: number };
  next: ContinueItem[];
}

const LANG = { python: "Python", c: "C", java: "Java" } as const;

/** Everything on the dashboard beyond the weekly AI/human numbers. Always scoped to one user. */
export async function dashboardExtras(userId: string): Promise<DashboardExtras> {
  const sb = supabaseAdmin();
  const today = `${utcDate()}T00:00:00Z`;
  const [ledger, math, code, certs, works, docs, drafts] = await Promise.all([
    sb.from("points_ledger").select("reason, points, created_at").eq("user_id", userId),
    sb.from("tutor_progress").select("problem_id, solved_at, last_check_at").eq("user_id", userId),
    sb.from("code_progress").select("exercise_id, solved_at, last_submit_at").eq("user_id", userId),
    sb.from("certificates").select("id, verdict, kind").eq("owner_id", userId),
    sb.from("gallery_works").select("id, cert_id").eq("owner_id", userId),
    sb.from("documents").select("id, title_enc, status, updated_at").eq("owner_id", userId).eq("status", "draft").order("updated_at", { ascending: false }).limit(2),
    sb.from("creations").select("id, kind, title, updated_at").eq("owner_id", userId).eq("status", "draft").order("updated_at", { ascending: false }).limit(2),
  ]);

  const byReason: Record<PointsReason, number> = { math: 0, code: 0, document: 0, think_first: 0 };
  let total = 0;
  let todayPts = 0;
  for (const p of ledger.data ?? []) {
    byReason[p.reason as PointsReason] += p.points;
    total += p.points;
    if (p.created_at >= today) todayPts += p.points;
  }

  const sealedCerts = new Set((certs.data ?? []).filter((c) => c.verdict === "human_verified").map((c) => c.id));
  const workIds = (works.data ?? []).map((w) => w.id);
  const [likes, comments] = workIds.length
    ? await Promise.all([
        sb.from("likes").select("work_id", { count: "exact", head: true }).in("work_id", workIds),
        sb.from("comments").select("id", { count: "exact", head: true }).in("work_id", workIds).neq("author_id", userId),
      ])
    : [{ count: 0 }, { count: 0 }];

  const next: ContinueItem[] = [];
  for (const m of (math.data ?? []).filter((r) => !r.solved_at && r.last_check_at)) {
    const p = getMathProblem(m.problem_id);
    if (p) next.push({ href: `/tutor/math/${p.id}`, title: p.topic, note: `${MATH_SUBJECTS.find((s) => s.slug === p.subject)?.label ?? "Math"}, not solved yet`, at: m.last_check_at! });
  }
  for (const c of (code.data ?? []).filter((r) => !r.solved_at && r.last_submit_at)) {
    const ex = getExercise(c.exercise_id);
    if (ex) next.push({ href: `/tutor/code/${ex.id}`, title: ex.title, note: `${LANG[ex.lang]}, tests not passing yet`, at: c.last_submit_at! });
  }
  for (const d of docs.data ?? []) {
    let title = "Untitled";
    try {
      title = dec(d.id, "title", d.title_enc) || "Untitled";
    } catch {}
    next.push({ href: `/write/${d.id}`, title, note: "Writing draft", at: d.updated_at });
  }
  for (const c of drafts.data ?? []) next.push({ href: c.kind === "art" ? `/portfolio/art/studio/${c.id}` : `/portfolio/music/composer/${c.id}`, title: c.title, note: c.kind === "art" ? "Drawing in the studio" : "Piece in the composer", at: c.updated_at });
  next.sort((a, b) => b.at.localeCompare(a.at));

  return {
    points: { total, today: todayPts, cap: DAILY_POINTS_CAP, byReason, level: levelFor(total) },
    tutor: {
      mathSolved: (math.data ?? []).filter((r) => r.solved_at && MATH_PROBLEMS.some((p) => p.id === r.problem_id)).length,
      mathTotal: MATH_PROBLEMS.length,
      codeSolved: (code.data ?? []).filter((r) => r.solved_at).length,
      codeTotal: EXERCISES.length,
      certified: (certs.data ?? []).filter((c) => c.kind === "writing" && c.verdict === "human_verified").length,
    },
    portfolio: { works: workIds.length, sealed: (works.data ?? []).filter((w) => w.cert_id && sealedCerts.has(w.cert_id)).length, likes: likes.count ?? 0, comments: comments.count ?? 0 },
    next: next.slice(0, 4),
  };
}
