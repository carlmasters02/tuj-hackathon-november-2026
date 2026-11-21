"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { replayMusic, SCALE_HZ, STEPS, type MusicEvent } from "@hm/shared/creation";
import { ScoreGrid } from "./ScoreGrid";
import { audio, pluck } from "./synth";

type Batches = { events: unknown[] }[];

/** Plays a composer score, and can re-enact how it was written note by note. */
export function ScorePlayer({ batches }: { batches: Batches }) {
  const events = useMemo(() => batches.flatMap((b) => b.events) as MusicEvent[], [batches]);
  const score = useMemo(() => replayMusic(events), [events]);
  const [cells, setCells] = useState(() => new Set(score.cells));
  const [bpm, setBpm] = useState(score.bpm);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [mode, setMode] = useState<"idle" | "play" | "replay">("idle");
  const [flash, setFlash] = useState<string | null>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  const stop = () => {
    stopRef.current();
    setMode("idle");
    setPlayhead(null);
  };

  const play = (loops = 2) => {
    stop();
    const ac = audio();
    const stepDur = 60 / bpm / 4;
    const start = ac.currentTime + 0.05;
    const total = STEPS * loops;
    for (let i = 0; i < total; i++) {
      const step = i % STEPS;
      for (const k of cells) {
        const [s, r] = k.split(":").map(Number);
        if (s === step) pluck(SCALE_HZ[r], start + i * stepDur, Math.max(0.25, stepDur * 2.2));
      }
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const i = Math.floor((performance.now() - t0) / 1000 / stepDur);
      if (i >= total) return stop();
      setPlayhead(i % STEPS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    stopRef.current = () => cancelAnimationFrame(raf);
    setMode("play");
  };

  /** Re-enact composing: each toggle appears in order, idle gaps compressed. */
  const replay = () => {
    stop();
    setCells(new Set());
    setMode("replay");
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const on = new Set<string>();
    const step = () => {
      if (i >= events.length) {
        setFlash(null);
        setMode("idle");
        return;
      }
      const e = events[i];
      if (e.type === "toggle") {
        const k = `${e.step}:${e.row}`;
        if (on.has(k)) on.delete(k);
        else {
          on.add(k);
          pluck(SCALE_HZ[e.row], undefined, 0.3, 0.12);
        }
        setFlash(k);
      } else if (e.type === "tempo") setBpm(e.bpm);
      else on.clear();
      setCells(new Set(on));
      const next = events[i + 1];
      i++;
      timer = setTimeout(step, next ? Math.min(450, Math.max(60, (next.t - e.t) / 4)) : 0);
    };
    step();
    stopRef.current = () => clearTimeout(timer);
  };

  return (
    <div className="rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <ScoreGrid cells={cells} playhead={playhead} flash={flash} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {mode === "play" ? (
          <button className="btn btn-primary" onClick={stop}>Stop</button>
        ) : (
          <button className="btn btn-primary" onClick={() => play()} disabled={mode === "replay" || cells.size === 0}>Play</button>
        )}
        {mode === "replay" ? (
          <button className="btn" onClick={() => { stop(); setCells(new Set(score.cells)); setBpm(score.bpm); setFlash(null); }}>Skip to the end</button>
        ) : (
          <button className="btn" onClick={replay} disabled={mode === "play"}>Watch it being written</button>
        )}
        <span className="ml-auto text-sm text-fg-dim tabular-nums">{bpm} bpm · {cells.size} notes</span>
      </div>
    </div>
  );
}
