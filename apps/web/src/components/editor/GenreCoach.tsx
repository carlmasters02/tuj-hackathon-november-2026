"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { genreReport } from "@hm/shared/genreCoach";
import { genreGuide, type Genre } from "@hm/shared/genres";

const RHYME_TINT = ["bg-sun-soft text-fg", "bg-[#dcebf3] text-fg", "bg-[#e3efd6] text-fg", "bg-[#f6dde4] text-fg", "bg-[#e9e1f3] text-fg", "bg-muted text-fg"];

/** Genre checklist. Observations only: it says what it sees and why, never what to write. */
export function GenreCoach({ genre, text }: { genre: Genre; text: string }) {
  const deferred = useDeferredValue(text);
  const report = useMemo(() => genreReport(genre, deferred), [genre, deferred]);
  const [showLines, setShowLines] = useState(true);
  const guide = genreGuide(genre);
  if (!report || !guide) return null;
  const done = report.items.filter((i) => i.ok).length;
  const maxSyl = Math.max(1, ...(report.poem?.lines.map((l) => l.syllables) ?? [1]));
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)]" aria-label={`${guide.label} coach`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold">{guide.noun[0].toUpperCase() + guide.noun.slice(1)} coach</h2>
        <span className="text-xs font-semibold text-fg-dim tabular-nums">{done} of {report.items.length}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${(done / report.items.length) * 100}%` }} />
      </div>
      <ul className="mt-3 space-y-2.5">
        {report.items.map((i) => (
          <li key={i.id} className="flex gap-2.5 text-sm">
            <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i.ok ? "bg-ok text-surface" : "border-2 border-line"}`}>{i.ok ? "✓" : ""}</span>
            <span>
              <span className="font-semibold">{i.label}</span>
              <span className="sr-only">{i.ok ? " (done)" : " (not yet)"}</span>
              <span className="block text-fg-dim">{i.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {report.poem && report.poem.lines.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <button className="flex w-full items-center justify-between text-sm font-bold" onClick={() => setShowLines((s) => !s)} aria-expanded={showLines}>
            Line by line <span className="text-xs font-semibold text-fg-dim">scheme {report.poem.scheme}</span>
          </button>
          {showLines && (
            <ol className="mt-2 max-h-80 space-y-1 overflow-y-auto pr-1">
              {report.poem.lines.map((l, k) => (
                <li key={k} className={`grid grid-cols-[1.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-xs ${k > 0 && l.stanza !== report.poem!.lines[k - 1].stanza ? "mt-2.5" : ""}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-md font-bold ${l.rhyme === "-" ? "text-fg-faint" : RHYME_TINT[(l.rhyme.charCodeAt(0) - 65) % RHYME_TINT.length]}`} title="rhyme group">{l.rhyme}</span>
                  <span className="truncate font-serif text-fg-dim" title={l.text}>{l.text}</span>
                  <span className="flex items-center gap-1.5" title={`${l.syllables} syllables`}>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-fg/70" style={{ width: `${(l.syllables / maxSyl) * 100}%` }} /></span>
                    <span className="w-5 text-right tabular-nums">{l.syllables}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-[11px] text-fg-faint">Syllables and rhymes are counted by rule, so unusual words can be off by one.</p>
        </div>
      )}
    </section>
  );
}
