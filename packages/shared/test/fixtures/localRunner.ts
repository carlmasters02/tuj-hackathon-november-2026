/**
 * TEST-ONLY runner that executes code directly on the dev machine with python3/gcc/javac.
 * It has NO sandbox and must never be used by the app — production uses Judge0/Piston.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodeRunner, RunRequest, RunResult } from "@hm/shared/code/types";

export class LocalTestRunner implements CodeRunner {
  readonly name = "local-test";
  private cache = new Map<string, string>(); // source hash → build dir
  async run(req: RunRequest): Promise<RunResult> {
    const key = req.lang + req.source;
    let dir = this.cache.get(key);
    if (!dir) {
      dir = mkdtempSync(join(tmpdir(), "hm-run-"));
      const file = req.lang === "python" ? "main.py" : req.lang === "c" ? "main.c" : "Main.java";
      writeFileSync(join(dir, file), req.source);
      try {
        if (req.lang === "c") execFileSync("gcc", ["-std=c17", "-Wall", "-Wextra", "-O0", "-o", join(dir, "main"), join(dir, "main.c"), "-lm"], { stdio: "pipe" });
        if (req.lang === "java") execFileSync("javac", ["-d", dir, join(dir, "Main.java")], { stdio: "pipe" });
      } catch (e: any) {
        rmSync(dir, { recursive: true, force: true });
        return { status: "compile_error", stdout: "", stderr: "", compileOutput: String(e.stderr ?? e.message), exitCode: 1, timeMs: null };
      }
      this.cache.set(key, dir);
    }
    const [cmd, args] = req.lang === "python" ? ["python3", [join(dir, "main.py")]] : req.lang === "c" ? [join(dir, "main"), []] : ["java", ["-cp", dir, "Main"]];
    const r = spawnSync(cmd as string, args as string[], { input: req.stdin, timeout: 10_000, encoding: "utf8" });
    return { status: r.error ? "timeout" : r.status === 0 ? "ok" : "runtime_error", stdout: r.stdout ?? "", stderr: r.stderr ?? "", compileOutput: "", exitCode: r.status, timeMs: null };
  }
  cleanup() {
    for (const d of this.cache.values()) rmSync(d, { recursive: true, force: true });
  }
}
