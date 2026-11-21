import { afterAll, describe, expect, it } from "vitest";
import { EXERCISES, counterpart } from "@hm/shared/code/exercises";
import { checkPatterns, grade, hintsUnlocked, lineDiff, normalizeOutput, outputsMatch, publicExercise } from "@hm/shared/code/grading";
import { ERROR_RULES, explainErrors, extractLine } from "@hm/shared/code/errorExplainer";
import { LANGS } from "@hm/shared/code/types";
import { SOLUTIONS } from "./fixtures/solutions";
import { LocalTestRunner } from "./fixtures/localRunner";

const runner = new LocalTestRunner();
afterAll(() => runner.cleanup());
const slug = (id: string) => id.replace(/^[a-z]+-\d+-/, "");

describe("curriculum", () => {
  it("has 12 exercises per language on the same concept ladder", () => {
    for (const l of LANGS) expect(EXERCISES.filter((e) => e.lang === l)).toHaveLength(12);
    const py = EXERCISES.find((e) => e.id === "python-05-largest")!;
    expect(counterpart(py, "java")?.id).toBe("java-05-largest");
  });
  it("public view hides hidden tests and hints", () => {
    const p = publicExercise(EXERCISES[0]);
    expect(p).not.toHaveProperty("tests");
    expect(p).not.toHaveProperty("hints");
    expect(p.hiddenCount).toBeGreaterThan(0);
    expect(JSON.stringify(p)).not.toContain("3000000");
  });
});

describe("every exercise passes with a correct solution (local toolchains)", () => {
  for (const ex of EXERCISES) {
    it(ex.id, async () => {
      const src = SOLUTIONS[slug(ex.id)]?.[ex.lang];
      expect(src, "fixture missing").toBeTruthy();
      const r = await grade(ex, src, runner);
      expect(r.patternIssues, JSON.stringify(r.patternIssues)).toEqual([]);
      expect(r.outcomes.filter((o) => !o.passed).map((o) => ({ i: o.index, s: o.status, a: o.actual, e: o.expected })), r.compileOutput).toEqual([]);
      expect(r.passed).toBe(true);
    }, 30_000);
  }
});

