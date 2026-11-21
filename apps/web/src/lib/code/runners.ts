import "server-only";
import { LIMITS, type CodeRunner, type Lang, type RunRequest, type RunResult } from "@hm/shared/code/types";
import { env } from "../env";

const cap = (s: string | null | undefined) => {
  const t = s ?? "";
  return t.length > LIMITS.maxOutputBytes ? t.slice(0, LIMITS.maxOutputBytes) + "\n…[output truncated at 64 KB]" : t;
};
const internal = (msg: string): RunResult => ({ status: "internal_error", stdout: "", stderr: msg, compileOutput: "", exitCode: null, timeMs: null });

/**
 * Self-hosted Judge0 CE. Never exposed to the browser: only our route handlers call it, on a
 * private network, with an auth token. Limits are set per request.
 */
export class Judge0Runner implements CodeRunner {
  readonly name = "judge0";
  private static LANG_ID: Record<Lang, number> = { c: 50, java: 62, python: 71 }; // GCC 9.2, OpenJDK 13, Python 3.8
  constructor(private url: string, private token?: string) {}

  async run(req: RunRequest): Promise<RunResult> {
    const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
    const unb64 = (s: string | null) => (s ? Buffer.from(s, "base64").toString("utf8") : "");
    const opts = req.lang === "c" ? (req.sanitize ? "-std=c17 -Wall -Wextra -O0 -g -fsanitize=address,undefined -fno-omit-frame-pointer" : "-std=c17 -Wall -Wextra -O0") : undefined;
    const body = {
      source_code: b64(req.source),
      language_id: Judge0Runner.LANG_ID[req.lang],
      stdin: b64(req.stdin),
      compiler_options: opts,
      cpu_time_limit: LIMITS.cpuSeconds[req.lang],
      wall_time_limit: LIMITS.wallSeconds,
      // ASan reserves a lot of virtual memory; sanitizer runs get a larger (still bounded) limit
      memory_limit: (req.sanitize ? 512 : LIMITS.memoryMb[req.lang]) * 1024,
      max_file_size: 64,
      enable_network: false,
      redirect_stderr_to_stdout: false,
    };
    let res: Response;
    try {
      res = await fetch(`${this.url}/submissions?base64_encoded=true&wait=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(this.token ? { "X-Auth-Token": this.token } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return internal("The code runner is unreachable.");
    }
    if (!res.ok) return internal(`Runner error (${res.status})`);
    const d = await res.json();
    const id: number = d.status?.id ?? 13;
    const status: RunResult["status"] =
      id === 3 || id === 4 ? "ok" : id === 5 ? "timeout" : id === 6 ? "compile_error" : id === 8 ? "output_limit" : id >= 7 && id <= 12 ? "runtime_error" : "internal_error";
    const stderr = unb64(d.stderr);
    return {
      status: status === "runtime_error" && /memory/i.test(d.message ?? "") ? "memory" : status,
      stdout: cap(unb64(d.stdout)),
      stderr: cap(stderr + (status === "runtime_error" && d.status?.description && !stderr ? d.status.description : "")),
      compileOutput: cap(unb64(d.compile_output)),
      exitCode: d.exit_code ?? null,
      timeMs: d.time ? Math.round(Number(d.time) * 1000) : null,
    };
  }
}

/**
 * Piston (engineer-man/piston) — the fallback implementation of the same interface. It compiles
 * with its package's fixed flags (no custom flags, so no sanitizer mode).
 */
export class PistonRunner implements CodeRunner {
  readonly name = "piston";
  // Piston appends the language's extension to the file name itself ("main" → "main.c").
  private static LANG: Record<Lang, { language: string; file: string }> = {
    c: { language: "c", file: "main" },
    java: { language: "java", file: "Main" },
    python: { language: "python", file: "main" },
  };
  constructor(private url: string) {}

  async run(req: RunRequest): Promise<RunResult> {
    const l = PistonRunner.LANG[req.lang];
    let res: Response;
    try {
      res = await fetch(`${this.url}/api/v2/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: l.language,
          version: "*",
          files: [{ name: l.file, content: req.lang === "java" ? withJavaLauncher(req.source) : req.source }],
          stdin: req.stdin,
          compile_timeout: 10_000,
          run_timeout: LIMITS.cpuSeconds[req.lang] * 1000,
          compile_memory_limit: 256 * 1024 * 1024,
          run_memory_limit: LIMITS.memoryMb[req.lang] * 1024 * 1024,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return internal("The code runner is unreachable.");
    }
    if (!res.ok) return internal(`Runner error (${res.status})`);
    const d = await res.json();
    if (d.compile && d.compile.code !== 0 && d.compile.code !== null) {
      return { status: "compile_error", stdout: "", stderr: "", compileOutput: cap(d.compile.stderr || d.compile.output), exitCode: d.compile.code, timeMs: null };
    }
    const run = d.run ?? {};
    // Java's single-file launcher compiles at run time: compile errors arrive on run.stderr
    if (req.lang === "java" && run.code !== 0 && /error: compilation failed/.test(run.stderr ?? "")) {
      return { status: "compile_error", stdout: "", stderr: "", compileOutput: cap(run.stderr), exitCode: run.code, timeMs: null };
    }
    const status: RunResult["status"] = run.signal === "SIGKILL" ? "timeout" : run.code === 0 ? "ok" : "runtime_error";
    const sig = run.signal && run.signal !== "SIGKILL" ? `\n${run.signal}` : "";
    return { status, stdout: cap(run.stdout), stderr: cap((run.stderr ?? "") + sig), compileOutput: cap(d.compile?.stderr ?? ""), exitCode: run.code ?? null, timeMs: null };
  }
}

/**
 * Java's single-file source launcher runs the FIRST class in the file, so a helper class declared
 * above Main would be run instead. We insert a tiny launcher class right after the imports — on
 * the same line as the student's first declaration, so compiler line numbers don't shift.
 */
export function withJavaLauncher(src: string): string {
  const header = /^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|(?:package|import)\s+[\w.]+(?:\.\*)?\s*;)*/.exec(src)?.[0] ?? "";
  // keep the header's trailing newline/indent, put the launcher before the first real token
  const cut = header.replace(/[ \t]*$/, "").length;
  return src.slice(0, cut) + "class HmLauncher { public static void main(String[] a) throws Exception { Main.main(a); } } " + src.slice(cut);
}

let runner: CodeRunner | null = null;
export function codeRunner(): CodeRunner {
  if (runner) return runner;
  const e = env();
  runner = e.CODE_RUNNER === "judge0" && e.JUDGE0_URL ? new Judge0Runner(e.JUDGE0_URL, e.JUDGE0_AUTH_TOKEN) : new PistonRunner(e.PISTON_URL);
  return runner;
}
