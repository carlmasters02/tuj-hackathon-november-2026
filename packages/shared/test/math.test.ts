import { describe, expect, it } from "vitest";
import { checkSteps, exprEquivalent, MATH_PROBLEMS, parseExpr, parseLine, lineSolutionSet, sameSet, publicProblem, getMathProblem } from "@hm/shared/math/index";

const P = (id: string) => publicProblem(getMathProblem(id)!);

describe("equivalence", () => {
  it("detects equivalent expressions symbolically and numerically", () => {
    expect(exprEquivalent(parseExpr("2(x+3)"), parseExpr("2x+6"))).toBe(true);
    expect(exprEquivalent(parseExpr("(x+2)(x+3)"), parseExpr("x^2+5x+6"))).toBe(true);
    expect(exprEquivalent(parseExpr("(x^2-9)/(x-3)"), parseExpr("x+3"))).toBe(true);
    expect(exprEquivalent(parseExpr("2(x+3)"), parseExpr("2x+3"))).toBe(false);
  });
  it("compares equation solution sets", () => {
    const s = (l: string) => lineSolutionSet(parseLine(l));
    expect(sameSet(s("2x + 3 = 11"), s("x = 4"))).toBe(true);
    expect(sameSet(s("x^2 - x - 12 = 0"), s("x = 4 or x = -3"))).toBe(true);
    expect(sameSet(s("x^2 - x - 12 = 0"), s("x = 4"))).toBe(false);
    expect(s("x + 1 = x + 1").type).toBe("all");
    expect(s("x + 1 = x + 2").type).toBe("none");
  });
  it("rejects non-algebra input", () => {
    expect(() => parseExpr("import('fs')")).toThrow();
    expect(() => parseExpr("y + 2")).toThrow();
    expect(() => parseExpr("x = 3")).toThrow();
  });
});

describe("every bank problem is solvable via its answer", () => {
  for (const p of MATH_PROBLEMS) {
    it(p.id, () => {
      const r = checkSteps(publicProblem(p), [p.answer]);
      expect(r.firstError, JSON.stringify(r)).toBeNull();
      expect(r.complete, r.finalFormMessage).toBe(true);
    });
  }
});

describe("step checking", () => {
  it("accepts a valid chain and marks complete", () => {
    const r = checkSteps(P("lin-3"), ["3x - 6 = 2x + 4", "x - 6 = 4", "x = 10"]);
    expect(r.lines.map((l) => l.status)).toEqual(["ok", "ok", "ok"]);
    expect(r.complete).toBe(true);
  });
  it("flags the first bad line and greys later lines", () => {
    const r = checkSteps(P("lin-3"), ["3x - 6 = 2x + 4", "x = 4 - 6", "x = -2"]);
    expect(r.firstError).toBe(1);
    expect(r.lines[1].message).toBe("Line 2 is not equivalent to line 1.");
    expect(r.lines[2].status).toBe("pending");
  });
  it("requires the final form", () => {
    const r = checkSteps(P("two-1"), ["2x = 8"]);
    expect(r.complete).toBe(false);
    expect(r.finalFormMessage).toMatch(/x = /);
    expect(checkSteps(P("fac-1"), ["x^2 + 2x + 3x + 6"]).complete).toBe(false);
    expect(checkSteps(P("frac-1"), ["6/9"]).complete).toBe(false);
    expect(checkSteps(P("exp-2"), ["x^2 + 3x + 2x + 6"]).finalFormMessage).toMatch(/like terms/);
  });
  it("derivative problems compare against the derivative", () => {
    expect(checkSteps(P("der-1"), ["3*2x + 2"]).complete).toBe(true);
    expect(checkSteps(P("der-1"), ["6x + 2x"]).firstError).toBe(0);
  });
  it("reports parse errors", () => {
    const r = checkSteps(P("two-1"), ["2x + = 3"]);
    expect(r.lines[0].status).toBe("parse_error");
  });
});

describe("hint rules", () => {
  const hintType = (id: string, lines: string[]) => checkSteps(P(id), lines, 3).hints.find((h) => h.tier === 2)?.type;
  const tier3 = (id: string, lines: string[]) => checkSteps(P(id), lines, 3).hints.find((h) => h.tier === 3)?.text;

  it("tier gating", () => {
    const r1 = checkSteps(P("two-1"), ["2x = 14"], 1);
    expect(r1.hints.map((h) => h.tier)).toEqual([1]);
    const r2 = checkSteps(P("two-1"), ["2x = 14"], 2);
    expect(r2.hints.map((h) => h.tier)).toEqual([1, 2]);
  });
  it("sign error", () => {
    expect(hintType("two-1", ["2x = 14"])).toBe("sign_error"); // 11 + 3 instead of 11 - 3
    expect(tier3("two-1", ["2x = 14"])).toMatch(/sign/);
    expect(hintType("two-3", ["-4x = 16", "x = 4"])).toBe("sign_error");
  });
  it("only one side changed", () => {
    expect(hintType("lin-1", ["x = 12"])).toBe("one_side_only");
    expect(tier3("lin-1", ["x = 12"])).toMatch(/left side/);
  });
  it("partial distribution", () => {
    expect(hintType("lin-3", ["3x - 2 = 2x + 4"])).toBe("partial_distribution");
    expect(hintType("exp-1", ["6x - 5"])).toBe("partial_distribution");
  });
  it("divided only one term", () => {
    expect(hintType("frac-2", ["x + 4"])).toBe("divided_one_term");
    expect(hintType("two-1", ["2x + 3 = 11", "x + 3 = 11/2"])).toBe("divided_one_term");
  });
  it("arithmetic slip", () => {
    expect(hintType("lin-4", ["2x - 3 = 9", "2x = 13"])).toBe("arithmetic_slip");
    expect(tier3("lin-4", ["2x - 3 = 9", "2x = 13"])).toMatch(/13/);
  });
});
