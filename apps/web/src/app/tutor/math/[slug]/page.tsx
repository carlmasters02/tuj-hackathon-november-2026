import Link from "next/link";
import { notFound } from "next/navigation";
import { getMathCourse, getMathProblem, MATH_PROBLEMS, publicProblem, type MathProblem } from "@hm/shared/math/index";
import { requireUserPage } from "@/lib/auth";
import { getProgress } from "@/lib/server/tutor";
import { supabaseServer } from "@/lib/supabase/server";
import { MATH_SUBJECTS } from "@/lib/sitemap";
import { HubHeader, Progress } from "@/components/Hub";
import { StepCheck } from "@/components/math/StepCheck";
import { TexServer } from "@/components/math/TexServer";

export const metadata = { title: "Math" };

type ProgressRecord = { solved_at: string | null; failed_attempts: number };

function ProblemLink({ problem: p, state: s }: { problem: MathProblem; state?: ProgressRecord }) {
  return (
    <Link href={`/tutor/math/${p.id}`} className="flex min-h-20 min-w-0 items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 transition hover:border-fg/30">
      <span className="min-w-0">
        {p.statement && <span className="block text-[0.95rem] font-semibold leading-snug">{p.statement}</span>}
        {p.prompt && <span className={`block overflow-x-auto ${p.statement ? "mt-1 text-base text-fg-dim" : "text-lg"}`}><TexServer tex={p.prompt} /></span>}
      </span>
      <span className={`shrink-0 text-xs font-bold ${s?.solved_at ? "text-ok" : "text-fg-faint"}`}>
        {s?.solved_at ? "Solved" : s?.failed_attempts ? "In progress" : ["Warm-up", "Standard", "Stretch"][p.difficulty - 1]}
      </span>
    </Link>
  );
}

const INSTRUCTIONS: Record<string, string> = {
  derivative: "Find the derivative. Every line must equal the derivative.",
  antiderivative: "Find the antiderivative. Every line must differentiate back to the integrand; finish with + C.",
  partial: "Find the partial derivative. Treat the other letters as constants.",
  value: "Write the setup, then simplify one step per line. Every line must equal the answer; finish with a single number or a fraction in lowest terms.",
};

