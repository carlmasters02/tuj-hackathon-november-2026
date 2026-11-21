"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MIN_EFFORT, replayMusic, SCALE_HZ, STEPS, type MusicEvent } from "@hm/shared/creation";
import { CreationRecorder, STATUS_TEXT, type SaveStatus } from "./recorder";
import { ScoreGrid } from "./ScoreGrid";
import { FinishPanel, SealProgress } from "./FinishPanel";
import { audio, pluck } from "./synth";

export interface ComposerProps {
  id: string;
  initialTitle: string;
  lastSeq: number;
  headHash: string | null;
  events: MusicEvent[];
  prior: { edits: number; activeSeconds: number };
}

export function Composer({ id, initialTitle, lastSeq, headHash, events, prior }: ComposerProps) {
  const start = replayMusic(events);
  const [cells, setCells] = useState(() => new Set(start.cells));
  const [bpm, setBpm] = useState(start.bpm);
  const cellsRef = useRef(cells);
  const bpmRef = useRef(bpm);
  cellsRef.current = cells;
  bpmRef.current = bpm;
  const recRef = useRef<CreationRecorder<MusicEvent> | null>(null);
  const lastT = useRef<number | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [effort, setEffort] = useState({ edits: prior.edits, seconds: prior.activeSeconds });
  const [title, setTitle] = useState(initialTitle);
  const [finishing, setFinishing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const loop = useRef<{ timer: ReturnType<typeof setInterval>; raf: number } | null>(null);

  useEffect(() => {
    const rec = new CreationRecorder<MusicEvent>(id, lastSeq, headHash, (s, e) => {
      setStatus(s);
      setErr(e);
    });
    recRef.current = rec;
    rec.start();
    const bye = () => void rec.flush(true);
    const vis = () => document.visibilityState === "hidden" && bye();
    window.addEventListener("pagehide", bye);
    document.addEventListener("visibilitychange", vis);
    return () => {
      rec.stop();
      bye();
      window.removeEventListener("pagehide", bye);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [id, lastSeq, headHash]);

  const tick = (edit: boolean) => {
    const t = recRef.current!.now();
    const gap = lastT.current === null ? 0 : t - lastT.current;
    lastT.current = t;
    setEffort((e) => ({ edits: e.edits + (edit ? 1 : 0), seconds: e.seconds + (gap > 0 && gap <= 60_000 ? gap / 1000 : 0) }));
  };

  const toggle = (step: number, row: number) => {
    if (status === "conflict") return;
    recRef.current!.push({ type: "toggle", step, row });
    tick(true);
    const k = `${step}:${row}`;
    setCells((c) => {
      const n = new Set(c);
      if (n.has(k)) n.delete(k);
      else {
        n.add(k);
        pluck(SCALE_HZ[row], undefined, 0.35, 0.14);
      }
      return n;
    });
  };

  const changeTempo = (v: number) => {
    setBpm(v);
    recRef.current!.replaceLast((e) => e.type === "tempo", { type: "tempo", bpm: v });
    tick(false);
  };

  const stop = useCallback(() => {
    if (loop.current) {
      clearInterval(loop.current.timer);
      cancelAnimationFrame(loop.current.raf);
    }
    loop.current = null;
    setPlayhead(null);
  }, []);

  /** Look-ahead scheduler: reads the live grid each step, so edits are heard while it plays. */
  const play = () => {
    stop();
    const ac = audio();
    let step = 0;
    let next = ac.currentTime + 0.06;
    const queue: { step: number; at: number }[] = [];
    const schedule = () => {
      while (next < ac.currentTime + 0.12) {
        for (const k of cellsRef.current) {
          const [s, r] = k.split(":").map(Number);
          if (s === step) pluck(SCALE_HZ[r], next, Math.max(0.25, (60 / bpmRef.current / 4) * 2.2));
        }
        queue.push({ step, at: next });
        next += 60 / bpmRef.current / 4;
        step = (step + 1) % STEPS;
      }
    };
    const draw = () => {
      while (queue.length > 1 && queue[1].at <= ac.currentTime) queue.shift();
      if (queue[0] && queue[0].at <= ac.currentTime) setPlayhead(queue[0].step);
      if (loop.current) loop.current.raf = requestAnimationFrame(draw);
    };
    schedule();
    loop.current = { timer: setInterval(schedule, 25), raf: requestAnimationFrame(draw) };
  };

  useEffect(() => stop, [stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, button, [role=dialog]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (loop.current) stop();
        else play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const clear = () => {
    recRef.current!.push({ type: "clear" });
    tick(false);
    setCells(new Set());
    setConfirmClear(false);
  };

  const eff = { done: effort.edits, need: MIN_EFFORT.music.edits, unit: "note edits", seconds: Math.floor(effort.seconds), needSeconds: MIN_EFFORT.music.seconds };
  const playing = playhead !== null || loop.current !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Title" className="min-w-0 flex-1 bg-transparent text-[1.9rem] leading-tight font-extrabold tracking-[-0.03em] outline-none placeholder:text-fg-faint focus:underline focus:decoration-sun focus:decoration-4 focus:underline-offset-8" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
        <span className={`chip ${status === "conflict" ? "border-redpen/40 text-redpen" : status === "offline" ? "text-warn" : ""}`} aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${status === "conflict" ? "bg-redpen" : status === "saving" ? "bg-flame animate-pulse" : "bg-ok"}`} />
          {STATUS_TEXT[status]}
        </span>
        <button className="btn btn-primary px-5" onClick={() => { stop(); setFinishing(true); }} disabled={cells.size === 0 || status === "conflict"}>Finish</button>
      </div>
      {err && <p role="alert" className="rounded-xl bg-redpen-dim p-3 text-sm text-redpen">{err}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-lift)] sm:p-6">
          <ScoreGrid cells={cells} playhead={playhead} onToggle={toggle} />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="btn btn-primary w-28" onClick={() => (playing ? stop() : play())}>
              {playing ? (
                <><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>Stop</>
              ) : (
                <><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" /></svg>Play</>
              )}
            </button>
            <label className="flex flex-1 items-center gap-3 text-sm font-semibold sm:max-w-xs">
              Tempo
              <input type="range" min={60} max={200} step={2} value={bpm} onChange={(e) => changeTempo(Number(e.target.value))} className="flex-1 accent-[var(--color-fg)]" />
              <span className="w-16 text-right text-fg-dim tabular-nums">{bpm} bpm</span>
            </label>
            <span className="text-xs text-fg-faint">Space plays and stops</span>
          </div>
        </div>

        <div className="space-y-4 lg:self-start">
          <SealProgress e={eff} />
          <div className="rounded-2xl border border-line p-4 text-sm text-fg-dim">
            <p><strong className="text-fg">{cells.size}</strong> {cells.size === 1 ? "note" : "notes"} in the score. Each column is a sixteenth note; the shaded blocks mark beats.</p>
            {confirmClear ? (
              <div className="mt-2 flex gap-2">
                <button className="btn btn-danger flex-1" onClick={clear}>Clear all notes</button>
                <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
              </div>
            ) : (
              <button className="mt-2 text-sm font-semibold text-redpen hover:underline disabled:opacity-40" disabled={cells.size === 0} onClick={() => setConfirmClear(true)}>Clear all notes…</button>
            )}
          </div>
        </div>
      </div>
      {finishing && <FinishPanel id={id} kind="music" title={title} setTitle={setTitle} effort={eff} drain={() => recRef.current!.drain()} onClose={() => setFinishing(false)} />}
    </div>
  );
}
