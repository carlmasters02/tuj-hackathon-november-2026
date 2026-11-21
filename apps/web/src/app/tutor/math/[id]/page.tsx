import Link from "next/link";
import { notFound } from "next/navigation";
import { getMathProblem, publicProblem } from "@hm/shared/math/index";
import { requireUserPage } from "@/lib/auth";
import { getProgress } from "@/lib/server/tutor";
import { StepCheck } from "@/components/math/StepCheck";
import { TexServer } from "@/components/math/TexServer";

export const metadata = { title: "StepCheck" };

export default async function MathProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getMathProblem(id);
  if (!p) notFound();
  const user = await requireUserPage(`/tutor/math/${id}`);
  const prog = await getProgress(user.id, id);
  const pub = publicProblem(p); // strip the answer before anything reaches the browser
  const instruction =
    p.kind === "derivative" ? "Find the derivative. Each line should be equivalent to the derivative." :
    p.finalForm === "factored" ? "Factor completely. Each line must stay equal to the expression." :
    p.finalForm === "expanded" ? "Multiply out and combine like terms." :
    p.finalForm === "fraction_lowest" || p.finalForm === "no_division" ? "Simplify fully." :
    p.finalForm === "solutions" ? "Solve for x. Finish with every solution, e.g. x = 2 or x = -3." : "Solve for x. Finish with x = (a number).";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/tutor/math" className="text-sm text-fg-dim hover:text-fg">← All problems</Link>
      <div className="card space-y-2 p-6">
        <div className="text-xs uppercase tracking-wide text-fg-faint">{p.topic}</div>
        <div className="text-2xl"><TexServer tex={p.prompt} display /></div>
        <p className="text-sm text-fg-dim">{instruction}</p>
      </div>
      <StepCheck problem={pub} solved={!!prog.solved_at} />
    </div>
  );
}
