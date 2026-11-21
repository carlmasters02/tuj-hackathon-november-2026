import Link from "next/link";
import { MATH_PROBLEMS } from "@hm/shared/math/problems";
import { requireUserPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { TexServer } from "@/components/math/TexServer";

export const metadata = { title: "StepCheck" };

export default async function MathIndex() {
  await requireUserPage("/tutor/math");
  const sb = await supabaseServer();
  const { data } = await sb.from("tutor_progress").select("problem_id, solved_at, failed_attempts");
  const prog = new Map((data ?? []).map((r) => [r.problem_id, r]));
  const topics = [...new Set(MATH_PROBLEMS.map((p) => p.topic))];
  const solved = MATH_PROBLEMS.filter((p) => prog.get(p.id)?.solved_at).length;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-page">StepCheck</h1>
          <p className="mt-1 max-w-2xl text-sm text-paper-dim">Work each problem one line at a time. StepCheck checks every line against the one before and points to the first one that goes wrong. It never shows the answer.</p>
        </div>
        <span className="chip">{solved}/{MATH_PROBLEMS.length} solved</span>
      </div>
      {topics.map((t) => (
        <section key={t} className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-paper-faint">{t}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MATH_PROBLEMS.filter((p) => p.topic === t).map((p) => {
              const s = prog.get(p.id);
              return (
                <Link key={p.id} href={`/tutor/math/${p.id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-paper-faint">
                  <TexServer tex={p.prompt} />
                  <span className={`shrink-0 text-xs ${s?.solved_at ? "text-ok" : "text-paper-faint"}`}>{s?.solved_at ? "✓ solved" : "●".repeat(p.difficulty)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
