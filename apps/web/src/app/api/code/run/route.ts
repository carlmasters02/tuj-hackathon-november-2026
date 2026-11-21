import type { NextRequest } from "next/server";
import { z } from "zod";
import { getExercise } from "@hm/shared/code/exercises";
import { explainErrors } from "@hm/shared/code/errorExplainer";
import { lineDiff, outputsMatch } from "@hm/shared/code/grading";
import { LIMITS } from "@hm/shared/code/types";
import { api, assertSameOrigin, HttpError, json, parseJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { codeRunner } from "@/lib/code/runners";
import { withRunSlot } from "@/lib/code/guard";

export const runtime = "nodejs";

const Body = z
  .object({
    exerciseId: z.string().regex(/^[a-z0-9-]{1,60}$/),
    source: z.string().max(LIMITS.maxSourceBytes),
    stdin: z.string().max(10_000).optional(),
    sanitize: z.boolean().optional(),
  })
  .strict();

/** "Run": executes against the visible tests (or custom stdin). Never touches hidden tests. */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const b = await parseJson(req, Body, 40_000);
  if (Buffer.byteLength(b.source) > LIMITS.maxSourceBytes) throw new HttpError(413, "Source is limited to 20 KB");
  const ex = getExercise(b.exerciseId);
  if (!ex) throw new HttpError(404, "Unknown exercise");
  if (b.sanitize && ex.lang !== "c") throw new HttpError(400, "Memory checking is only for C");
  const runner = codeRunner();

  return withRunSlot(user.id, 1, async () => {
    const inputs = b.stdin !== undefined ? [{ stdin: b.stdin, expectedStdout: null as string | null }] : ex.tests.filter((t) => !t.hidden).map((t) => ({ stdin: t.stdin, expectedStdout: t.expectedStdout as string | null }));
    const results = [];
    for (const t of inputs) {
      const r = await runner.run({ lang: ex.lang, source: b.source, stdin: t.stdin, sanitize: b.sanitize });
      const passed = t.expectedStdout !== null ? r.status === "ok" && outputsMatch(r.stdout, t.expectedStdout) : null;
      const out = r.compileOutput || r.stderr;
      results.push({
        stdin: t.stdin,
        expected: t.expectedStdout,
        status: r.status,
        stdout: r.stdout,
        stderr: r.stderr,
        compileOutput: r.compileOutput,
        passed,
        diff: passed === false ? lineDiff(t.expectedStdout!, r.stdout) : undefined,
        explanations: explainErrors(ex.lang, out, r.status, b.source),
      });
      if (r.status === "compile_error" || r.status === "internal_error") break;
    }
    return json({ runner: runner.name, results });
  });
});
