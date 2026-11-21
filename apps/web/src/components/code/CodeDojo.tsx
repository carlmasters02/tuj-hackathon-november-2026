"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublicExercise } from "@hm/shared/code/types";
import { explainErrors, type Explanation } from "@hm/shared/code/errorExplainer";
import { lineDiff, outputsMatch, type DiffLine } from "@hm/shared/code/grading";
import { postJson, getJson, ApiError } from "@/lib/client";
import { useActiveTime } from "@/hooks/useActiveTime";
import { CodeEditor } from "./CodeEditor";
import { usePyodide } from "./usePyodide";

interface RunRow { stdin: string; expected: string | null; status: string; stdout: string; stderr: string; compileOutput?: string; passed: boolean | null; diff?: DiffLine[]; explanations: Explanation[] }
interface SubmitResult {
  passed: boolean; testsPassed: number; testsTotal: number; hiddenPassed: number; hiddenTotal: number;
  patternIssues: { kind: string; message: string }[];
  visible: { index: number; passed: boolean; status: string; stdin?: string; expected?: string; actual?: string; diff?: DiffLine[]; stderr?: string }[];
  compileOutput?: string; explanations: Explanation[]; failedSubmissions: number; hints: string[]; nextHintAt: number | null; points: number;
}

const LANG_LABEL = { python: "Python", c: "C", java: "Java" } as const;