describe("grading", () => {
  it("normalizes trailing whitespace and line endings", () => {
    expect(normalizeOutput("a  \r\nb\t\n\n\n")).toBe("a\nb");
    expect(outputsMatch("7\n", "7")).toBe(true);
    expect(outputsMatch("7 ", "7")).toBe(true);
    expect(outputsMatch(" 7", "7")).toBe(false);
  });
  it("diffs visible output", () => {
    expect(lineDiff("a\nb\nc", "a\nx\nc").map((d) => d.kind)).toEqual(["same", "expected", "actual", "same"]);
  });
  it("hidden tests report counts only; a wrong solution fails them", async () => {
    const ex = EXERCISES.find((e) => e.id === "python-02-even-odd")!;
    const r = await grade(ex, "n = int(input())\nprint('even' if n % 2 == 0 and n > 0 else 'odd')\n", runner);
    expect(r.passed).toBe(false);
    const hidden = r.outcomes.filter((o) => o.hidden);
    expect(hidden.every((o) => o.actual === undefined && o.stdin === undefined)).toBe(true);
    expect(r.hiddenPassed).toBe(1); // -3 → odd passes, 0 → should be even fails
  });
  it("required / forbidden patterns ignore comments and strings", () => {
    const ex = EXERCISES.find((e) => e.id === "python-08-factorial")!;
    expect(checkPatterns(ex, "# for loops are banned\ndef f(n):\n    return 1 if n == 0 else n * f(n - 1)\nprint('while')")).toEqual([]);
    expect(checkPatterns(ex, "t = 1\nfor i in range(5):\n    t *= i")[0].kind).toBe("forbidden");
    const c = EXERCISES.find((e) => e.id === "c-06-vowels")!;
    expect(checkPatterns(c, "char s[9]; gets(s);").map((i) => i.message).join()).toMatch(/fgets/);
  });
  it("hints unlock after 2/4/6 failures", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(hintsUnlocked)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});

describe("error explainer", () => {
  it("has 30 rules per language", () => {
    for (const l of LANGS) expect(ERROR_RULES[l]).toHaveLength(30);
  });
  const cases: [Parameters<typeof explainErrors>[0], string, string, number | null][] = [
    ["python", 'Traceback (most recent call last):\n  File "main.py", line 3, in <module>\n    print("total: " + 5)\nTypeError: can only concatenate str (not "int") to str', "py-concat-str", 3],
    ["python", '  File "main.py", line 2\n    print(x)\n    ^\nIndentationError: expected an indented block after \'if\' statement on line 1', "py-indentation-expected", 2],
    ["python", 'File "main.py", line 4, in <module>\nNameError: name \'totl\' is not defined', "py-nameerror", 4],
    ["python", 'File "main.py", line 7, in f\nRecursionError: maximum recursion depth exceeded', "py-recursion", 7],
    ["python", 'File "main.py", line 1\nZeroDivisionError: division by zero', "py-zerodivision", 1],
    ["python", 'File "main.py", line 5\nIndexError: list index out of range', "py-indexerror", 5],
    ["c", "main.c:5:14: error: expected ';' before 'return'", "c-missing-semicolon", 5],
    ["c", "main.c:3:5: error: implicit declaration of function 'printf' [-Wimplicit-function-declaration]", "c-implicit-decl", 3],
    ["c", "main.c:6:14: warning: format '%d' expects argument of type 'int', but argument 2 has type 'double' [-Wformat=]", "c-format-mismatch", 6],
    ["c", "main.c:8:9: warning: suggest parentheses around assignment used as truth value [-Wparentheses]", "c-assign-in-condition", 8],
    ["c", "main.c:4:9: warning: 'sum' is used uninitialized [-Wuninitialized]", "c-uninitialized", 4],
    ["c", "Segmentation fault (core dumped)", "c-segfault", null],
    ["c", "==1==ERROR: AddressSanitizer: heap-use-after-free on address 0x602000000010\n    #0 0x4011 in main main.c:9", "c-asan-uaf", 9],
    ["c", "main.c:12:11: runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'", "c-ubsan-overflow", 12],
    ["c", "==1==ERROR: LeakSanitizer: detected memory leaks\nDirect leak of 40 byte(s)\n    #1 in main main.c:5", "c-asan-leak", 5],
    ["java", "Main.java:5: error: cannot find symbol\n        Sytem.out.println(x);\n  symbol:   variable Sytem", "java-cannot-find-symbol", 5],
    ["java", "Main.java:7: error: incompatible types: String cannot be converted to int", "java-incompatible-types", 7],
    ["java", "Main.java:9: error: missing return statement", "java-missing-return", 9],
    ["java", "Main.java:1: error: class Solution is public, should be declared in a file named Solution.java", "java-public-class-file", 1],
    ["java", 'Exception in thread "main" java.lang.NullPointerException: Cannot invoke "String.length()"\n\tat Main.main(Main.java:6)', "java-npe", 6],
    ["java", 'Exception in thread "main" java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 5\n\tat Main.main(Main.java:8)', "java-aioobe", 8],
  ];
  for (const [lang, out, rule, line] of cases) {
    it(`${lang}: ${rule}`, () => {
      const ex = explainErrors(lang, out);
      expect(ex.map((e) => e.ruleId)).toContain(rule);
      expect(extractLine(lang, out)).toBe(line);
    });
  }
  it("timeouts", () => {
    expect(explainErrors("python", "", "timeout")[0].ruleId).toBe("py-timeout");
  });
  it("real gcc/javac/python output is explained", async () => {
    const c = await runner.run({ lang: "c", source: "#include <stdio.h>\nint main(void){\n  int x = 3\n  return 0;\n}\n", stdin: "" });
    expect(explainErrors("c", c.compileOutput).map((e) => e.ruleId)).toContain("c-missing-semicolon");
    const j = await runner.run({ lang: "java", source: "public class Main{public static void main(String[] a){\nint x = \"hi\";\n}}\n", stdin: "" });
    expect(explainErrors("java", j.compileOutput).map((e) => e.ruleId)).toContain("java-incompatible-types");
    const p = await runner.run({ lang: "python", source: "x = [1]\nprint(x[3])\n", stdin: "" });
    const pe = explainErrors("python", p.stderr.replace(/File ".*main\.py"/, 'File "main.py"'));
    expect(pe[0].ruleId).toBe("py-indexerror");
    expect(pe[0].line).toBe(2);
  }, 30_000);
});
