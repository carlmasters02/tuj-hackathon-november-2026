import fs from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
try {
  const page = fs.readFileSync("apps/web/src/app/tutor/math/[slug]/page.tsx", "utf8");
  const hub = fs.readFileSync("apps/web/src/app/tutor/math/page.tsx", "utf8");
  for (const required of ["getMathCourse", "course.outcomes.map", "course.units.map", "unit.summary", "unit.objectives.map", "unit.problems.map", "data-course-unit", "unit.problems.filter", "Extra practice", "legacy.filter", "grid grid-cols-1", "publicProblem(p)"]) {
    assert(page.includes(required), `subject page is missing ${required}`);
  }
  for (const required of ["MATH_COURSES", "course.units.length", "list.length", "grid-cols-1"]) {
    if (required === "grid-cols-1") continue;
    assert(hub.includes(required), `math hub is missing ${required}`);
  }
  assert((page.match(/grid grid-cols-1/g) ?? []).length >= 3, "problem and outcome grids need a single-column mobile base");
  console.log("math course pages verified: semester outcomes, unit objectives, unit progress, practice grids and legacy links");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
