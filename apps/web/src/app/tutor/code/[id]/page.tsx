import Link from "next/link";
import { notFound } from "next/navigation";
import { getExercise } from "@hm/shared/code/exercises";
import { hintsUnlocked, publicExercise } from "@hm/shared/code/grading";
import { CONCEPT_LABEL } from "@hm/shared/code/types";
import { requireUserPage } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderMarkdown } from "@/lib/markdown";
import { CodeDojo } from "@/components/code/CodeDojo";

export const metadata = { title: "Code Dojo" };
const LABEL = { python: "Python", c: "C", java: "Java" } as const;

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ex = getExercise(id);
  if (!ex) notFound();
  const user = await requireUserPage(`/tutor/code/${id}`);
  const { data: prog } = await supabaseAdmin().from("code_progress").select("solved_at, failed_submissions").eq("user_id", user.id).eq("exercise_id", id).maybeSingle();
  const failed = prog?.failed_submissions ?? 0;
  const pub = publicExercise(ex); // hidden tests and locked hints never reach the browser
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-4">
        <Link href="/tutor/code" className="text-sm text-paper-dim hover:text-paper">← Code Dojo</Link>
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="chip">{LABEL[ex.lang]}</span><span className="chip">{CONCEPT_LABEL[ex.concept]}</span><span className="chip">{"●".repeat(ex.difficulty)}</span>{prog?.solved_at && <span className="chip border-ok/50 text-ok">✓ solved</span>}</div>
        <h1 className="h-page">{ex.title}</h1>
        <div className="space-y-3 text-sm leading-relaxed text-paper-dim [&_strong]:text-paper" dangerouslySetInnerHTML={{ __html: renderMarkdown(ex.promptMd) }} />
        <div className="text-xs text-paper-faint">{pub.visibleTests.length} example tests · {pub.hiddenCount} hidden tests</div>
        {pub.forbiddenPatterns?.length || pub.requiredPatterns?.length ? (
          <ul className="space-y-1 text-xs text-warn">{[...(pub.requiredPatterns ?? []), ...(pub.forbiddenPatterns ?? [])].map((p, i) => <li key={i}>• {p.message}</li>)}</ul>
        ) : null}
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-medium">Concept note: {CONCEPT_LABEL[ex.concept]}</summary>
          <div className="mt-3 space-y-3 text-paper-dim" dangerouslySetInnerHTML={{ __html: renderMarkdown(ex.conceptNoteMd) }} />
        </details>
      </div>
      <CodeDojo ex={pub} solved={!!prog?.solved_at} initialHints={ex.hints.slice(0, hintsUnlocked(failed))} failed={failed} />
    </div>
  );
}
