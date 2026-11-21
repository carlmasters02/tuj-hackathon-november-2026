/**
 * Live end-to-end check of the Piston adapter + grader. Bundled with esbuild and executed
 * *inside* the Piston container (see README → "Verifying the code runner"), because the dev
 * sandbox can't reach container ports from the host.
 */
import "./node15-fetch";
import { EXERCISES } from "../../src/code/exercises";
import { grade } from "../../src/code/grading";
import { explainErrors } from "../../src/code/errorExplainer";
import { PistonRunner } from "../../../../apps/web/src/lib/code/runners";
import { SOLUTIONS } from "../fixtures/solutions";

const runner = new PistonRunner(process.env.PISTON_URL ?? "http://localhost:2000");
(async () => {
  let ok = 0;
  const fails: string[] = [];
  for (const ex of EXERCISES) {
    const src = SOLUTIONS[ex.id.replace(/^[a-z]+-\d+-/, "")][ex.lang];
    const r = await grade(ex, src, runner);
    if (r.passed) ok++;
    else fails.push(`${ex.id}: ${r.testsPassed}/${r.testsTotal} ${JSON.stringify(r.outcomes.find((o) => !o.passed))} ${r.compileOutput ?? ""}`);
  }
  console.log(`graded ${EXERCISES.length} reference solutions on Piston: ${ok} passed`);
  for (const f of fails) console.log("FAIL", f.slice(0, 600));
  // wrong answers & errors come back explained
  const probes: [string, string, string][] = [
    ["c", "#include <stdio.h>\nint main(void){\n  int x = 3\n  return 0;\n}\n", "c-missing-semicolon"],
    ["c", "#include <stdio.h>\nint main(void){int *p=0; printf(\"%d\\n\", *p); return 0;}\n", "c-segfault"],
    ["java", "public class Main{public static void main(String[] a){\nint x = \"hi\";\n}}\n", "java-incompatible-types"],
    ["java", "public class Main{public static void main(String[] a){\nint[] v=new int[2];\nSystem.out.println(v[5]);\n}}\n", "java-aioobe"],
    ["python", "x = [1]\nprint(x[3])\n", "py-indexerror"],
    ["python", "while True:\n    pass\n", "py-timeout"],
  ];
  for (const [lang, src, want] of probes) {
    const r = await runner.run({ lang: lang as any, source: src, stdin: "" });
    const got = explainErrors(lang as any, r.compileOutput || r.stderr, r.status, src);
    console.log(got.some((g) => g.ruleId === want) ? "ok  " : "MISS", want, r.status, got.map((g) => `${g.ruleId}@${g.line}`).join(","), got.length ? "" : JSON.stringify((r.compileOutput || r.stderr).slice(0, 300)));
  }
})();