export default async function MathSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const subject = MATH_SUBJECTS.find((s) => s.slug === slug);
  const course = getMathCourse(slug);
  if (subject && course) {
    await requireUserPage(`/tutor/math/${slug}`);
    const sb = await supabaseServer();
    const { data } = await sb.from("tutor_progress").select("problem_id, solved_at, failed_attempts");
    const prog = new Map((data ?? []).map((r) => [r.problem_id, r]));
    const list = MATH_PROBLEMS.filter((p) => p.subject === subject.slug);
    const unitIds = new Set(course.units.flatMap((unit) => unit.problems.map((p) => p.id)));
    const legacy = list.filter((p) => !unitIds.has(p.id));
    const legacyTopics = [...new Set(legacy.map((p) => p.topic))];
    return (
      <div>
        <HubHeader title={course.title} intro={course.description} back={{ href: "/tutor/math", label: "Math" }}>
          <span className="chip">{course.semester}</span>
          <span className="chip">{course.units.length} guided units</span>
          <span className="chip">{list.length} StepCheck problems</span>
        </HubHeader>

        <section aria-labelledby="course-goals" className="mb-10 rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg-faint">Course overview</p>
              <h2 id="course-goals" className="mt-2 text-2xl font-bold">What this semester covers</h2>
            </div>
            <Progress done={list.filter((p) => prog.get(p.id)?.solved_at).length} total={list.length} label={`${course.title} problems solved`} />
          </div>
          <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 text-sm leading-relaxed text-fg-dim sm:grid-cols-2">
            {course.outcomes.map((outcome) => <li key={outcome} className="flex gap-2"><span aria-hidden className="text-flame">✦</span><span>{outcome}</span></li>)}
          </ul>
          <nav aria-label={`${course.title} units`} className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
            {course.units.map((unit, index) => <a key={unit.id} href={`#${unit.id}`} className="chip transition hover:border-fg/30">{index + 1}. {unit.title}</a>)}
          </nav>
        </section>

        {course.units.map((unit, index) => (
          <section key={unit.id} id={unit.id} data-course-unit={unit.id} aria-labelledby={`${unit.id}-title`} className="mb-12 scroll-mt-24">
            <div className="mb-5 border-t border-line pt-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame">Unit {index + 1} · {unit.week}</p>
                  <h2 id={`${unit.id}-title`} className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{unit.title}</h2>
                </div>
                <Progress done={unit.problems.filter((p) => prog.get(p.id)?.solved_at).length} total={unit.problems.length} label={`${unit.title} problems solved`} />
              </div>
              <p className="mt-4 max-w-3xl leading-relaxed text-fg-dim">{unit.summary}</p>
              <div className="mt-5 rounded-2xl bg-muted/65 px-5 py-4">
                <h3 className="text-sm font-bold">By the end of this unit, you can:</h3>
                <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-sm leading-relaxed text-fg-dim lg:grid-cols-3">
                  {unit.objectives.map((objective) => <li key={objective} className="flex gap-2"><span aria-hidden>—</span><span>{objective}</span></li>)}
                </ul>
              </div>
            </div>
            <ol aria-label={`${unit.title} practice`} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {unit.problems.map((p) => <li key={p.id} className="min-w-0"><ProblemLink problem={p} state={prog.get(p.id)} /></li>)}
            </ol>
          </section>
        ))}

        {legacy.length > 0 && (
          <section aria-labelledby="extra-practice" className="border-t border-line pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg-faint">Keep practicing</p>
            <h2 id="extra-practice" className="mt-2 text-2xl font-bold">Extra practice</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-fg-dim">The original Humagination exercises stay here, so your existing links and progress still work. They complement the twelve-unit semester pathway above.</p>
            {legacyTopics.map((topic) => (
              <div key={topic} className="mt-7">
                <h3 className="mb-3 text-lg font-bold">{topic}</h3>
                <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {legacy.filter((p) => p.topic === topic).map((p) => <li key={p.id} className="min-w-0"><ProblemLink problem={p} state={prog.get(p.id)} /></li>)}
                </ol>
              </div>
            ))}
          </section>
        )}
      </div>
    );
  }

  const p = getMathProblem(slug);
  if (!p) notFound();
  const user = await requireUserPage(`/tutor/math/${slug}`);
  const prog = await getProgress(user.id, slug);
  const pub = publicProblem(p); // the answer never reaches the browser
  const subj = MATH_SUBJECTS.find((s) => s.slug === p.subject);
  const instruction =
    INSTRUCTIONS[p.kind] ??
    (p.finalForm === "factored" ? "Factor completely. Each line must stay equal to the expression." :
     p.finalForm === "expanded" ? "Multiply out and combine like terms." :
     p.finalForm === "fraction_lowest" || p.finalForm === "no_division" ? "Simplify fully." :
     p.finalForm === "solutions" ? "Solve for x. Finish with every solution, e.g. x = 2 or x = -3." :
     p.finalForm === "exact" ? "Solve for x and keep it exact. Finish with x = …, e.g. x = 2 + sqrt(3) or x = ln(7)/2." : "Solve for x. Finish with x = (a number).");
  const syntax =
    p.subject === "prob-stats" ? "Type C(n, k) for combinations, P(n, k) for permutations, and n! for factorials." :
    p.subject === "precalculus" ? "Type ln(x), log10(x), log(x, 2) for log base 2, sqrt(x), sin(x), and pi." :
    p.subject === "calc-2" ? "Type e^x, ln(x), sin(x), cos(x), and C for the constant of integration." :
    p.subject === "calc-3" ? "Type products with a space or *, e.g. 2x y or 2*x*y." : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/tutor/math/${p.subject}`} className="inline-flex items-center gap-1 text-sm font-semibold text-fg-dim hover:text-fg"><span aria-hidden>←</span> {subj?.label ?? "Math"} · {p.topic}</Link>
      <div className="rounded-3xl border border-line bg-surface px-6 py-8 text-center shadow-[var(--shadow-soft)]">
        {p.statement && <p className="mx-auto max-w-xl text-xl font-semibold leading-snug text-balance">{p.statement}</p>}
        {p.prompt && <div className={`overflow-x-auto overflow-y-hidden ${p.statement ? "mt-3 text-2xl" : "text-3xl"}`}><TexServer tex={p.prompt} display /></div>}
        <p className="mt-3 text-sm text-fg-dim">{instruction}</p>
        {syntax && <p className="mt-1 text-xs text-fg-faint">{syntax}</p>}
      </div>
      <StepCheck problem={pub} solved={!!prog.solved_at} />
    </div>
  );
}
