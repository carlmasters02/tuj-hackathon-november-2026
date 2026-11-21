import { describe, expect, it } from "vitest";
import { getMathProblem, MATH_COURSES, MATH_COURSE_PROBLEMS, MATH_PROBLEMS, publicProblem } from "@hm/shared/math/index";

const legacyIds = ["lin-1", "pre-1", "der-1", "int-1", "par-1", "prob-1"];

describe("complete semester math pathways", () => {
  it("provides all six courses with twelve instructional units and deep practice", () => {
    expect(MATH_COURSES.map((course) => course.slug)).toEqual(["algebra", "precalculus", "calc-1", "calc-2", "calc-3", "prob-stats"]);
    expect(MATH_COURSES.flatMap((course) => course.units)).toHaveLength(72);
    expect(MATH_COURSE_PROBLEMS.length).toBeGreaterThanOrEqual(288);
    for (const course of MATH_COURSES) {
      expect(course.semester).toContain("15-week");
      expect(course.outcomes.length).toBeGreaterThanOrEqual(4);
      expect(course.units).toHaveLength(12);
      expect(MATH_COURSE_PROBLEMS.filter((p) => p.subject === course.slug).length).toBeGreaterThanOrEqual(48);
      for (const [index, unit] of course.units.entries()) {
        expect(unit.id, unit.id).toBe(`${course.slug}-u${String(index + 1).padStart(2, "0")}`);
        expect(unit.summary.length, unit.id).toBeGreaterThanOrEqual(160);
        expect(unit.objectives.length, unit.id).toBeGreaterThanOrEqual(3);
        expect(unit.problems.length, unit.id).toBeGreaterThanOrEqual(4);
        for (const problem of unit.problems) {
          expect(problem.subject).toBe(course.slug);
          expect(problem.topic).toBe(unit.title);
          expect(problem.prompt.length > 0 || !!problem.statement).toBe(true);
          expect(publicProblem(problem)).not.toHaveProperty("answer");
        }
      }
    }
  });

  it("uses the complete binomial coefficient for a reviewed exact probability", () => {
    // C(5, 2) * (1/3)^2 * (2/3)^3 = 80/243; an omitted coefficient factor once made this 40/243.
    expect(getMathProblem("ps-u05-01")?.answer).toBe("80/243");
  });

  it("adds new unique ids without dropping legacy problem links", () => {
    const ids = MATH_PROBLEMS.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MATH_COURSE_PROBLEMS.length).toBe(MATH_PROBLEMS.length - 59);
    for (const problem of MATH_COURSE_PROBLEMS) expect(ids.filter((id) => id === problem.id)).toHaveLength(1);
    for (const id of legacyIds) expect(ids).toContain(id);
  });
});
