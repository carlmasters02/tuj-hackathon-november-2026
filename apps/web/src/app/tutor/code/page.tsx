import Link from "next/link";
import { EXERCISES } from "@hm/shared/code/exercises";
import { requireUserPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { CODE_LANGS } from "@/lib/sitemap";
import { HubHeader, IndexRow, Progress } from "@/components/Hub";

export const metadata = { title: "Code" };

export default async function CodeHub() {
  await requireUserPage("/tutor/code");
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("code_progress")
    .select("exercise_id")
    .not("solved_at", "is", null);
  const solved = new Set((data ?? []).map((r) => r.exercise_id));

  const byLang = new Map<string, typeof EXERCISES>();
  for (const e of EXERCISES) {
    byLang.set(e.lang, [...(byLang.get(e.lang) ?? []), e]);
  }

  const totalSolved = EXERCISES.filter((e) => solved.has(e.id)).length;
  const nextLang = CODE_LANGS.find((l) =>
    (byLang.get(l.slug) ?? []).some((e) => !solved.has(e.id))
  );

  return (
    <div>
      <HubHeader title="Code" intro="Three languages on the same ladder of concepts, so you can see how each one says the same thing. No solution button, ever." back={{ href: "/tutor", label: "Tutor" }} />

      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <Progress done={totalSolved} total={EXERCISES.length} label="Code exercises solved" />
        {nextLang && (
          <Link href={`/tutor/code/${nextLang.slug}`} className="btn btn-primary">
            {totalSolved === 0 ? "Start with " : "Continue with "}{nextLang.label}
          </Link>
        )}
      </div>
      {error && <p className="text-sm">Couldn’t load your progress, so the counts below may be wrong.</p>}

      <nav aria-label="Languages">
        {CODE_LANGS.map((l) => {
          const list = byLang.get(l.slug) ?? [];
          return (
            <IndexRow
              key={l.slug}
              href={`/tutor/code/${l.slug}`}
              title={l.label}
              note={l.note}
              status={list.length ? <Progress done={list.filter((e) => solved.has(e.id)).length} total={list.length} label={`${l.label} solved`} /> : "Coming soon"}
            />
          );
        })}
      </nav>
    </div>
  );
}