export function CodeDojo({ ex, solved: initiallySolved, initialHints, failed }: { ex: PublicExercise; solved: boolean; initialHints: string[]; failed: number }) {
  const storageKey = `hm-code-${ex.id}`;
  const [source, setSource] = useState(ex.starterCode);
  const [loaded, setLoaded] = useState(false);
  const [runRows, setRunRows] = useState<RunRow[] | null>(null);
  const [submit, setSubmit] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState<null | "run" | "submit" | "memory">(null);
  const [error, setError] = useState<string | null>(null);
  const [customStdin, setCustomStdin] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [hints, setHints] = useState(initialHints);
  const [solved, setSolved] = useState(initiallySolved);
  const [rosetta, setRosetta] = useState<{ solutions: { lang: string; source: string }[]; missing: { lang: string; exerciseId: string | null }[] } | null>(null);
  const pyFirst = useRef(true);
  const py = usePyodide();
  const active = useActiveTime();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setSource(saved);
    } catch {}
    setLoaded(true);
    if (ex.lang === "python") py.warm();
  }, [storageKey, ex.lang, py]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, source);
    } catch {}
  }, [source, loaded, storageKey]);

  const errorLine =
    submit?.explanations.find((e) => e.line)?.line ?? runRows?.flatMap((r) => r.explanations).find((e) => e.line)?.line ?? null;

  const run = async (sanitize = false) => {
    setBusy(sanitize ? "memory" : "run");
    setError(null);
    setSubmit(null);
    try {
      const inputs = useCustom ? [{ stdin: customStdin, expectedStdout: null as string | null }] : ex.visibleTests.map((t) => ({ stdin: t.stdin, expectedStdout: t.expectedStdout as string | null }));
      if (ex.lang === "python" && !sanitize) {
        const rows: RunRow[] = [];
        for (const t of inputs) {
          const r = await py.run(source, t.stdin, pyFirst.current);
          pyFirst.current = false;
          const passed = t.expectedStdout !== null ? r.status === "ok" && outputsMatch(r.stdout, t.expectedStdout) : null;
          rows.push({ stdin: t.stdin, expected: t.expectedStdout, status: r.status, stdout: r.stdout, stderr: r.stderr, passed, diff: passed === false ? lineDiff(t.expectedStdout!, r.stdout) : undefined, explanations: explainErrors("python", r.stderr, r.status as any, source) });
          if (r.status === "timeout") break;
        }
        setRunRows(rows);
      } else {
        const r = await postJson<{ results: RunRow[] }>("/api/code/run", { exerciseId: ex.id, source, ...(useCustom ? { stdin: customStdin } : {}), ...(sanitize ? { sanitize: true } : {}) });
        setRunRows(r.results);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Run failed");
    } finally {
      setBusy(null);
    }
  };

  const doSubmit = async () => {
    setBusy("submit");
    setError(null);
    setRunRows(null);
    try {
      const r = await postJson<SubmitResult>("/api/code/submit", { exerciseId: ex.id, source, activeSeconds: active.take() });
      setSubmit(r);
      setHints(r.hints);
      if (r.passed) setSolved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Submit failed");
    } finally {
      setBusy(null);
    }
  };

  const openRosetta = async () => {
    try {
      setRosetta(await getJson(`/api/code/rosetta?exerciseId=${encodeURIComponent(ex.id)}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't open Rosetta view");
    }
  };

  return (
    <div className="space-y-4">
      {loaded && <CodeEditor lang={ex.lang} initial={source} onChange={setSource} errorLine={errorLine} />}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => run(false)} disabled={!!busy}>{busy === "run" ? "Running…" : ex.lang === "python" ? "▶ Run (in your browser)" : "▶ Run"}</button>
        {ex.lang === "c" && <button className="btn" onClick={() => run(true)} disabled={!!busy} title="Compile with AddressSanitizer + UBSan">{busy === "memory" ? "Checking…" : "Check memory"}</button>}
        <button className="btn btn-primary" onClick={doSubmit} disabled={!!busy}>{busy === "submit" ? "Grading on server…" : "Submit"}</button>
        <label className="ml-auto flex items-center gap-2 text-xs text-paper-dim"><input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} /> Custom input</label>
      </div>
      {useCustom && <textarea className="input font-mono text-xs" rows={3} value={customStdin} onChange={(e) => setCustomStdin(e.target.value)} placeholder="stdin for Run" />}
      {error && <p className="text-sm text-redpen">{error}</p>}

      {runRows && (
        <div className="space-y-3">
          {runRows.map((r, i) => <RunCard key={i} title={r.expected === null ? "Custom input" : `Example ${i + 1}`} {...r} />)}
          <Explanations list={dedupe(runRows.flatMap((r) => r.explanations))} />
        </div>
      )}

      {submit && (
        <div className="space-y-3">
          <div className={`rounded-xl border p-4 ${submit.passed ? "border-ok/50 bg-ok-dim" : "border-redpen/40 bg-redpen-dim"}`}>
            <p className="font-medium">{submit.passed ? "✓ Accepted — all tests pass." : `${submit.testsPassed}/${submit.testsTotal} tests passed`}</p>
            <p className="text-sm text-paper-dim">Hidden tests: {submit.hiddenPassed}/{submit.hiddenTotal} passed{submit.points > 0 ? ` · +${submit.points} Human Points` : ""}</p>
            {submit.patternIssues.map((p, i) => <p key={i} className="mt-1 text-sm text-warn">• {p.message}</p>)}
          </div>
          {submit.visible.filter((v) => !v.passed).map((v) => (
            <RunCard key={v.index} title={`Example ${v.index + 1}`} stdin={v.stdin ?? ""} expected={v.expected ?? null} status={v.status} stdout={v.actual ?? ""} stderr={v.stderr ?? ""} passed={v.passed} diff={v.diff} compileOutput={v.status === "compile_error" ? submit.compileOutput : undefined} explanations={[]} />
          ))}
          {submit.compileOutput && submit.visible.every((v) => v.status !== "compile_error") && <pre className="max-h-60 overflow-auto rounded-lg bg-ink p-3 font-mono text-xs text-redpen">{submit.compileOutput}</pre>}
          <Explanations list={submit.explanations} />
          {!submit.passed && submit.nextHintAt && <p className="text-xs text-paper-faint">Next hint unlocks after {submit.nextHintAt} failed submissions ({submit.failedSubmissions} so far). There is no solution button — you&apos;ve got this.</p>}
        </div>
      )}

      {hints.length > 0 && (
        <div className="card space-y-2 p-4">
          {hints.map((h, i) => <p key={i} className="text-sm"><span className="mr-2 text-xs uppercase tracking-wide text-paper-faint">Hint {i + 1}</span>{h}</p>)}
        </div>
      )}
      {!hints.length && failed === 0 && !submit && <p className="text-xs text-paper-faint">Hints unlock after 2, 4 and 6 failed submissions.</p>}

      {solved && (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-serif text-lg">Rosetta view</h3>
            <button className="btn" onClick={openRosetta}>Compare my solutions across languages</button>
          </div>
          {rosetta && (
            <div className="grid gap-3 md:grid-cols-3">
              {rosetta.solutions.map((s) => (
                <div key={s.lang}>
                  <div className="mb-1 text-xs uppercase tracking-wide text-paper-faint">{LANG_LABEL[s.lang as keyof typeof LANG_LABEL]} — your code</div>
                  <pre className="max-h-80 overflow-auto rounded-lg bg-ink p-3 font-mono text-xs">{s.source}</pre>
                </div>
              ))}
              {rosetta.missing.map((m) => (
                <div key={m.lang} className="grid place-items-center rounded-lg border border-dashed border-line p-4 text-center text-sm text-paper-dim">
                  {m.exerciseId ? <Link className="link" href={`/tutor/code/${m.exerciseId}`}>Solve it in {LANG_LABEL[m.lang as keyof typeof LANG_LABEL]} to compare →</Link> : "Not in this track"}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const dedupe = (l: Explanation[]) => l.filter((e, i) => l.findIndex((x) => x.ruleId === e.ruleId) === i);

function Explanations({ list }: { list: Explanation[] }) {
  if (!list.length) return null;
  return (
    <div className="card space-y-3 p-4">
      <div className="text-xs uppercase tracking-wide text-paper-faint">What the error means</div>
      {list.map((e) => (
        <div key={e.ruleId} className="text-sm">
          <p className="font-medium">{e.title}{e.line ? <span className="ml-2 chip">line {e.line}</span> : null}</p>
          <p className="text-paper-dim">{e.explanation}</p>
          <p className="text-paper-dim"><span className="text-paper">Where to look:</span> {e.where}</p>
        </div>
      ))}
    </div>
  );
}

function RunCard({ title, stdin, expected, status, stdout, stderr, compileOutput, passed, diff }: Omit<RunRow, "explanations"> & { title: string; explanations: Explanation[] }) {
  const tone = passed === true ? "border-ok/50" : passed === false || status !== "ok" ? "border-redpen/40" : "border-line";
  return (
    <div className={`rounded-lg border ${tone} text-xs`}>
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-medium">{title}</span>
        <span className={passed ? "text-ok" : passed === false ? "text-redpen" : "text-paper-dim"}>{status === "timeout" ? "time limit exceeded" : status === "compile_error" ? "compile error" : passed === true ? "✓ matches" : passed === false ? "✗ different output" : status}</span>
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <div className="bg-ink-2 p-2"><div className="mb-1 text-paper-faint">input</div><pre className="whitespace-pre-wrap font-mono">{stdin || "(none)"}</pre></div>
        {diff ? (
          <div className="bg-ink-2 p-2">
            <div className="mb-1 text-paper-faint">expected / <span className="text-redpen">yours</span></div>
            <pre className="whitespace-pre-wrap font-mono">{diff.map((d, i) => <div key={i} className={d.kind === "expected" ? "text-ok" : d.kind === "actual" ? "text-redpen" : ""}>{d.kind === "expected" ? "+ " : d.kind === "actual" ? "- " : "  "}{d.text || " "}</div>)}</pre>
          </div>
        ) : (
          <div className="bg-ink-2 p-2"><div className="mb-1 text-paper-faint">output{expected !== null && passed ? " (= expected)" : ""}</div><pre className="whitespace-pre-wrap font-mono">{stdout || "(no output)"}</pre></div>
        )}
      </div>
      {(compileOutput || stderr) && <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-t border-line p-2 font-mono text-redpen">{compileOutput || stderr}</pre>}
    </div>
  );
}
