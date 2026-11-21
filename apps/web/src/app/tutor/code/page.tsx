import { EXERCISES } from "@hm/shared/code/exercises";
import { requireUserPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { CODE_LANGS } from "@/lib/sitemap";
import { HubHeader, IndexRow, Progress } from "@/components/Hub";

export const metadata = { title: "Code" };

export default async function CodeHub() {
  await requireUserPage("/tutor/code");
  const sb = await supabaseServer();
  const { data } = await sb.from("code_progress").select("exercise_id, solved_at");
  const solved = new Set((data ?? []).filter((r) => r.solved_at).map((r) => r.exercise_id));
  return (
    <div>
      <HubHeader title="Code" intro="Three languages on the same ladder of concepts, so you can see how each one says the same thing. No solution button, ever." back={{ href: "/tutor", label: "Tutor" }} />
      <nav aria-label="Languages">
        {CODE_LANGS.map((l) => {
          const list = EXERCISES.filter((e) => e.lang === l.slug);
          return <IndexRow key={l.slug} href={`/tutor/code/${l.slug}`} title={l.label} note={l.note} status={<Progress done={list.filter((e) => solved.has(e.id)).length} total={list.length} label={`${l.label} solved`} />} />;
        })}
      </nav>
    </div>
  );
}
