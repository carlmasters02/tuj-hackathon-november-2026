"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CANVAS_H, CANVAS_W, MAX_STROKE_POINTS, PAPER, PIXEL_SIZES, SHAPE_TOOLS, replayArt, type ArtEvent, type Stroke } from "@hm/shared/creation";
import { CreationRecorder, STATUS_TEXT, type SaveStatus } from "./recorder";
import { paintAll, paintStroke } from "./ArtReplay";
import { FinishPanel, SealProgress } from "./FinishPanel";
import { TitleField } from "@/components/TitleField";

type Mode = "freehand" | "pixel";
/** UI tools; each drawing tool maps onto one recorded stroke tool (the picker records nothing). */
type Tool = "pen" | "marker" | "eraser" | "line" | "rect" | "ellipse" | "pixel" | "pixelEraser" | "picker";
type PixelSize = (typeof PIXEL_SIZES)[number];

const PALETTE = ["#1b2b5e", "#2b2142", "#3f6fb5", "#5aa9c9", "#2a7247", "#8cbf4a", "#fbcb3d", "#ff9f1c", "#c0392b", "#e88aa6", "#8e5bb5", "#7a5230", "#9aa3b5", "#ffffff"];
const TOOLS: { id: Tool; label: string; key: string; mode: Mode | "both" }[] = [
  { id: "pen", label: "Pen", key: "B", mode: "freehand" },
  { id: "marker", label: "Marker", key: "M", mode: "freehand" },
  { id: "eraser", label: "Eraser", key: "E", mode: "freehand" },
  { id: "line", label: "Line", key: "L", mode: "freehand" },
  { id: "rect", label: "Box", key: "R", mode: "freehand" },
  { id: "ellipse", label: "Oval", key: "O", mode: "freehand" },
  { id: "pixel", label: "Pixel", key: "P", mode: "pixel" },
  { id: "pixelEraser", label: "Erase", key: "E", mode: "pixel" },
  { id: "picker", label: "Pick", key: "I", mode: "both" },
];
const isShape = (t: Tool) => (SHAPE_TOOLS as readonly string[]).includes(t);
const isPixel = (t: Tool) => t === "pixel" || t === "pixelEraser";
const strokeTool = (t: Tool): Stroke["tool"] => (t === "pixelEraser" ? "pixel" : (t as Stroke["tool"]));
const toHex = (d: Uint8ClampedArray) => `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

export interface StudioProps {
  id: string;
  initialTitle: string;
  lastSeq: number;
  headHash: string | null;
  events: ArtEvent[];
  prior: { strokes: number; activeSeconds: number };
  /** "pixel" when the piece was started from the hub's Pixel Art choice (?mode=pixel) */
  initialMode?: "digital" | "pixel";
}

interface Live {
  pts: number[];
  t0: number;
  tStart: number;
  cells: Set<string>;
  lastCell: [number, number] | null;
}

export function Studio({ id, initialTitle, lastSeq, headHash, events, prior, initialMode = "digital" }: StudioProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>(replayArt(events));
  const recRef = useRef<CreationRecorder<ArtEvent> | null>(null);
  const live = useRef<Live | null>(null);
  const lastT = useRef<number | null>(null);
  const prevTool = useRef<Tool>("pen");
  const [mode, setMode] = useState<Mode>(() => (initialMode === "pixel" || strokesRef.current.some((s) => s.tool === "pixel") ? "pixel" : "freehand"));
  const [tool, setToolState] = useState<Tool>(mode === "pixel" ? "pixel" : "pen");
  const [color, setColor] = useState(PALETTE[0]);
  const [recent, setRecent] = useState<string[]>([]);
  const [size, setSize] = useState(8);
  const [cell, setCell] = useState<PixelSize>(15);
  const [showGrid, setShowGrid] = useState(true);
  const [mirror, setMirror] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [count, setCount] = useState(strokesRef.current.length);
  const [effort, setEffort] = useState({ strokes: prior.strokes, seconds: prior.activeSeconds });
  const [title, setTitle] = useState(initialTitle);
  const [finishing, setFinishing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; d: number; square: boolean } | null>(null);

  const setTool = (t: Tool) => {
    if (t !== "picker") prevTool.current = t;
    setToolState(t);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setTool(m === "pixel" ? "pixel" : "pen");
    setCursor(null);
  };

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

  const snap = (x: number, y: number): [number, number] => [
    Math.max(0, Math.min(CANVAS_W - cell, Math.floor(x / cell) * cell)),
    Math.max(0, Math.min(CANVAS_H - cell, Math.floor(y / cell) * cell)),
  ];

  const strokeSize = isPixel(tool) ? cell : size;
  const strokeColorFor = (t: Tool) => (t === "pixelEraser" ? PAPER : color);

  const current = (): Stroke | null => (live.current ? { seq: 0, t: 0, type: "stroke", tool: strokeTool(tool), color: strokeColorFor(tool), size: strokeSize, pts: live.current.pts, dur: 0 } : null);

  const drawLive = () => {
    const g = canvasRef.current!.getContext("2d")!;
    g.drawImage(baseRef.current!, 0, 0);
    const s = current();
    if (s) paintStroke(g, s);
  };

  const begin = (tStart: number): Live => ({ pts: [], t0: performance.now(), tStart, cells: new Set(), lastCell: null });

  const commit = () => {
    const l = live.current;
    const rec = recRef.current;
    live.current = null;
    if (!l || !rec || l.pts.length < 2) return drawLive();
    // a click without a drag makes no shape
    if (isShape(tool) && l.pts[0] === l.pts[2] && l.pts[1] === l.pts[3]) return drawLive();
    const ev = { type: "stroke" as const, tool: strokeTool(tool), color: strokeColorFor(tool), size: strokeSize, pts: l.pts, dur: Math.max(0, Math.round(performance.now() - l.t0)) };
    rec.push(ev, l.tStart);
    strokesRef.current.push({ ...ev, seq: 0, t: l.tStart });
    paintStroke(baseRef.current!.getContext("2d")!, strokesRef.current[strokesRef.current.length - 1]);
    drawLive();
    setCount(strokesRef.current.length);
    tickEffort(l.tStart, true);
    if (tool !== "eraser" && tool !== "pixelEraser") setRecent((r) => [color, ...r.filter((c) => c !== color)].slice(0, 7));
  };

  /** paints the grid cell under (x, y), filling any cells skipped by a fast drag, plus its mirror image */
  const addCells = (x: number, y: number) => {
    const l = live.current!;
    const [cx, cy] = snap(x, y);
    const from = l.lastCell ?? [cx, cy];
    const steps = Math.max(Math.abs(cx - from[0]), Math.abs(cy - from[1])) / cell;
    for (let i = l.lastCell ? 1 : 0; i <= steps; i++) {
      const k = steps === 0 ? 0 : i / steps;
      const px = Math.round((from[0] + (cx - from[0]) * k) / cell) * cell;
      const py = Math.round((from[1] + (cy - from[1]) * k) / cell) * cell;
      for (const [qx, qy] of mirror ? [[px, py], [CANVAS_W - cell - px, py]] : [[px, py]]) {
        const key = `${qx},${qy}`;
        if (l.cells.has(key)) continue;
        if (l.pts.length >= MAX_STROKE_POINTS * 2) {
          commit();
          live.current = begin(recRef.current!.now());
        }
        live.current!.cells.add(key);
        live.current!.pts.push(qx, qy);
      }
    }
    live.current!.lastCell = [cx, cy];
  };

  /** Shift: lines snap to 45°, boxes and ovals become squares and circles */
  const shapeEnd = (x0: number, y0: number, x: number, y: number, shift: boolean): [number, number] => {
    if (!shift) return [x, y];
    const dx = x - x0;
    const dy = y - y0;
    if (tool === "line") {
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      return [Math.round(x0 + Math.cos(a) * len), Math.round(y0 + Math.sin(a) * len)];
    }
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    return [x0 + Math.sign(dx || 1) * m, y0 + Math.sign(dy || 1) * m];
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || status === "conflict") return;
    const [x, y] = toCanvas(e);
    if (tool === "picker") {
      const px = Math.max(0, Math.min(CANVAS_W - 1, x));
      const py = Math.max(0, Math.min(CANVAS_H - 1, y));
      setColor(toHex(baseRef.current!.getContext("2d")!.getImageData(px, py, 1, 1).data));
      setToolState(prevTool.current);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = begin(recRef.current!.now());
    if (isPixel(tool)) addCells(x, y);
    else if (isShape(tool)) live.current.pts = [x, y, x, y];
    else live.current.pts = [x, y];
    drawLive();
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (e.pointerType === "mouse" && tool !== "picker") {
      if (isPixel(tool)) {
        const [cx, cy] = snap(...toCanvas(e));
        const k = r.width / CANVAS_W;
        setCursor({ x: (cx + cell / 2) * k, y: (cy + cell / 2) * k, d: cell * k, square: true });
      } else setCursor({ x: e.clientX - r.left, y: e.clientY - r.top, d: (size * r.width) / CANVAS_W, square: false });
    }
    const l = live.current;
    if (!l) return;
    if (isShape(tool)) {
      const [x, y] = toCanvas(e);
      const [ex, ey] = shapeEnd(l.pts[0], l.pts[1], x, y, e.shiftKey);
      l.pts = [l.pts[0], l.pts[1], ex, ey];
    } else {
      for (const pe of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) {
        const [x, y] = toCanvas(pe);
        if (isPixel(tool)) {
          addCells(x, y);
          continue;
        }
        const cur = live.current!;
        const n = cur.pts.length;
        if (Math.hypot(x - cur.pts[n - 2], y - cur.pts[n - 1]) < 1.5) continue;
        cur.pts.push(x, y);
        if (cur.pts.length >= MAX_STROKE_POINTS * 2) {
          commit();
          live.current = { ...begin(recRef.current!.now()), pts: [x, y] };
        }
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = TOOLS.find((x) => x.key === e.key.toUpperCase() && (x.mode === mode || x.mode === "both"));
      if (t) {
        if (t.id !== "picker") prevTool.current = t.id;
        setToolState(t.id);
      }
      if (e.key === "[" || e.key === "]") {
        const dir = e.key === "[" ? -1 : 1;
        if (mode === "pixel") setCell((c) => PIXEL_SIZES[Math.max(0, Math.min(PIXEL_SIZES.length - 1, PIXEL_SIZES.indexOf(c) + dir))]);
        else setSize((s) => Math.max(1, Math.min(80, s + dir * (s < 10 ? 1 : s < 30 ? 3 : 6))));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, mode]);

  const eff = { done: effort.strokes, unit: "strokes", seconds: Math.floor(effort.seconds) };
  const visibleTools = TOOLS.filter((t) => t.mode === mode || t.mode === "both");
  const pickColor = (c: string) => {
    setColor(c);
    if (tool === "eraser") setTool("pen");
    if (tool === "pixelEraser" || tool === "picker") setTool(mode === "pixel" ? "pixel" : "pen");
  };

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
        <div role="toolbar" aria-label="Tools" className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-soft)] lg:flex-col lg:flex-nowrap lg:self-start">
          {visibleTools.map((t) => (
            <button key={t.id} onClick={() => setTool(t.id)} aria-pressed={tool === t.id} title={`${t.label} (${t.key})`} className={`flex h-14 min-w-[3.4rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold transition lg:flex-none ${tool === t.id ? "bg-fg text-surface" : "text-fg-dim hover:bg-muted hover:text-fg"}`}>
              <ToolGlyph tool={t.id} />
              {t.label}
            </button>
          ))}
          <div className="mx-1 w-px bg-line lg:my-1 lg:h-px lg:w-auto" />
          <button onClick={undo} disabled={count === 0} title="Undo (Ctrl+Z)" className="flex h-14 min-w-[3.4rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold text-fg-dim hover:bg-muted hover:text-fg disabled:opacity-40 lg:flex-none">
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
            aria-label={mode === "pixel" ? "Pixel art canvas" : "Drawing canvas"}
            className={`block w-full touch-none rounded-2xl border border-line shadow-[var(--shadow-lift)] ${cursor ? "cursor-none" : "cursor-crosshair"}`}
          />
          {mode === "pixel" && showGrid && (
            <div
              aria-hidden
              data-testid="pixel-grid"
              className="pointer-events-none absolute inset-px rounded-2xl"
              style={{
                backgroundImage: "linear-gradient(to right, rgba(27,43,94,0.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(27,43,94,0.13) 1px, transparent 1px)",
                backgroundSize: `${(cell / CANVAS_W) * 100}% ${(cell / CANVAS_H) * 100}%`,
              }}
            />
          )}
          {mode === "pixel" && mirror && <div aria-hidden className="pointer-events-none absolute inset-y-px left-1/2 border-l-2 border-dashed border-sun" />}
          {cursor && (
            <div
              aria-hidden
              className={`pointer-events-none absolute border border-fg/70 mix-blend-multiply ${cursor.square ? "" : "rounded-full"}`}
              style={{ left: cursor.x, top: cursor.y, width: Math.max(4, cursor.d), height: Math.max(4, cursor.d), transform: "translate(-50%,-50%)", background: tool === "eraser" || tool === "pixelEraser" ? "transparent" : `${color}33` }}
            />
          )}
        </div>

        {/* mode, palette & brush */}
        <div className="space-y-4 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
            <p className="mb-2 text-sm font-bold">Mode</p>
            <div role="group" aria-label="Drawing mode" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(["freehand", "pixel"] as const).map((m) => (
                <button key={m} onClick={() => switchMode(m)} aria-pressed={mode === m} className={`rounded-lg py-2 text-sm font-bold transition ${mode === m ? "bg-surface text-fg shadow-[var(--shadow-soft)]" : "text-fg-dim hover:text-fg"}`}>
                  {m === "freehand" ? "Digital art" : "Pixel art"}
                </button>
              ))}
            </div>

            <p className="mt-4 mb-2 text-sm font-bold">Colour</p>
            <div className="grid grid-cols-7 gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} onClick={() => pickColor(c)} aria-label={c} aria-pressed={color === c} className={`aspect-square rounded-full ring-1 ring-black/10 transition hover:scale-110 ${color === c ? "ring-[3px] ring-fg ring-offset-2 ring-offset-surface" : ""}`} style={{ background: c }} />
              ))}
            </div>
            {recent.some((c) => !PALETTE.includes(c)) && (
              <>
                <p className="mt-3 mb-1.5 text-xs font-semibold text-fg-faint">Recent</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {recent.filter((c) => !PALETTE.includes(c)).map((c) => (
                    <button key={c} onClick={() => pickColor(c)} aria-label={`Recent ${c}`} aria-pressed={color === c} className={`aspect-square rounded-md ring-1 ring-black/10 transition hover:scale-110 ${color === c ? "ring-[3px] ring-fg ring-offset-2 ring-offset-surface" : ""}`} style={{ background: c }} />
                  ))}
                </div>
              </>
            )}
            <label className="mt-3 flex items-center gap-2 text-sm text-fg-dim">
              <input type="color" value={color} onChange={(e) => pickColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-line bg-surface" />
              Mix your own
              <span className="ml-auto font-mono text-xs text-fg-faint">{color}</span>
            </label>

            {mode === "freehand" ? (
              <>
                <label htmlFor="brush-size" className="mt-4 mb-2 flex items-center justify-between text-sm font-bold">
                  Brush size <span className="font-mono text-xs font-semibold text-fg-faint">{size}px</span>
                </label>
                <div className="flex items-center gap-3">
                  <input id="brush-size" type="range" min={1} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-[var(--color-fg)]" />
                  <span className="grid h-9 w-9 shrink-0 place-items-center">
                    <span className="rounded-full" style={{ width: Math.max(2, Math.min(34, size * 0.45)), height: Math.max(2, Math.min(34, size * 0.45)), background: color }} />
                  </span>
                </div>
                <p className="mt-2 text-xs text-fg-faint">[ and ] change size · Shift keeps lines at 45° and makes squares and circles</p>
              </>
            ) : (
              <>
                <p className="mt-4 mb-2 text-sm font-bold">Pixel size</p>
                <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Pixel size">
                  {PIXEL_SIZES.map((s) => (
                    <button key={s} onClick={() => setCell(s)} aria-pressed={cell === s} title={`${CANVAS_W / s} × ${CANVAS_H / s} grid`} className={`rounded-xl py-2 text-xs font-bold transition ${cell === s ? "bg-muted ring-2 ring-fg" : "text-fg-dim hover:bg-muted"}`}>
                      {s}px
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-fg-faint">{CANVAS_W / cell} × {CANVAS_H / cell} grid · [ and ] change size</p>
                <label className="mt-3 flex items-center gap-2 text-sm text-fg-dim">
                  <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="h-4 w-4 accent-[var(--color-fg)]" />
                  Show grid
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm text-fg-dim">
                  <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="h-4 w-4 accent-[var(--color-fg)]" />
                  Mirror left ↔ right
                </label>
              </>
            )}
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
  switch (tool) {
    case "pen":
      return <svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "marker":
      return <svg {...p}><path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" /></svg>;
    case "line":
      return <svg {...p}><path d="M5 19 19 5" /><circle cx="5" cy="19" r="1.5" /><circle cx="19" cy="5" r="1.5" /></svg>;
    case "rect":
      return <svg {...p}><rect x="4" y="6" width="16" height="12" rx="1" /></svg>;
    case "ellipse":
      return <svg {...p}><ellipse cx="12" cy="12" rx="8.5" ry="6" /></svg>;
    case "pixel":
      return <svg {...p}><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" /><path d="M14 14h6v6h-6z" fill="currentColor" /></svg>;
    case "picker":
      return <svg {...p}><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>;
    default:
      return <svg {...p}><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>;
  }
}
