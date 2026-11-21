import { RAW_EXERCISES } from "./exercises.generated";
import { ExerciseSchema, type Exercise, type Lang } from "./types";

/** Server-side bank (includes hidden tests and hints). Validated at load. */
export const EXERCISES: Exercise[] = RAW_EXERCISES.map((e) => ExerciseSchema.parse(e));

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function exercisesFor(lang: Lang): Exercise[] {
  return EXERCISES.filter((e) => e.lang === lang);
}

/** The same exercise in another language (same position on the concept ladder). */
export function counterpart(ex: Exercise, lang: Lang): Exercise | undefined {
  const slug = ex.id.replace(/^[a-z]+-/, "");
  return EXERCISES.find((e) => e.lang === lang && e.id.replace(/^[a-z]+-/, "") === slug);
}
