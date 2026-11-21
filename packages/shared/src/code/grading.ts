import type { CodeRunner, Exercise, PublicExercise, RunResult } from "./types";
import { LIMITS } from "./types";

/** Normalizes program output: CRLF → LF, strip trailing whitespace on each line and trailing blank lines. */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

export interface DiffLine {
  kind: "same" | "expected" | "actual";
  text: string;
}

/** Line diff of expected vs actual (LCS), for visible tests only. */
export function lineDiff(expected: string, actual: string): DiffLine[] {
  const a = normalizeOutput(expected).split("\n");
  const b = normalizeOutput(actual).split("\n");
  if (a.length * b.length > 250_000) return [...a.map((t) => ({ kind: "expected" as const, text: t })), ...b.map((t) => ({ kind: "actual" as const, text: t }))];
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: "expected", text: a[i++] });
    else out.push({ kind: "actual", text: b[j++] });
  }
  while (i < a.length) out.push({ kind: "expected", text: a[i++] });
  while (j < b.length) out.push({ kind: "actual", text: b[j++] });
  return out;
}

/** Strips comments and string literals so pattern checks look at code, not prose. */
export function stripCommentsAndStrings(src: string, lang: Exercise["lang"]): string {
  if (lang === "python") {
    return src
      .replace(/("""|''')[\s\S]*?\1/g, '""')
      .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, '""')
      .replace(/#.*$/gm, "");
  }
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, '""')
    .replace(/\/\/.*$/gm, "");
}

export interface PatternIssue {
  kind: "required" | "forbidden";
  message: string;
}

export function checkPatterns(ex: Pick<Exercise, "lang" | "requiredPatterns" | "forbiddenPatterns">, source: string): PatternIssue[] {
  const code = stripCommentsAndStrings(source, ex.lang);
  const issues: PatternIssue[] = [];
  for (const p of ex.requiredPatterns ?? []) if (!new RegExp(p.regex, p.flags ?? "m").test(code)) issues.push({ kind: "required", message: p.message });
  for (const p of ex.forbiddenPatterns ?? []) if (new RegExp(p.regex, p.flags ?? "m").test(code)) issues.push({ kind: "forbidden", message: p.message });
  return issues;
}

export interface TestOutcome {
  index: number;
  hidden: boolean;
  passed: boolean;
  status: RunResult["status"];
  // only populated for visible tests
  stdin?: string;
  expected?: string;
  actual?: string;
  diff?: DiffLine[];
  stderr?: string;
}

export interface GradeResult {
  passed: boolean;
  testsPassed: number;
  testsTotal: number;
  hiddenPassed: number;
  hiddenTotal: number;
  patternIssues: PatternIssue[];
  outcomes: TestOutcome[];
  compileOutput?: string;
  firstError?: { stderr: string; compileOutput: string; status: RunResult["status"] };
}

/**
 * Runs every test (visible + hidden) through the runner. Visible tests return full output and a
 * diff; hidden tests return only pass/fail. A compile error short-circuits the remaining tests.
 */
export async function grade(ex: Exercise, source: string, runner: CodeRunner): Promise<GradeResult> {
  if (new TextEncoder().encode(source).length > LIMITS.maxSourceBytes) throw new Error("source too large");
  const patternIssues = checkPatterns(ex, source);
  const outcomes: TestOutcome[] = [];
  let compileOutput: string | undefined;
  let firstError: GradeResult["firstError"];
  for (let i = 0; i < ex.tests.length; i++) {
    const t = ex.tests[i];
    const r = await runner.run({ lang: ex.lang, source, stdin: t.stdin });
    if (r.status === "compile_error") {
      compileOutput = r.compileOutput;
      firstError = { stderr: r.stderr, compileOutput: r.compileOutput, status: r.status };
      for (let k = i; k < ex.tests.length; k++) outcomes.push({ index: k, hidden: ex.tests[k].hidden, passed: false, status: "compile_error" });
      break;
    }
    const passed = r.status === "ok" && outputsMatch(r.stdout, t.expectedStdout);
    if (!passed && !firstError && (r.stderr || r.status !== "ok")) firstError = { stderr: r.stderr, compileOutput: r.compileOutput, status: r.status };
    outcomes.push(
      t.hidden
        ? { index: i, hidden: true, passed, status: r.status }
        : { index: i, hidden: false, passed, status: r.status, stdin: t.stdin, expected: t.expectedStdout, actual: r.stdout.slice(0, 8000), diff: passed ? undefined : lineDiff(t.expectedStdout, r.stdout.slice(0, 8000)), stderr: r.stderr.slice(0, 4000) },
    );
  }
  const testsPassed = outcomes.filter((o) => o.passed).length;
  const hidden = outcomes.filter((o) => o.hidden);
  return {
    passed: testsPassed === ex.tests.length && patternIssues.length === 0,
    testsPassed,
    testsTotal: ex.tests.length,
    hiddenPassed: hidden.filter((o) => o.passed).length,
    hiddenTotal: hidden.length,
    patternIssues,
    outcomes,
    compileOutput,
    firstError,
  };
}

export function publicExercise(ex: Exercise): PublicExercise {
  const { tests, hints: _hints, ...rest } = ex;
  return { ...rest, visibleTests: tests.filter((t) => !t.hidden).map(({ stdin, expectedStdout }) => ({ stdin, expectedStdout })), hiddenCount: tests.filter((t) => t.hidden).length };
}

/** Hints unlock after 2 / 4 / 6 failed submissions. There is no solution reveal. */
export function hintsUnlocked(failedSubmissions: number): number {
  return failedSubmissions >= 6 ? 3 : failedSubmissions >= 4 ? 2 : failedSubmissions >= 2 ? 1 : 0;
}
