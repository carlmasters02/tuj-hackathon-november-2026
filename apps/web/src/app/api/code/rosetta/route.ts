import type { NextRequest } from "next/server";
import { counterpart, getExercise } from "@hm/shared/code/exercises";
import { LANGS } from "@hm/shared/code/types";
import { api, HttpError, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { decryptString } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Rosetta view: the student's OWN passing solutions for the same exercise in other languages.
 * Only available once they've solved this one. Never a reference solution.
 */
export const GET = api(async (req: NextRequest) => {
  const user = await requireUser();
  const id = req.nextUrl.searchParams.get("exerciseId") ?? "";
  const ex = getExercise(id);
  if (!ex) throw new HttpError(404, "Unknown exercise");
  const sb = supabaseAdmin();
  const ids = LANGS.map((l) => counterpart(ex, l)?.id).filter(Boolean) as string[];
  const { data } = await sb.from("code_progress").select("exercise_id, lang, solved_at, solution_enc").eq("user_id", user.id).in("exercise_id", ids);
  const mine = (data ?? []).find((r) => r.exercise_id === ex.id);
  if (!mine?.solved_at) throw new HttpError(403, "Solve this exercise first to open the Rosetta view.");
  return json({
    solutions: (data ?? [])
      .filter((r) => r.solved_at && r.solution_enc)
      .map((r) => ({ exerciseId: r.exercise_id, lang: r.lang, source: decryptString(r.solution_enc, `code:${user.id}:${r.exercise_id}`) })),
    missing: LANGS.filter((l) => !(data ?? []).some((r) => r.lang === l && r.solved_at)).map((l) => ({ lang: l, exerciseId: counterpart(ex, l)?.id ?? null })),
  });
});
