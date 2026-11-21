import Link from "next/link";
import { notFound } from "next/navigation";
import { getMathProblem, publicProblem, MATH_PROBLEMS } from "@hm/shared/math/index";
import { requireUserPage } from "@/lib/auth";
import { getProgress } from "@/lib/server/tutor";
import { supabaseServer } from "@/lib/supabase/server";
import { MATH_SUBJECTS } from "@/lib/sitemap";
import { HubHeader } from "@/components/Hub";
import { StepCheck } from "@/components/math/StepCheck";
import { TexServer } from "@/components/math/TexServer";

export const metadata = { title: "Math" };

const INSTRUCTIONS: Record<string, string> = {
  derivative: "Find the derivative. Every line must equal the derivative.",
  antiderivative: "Find an antiderivative (add + C if you like). Every line must differentiate back to the integrand.",
  partial: "Find the partial derivative. Treat the other variable as a constant.",
  value: "Work it out step by step. Every line must equal the exact answer; finish with the simplest form.",
};

export default async function MathSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const subject = MATH_SUBJECTS.find((s) => s.slug === slug);
  if (subject) {
    await requireUserPage(`/tutor/math/${slug}`);
    const sb = await supabaseServer();
    const { data } = await sb.from("tutor_progress").select("problem_id, solved_at, failed_attempts");
    const prog = new Map((data ?? []).map((r) => [r.problem_id, r]));
    const list = MATH_PROBLEMS.filter((p) => p.subject === subject.slug);
    const topics = [...new Set(list.map((p) => p.topic))];
    return (
      <div>
        <HubHeader title={subject.label} intro={subject.note} back={{ href: "/tutor/math", label: "Math" }} />
        {list.length === 0 && <p className="text-fg-dim">Problems for this subject are on the way.</p>}
        {topics.map((t) => (
          <section key={t} className="mb-10">
            <h2 className="mb-3 text-xl font-bold">{t}</h2>
            <ol className="grid gap-2 sm:grid-cols-2">
              {list.filter((p) => p.topic === t).map((p) => {
                const s = prog.get(p.id);
                return (
                  <li key={p.id}>
                    <Link href={`/tutor/math/${p.id}`} className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 transition hover:border-fg/30">
                      <span className="text-lg"><TexServer tex={p.prompt} /></span>
                      <span className={`shrink-0 text-xs font-bold ${s?.solved_at ? "text-ok" : "text-fg-faint"}`}>
                        {s?.solved_at ? "Solved" : s?.failed_attempts ? "In progress" : ["Warm-up", "Standard", "Stretch"][p.difficulty - 1]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
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
     p.finalForm === "solutions" ? "Solve for x. Finish with every solution, e.g. x = 2 or x = -3." : "Solve for x. Finish with x = (a number).");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/tutor/math/${p.subject}`} className="inline-flex items-center gap-1 text-sm font-semibold text-fg-dim hover:text-fg"><span aria-hidden>←</span> {subj?.label ?? "Math"} · {p.topic}</Link>
      <div className="rounded-3xl border border-line bg-surface px-6 py-8 text-center shadow-[var(--shadow-soft)]">
        <div className="text-3xl"><TexServer tex={p.prompt} display /></div>
        <p className="mt-3 text-sm text-fg-dim">{instruction}</p>
      </div>
      <StepCheck problem={pub} solved={!!prog.solved_at} />
    </div>
  );
}
