import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const slugs = ["algebra", "precalculus", "calc-1", "calc-2", "calc-3", "prob-stats"];
const prefixes = { algebra: "alg", precalculus: "pre", "calc-1": "c1", "calc-2": "c2", "calc-3": "c3", "prob-stats": "ps" };
const kinds = new Set(["equation", "expression", "derivative", "partial", "antiderivative", "value"]);
const forms = new Set(["isolated", "solutions", "expanded", "factored", "fraction_lowest", "no_division", "polynomial", "exact", "number", "antiderivative", "any"]);
const args = process.argv.slice(2);
const one = args[0] === "--course" ? args[1] : null;
const all = args.includes("--all");
const docs = args.includes("--docs");
if ((!one && !all) || args.some((a) => !["--course", "--all", "--docs"].includes(a) && a !== one)) {
  console.error("Usage: node scripts/check-math-course.mjs --course <slug> [--docs] | --all [--docs]");
  process.exit(2);
}
if (one && !slugs.includes(one)) throw new Error(`Unknown course: ${one}`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function text(value, minimum, label) {
  assert(typeof value === "string" && value.trim().length >= minimum, `${label} needs at least ${minimum} non-whitespace characters`);
}
function load(slug) {
  const file = path.join(root, "packages/shared/courses/math", `${slug}.json`);
  const course = JSON.parse(fs.readFileSync(file, "utf8"));
  assert(course.slug === slug, `${slug}: slug mismatch`);
  text(course.title, 5, `${slug}: title`);
  text(course.semester, 15, `${slug}: semester`);
  assert(course.semester.includes("15-week") && course.semester.includes("12 instructional units"), `${slug}: honest semester label missing`);
  text(course.description, 80, `${slug}: description`);
  assert(Array.isArray(course.outcomes) && course.outcomes.length >= 4, `${slug}: at least four course outcomes required`);
  course.outcomes.forEach((s, i) => text(s, 25, `${slug}: course outcome ${i + 1}`));
  assert(Array.isArray(course.units) && course.units.length === 12, `${slug}: exactly 12 units required`);
  const seenUnitIds = new Set();
  const seenProblemIds = new Set();
  const seenPrompts = new Set();
  const seenTopics = new Set();
  course.units.forEach((unit, ui) => {
    const at = `${slug} unit ${ui + 1}`;
    assert(unit.id === `${slug}-u${String(ui + 1).padStart(2, "0")}`, `${at}: id must be ${slug}-u${String(ui + 1).padStart(2, "0")}`);
    assert(!seenUnitIds.has(unit.id), `${at}: duplicate unit id`);
    seenUnitIds.add(unit.id);
    text(unit.week, 5, `${at}: week`);
    assert(/Week/.test(unit.week), `${at}: week must map to the semester`);
    text(unit.title, 4, `${at}: title`);
    assert(!seenTopics.has(unit.title), `${at}: duplicate title`);
    seenTopics.add(unit.title);
    text(unit.summary, 160, `${at}: summary`);
    assert(Array.isArray(unit.objectives) && unit.objectives.length >= 3, `${at}: at least three objectives required`);
    unit.objectives.forEach((s, i) => text(s, 25, `${at}: objective ${i + 1}`));
    assert(Array.isArray(unit.problems) && unit.problems.length >= 4, `${at}: at least four problems required`);
    assert(new Set(unit.problems.map((p) => p.difficulty)).size >= 2, `${at}: include meaningful difficulty variation`);
    unit.problems.forEach((p, pi) => {
      const where = `${at} problem ${pi + 1}`;
      const id = `${prefixes[slug]}-u${String(ui + 1).padStart(2, "0")}-${String(pi + 1).padStart(2, "0")}`;
      assert(p.id === id, `${where}: id must be ${id}`);
      assert(!seenProblemIds.has(p.id), `${where}: duplicate id`);
      seenProblemIds.add(p.id);
      assert(p.subject === slug, `${where}: wrong subject`);
      assert(p.topic === unit.title, `${where}: topic must exactly match unit title`);
      assert([1, 2, 3].includes(p.difficulty), `${where}: invalid difficulty`);
      assert(kinds.has(p.kind), `${where}: unsupported kind`);
      assert(forms.has(p.finalForm), `${where}: unsupported final form`);
      text(p.answer, 1, `${where}: answer`);
      assert(typeof p.start === "string" && typeof p.variable === "string" && p.variable.length === 1, `${where}: start/variable missing`);
      assert(typeof p.prompt === "string" && (p.prompt.trim() || (typeof p.statement === "string" && p.statement.trim())), `${where}: visible prompt or statement required`);
      if (p.statement !== undefined) text(p.statement, 20, `${where}: statement`);
      if (p.kind === "value") {
        assert(p.finalForm === "number" && /^-?(?:\d+|\d+\/\d+)$/.test(p.answer), `${where}: value answers must be simple integers or reduced fractions`);
        const fraction = p.answer.match(/^(-?\d+)\/(\d+)$/);
        if (fraction) {
          let [a, b] = [Math.abs(Number(fraction[1])), Number(fraction[2])];
          assert(b > 0, `${where}: zero denominator`);
          while (b) [a, b] = [b, a % b];
          assert(a === 1, `${where}: fraction is not reduced`);
        }
      }
      if (p.kind === "antiderivative") assert(p.finalForm === "antiderivative" && /(?:^|[^A-Za-z])C(?:$|[^A-Za-z])/.test(p.answer), `${where}: antiderivative answer needs + C`);
      const fingerprint = `${p.statement ?? ""}|${p.prompt}`.replace(/\s+/g, " ").trim();
      assert(!seenPrompts.has(fingerprint), `${where}: duplicate prompt`);
      seenPrompts.add(fingerprint);
    });
  });
  return { course, newProblems: seenProblemIds.size };
}

try {
  const selected = one ? [one] : slugs;
  const loaded = selected.map(load);
  if (all) {
    const units = loaded.reduce((n, c) => n + c.course.units.length, 0);
    const count = loaded.reduce((n, c) => n + c.newProblems, 0);
    assert(units === 72, `expected 72 units; measured ${units}`);
    assert(count >= 288, `expected at least 288 new problems; measured ${count}`);
    if (docs) {
      const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
      const decisions = fs.readFileSync(path.join(root, "DECISIONS.md"), "utf8");
      assert(readme.includes(`${count + 59} problems`) && readme.includes("72 units"), `README must report ${count + 59} total problems and 72 units`);
      assert(decisions.includes("Semester-length math pathways"), "DECISIONS must record the math curriculum decision");
      console.log(`final math curriculum and documentation verified: 6 courses, 72 units, ${count} new and 59 legacy problems`);
    } else {
      console.log(`all math curricula verified: 6 courses, 72 units, ${count} new problems and 59 retained legacy problems`);
    }
  } else {
    const { newProblems } = loaded[0];
    console.log(`${one} curriculum verified: 12 units, ${newProblems} new problems`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
