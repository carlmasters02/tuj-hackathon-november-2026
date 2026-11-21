import Link from "next/link";
import { EXERCISES } from "@hm/shared/code/exercises";
import { CONCEPT_LABEL, LANGS, type Lang } from "@hm/shared/code/types";
import { requireUserPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Code Dojo" };
const LABEL: Record<Lang, string> = { python: "Python", c: "C", java: "Java" };

export default async function CodeIndex() {
  await requireUserPage("/tutor/code");
  const sb = await supabaseServer();
  const { data } = await sb.from("code_progress").select("exercise_id, solved_at, failed_submissions");
  const prog = new Map((data ?? []).map((r) => [r.exercise_id, r]));
  const rows = EXERCISES.filter((e) => e.lang === "python");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-page">Code Dojo</h1>
        <p className="mt-1 max-w-2xl text-sm text-paper-dim">Three tracks, one concept ladder — so you can compare how Python, C and Java express the same idea. Graded on our own sandbox against hidden tests. Compiler errors explained in plain English. No solution button, ever.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {LANGS.map((l) => {
          const list = EXERCISES.filter((e) => e.lang === l);
          const done = list.filter((e) => prog.get(e.id)?.solved_at).length;
          return (
            <div key={l} className="card p-4">
              <div className="flex items-baseline justify-between"><span className="font-serif text-xl">{LABEL[l]}</span><span className="text-xs text-paper-faint">{done}/{list.length}</span></div>
              <div className="mt-2 h-1.5 rounded bg-ink-3"><div className="h-1.5 rounded bg-ok" style={{ width: `${(100 * done) / list.length}%` }} /></div>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-paper-faint">
            <tr className="border-b border-line"><th className="px-4 py-2 font-normal">#</th><th className="px-4 py-2 font-normal">Concept</th>{LANGS.map((l) => <th key={l} className="px-4 py-2 font-normal">{LABEL[l]}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((py, i) => {
              return (
                <tr key={py.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-paper-faint">{i + 1}</td>
                  <td className="px-4 py-2 text-paper-dim">{CONCEPT_LABEL[py.concept]}</td>
                  {LANGS.map((l) => {
                    const ex = EXERCISES.filter((e) => e.lang === l)[i];
                    const p = prog.get(ex.id);
                    return (
                      <td key={l} className="px-4 py-2">
                        <Link href={`/tutor/code/${ex.id}`} className="hover:underline">
                          <span className={p?.solved_at ? "text-ok" : ""}>{p?.solved_at ? "✓ " : ""}{ex.title}</span>
                          {ex.concept !== py.concept && <span className="ml-1 text-xs text-paper-faint">({CONCEPT_LABEL[ex.concept]})</span>}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
