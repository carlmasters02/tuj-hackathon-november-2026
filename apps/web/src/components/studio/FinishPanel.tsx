"use client";
import { useRef, useState } from "react";
import { isDefaultTitle } from "@hm/shared/genres";
import { DefaultTitleWarning, TitleField } from "@/components/TitleField";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client";
import { HumanSeal } from "@/components/HumanSeal";

export interface Effort {
  done: number;
  unit: string; // "strokes" | "note edits"
  seconds: number;
}

/** Shows the recorded work; count and time are context, never thresholds for certification. */
export function SealProgress({ e }: { e: Effort }) {
  const hasContent = e.done > 0;
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-3 text-sm transition-colors ${hasContent ? "bg-sun-soft ring-1 ring-sun" : "bg-muted/60"}`}>
      <div className={`transition-[filter,opacity] duration-500 ${hasContent ? "" : "opacity-40 grayscale"}`}><HumanSeal size={40} /></div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-semibold">{hasContent ? "Ready to check the creation record" : "Add something to record"}</p>
        <p className="text-xs text-fg-dim tabular-nums">{e.done} {e.unit} · {e.seconds} s active</p>
        <p className="text-xs leading-relaxed text-fg-dim">No stroke-count or time minimum. The server checks the non-empty final work against the event chain and receipt times.</p>
      </div>
    </div>
  );
}

export function FinishPanel({ id, kind, title, setTitle, effort, drain, onClose }: { id: string; kind: "art" | "music"; title: string; setTitle: (t: string) => void; effort: Effort; drain: () => Promise<boolean>; onClose: () => void }) {
  const router = useRouter();
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = effort.done > 0;
  const titleRef = useRef<HTMLInputElement>(null);
  const untitled = isDefaultTitle(title);
  const finish = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!(await drain())) throw new Error("Couldn't save the last changes. Check your connection and try again.");
      const r = await postJson<{ workId: string }>(`/api/creations/${id}/finalize`, { title: title.trim() || "Untitled", publish });
      router.push(`/portfolio/work/${r.workId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't finish this piece. Check your connection and try again.");
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
        <TitleField value={title} onChange={setTitle} inputRef={titleRef} id="finish-title" />
        {untitled && <DefaultTitleWarning title={title} onChange={() => { titleRef.current?.focus(); titleRef.current?.select(); }} />}
        <SealProgress e={effort} />
        {!ready && <p className="text-sm text-warn">Add at least one visible {kind === "art" ? "stroke" : "active note"} before finishing. Event counts and active time are shown for context, not required as targets.</p>}
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-4 w-4 accent-[var(--color-fg)]" />
          Show it in the portfolio
        </label>
        {err && <p role="alert" className="text-sm text-redpen">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Keep working</button>
          <button className="btn btn-primary px-5" onClick={finish} disabled={busy}>{busy ? "Signing…" : untitled ? "Publish anyway" : "Finish and sign"}</button>
        </div>
      </div>
    </div>
  );
}
