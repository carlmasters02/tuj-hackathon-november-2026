import type { NextRequest } from "next/server";
import { z } from "zod";
import { getExercise } from "@hm/shared/code/exercises";
import { explainErrors } from "@hm/shared/code/errorExplainer";
import { grade, hintsUnlocked } from "@hm/shared/code/grading";
import { LIMITS } from "@hm/shared/code/types";
import { pointsFor } from "@hm/shared/scoring";
import { api, assertSameOrigin, HttpError, json, parseJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { encryptString, sha256 } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { codeRunner } from "@/lib/code/runners";
import { withRunSlot } from "@/lib/code/guard";
import { clampActiveSeconds } from "@/lib/server/tutor";
import { addHumanTime, awardPoints } from "@/lib/server/points";

export const runtime = "nodejs";

const Body = z.object({ exerciseId: z.string().regex(/^[a-z0-9-]{1,60}$/), source: z.string().max(LIMITS.maxSourceBytes), activeSeconds: z.number().int().min(0).max(3600).default(0) }).strict();

/**
 * "Submit": graded server-side against visible AND hidden tests, so completions and Human Points
 * can't be faked from the browser. Hidden tests report counts only.
 */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const b = await parseJson(req, Body, 40_000);
  if (Buffer.byteLength(b.source) > LIMITS.maxSourceBytes) throw new HttpError(413, "Source is limited to 20 KB");
  const ex = getExercise(b.exerciseId);
  if (!ex) throw new HttpError(404, "Unknown exercise");
  const runner = codeRunner();

  return withRunSlot(user.id, 1, async () => {
    const result = await grade(ex, b.source, runner);
    if (result.outcomes.some((o) => o.status === "internal_error")) throw new HttpError(503, "The code runner is unavailable right now. Your attempt wasn't counted.");

    const sb = supabaseAdmin();
    const { data: prog } = await sb.from("code_progress").select("*").eq("user_id", user.id).eq("exercise_id", ex.id).maybeSingle();
    const failed = (prog?.failed_submissions ?? 0) + (result.passed ? 0 : 1);
    const unlocked = hintsUnlocked(failed);
    const active = clampActiveSeconds(b.activeSeconds, prog?.last_submit_at ?? null);
    const now = new Date().toISOString();
    const newlySolved = result.passed && !prog?.solved_at;
    const hintsUsed = prog?.hints_revealed ?? 0;

    await sb.from("code_progress").upsert({
      user_id: user.id,
      exercise_id: ex.id,
      lang: ex.lang,
      concept: ex.concept,
      failed_submissions: failed,
      hints_revealed: Math.max(hintsUsed, unlocked),
      active_seconds: (prog?.active_seconds ?? 0) + active,
      last_submit_at: now,
      solved_at: prog?.solved_at ?? (result.passed ? now : null),
      // keep the student's own passing code (encrypted) for the Rosetta view
      solution_enc: result.passed ? encryptString(b.source, `code:${user.id}:${ex.id}`) : (prog?.solution_enc ?? null),
    });
    await sb.from("code_attempts").insert({
      user_id: user.id, exercise_id: ex.id, lang: ex.lang, source_hash: sha256(b.source), passed: result.passed,
      tests_passed: result.testsPassed, tests_total: result.testsTotal, hints_used: hintsUsed, active_seconds: active,
    });
    await addHumanTime(user.id, "tutor", active);
    let points = 0;
    if (newlySolved) points = await awardPoints(user.id, "code", ex.id, pointsFor("code", { hintsUsed }));

    const errText = result.firstError ? result.firstError.compileOutput || result.firstError.stderr : "";
    return json({
      passed: result.passed,
      testsPassed: result.testsPassed,
      testsTotal: result.testsTotal,
      hiddenPassed: result.hiddenPassed,
      hiddenTotal: result.hiddenTotal,
      patternIssues: result.patternIssues,
      visible: result.outcomes.filter((o) => !o.hidden),
      compileOutput: result.compileOutput,
      explanations: errText || result.firstError ? explainErrors(ex.lang, errText, result.firstError?.status, b.source) : [],
      failedSubmissions: failed,
      hints: ex.hints.slice(0, unlocked),
      nextHintAt: unlocked < 3 ? [2, 4, 6][unlocked] : null,
      points,
    });
  });
});
