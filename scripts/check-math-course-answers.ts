import fs from "node:fs";
import { checkSteps, publicProblem } from "../packages/shared/src/math/check";
import type { MathProblem } from "../packages/shared/src/math/types";

const arg = process.argv[2];
const slugs = ["algebra", "precalculus", "calc-1", "calc-2", "calc-3", "prob-stats"];
if (arg !== "--all" && !slugs.includes(arg)) {
  console.error("Usage: pnpm exec tsx scripts/check-math-course-answers.ts <slug>|--all");
  process.exit(2);
}

function verify(problem: MathProblem) {
  const result = checkSteps(problem, [problem.answer]);
  if (result.firstError !== null || !result.complete) {
    throw new Error(`${problem.id}: answer rejected (${result.lines.find((line) => line.status !== "ok")?.message ?? result.finalFormMessage ?? "incomplete"})`);
  }
  if ("answer" in publicProblem(problem)) throw new Error(`${problem.id}: public problem leaked its answer`);
}

async function main() {
  try {
    if (arg !== "--all") {
    const course = JSON.parse(fs.readFileSync(`packages/shared/courses/math/${arg}.json`, "utf8")) as { units: { problems: MathProblem[] }[] };
    const problems = course.units.flatMap((unit) => unit.problems);
    if (problems.length < 48) throw new Error(`${arg}: expected at least 48 problems`);
    for (const problem of problems) verify(problem);
    console.log(`${arg} answers verified: ${problems.length} StepCheck problems`);
  } else {
    const { MATH_COURSES } = await import("../packages/shared/src/math/courses");
    const { MATH_PROBLEMS } = await import("../packages/shared/src/math/problems");
    const legacyDir = "packages/shared/problems/math";
    const legacyIds = fs.readdirSync(legacyDir).filter((file) => file.endsWith(".json")).flatMap((file) =>
      (JSON.parse(fs.readFileSync(`${legacyDir}/${file}`, "utf8")) as MathProblem[]).map((problem) => problem.id),
    );
    const currentIds = MATH_PROBLEMS.map((problem) => problem.id);
    if (new Set(currentIds).size !== currentIds.length) throw new Error("duplicate ids in integrated math bank");
    for (const id of legacyIds) {
      if (currentIds.filter((current) => current === id).length !== 1) throw new Error(`legacy problem missing or duplicated: ${id}`);
    }
    const newProblems = MATH_COURSES.flatMap((course) => course.units.flatMap((unit) => unit.problems));
    if (newProblems.length < 288) throw new Error("fewer than 288 new problems in integrated bank");
    for (const id of newProblems.map((problem) => problem.id)) {
      if (currentIds.filter((current) => current === id).length !== 1) throw new Error(`new problem missing or duplicated: ${id}`);
    }
    for (const problem of MATH_PROBLEMS) verify(problem);
    console.log(`all math answers verified: ${MATH_PROBLEMS.length} integrated problems (${newProblems.length} new, ${legacyIds.length} legacy)`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void main();
