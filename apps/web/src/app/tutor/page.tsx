import { requireUserPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { MATH_PROBLEMS } from "@hm/shared/math/problems";
import { EXERCISES } from "@hm/shared/code/exercises";
import { TUTOR } from "@/lib/sitemap";
import { HubHeader, IndexRow, Progress } from "@/components/Hub";

export const metadata = { title: "Tutor" };

export default async function TutorHub() {
  await requireUserPage("/tutor");
  const sb = await supabaseServer();
  const [math, code, docs] = await Promise.all([
    sb.from("tutor_progress").select("problem_id", { count: "exact", head: true }).not("solved_at", "is", null),
    sb.from("code_progress").select("exercise_id", { count: "exact", head: true }).not("solved_at", "is", null),
    sb.from("documents").select("id", { count: "exact", head: true }).neq("genre", "free"),
  ]);
  const status: Record<string, React.ReactNode> = {
    math: <Progress done={math.count ?? 0} total={MATH_PROBLEMS.length} label="Math problems solved" />,
    code: <Progress done={code.count ?? 0} total={EXERCISES.length} label="Exercises solved" />,
    writing: <span className="tabular-nums">{docs.count ?? 0} pieces in progress</span>,
  };
  return (
    <div>
      <HubHeader title="Tutor" intro="Practice that checks your work and points at the mistake, without ever doing it for you. Pick a subject." />
      <nav aria-label="Tutor subjects">
        {TUTOR.map((s) => (
          <IndexRow key={s.key} href={s.href} title={s.label} note={s.blurb} chips={s.items.map((i) => i.label)} status={status[s.key]} />
        ))}
      </nav>
    </div>
  );
}
