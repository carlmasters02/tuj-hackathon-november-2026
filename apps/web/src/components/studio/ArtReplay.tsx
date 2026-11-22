"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CANVAS_H, CANVAS_W, PAPER, replayArt, strokePath, type ArtEvent, type Stroke } from "@hm/shared/creation";

type Batches = { events: unknown[] }[];
const SPEEDS = [1, 4, 16] as const;

export function paintStroke(g: CanvasRenderingContext2D, s: Stroke, pts = s.pts) {
  if (pts.length < 2) return;
  if (s.tool === "pixel") {
    const cell = s.size;
    const plotted = new Set<string>();
    for (let i = 0; i < pts.length; i += 2) {
      const x = Math.floor(pts[i] / cell);
      const y = Math.floor(pts[i + 1] / cell);
      const k = `${x}:${y}`;
      if (!plotted.has(k)) {
        plotted.add(k);
        g.fillStyle = s.color;
        g.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    return;
  }
  g.save();
  g.globalAlpha = s.tool === "marker" ? 0.55 : 1;
  g.strokeStyle = s.tool === "eraser" ? PAPER : s.color;
  g.lineWidth = s.size;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.stroke(new Path2D(strokePath(pts)));
  g.restore();
}

export function paintAll(g: CanvasRenderingContext2D, strokes: Stroke[]) {
  g.fillStyle = PAPER;
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);
  for (const s of strokes) paintStroke(g, s);
}

/** Redraws a studio piece stroke by stroke, at the speed each stroke was drawn (idle gaps compressed). */
export function ArtReplay({ batches }: { batches: Batches }) {
  const events = useMemo(() => batches.flatMap((b) => b.events) as ArtEvent[], [batches]);
  const ref = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(4);
  const [i, setI] = useState(events.length);

  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (g && !playing) paintAll(g, replayArt(events));
  }, [events, playing]);

  useEffect(() => {
    if (!playing) return;
    const g = ref.current!.getContext("2d")!;
    let cancelled = false;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout>;
    const strokes: Stroke[] = [];
    paintAll(g, strokes);
    let k = 0;
    const next = () => {
      if (cancelled) return;
      if (k >= events.length) return setPlaying(false);
      const e = events[k++];
      setI(k);
      const gap = events[k] ? Math.min(900, Math.max(0, events[k].t - e.t - (e.type === "stroke" ? e.dur : 0))) / speed : 0;
      if (e.type !== "stroke") {
        if (e.type === "undo") strokes.pop();
        else strokes.length = 0;
        paintAll(g, strokes);
        timer = setTimeout(next, gap + 250 / speed);
        return;
      }
      const dur = Math.max(80, Math.min(e.dur, 4000)) / speed;
      const t0 = performance.now();
      const frame = () => {
        if (cancelled) return;
        const p = Math.min(1, (performance.now() - t0) / dur);
        const n = Math.max(2, Math.round((e.pts.length / 2) * p) * 2);
        paintAll(g, strokes);
        paintStroke(g, e, e.pts.slice(0, n));
        if (p < 1) raf = requestAnimationFrame(frame);
        else {
          strokes.push(e);
          timer = setTimeout(next, gap);
        }
      };
      raf = requestAnimationFrame(frame);
    };
    next();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [playing, speed, events]);

  return (
    <div className="space-y-3">
      <canvas ref={ref} width={CANVAS_W} height={CANVAS_H} className="block w-full rounded-2xl border border-line shadow-[var(--shadow-soft)]" aria-label="Drawing replay" />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={() => setPlaying((p) => !p)}>{playing ? "Stop" : i >= events.length ? "Replay the drawing" : "Resume"}</button>
        <div role="group" aria-label="Speed" className="flex rounded-xl border border-line bg-surface p-0.5">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`rounded-[9px] px-3 py-1 text-sm font-semibold ${speed === s ? "bg-fg text-surface" : "text-fg-dim hover:text-fg"}`}>{s}×</button>
          ))}
        </div>
        <span className="ml-auto text-sm text-fg-dim tabular-nums">event {Math.min(i, events.length)} of {events.length}</span>
      </div>
    </div>
  );
}
