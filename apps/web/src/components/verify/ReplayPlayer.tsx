"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { applyEvent, type DocEvent, type StoredBatch } from "@hm/shared/provenance/index";

const SPEEDS = [1, 5, 20] as const;
const MAX_GAP_MS = 1500; // idle gaps are compressed so playback stays watchable

/**
 * Re-types the document from its event log. External pastes flash amber so readers can see
 * exactly what was pasted and when.
 */
export function ReplayPlayer({ batches }: { batches: StoredBatch[] }) {
  const events = useMemo(() => batches.flatMap((b) => b.events).filter((e) => e.type !== "focus" && e.type !== "blur"), [batches]);
  const finalText = useMemo(() => events.reduce((t, e) => applyEvent(t, e), ""), [events]);
  const [i, setI] = useState(events.length);
  const [text, setText] = useState(finalText);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(5);
  const [lastPaste, setLastPaste] = useState<{ from: number; to: number } | null>(null);
  const state = useRef({ i: events.length, text: finalText });

  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      const s = state.current;
      if (s.i >= events.length) {
        setPlaying(false);
        return;
      }
      const e: DocEvent = events[s.i];
      s.text = applyEvent(s.text, e);
      s.i++;
      setI(s.i);
      setText(s.text);
      setLastPaste(e.type === "paste" && e.src === "external" ? { from: e.from, to: e.from + e.len } : null);
      const next = events[s.i];
      const gap = next ? Math.min(MAX_GAP_MS, Math.max(0, next.t - e.t)) : 0;
      setTimeout(step, gap / speed + (e.type === "paste" ? 600 : 0));
    };
    step();
    return () => {
      cancelled = true;
    };
  }, [playing, speed, events]);

  const restart = () => {
    state.current = { i: 0, text: "" };
    setI(0);
    setText("");
    setLastPaste(null);
    setPlaying(true);
  };

  const before = lastPaste ? text.slice(0, lastPaste.from) : text;
  const pasted = lastPaste ? text.slice(lastPaste.from, lastPaste.to) : "";
  const after = lastPaste ? text.slice(lastPaste.to) : "";

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <h2 className="mr-auto font-serif text-lg">Replay</h2>
        <button className="btn py-1" onClick={() => (playing ? setPlaying(false) : i >= events.length ? restart() : setPlaying(true))}>
          {playing ? "Pause" : i >= events.length ? "▶ Play from start" : "▶ Resume"}
        </button>
        {SPEEDS.map((s) => (
          <button key={s} className={`btn py-1 ${speed === s ? "btn-primary" : ""}`} onClick={() => setSpeed(s)}>{s}×</button>
        ))}
        <span className="w-28 text-right font-mono text-xs text-paper-faint">{i}/{events.length}</span>
      </div>
      <div className="h-1 bg-ink-3"><div className="h-1 bg-redpen transition-all" style={{ width: `${events.length ? (100 * i) / events.length : 100}%` }} /></div>
      <div className="max-h-[60vh] min-h-48 overflow-auto whitespace-pre-wrap px-6 py-5 font-serif text-lg leading-relaxed">
        {before}
        {pasted && <mark className="rounded bg-warn/40 text-paper">{pasted}</mark>}
        {after}
        {playing && <span className="ml-px inline-block h-5 w-px animate-pulse bg-paper align-middle" />}
      </div>
    </section>
  );
}
