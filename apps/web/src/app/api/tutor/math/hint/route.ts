import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkSteps, getMathProblem, MAX_LINES } from "@hm/shared/math/index";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProgress } from "@/lib/server/tutor";

const Body = z.object({ problemId: z.string().regex(/^[a-z0-9-]{1,40}$/), lines: z.array(z.string().max(300)).min(1).max(MAX_LINES) }).strict();

/** Reveals hints up to the tier the student has unlocked by failing. Revealing tier ≥2 forfeits the no-hint bonus. */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const body = await parseJson(req, Body, 20_000);
  const problem = getMathProblem(body.problemId);
  if (!problem) throw new HttpError(404, "Unknown problem");
  const prog = await getProgress(user.id, problem.id);
  const tier = Math.min(3, Math.max(1, prog.hint_tier)) as 1 | 2 | 3;
  const result = checkSteps(problem, body.lines, tier);
  if (result.firstError === null) return json({ hints: [] });
  if (tier >= 2) {
    await supabaseAdmin().from("tutor_progress").update({ hints_used: Math.max(prog.hints_used, tier - 1) }).eq("user_id", user.id).eq("problem_id", problem.id);
  }
  return json({ hints: result.hints, tier });
});
