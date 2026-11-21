import { MATH_PROBLEMS } from "@hm/shared/math/problems";
import { requireUserPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { MATH_SUBJECTS } from "@/lib/sitemap";
import { HubHeader, IndexRow, Progress } from "@/components/Hub";

export const metadata = { title: "Math" };

export default async function MathHub() {
  await requireUserPage("/tutor/math");
  const sb = await supabaseServer();
  const { data } = await sb.from("tutor_progress").select("problem_id, solved_at");
  const solved = new Set((data ?? []).filter((r) => r.solved_at).map((r) => r.problem_id));
  return (
    <div>
      <HubHeader title="Math" intro="One step per line. StepCheck checks each line against the one before and tells you what kind of mistake it is." back={{ href: "/tutor", label: "Tutor" }} />
      <nav aria-label="Math subjects">
        {MATH_SUBJECTS.map((s) => {
          const list = MATH_PROBLEMS.filter((p) => p.subject === s.slug);
          return (
            <IndexRow
              key={s.slug}
              href={`/tutor/math/${s.slug}`}
              title={s.label}
              note={s.note}
              status={list.length ? <Progress done={list.filter((p) => solved.has(p.id)).length} total={list.length} label={`${s.label} solved`} /> : "Coming soon"}
            />
          );
        })}
      </nav>
    </div>
  );
}
