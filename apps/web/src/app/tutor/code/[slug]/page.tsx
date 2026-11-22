import Link from "next/link";
import { notFound } from "next/navigation";
import { getExercise, EXERCISES } from "@hm/shared/code/exercises";
import { hintsUnlocked, publicExercise } from "@hm/shared/code/grading";
import { CONCEPT_LABEL } from "@hm/shared/code/types";
import { requireUserPage } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderMarkdown } from "@/lib/markdown";
import { CODE_LANGS } from "@/lib/sitemap";
import { HubHeader } from "@/components/Hub";
import { supabaseServer } from "@/lib/supabase/server";
import { CodeDojo } from "@/components/code/CodeDojo";

export const metadata = { title: "Code" };
const LABEL = { python: "Python", c: "C", java: "Java" } as const;

export default async function CodeSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: id } = await params;
  const lang = CODE_LANGS.find((l) => l.slug === id);
  if (lang) {
    await requireUserPage(`/tutor/code/${id}`);
    const sb = await supabaseServer();
    const { data } = await sb.from("code_progress").select("exercise_id, solved_at, failed_submissions");
    const prog = new Map((data ?? []).map((r) => [r.exercise_id, r]));
    const list = EXERCISES.filter((e) => e.lang === lang.slug);
    return (
      <div>
        <HubHeader title={lang.label} intro={lang.note + ". Twelve exercises, from first input to small projects."} back={{ href: "/tutor/code", label: "Code" }} />
        <ol className="divide-y divide-line border-y border-line">
          {list.map((e, i) => {
            const pr = prog.get(e.id);
            return (
              <li key={e.id}>
                <Link href={`/tutor/code/${e.id}`} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 px-1 py-4 transition-colors hover:bg-sun-soft/60">
                  <span className="text-right text-2xl font-extrabold tabular-nums text-fg-faint">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-lg font-bold">{e.title}</span>
                    <span className="block text-sm text-fg-dim">{CONCEPT_LABEL[e.concept]}</span>
                  </span>
                  <span className={`text-xs font-bold ${pr?.solved_at ? "text-ok" : "text-fg-faint"}`}>{pr?.solved_at ? "Solved" : pr?.failed_submissions ? "In progress" : ["Warm-up", "Standard", "Stretch"][e.difficulty - 1]}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }
  const ex = getExercise(id);
  if (!ex) notFound();
  const user = await requireUserPage(`/tutor/code/${id}`);
  const { data: prog } = await supabaseAdmin().from("code_progress").select("solved_at, failed_submissions").eq("user_id", user.id).eq("exercise_id", id).maybeSingle();
  const failed = prog?.failed_submissions ?? 0;
  const pub = publicExercise(ex); // hidden tests and locked hints never reach the browser
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-4">
        <Link href={`/tutor/code/${ex.lang}`} className="inline-flex items-center gap-1 text-sm font-semibold text-fg-dim hover:text-fg"><span aria-hidden>←</span> {LABEL[ex.lang]}</Link>
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="chip">{LABEL[ex.lang]}</span><span className="chip">{CONCEPT_LABEL[ex.concept]}</span><span className="chip" title="Difficulty">{["Warm-up", "Standard", "Stretch"][ex.difficulty - 1] ?? "Stretch"}</span>{prog?.solved_at && <span className="chip border-ok/50 text-ok">✓ solved</span>}</div>
        <h1 className="h-page">{ex.title}</h1>
        <div className="space-y-3 text-sm leading-relaxed text-fg-dim [&_strong]:text-fg" dangerouslySetInnerHTML={{ __html: renderMarkdown(ex.promptMd) }} />
        <div className="text-xs text-fg-faint">{pub.visibleTests.length} example tests · {pub.hiddenCount} hidden tests</div>
        {pub.forbiddenPatterns?.length || pub.requiredPatterns?.length ? (
          <ul className="space-y-1 text-xs text-warn">{[...(pub.requiredPatterns ?? []), ...(pub.forbiddenPatterns ?? [])].map((p, i) => <li key={i}>• {p.message}</li>)}</ul>
        ) : null}
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-medium">Concept note: {CONCEPT_LABEL[ex.concept]}</summary>
          <div className="mt-3 space-y-3 text-fg-dim" dangerouslySetInnerHTML={{ __html: renderMarkdown(ex.conceptNoteMd) }} />
        </details>
      </div>
      <CodeDojo ex={pub} userId={user.id} solved={!!prog?.solved_at} initialHints={ex.hints.slice(0, hintsUnlocked(failed))} failed={failed} />
    </div>
  );
}
