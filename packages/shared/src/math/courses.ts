import type { MathCourse, MathProblem, MathSubject } from "./types";
import algebra from "../../courses/math/algebra.json";
import precalculus from "../../courses/math/precalculus.json";
import calc1 from "../../courses/math/calc-1.json";
import calc2 from "../../courses/math/calc-2.json";
import calc3 from "../../courses/math/calc-3.json";
import probStats from "../../courses/math/prob-stats.json";

/** Complete semester metadata and unit-aligned practice. Answers stay behind publicProblem(). */
export const MATH_COURSES = [algebra, precalculus, calc1, calc2, calc3, probStats] as MathCourse[];

export const MATH_COURSE_PROBLEMS: MathProblem[] = MATH_COURSES.flatMap((course) =>
  course.units.flatMap((unit) => unit.problems),
);

export function getMathCourse(slug: string): MathCourse | undefined {
  return MATH_COURSES.find((course) => course.slug === slug);
}

export function isMathSubject(slug: string): slug is MathSubject {
  return MATH_COURSES.some((course) => course.slug === slug);
}
