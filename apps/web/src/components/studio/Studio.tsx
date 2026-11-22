"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CANVAS_H, CANVAS_W, MAX_STROKE_POINTS, replayArt, type ArtEvent, type Stroke } from "@hm/shared/creation";
import { CreationRecorder, STATUS_TEXT, type SaveStatus } from "./recorder";
import { paintAll, paintStroke } from "./ArtReplay";
import { FinishPanel, SealProgress } from "./FinishPanel";
import { TitleField } from "@/components/TitleField";

type Tool = Stroke["tool"];
const PALETTE = ["#1b2b5e", "#2b2142", "#3f6fb5", "#5aa9c9", "#2a7247", "#8cbf4a", "#fbcb3d", "#ff9f1c", "#c0392b", "#e88aa6", "#8e5bb5", "#7a5230", "#9aa3b5", "#ffffff"];
const SIZES = [3, 8, 18, 40];
const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "pen", label: "Pen", key: "B" },
  { id: "marker", label: "Marker", key: "M" },
  { id: "eraser", label: "Eraser", key: "E" },
];

export interface StudioProps {
  id: string;
  initialTitle: string;
  lastSeq: number;
  headHash: string | null;
  events: ArtEvent[];
  prior: { strokes: number; activeSeconds: number };
}

export function Studio({ id, initialTitle, lastSeq, headHash, events, prior }: StudioProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>(replayArt(events));
  const recRef = useRef<CreationRecorder<ArtEvent> | null>(null);
  const live = useRef<{ pts: number[]; t0: number; tStart: number } | null>(null);
  const lastT = useRef<number | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [count, setCount] = useState(strokesRef.current.length);
  const [effort, setEffort] = useState({ strokes: prior.strokes, seconds: prior.activeSeconds });
  const [title, setTitle] = useState(initialTitle);
  const [finishing, setFinishing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; d: number } | null>(null);

  const repaintBase = useCallback(() => {
    const base = (baseRef.current ??= Object.assign(document.createElement("canvas"), { width: CANVAS_W, height: CANVAS_H }));
    paintAll(base.getContext("2d")!, strokesRef.current);
    canvasRef.current!.getContext("2d")!.drawImage(base, 0, 0);
    setCount(strokesRef.current.length);
  }, []);

  useEffect(() => {
    repaintBase();
    const rec = new CreationRecorder<ArtEvent>(id, lastSeq, headHash, (s, e) => {
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
  }, [id, lastSeq, headHash, repaintBase]);

  /** mirrors the server's active-time rule: gaps up to 60 s between events count */
  const tickEffort = (t: number, stroke: boolean) => {
    const gap = lastT.current === null ? 0 : t - lastT.current;
    lastT.current = t;
    setEffort((e) => ({ strokes: e.strokes + (stroke ? 1 : 0), seconds: e.seconds + (gap > 0 && gap <= 60_000 ? gap / 1000 : 0) }));
  };

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const clamp = (v: number, hi: number) => Math.max(-50, Math.min(hi + 50, Math.round(v)));
    return [clamp(((e.clientX - r.left) * CANVAS_W) / r.width, CANVAS_W), clamp(((e.clientY - r.top) * CANVAS_H) / r.height, CANVAS_H)] as const;
  };

  const current = (): Stroke | null => (live.current ? { seq: 0, t: 0, type: "stroke", tool, color, size, pts: live.current.pts, dur: 0 } : null);

  const drawLive = () => {
    const g = canvasRef.current!.getContext("2d")!;
    g.drawImage(baseRef.current!, 0, 0);
    const s = current();
    if (s) paintStroke(g, s);
  };

  const commit = () => {
    const l = live.current;
    const rec = recRef.current;
    live.current = null;
    if (!l || !rec) return;
    const ev = { type: "stroke" as const, tool, color, size, pts: l.pts, dur: Math.max(0, Math.round(performance.now() - l.t0)) };
    rec.push(ev, l.tStart);
    strokesRef.current.push({ ...ev, seq: 0, t: l.tStart });
    paintStroke(baseRef.current!.getContext("2d")!, strokesRef.current[strokesRef.current.length - 1]);
    drawLive();
    setCount(strokesRef.current.length);
    tickEffort(l.tStart, true);
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || status === "conflict") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toCanvas(e);
    live.current = { pts: [x, y], t0: performance.now(), tStart: recRef.current!.now() };
    drawLive();
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (e.pointerType === "mouse") setCursor({ x: e.clientX - r.left, y: e.clientY - r.top, d: (size * r.width) / CANVAS_W });
    const l = live.current;
    if (!l) return;
    for (const pe of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) {
      const [x, y] = toCanvas(pe);
      const n = l.pts.length;
      if (Math.hypot(x - l.pts[n - 2], y - l.pts[n - 1]) < 1.5) continue;
      l.pts.push(x, y);
      if (l.pts.length >= MAX_STROKE_POINTS * 2) {
        commit();
        live.current = { pts: [x, y], t0: performance.now(), tStart: recRef.current!.now() };
      }
    }
    drawLive();
  };

  const undo = useCallback(() => {
    if (!strokesRef.current.length || live.current) return;
    const t = recRef.current!.now();
    recRef.current!.push({ type: "undo" }, t);
    strokesRef.current.pop();
    repaintBase();
    tickEffort(t, false);
  }, [repaintBase]);

  const clear = () => {
    const t = recRef.current!.now();
    recRef.current!.push({ type: "clear" }, t);
    strokesRef.current = [];
    repaintBase();
    tickEffort(t, false);
    setConfirmClear(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      const t = TOOLS.find((x) => x.key === e.key.toUpperCase());
      if (t && !e.metaKey && !e.ctrlKey) setTool(t.id);
      if (e.key === "[") setSize((s) => SIZES[Math.max(0, SIZES.indexOf(s) - 1)] ?? s);
      if (e.key === "]") setSize((s) => SIZES[Math.min(SIZES.length - 1, SIZES.indexOf(s) + 1)] ?? s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const eff = { done: effort.strokes, unit: "strokes", seconds: Math.floor(effort.seconds) };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <TitleField value={title} onChange={setTitle} />
        <span className={`chip mb-3 ${status === "conflict" ? "border-redpen/40 text-redpen" : status === "offline" ? "text-warn" : ""}`} aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${status === "conflict" ? "bg-redpen" : status === "saving" ? "bg-flame animate-pulse" : "bg-ok"}`} />
          {STATUS_TEXT[status]}
        </span>
        <button className="btn btn-primary h-[3.4rem] px-5" onClick={() => setFinishing(true)} disabled={count === 0 || status === "conflict"}>Finish</button>
      </div>
      {err && <p role="alert" className="rounded-xl bg-redpen-dim p-3 text-sm text-redpen">{err}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[4.25rem_minmax(0,1fr)_16rem]">
        {/* tool rail */}
        <div role="toolbar" aria-label="Tools" className="flex gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-soft)] lg:flex-col lg:self-start">
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => setTool(t.id)} aria-pressed={tool === t.id} title={`${t.label} (${t.key})`} className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold transition lg:flex-none ${tool === t.id ? "bg-fg text-surface" : "text-fg-dim hover:bg-muted hover:text-fg"}`}>
              <ToolGlyph tool={t.id} />
              {t.label}
            </button>
          ))}
          <div className="mx-1 w-px bg-line lg:my-1 lg:h-px lg:w-auto" />
          <button onClick={undo} disabled={count === 0} title="Undo (Ctrl+Z)" className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold text-fg-dim hover:bg-muted hover:text-fg disabled:opacity-40 lg:flex-none">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
            Undo
          </button>
        </div>

        {/* canvas */}
        <div className="relative min-w-0 self-start">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={commit}
            onPointerCancel={commit}
            onPointerLeave={() => setCursor(null)}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Drawing canvas"
            className={`block w-full touch-none rounded-2xl border border-line shadow-[var(--shadow-lift)] ${cursor ? "cursor-none" : "cursor-crosshair"}`}
          />
          {cursor && (
            <div aria-hidden className="pointer-events-none absolute rounded-full border border-fg/70 mix-blend-multiply" style={{ left: cursor.x, top: cursor.y, width: Math.max(4, cursor.d), height: Math.max(4, cursor.d), transform: "translate(-50%,-50%)", background: tool === "eraser" ? "transparent" : `${color}33` }} />
          )}
        </div>

        {/* palette & brush */}
        <div className="space-y-4 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
            <p className="mb-2 text-sm font-bold">Colour</p>
            <div className="grid grid-cols-7 gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }} aria-label={c} aria-pressed={color === c} className={`aspect-square rounded-full ring-1 ring-black/10 transition hover:scale-110 ${color === c ? "ring-[3px] ring-fg ring-offset-2 ring-offset-surface" : ""}`} style={{ background: c }} />
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-fg-dim">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-line bg-surface" />
              Mix your own
            </label>
            <p className="mt-4 mb-2 text-sm font-bold">Brush size</p>
            <div className="flex items-center gap-1.5">
              {SIZES.map((s) => (
                <button key={s} onClick={() => setSize(s)} aria-pressed={size === s} aria-label={`Size ${s}`} className={`flex h-11 flex-1 items-center justify-center rounded-xl transition ${size === s ? "bg-muted ring-2 ring-fg" : "hover:bg-muted"}`}>
                  <span className="rounded-full bg-fg" style={{ width: Math.min(28, 3 + s * 0.6), height: Math.min(28, 3 + s * 0.6) }} />
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-fg-faint">[ and ] change size</p>
          </div>
          <SealProgress e={eff} />
          <div className="rounded-2xl border border-line p-4 text-sm text-fg-dim">
            <p><strong className="text-fg">{count}</strong> {count === 1 ? "stroke" : "strokes"} on the page.</p>
            {confirmClear ? (
              <div className="mt-2 flex gap-2">
                <button className="btn btn-danger flex-1" onClick={clear}>Clear the page</button>
                <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
              </div>
            ) : (
              <button className="mt-2 text-sm font-semibold text-redpen hover:underline disabled:opacity-40" disabled={count === 0} onClick={() => setConfirmClear(true)}>Clear the page…</button>
            )}
          </div>
        </div>
      </div>
      {finishing && <FinishPanel id={id} kind="art" title={title} setTitle={setTitle} effort={eff} drain={() => recRef.current!.drain()} onClose={() => setFinishing(false)} />}
    </div>
  );
}

function ToolGlyph({ tool }: { tool: Tool }) {
  const p = { viewBox: "0 0 24 24", className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (tool === "pen") return <svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
  if (tool === "marker") return <svg {...p}><path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" /></svg>;
  return <svg {...p}><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>;
}
