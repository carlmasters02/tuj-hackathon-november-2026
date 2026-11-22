import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkSteps, getMathProblem, MAX_LINES } from "@hm/shared/math/index";
import { pointsFor } from "@hm/shared/scoring";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clampActiveSeconds, getProgress } from "@/lib/server/tutor";
import { addHumanTime, awardPoints } from "@/lib/server/points";

const Body = z
  .object({
    problemId: z.string().regex(/^[a-z0-9-]{1,40}$/),
    lines: z.array(z.string().max(300)).min(1).max(MAX_LINES),
    activeSeconds: z.number().int().min(0).max(3600).default(0),
  })
  .strict();

/** Server-authoritative step check. The answer never leaves the server. */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const body = await parseJson(req, Body, 20_000);
  const problem = getMathProblem(body.problemId);
  if (!problem) throw new HttpError(404, "That problem doesn't exist.");

  const prog = await getProgress(user.id, problem.id);
  const result = checkSteps(problem, body.lines, 1);
  const failed = result.firstError !== null;
  const failedAttempts = prog.failed_attempts + (failed ? 1 : 0);
  // tier 1 now; tier 2 after the 2nd failed attempt; tier 3 after the 3rd
  const unlockedTier = Math.min(3, Math.max(1, failedAttempts));
  const active = clampActiveSeconds(body.activeSeconds, prog.last_check_at);
  const now = new Date().toISOString();
  const newlySolved = result.complete && !prog.solved_at;

  const sb = supabaseAdmin();
  await sb.from("tutor_progress").upsert({
    user_id: user.id,
    problem_id: problem.id,
    failed_attempts: failedAttempts,
    hint_tier: Math.max(prog.hint_tier, unlockedTier),
    hints_used: prog.hints_used,
    active_seconds: prog.active_seconds + active,
    last_check_at: now,
    solved_at: prog.solved_at ?? (result.complete ? now : null),
  });
  await sb.from("tutor_attempts").insert({ user_id: user.id, problem_id: problem.id, kind: "math", lines_or_code: body.lines.join("\n").slice(0, 20000), passed: result.complete, hints_used: prog.hints_used, active_seconds: active });
  await addHumanTime(user.id, "tutor", active);

  let points = 0;
  if (newlySolved) points = await awardPoints(user.id, "math", problem.id, pointsFor("math", { hintsUsed: prog.hints_used }));

  return json({
    lines: result.lines,
    firstError: result.firstError,
    complete: result.complete,
    finalFormMessage: result.finalFormMessage,
    hints: result.hints, // tier 1 only here
    hintTierAvailable: failed ? unlockedTier : 0,
    hintsUsed: prog.hints_used,
    points,
  });
});
