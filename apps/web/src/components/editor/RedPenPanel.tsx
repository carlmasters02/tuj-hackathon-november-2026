"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { RULES, type Flag, type ReadabilityScores, type RuleId } from "@hm/shared/redpen";

/**
 * RedPen side panel. Shows flags with the rule, why it matters and a generic example.
 * Deliberately has no "apply fix" button: the writer edits the text themselves.
 */
export function RedPenPanel({ text, onFocusFlag, hide = [] }: { text: string; onFocusFlag: (f: Flag | null) => void; hide?: RuleId[] }) {
  const worker = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [scores, setScores] = useState<ReadabilityScores | null>(null);
  const [open, setOpen] = useState<RuleId | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("../../workers/redpen.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      if (e.data.id !== reqId.current || e.data.error) return;
      setFlags(e.data.flags);
      setScores(e.data.scores);
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => worker.current?.postMessage({ id: ++reqId.current, text }), 500);
    return () => clearTimeout(t);
  }, [text]);

  const grouped = useMemo(() => {
    const m = new Map<RuleId, Flag[]>();
    for (const f of flags) if (!hide.includes(f.rule)) m.set(f.rule, [...(m.get(f.rule) ?? []), f]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [flags, hide]);

  return (
    <aside className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-extrabold"><span className="text-redpen">Red</span>Pen</h2>
        <span className="text-xs text-fg-faint">flags only — you do the rewriting</span>
      </div>
      {scores && !hide.includes("readability") && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Reading ease" value={scores.words ? scores.fleschReadingEase.toFixed(0) : "–"} hint="Flesch, 0–100, higher = easier" />
          <Stat label="Grade level" value={scores.words ? scores.fleschKincaidGrade.toFixed(1) : "–"} hint="Flesch–Kincaid" />
          <Stat label="Words" value={String(scores.words)} hint={`${scores.sentences} sentences`} />
        </div>
      )}
      {grouped.length === 0 && <p className="text-sm text-fg-faint">No flags yet. Start writing.</p>}
      <ul className="space-y-2">
        {grouped.map(([rule, list]) => (
          <li key={rule} className="rounded-xl border border-line bg-surface">
            <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm" onClick={() => setOpen(open === rule ? null : rule)}>
              <span>{RULES[rule].label}</span>
              <span className="chip">{list.length}</span>
            </button>
            {open === rule && (
              <div className="space-y-3 border-t border-line px-3 py-3 text-sm">
                <p className="text-fg-dim"><strong className="text-fg">Why it matters:</strong> {RULES[rule].why}</p>
                <p className="text-fg-dim"><strong className="text-fg">Example:</strong> {RULES[rule].example}</p>
                <ul className="space-y-1">
                  {list.slice(0, 50).map((f, i) => (
                    <li key={i}>
                      <button
                        className="w-full truncate rounded px-2 py-1 text-left font-serif text-fg-dim hover:bg-muted hover:text-fg"
                        onMouseEnter={() => onFocusFlag(f)}
                        onMouseLeave={() => onFocusFlag(null)}
                        onClick={() => onFocusFlag(f)}
                        title={f.message}
                      >
                        “{f.excerpt}”
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-2" title={hint}>
      <div className="text-lg">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-fg-faint">{label}</div>
    </div>
  );
}
