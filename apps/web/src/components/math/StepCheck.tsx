"use client";
import { useMemo, useRef, useState } from "react";
import { toTex } from "@hm/shared/math/parse";
import type { Hint, PublicMathProblem } from "@hm/shared/math/types";
import { postJson, ApiError } from "@/lib/client";
import { useActiveTime } from "@/hooks/useActiveTime";
import { Tex } from "./Tex";

type Status = "ok" | "error" | "parse_error" | "pending" | "unchecked";
interface CheckResponse {
  lines: { index: number; status: Exclude<Status, "unchecked">; message?: string }[];
  firstError: number | null;
  complete: boolean;
  finalFormMessage?: string;
  hints: Hint[];
  hintTierAvailable: number;
  points: number;
}

const TIER_LABEL = { 1: "Where", 2: "What kind of mistake", 3: "Which term" } as const;

export function StepCheck({ problem, solved: initiallySolved }: { problem: PublicMathProblem; solved: boolean }) {
  const [lines, setLines] = useState<string[]>([""]);
  const [status, setStatus] = useState<Status[]>(["unchecked"]);
  const [messages, setMessages] = useState<(string | undefined)[]>([]);
  const [hints, setHints] = useState<Hint[]>([]);
  const [tierAvailable, setTierAvailable] = useState(0);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solved, setSolved] = useState(initiallySolved);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const active = useActiveTime();

  const previews = useMemo(
    () =>
      lines.map((l) => {
        if (!l.trim()) return null;
        try {
          return toTex(l, problem.variable);
        } catch {
          return null;
        }
      }),
    [lines, problem.variable],
  );

  const edit = (i: number, v: string) => {
    const next = [...lines];
    next[i] = v;
    setLines(next);
    // editing a line invalidates its verdict and everything after it
    setStatus((s) => s.map((x, k) => (k >= i ? "unchecked" : x)));
    setResult(null);
  };

  const addLine = (after: number) => {
    const next = [...lines.slice(0, after + 1), "", ...lines.slice(after + 1)];
    setLines(next);
    setStatus((s) => [...s.slice(0, after + 1), "unchecked", ...s.slice(after + 1)]);
    setTimeout(() => inputs.current[after + 1]?.focus(), 0);
  };

  const removeLine = (i: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, k) => k !== i));
    setStatus((s) => s.filter((_, k) => k !== i).map((x, k) => (k >= i ? "unchecked" : x)));
    setTimeout(() => inputs.current[Math.max(0, i - 1)]?.focus(), 0);
  };

  const check = async () => {
    const trimmed = lines.map((l) => l.trim());
    while (trimmed.length > 1 && !trimmed[trimmed.length - 1]) trimmed.pop();
    if (!trimmed.some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<CheckResponse>("/api/tutor/math/check", { problemId: problem.id, lines: trimmed, activeSeconds: active.take() });
      setResult(r);
      const st: Status[] = lines.map((_, i) => r.lines[i]?.status ?? "unchecked");
      setStatus(st);
      setMessages(lines.map((_, i) => r.lines[i]?.message));
      setHints(r.hints);
      setTierAvailable(r.hintTierAvailable);
      if (r.complete) setSolved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  };

  const revealHint = async () => {
    const trimmed = lines.map((l) => l.trim()).filter((l, i, a) => l || i < a.length - 1);
    try {
      const r = await postJson<{ hints: Hint[] }>("/api/tutor/math/hint", { problemId: problem.id, lines: trimmed });
      setHints(r.hints);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load hint");
    }
  };

  const highestShown = hints.reduce((m, h) => Math.max(m, h.tier), 0);

  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {lines.map((l, i) => {
          const s = status[i] ?? "unchecked";
          const tone =
            s === "ok" ? "border-ok/50" : s === "error" || s === "parse_error" ? "border-redpen bg-redpen-dim" : s === "pending" ? "opacity-40" : "border-line";
          return (
            <li key={i} className={`rounded-lg border ${tone} transition`}>
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-right font-mono text-xs text-fg-faint">{i + 1}</span>
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  className="min-w-0 flex-1 bg-transparent font-mono text-base outline-none placeholder:text-fg-faint"
                  value={l}
                  placeholder={i === 0 ? (problem.kind === "equation" ? "e.g. 2x = 11 - 3" : "your first step") : "next step"}
                  maxLength={300}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) => edit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void check();
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      addLine(i);
                    } else if (e.key === "Backspace" && !l && lines.length > 1) {
                      e.preventDefault();
                      removeLine(i);
                    } else if (e.key === "ArrowUp") inputs.current[i - 1]?.focus();
                    else if (e.key === "ArrowDown") inputs.current[i + 1]?.focus();
                  }}
                  aria-label={`Step ${i + 1}`}
                />
                <span className="w-5 text-center text-sm">{s === "ok" ? <span className="text-ok">✓</span> : s === "error" || s === "parse_error" ? <span className="text-redpen">✗</span> : null}</span>
              </div>
              {previews[i] && <div className="border-t border-line/60 px-11 py-1.5 text-fg-dim"><Tex tex={previews[i]!} /></div>}
              {messages[i] && (s === "error" || s === "parse_error") && <div className="px-11 pb-2 text-sm text-redpen">{messages[i]}</div>}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={check} disabled={busy}>{busy ? "Checking…" : "Check my steps"}</button>
        <button className="btn btn-ghost" onClick={() => addLine(lines.length - 1)}>+ Line</button>
        <span className="text-xs text-fg-faint">Enter = new line · Ctrl/⌘+Enter = check · use * for times, ^ for powers, / for fractions</span>
      </div>

      {error && <p className="text-sm text-redpen">{error}</p>}

      {result?.complete && (
        <div className="rounded-xl border border-ok/50 bg-ok-dim p-4">
          <p className="font-medium text-ok">Solved — every step checks out.</p>
          {result.points > 0 && <p className="text-sm text-fg-dim">+{result.points} Human Points</p>}
        </div>
      )}
      {result && result.firstError === null && !result.complete && result.finalFormMessage && (
        <div className="rounded-xl border border-warn/50 bg-warn-dim p-4 text-sm">
          <p><span className="text-ok">All steps are valid.</span> {result.finalFormMessage}</p>
        </div>
      )}

      {hints.length > 0 && (
        <div className="card space-y-3 p-4">
          {hints.map((h) => (
            <div key={h.tier} className="text-sm">
              <div className="text-xs uppercase tracking-wide text-fg-faint">Hint {h.tier} · {TIER_LABEL[h.tier]}</div>
              <p className="mt-0.5">{h.text}</p>
            </div>
          ))}
          {tierAvailable > highestShown && (
            <button className="btn" onClick={revealHint}>Show hint {highestShown + 1} {highestShown + 1 >= 2 && "(forfeits the no-hint bonus)"}</button>
          )}
          {tierAvailable <= highestShown && highestShown < 3 && result?.firstError !== null && <p className="text-xs text-fg-faint">Try again — the next hint unlocks after another attempt.</p>}
        </div>
      )}
      {solved && !result?.complete && <p className="text-xs text-ok">You&apos;ve solved this one before. Practice is still welcome.</p>}
    </div>
  );
}
