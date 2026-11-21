"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client";
import { HumanSeal } from "@/components/HumanSeal";

export interface Effort {
  done: number;
  need: number;
  unit: string; // "strokes" | "note edits"
  seconds: number;
  needSeconds: number;
}

/** Shows how close a piece is to the Human-made seal; finishing signs the certificate and publishes. */
export function SealProgress({ e }: { e: Effort }) {
  const a = Math.min(1, e.done / e.need);
  const b = Math.min(1, e.seconds / e.needSeconds);
  const ready = a >= 1 && b >= 1;
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-3 text-sm transition-colors ${ready ? "bg-sun-soft ring-1 ring-sun" : "bg-muted/60"}`}>
      <div className={`transition-[filter,opacity] duration-500 ${ready ? "" : "opacity-40 grayscale"}`}><HumanSeal size={40} /></div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-semibold">{ready ? "Ready for the Human-made seal" : "Working toward the seal"}</p>
        <Bar label={`${Math.min(e.done, e.need)}/${e.need} ${e.unit}`} p={a} />
        <Bar label={`${Math.min(e.seconds, e.needSeconds)}/${e.needSeconds} s of active time`} p={b} />
      </div>
    </div>
  );
}

function Bar({ label, p }: { label: string; p: number }) {
  return (
    <div>
      <span className="text-xs text-fg-dim tabular-nums">{label}</span>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full transition-[width] duration-300 ${p >= 1 ? "bg-ok" : "bg-fg"}`} style={{ width: `${p * 100}%` }} /></div>
    </div>
  );
}

export function FinishPanel({ id, kind, title, setTitle, effort, drain, onClose }: { id: string; kind: "art" | "music"; title: string; setTitle: (t: string) => void; effort: Effort; drain: () => Promise<boolean>; onClose: () => void }) {
  const router = useRouter();
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = effort.done >= effort.need && effort.seconds >= effort.needSeconds;
  const finish = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!(await drain())) throw new Error("Couldn't save the last changes. Check your connection and try again.");
      const r = await postJson<{ workId: string }>(`/api/creations/${id}/finalize`, { title: title.trim() || "Untitled", publish });
      router.push(`/portfolio/work/${r.workId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="finish-h" className="fixed inset-0 z-50 flex items-end justify-center bg-fg/25 p-4 backdrop-blur-[2px] sm:items-center" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="hm-pop w-full max-w-md space-y-5 rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-lift)]">
        <div>
          <h2 id="finish-h" className="text-2xl font-extrabold tracking-tight">Finish this {kind === "art" ? "drawing" : "piece"}</h2>
          <p className="mt-1 text-sm text-fg-dim">Finishing locks it. The server replays every {kind === "art" ? "stroke" : "note"}, checks the record and signs a certificate.</p>
        </div>
        <label className="block">
          <span className="label">Title</span>
          <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <SealProgress e={effort} />
        {!ready && <p className="text-sm text-warn">You can finish now, but it won&apos;t carry the seal. Keep going a little longer to earn it.</p>}
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-4 w-4 accent-[var(--color-fg)]" />
          Show it in the portfolio
        </label>
        {err && <p role="alert" className="text-sm text-redpen">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Keep working</button>
          <button className="btn btn-primary px-5" onClick={finish} disabled={busy}>{busy ? "Signing…" : "Finish and sign"}</button>
        </div>
      </div>
    </div>
  );
}
