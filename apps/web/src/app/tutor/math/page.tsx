import Link from "next/link";
import { MATH_COURSES, MATH_PROBLEMS } from "@hm/shared/math/index";
import { requireUserPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { MATH_SUBJECTS } from "@/lib/sitemap";
import { HubHeader, IndexRow, Progress } from "@/components/Hub";

export const metadata = { title: "Math" };

export default async function MathHub() {
  await requireUserPage("/tutor/math");
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("tutor_progress")
    .select("problem_id")
    .not("solved_at", "is", null);
  const solved = new Set((data ?? []).map((r) => r.problem_id));

  const bySubject = new Map<string, typeof MATH_PROBLEMS>();
  for (const p of MATH_PROBLEMS) {
    bySubject.set(p.subject, [...(bySubject.get(p.subject) ?? []), p]);
  }

  const totalSolved = MATH_PROBLEMS.filter((p) => solved.has(p.id)).length;
  const nextSubject = MATH_SUBJECTS.find((s) =>
    (bySubject.get(s.slug) ?? []).some((p) => !solved.has(p.id))
  );

  return (
    <div>
      <HubHeader title="Math" intro="Six full-semester pathways with clear learning goals and unit-by-unit practice. Write one step per line; StepCheck finds the first line that stops being equivalent without giving you the answer." back={{ href: "/tutor", label: "Tutor" }} />

      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <Progress done={totalSolved} total={MATH_PROBLEMS.length} label="Math problems solved" />
        {nextSubject && (
          <Link href={`/tutor/math/${nextSubject.slug}`} className="btn btn-primary">
            {totalSolved === 0 ? "Start with " : "Continue with "}{nextSubject.label}
          </Link>
        )}
      </div>
      {error && <p className="text-sm">Couldn’t load your progress, so the counts below may be wrong.</p>}

      <nav aria-label="Math subjects">
        {MATH_SUBJECTS.map((s) => {
          const list = bySubject.get(s.slug) ?? [];
          const course = MATH_COURSES.find((c) => c.slug === s.slug);
          return (
            <IndexRow
              key={s.slug}
              href={`/tutor/math/${s.slug}`}
              title={s.label}
              note={s.note}
              chips={course ? [`${course.units.length} units`, `${list.length} problems`, course.semester] : undefined}
              status={<Progress done={list.filter((p) => solved.has(p.id)).length} total={list.length} label={`${s.label} solved`} />}
            />
          );
        })}
      </nav>
    </div>
  );
}