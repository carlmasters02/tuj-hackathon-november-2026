import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { MATH_PROBLEMS } from "@hm/shared/math/problems";
import { EXERCISES } from "@hm/shared/code/exercises";
import { TUTOR } from "@/lib/sitemap";

export const metadata = { title: "Tutor" };

export default async function TutorHub() {
  await requireUserPage("/tutor");
  const sb = await supabaseServer();
  const [math, code, docs] = await Promise.all([
    sb.from("tutor_progress").select("problem_id", { count: "exact", head: true }).not("solved_at", "is", null),
    sb.from("code_progress").select("exercise_id", { count: "exact", head: true }).not("solved_at", "is", null),
    sb.from("documents").select("id", { count: "exact", head: true }).neq("genre", "free"),
  ]);
  const totals: Record<string, { done: number; total: number; label: string } | null> = {
    math: { done: math.count ?? 0, total: MATH_PROBLEMS.length, label: "Problems solved" },
    code: { done: code.count ?? 0, total: EXERCISES.length, label: "Exercises completed" },
    writing: null,
  };

  return (
    <main className="mx-auto max-w-5xl pb-12">
      {/* Header and navigation are supplied by the existing shared site layout. */}
      <header className="mb-8">
        <h1 className="font-display text-[clamp(2.4rem,5vw,3.8rem)] font-semibold leading-tight tracking-tight text-fg">Tutor</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-fg-dim">
          Practice that checks your work and points at the mistake, without ever doing it for you. Pick a subject.
        </p>
      </header>

      <nav aria-label="Tutor subjects" className="space-y-4">
        {TUTOR.map((subject) => {
          const progress = totals[subject.key];
          const writingCount = docs.count ?? 0;
          const progressPercent = progress && progress.total ? Math.min(100, 100 * progress.done / progress.total) : 0;

          return (
            <section key={subject.key} className="rounded-xl border-[1.5px] border-[#E9D68A] bg-white p-5 shadow-[0_5px_15px_rgba(91,77,39,0.09)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-[clamp(1.7rem,3.5vw,2.5rem)] font-semibold leading-tight text-fg">
                    <Link href={subject.href} className="transition hover:text-navy-2 focus-visible:outline-offset-4">{subject.label}</Link>
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-dim sm:text-base">{subject.blurb}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-fg-faint">
                  {progress ? `${progress.done} / ${progress.total}` : `${writingCount} pieces in progress`}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {subject.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center rounded-full border border-[#E5D8BC] bg-[#FFFBF2] px-3 py-1.5 text-xs font-semibold text-fg-dim no-underline transition hover:border-[#D4BD62] hover:bg-[#FDF1C7] focus-visible:outline-offset-2 sm:text-sm"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              {progress && (
                <div className="mt-6 border-t border-[#EFE8D5] pt-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-fg-dim">{progress.label}</span>
                    <span className="font-semibold tabular-nums text-fg">{progress.done} of {progress.total}</span>
                  </div>
                  <div
                    className="mt-2 h-1.5 w-full bg-[#F0E9D6]"
                    role="progressbar"
                    aria-label={progress.label}
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-valuenow={progress.done}
                  >
                    <div className="h-full bg-fg" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </nav>
    </main>
  );
}
