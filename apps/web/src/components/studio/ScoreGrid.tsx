"use client";
import { NOTE_NAMES, ROWS, STEPS } from "@hm/shared/creation";

/**
 * The composer's grid: rows are notes (high at the top), columns are sixteenth-note steps,
 * grouped in fours so beats are easy to read.
 */
export function ScoreGrid({ cells, playhead, onToggle, flash }: { cells: Set<string>; playhead: number | null; onToggle?: (step: number, row: number) => void; flash?: string | null }) {
  const rows = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i);
  return (
    <div className="overflow-x-auto">
      <div role="grid" aria-label="Score" className="inline-grid min-w-full gap-[3px]" style={{ gridTemplateColumns: `2.6rem repeat(${STEPS}, minmax(1.7rem, 1fr))` }}>
        {rows.map((row) => (
          <div role="row" key={row} className="contents">
            <div role="rowheader" className={`flex items-center justify-end pr-2 text-[11px] font-semibold tabular-nums ${NOTE_NAMES[row].startsWith("C") ? "text-fg" : "text-fg-faint"}`}>{NOTE_NAMES[row]}</div>
            {Array.from({ length: STEPS }, (_, step) => {
              const k = `${step}:${row}`;
              const on = cells.has(k);
              const beat = Math.floor(step / 4) % 2 === 0;
              const Cell = onToggle ? "button" : "div";
              return (
                <Cell
                  key={k}
                  role="gridcell"
                  aria-label={`${NOTE_NAMES[row]}, step ${step + 1}${on ? ", on" : ""}`}
                  aria-pressed={onToggle ? on : undefined}
                  onClick={onToggle ? () => onToggle(step, row) : undefined}
                  className={[
                    "aspect-square rounded-[7px] transition-transform duration-100",
                    on && playhead === step
                      ? "scale-[1.08] bg-flame shadow-[0_0_0_3px_var(--color-sun-soft)]"
                      : on
                        ? "bg-fg shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]"
                        : playhead === step
                          ? "bg-sun-soft ring-1 ring-sun ring-inset"
                          : beat
                            ? "bg-muted"
                            : "bg-surface ring-1 ring-line ring-inset",
                    flash === k ? "outline-2 outline-offset-1 outline-sun" : "",
                    onToggle ? "cursor-pointer hover:ring-2 hover:ring-sun hover:ring-inset active:scale-95" : "",
                  ].join(" ")}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
