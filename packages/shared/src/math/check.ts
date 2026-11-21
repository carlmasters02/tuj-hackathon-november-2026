import type { MathNode } from "mathjs";
import { constValue, exprEquivalent, lineSolutionSet, numericallyEqual, sameSet, sameValue, type SolutionSet } from "./equivalence";
import { hintsFor } from "./hints";
import { MathInputError, math, parseExpr, parseLine, type Line } from "./parse";
import type { FinalForm, Hint, MathProblem, PublicMathProblem } from "./types";

export type LineStatus = "ok" | "error" | "parse_error" | "pending";

export interface LineResult {
  index: number; // 0-based index into the student's lines
  status: LineStatus;
  message?: string;
}

export interface CheckResult {
  lines: LineResult[];
  firstError: number | null;
  complete: boolean;
  finalFormMessage?: string;
  hints: Hint[];
}

export const MAX_LINES = 30;

const unparen = (n: any): any => (n?.isParenthesisNode ? unparen(n.content) : n);

/** A problem as the server sees it: `answer` is needed for "value" problems and never sent to browsers. */
export type CheckableProblem = PublicMathProblem & { answer?: string };

const symbolsOf = (p: PublicMathProblem) => p.symbols ?? [];

function startLine(p: CheckableProblem): Line {
  const sy = symbolsOf(p);
  if (p.kind === "derivative" || p.kind === "partial") {
    const d = math.derivative(parseExpr(p.start, p.variable, sy), p.variable);
    return { kind: "expression", expr: d, raw: d.toString() };
  }
  if (p.kind === "antiderivative") {
    const f = parseExpr(p.start, p.variable, sy);
    return { kind: "expression", expr: f, raw: p.start };
  }
  if (p.kind === "value") {
    if (!p.answer) throw new Error("value problems are checked on the server only");
    const a = parseExpr(p.answer, p.variable, sy);
    return { kind: "expression", expr: a, raw: p.answer };
  }
  return parseLine(p.start, p.variable, sy);
}

/** Replace the constant of integration with 0 so lines can be differentiated and evaluated. */
const withoutC = (n: MathNode): MathNode => n.transform((m: any) => (m.isSymbolNode && m.name === "C" ? new math.ConstantNode(0) : m));

function hasSymbol(node: MathNode, name: string): boolean {
  let found = false;
  node.traverse((n: any, path: string, parent: any) => {
    if (n.isSymbolNode && n.name === name && !(parent?.isFunctionNode && path === "fn")) found = true;
  });
  return found;
}

function hasVar(node: MathNode, v: string): boolean {
  let found = false;
  node.traverse((n: any) => {
    if (n.isSymbolNode && n.name === v) found = true;
  });
  return found;
}

function isNumberLiteral(node: MathNode): boolean {
  const n: any = unparen(node);
  if (n.isConstantNode) return true;
  if (n.isOperatorNode && n.fn === "unaryMinus") return isNumberLiteral(n.args[0]);
  if (n.isOperatorNode && n.fn === "divide") return isNumberLiteral(n.args[0]) && isNumberLiteral(n.args[1]) && fractionLowest(n);
  if (n.isFunctionNode && n.fn.name === "sqrt") return n.args.every((a: any) => !hasVar(a, "x"));
  return false;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function fractionLowest(node: any): boolean {
  const n = unparen(node);
  const num = unparen(n.args[0]);
  const den = unparen(n.args[1]);
  const val = (x: any): number | null => (x.isConstantNode ? x.value : x.isOperatorNode && x.fn === "unaryMinus" && unparen(x.args[0]).isConstantNode ? -unparen(x.args[0]).value : null);
  const a = val(num);
  const b = val(den);
  if (a === null || b === null || !Number.isInteger(a) || !Number.isInteger(b)) return false;
  return Math.abs(b) > 1 && gcd(a, b) === 1 && b > 0;
}

function countTerms(node: MathNode): number {
  const n: any = unparen(node);
  if (n.isOperatorNode && (n.fn === "add" || n.fn === "subtract") && n.args.length === 2) return countTerms(n.args[0]) + countTerms(n.args[1]);
  return 1;
}

function hasParenSum(node: MathNode): boolean {
  let found = false;
  node.traverse((n: any) => {
    if (n.isParenthesisNode) {
      const c = unparen(n);
      if (c.isOperatorNode && (c.fn === "add" || c.fn === "subtract")) found = true;
    }
  });
  return found;
}

function hasDivisionByVar(node: MathNode, v: string): boolean {
  let found = false;
  node.traverse((n: any) => {
    if (n.isOperatorNode && n.fn === "divide" && hasVar(n.args[1], v)) found = true;
  });
  return found;
}

function polyDegreeAndTerms(node: MathNode, _v: string): { degree: number; nonzero: number } | null {
  try {
    const r: any = math.rationalize(node.toString(), {}, true);
    if (r.denominator && !(r.denominator.isConstantNode && r.denominator.value === 1)) return null;
    const coeffs: number[] = r.coefficients ?? [];
    if (!coeffs.length) return { degree: 0, nonzero: 1 };
    return { degree: coeffs.length - 1, nonzero: coeffs.filter((c) => Math.abs(c) > 1e-12).length };
  } catch {
    return null;
  }
}

function isFactored(node: MathNode, v: string): boolean {
  let n: any = unparen(node);
  if (n.isOperatorNode && n.fn === "unaryMinus") n = unparen(n.args[0]);
  const total = polyDegreeAndTerms(node, v);
  if (!total || total.degree < 2) return false;
  const factors: any[] = [];
  const collect = (m: any) => {
    m = unparen(m);
    if (m.isOperatorNode && m.fn === "multiply") m.args.forEach(collect);
    else factors.push(m);
  };
  if (n.isOperatorNode && n.fn === "pow") factors.push(n);
  else collect(n);
  const nonConst = factors.filter((f) => hasVar(f, v));
  if (nonConst.length === 1 && !(unparen(nonConst[0]).isOperatorNode && unparen(nonConst[0]).fn === "pow")) return false;
  // every non-constant factor must have lower degree than the whole polynomial
  return nonConst.every((f) => {
    const d = polyDegreeAndTerms(unparen(f).fn === "pow" ? unparen(f).args[0] : f, v);
    return d !== null && d.degree < total.degree;
  });
}

/** Does the final line have the required form? Returns an error message, or null when OK. */
export function finalFormProblem(line: Line, form: FinalForm, v: string): string | null {
  switch (form) {
    case "isolated":
    case "solutions": {
      if (line.kind !== "equation") return `Finish with ${v} = (a number).`;
      if (form === "isolated" && line.parts.length !== 1) return `Finish with a single ${v} = (a number).`;
      for (const p of line.parts) {
        const l: any = unparen(p.lhs);
        const r: any = unparen(p.rhs);
        const lv = l.isSymbolNode && l.name === v && !hasVar(p.rhs, v) && isNumberLiteral(p.rhs);
        const rv = r.isSymbolNode && r.name === v && !hasVar(p.lhs, v) && isNumberLiteral(p.lhs);
        if (!lv && !rv) return `Not finished yet: the last line should be ${v} = (a simplified number)${form === "solutions" ? `, e.g. ${v} = 2 or ${v} = -3` : ""}.`;
      }
      return null;
    }
    case "expanded":
    case "polynomial": {
      if (line.kind !== "expression") return "The answer should be an expression, not an equation.";
      if (hasParenSum(line.expr)) return "Not finished yet: there are still parentheses to multiply out.";
      const p = polyDegreeAndTerms(line.expr, v);
      if (p && countTerms(line.expr) > p.nonzero) return "Not finished yet: combine like terms.";
      return null;
    }
    case "factored":
      if (line.kind !== "expression") return "The answer should be an expression, not an equation.";
      return isFactored(line.expr, v) ? null : "Not finished yet: write it as a product of factors.";
    case "fraction_lowest": {
      if (line.kind !== "expression") return "The answer should be a number.";
      const n: any = unparen(line.expr);
      if (n.isConstantNode && Number.isInteger(n.value)) return null;
      if (n.isOperatorNode && n.fn === "unaryMinus" && unparen(n.args[0]).isConstantNode) return null;
      if (n.isOperatorNode && n.fn === "divide" && fractionLowest(n)) return null;
      return "Not finished yet: reduce the fraction to lowest terms (numerator and denominator share no factor).";
    }
    case "exact": {
      if (line.kind !== "equation") return `Finish with ${v} = (an exact value).`;
      for (const p of line.parts) {
        const l: any = unparen(p.lhs);
        const r: any = unparen(p.rhs);
        const ok = (l.isSymbolNode && l.name === v && !hasVar(p.rhs, v)) || (r.isSymbolNode && r.name === v && !hasVar(p.lhs, v));
        if (!ok) return `Not finished yet: the last line should be ${v} = (an exact value), e.g. ${v} = 2 + sqrt(3).`;
      }
      return null;
    }
    case "number": {
      if (line.kind !== "expression") return "The answer should be a number.";
      let n: any = unparen(line.expr);
      if (n.isOperatorNode && n.fn === "unaryMinus") n = unparen(n.args[0]);
      if (n.isConstantNode) return null;
      if (n.isOperatorNode && n.fn === "divide" && fractionLowest(n)) return null;
      return "Not finished yet: finish with a single number, a decimal, or a fraction in lowest terms.";
    }
    case "antiderivative":
      if (line.kind !== "expression") return "The answer should be an expression.";
      return hasSymbol(line.expr, "C") ? null : "Almost: every antiderivative needs the constant of integration. Add + C.";
    case "any":
      return line.kind === "expression" ? null : "The answer should be an expression.";
    case "no_division":
      if (line.kind !== "expression") return "The answer should be an expression.";
      if (hasDivisionByVar(line.expr, v) || hasParenSum(line.expr)) return "Not finished yet: cancel common factors and simplify fully.";
      {
        const p = polyDegreeAndTerms(line.expr, v);
        if (p && countTerms(line.expr) > p.nonzero) return "Not finished yet: combine like terms.";
      }
      return null;
  }
}

export function publicProblem(p: MathProblem): PublicMathProblem {
  const { answer: _answer, ...rest } = p;
  return rest;
}

/**
 * Checks each line against the previous one (the first against the problem's start).
 * Stops at the first invalid line; later lines are "pending" (greyed out in the UI).
 */
export function checkSteps(problem: CheckableProblem, rawLines: string[], maxHintTier: 1 | 2 | 3 = 1): CheckResult {
  const v = problem.variable;
  const sy = symbolsOf(problem);
  const lines = rawLines.map((l) => l.trim()).filter((l, i, arr) => l.length > 0 || i < arr.length - 1).slice(0, MAX_LINES);
  const results: LineResult[] = lines.map((_, i) => ({ index: i, status: "pending" as LineStatus }));
  const start = startLine(problem);
  let prev = start;
  let prevSet: SolutionSet | null = problem.kind === "equation" ? lineSolutionSet(prev, v) : null;
  let firstError: number | null = null;
  let hints: Hint[] = [];
  const target = problem.kind === "value" && start.kind === "expression" ? constValue(start.expr) : null;

  for (let i = 0; i < lines.length; i++) {
    let cur: Line;
    try {
      cur = parseLine(lines[i], v, problem.kind === "antiderivative" ? [...sy, "C"] : sy);
    } catch (e) {
      results[i] = { index: i, status: "parse_error", message: e instanceof MathInputError ? `Couldn't read line ${i + 1}: ${e.message}` : `Couldn't read line ${i + 1}.` };
      firstError = i;
      break;
    }
    const expectEquation = problem.kind === "equation";
    if (expectEquation !== (cur.kind === "equation")) {
      results[i] = { index: i, status: "error", message: expectEquation ? `Line ${i + 1} should be an equation (with =).` : `Line ${i + 1} should be an expression (no =).` };
      firstError = i;
      break;
    }
    const targetSet = prevSet;
    const valid = (l: Line): boolean => {
      try {
        if (expectEquation) return l.kind === "equation" && sameSet(lineSolutionSet(l, v), targetSet!);
        if (l.kind !== "expression" || start.kind !== "expression") return false;
        if (problem.kind === "antiderivative") {
          const d = math.derivative(withoutC(l.expr), v);
          return exprEquivalent(d, start.expr, v, sy) || numericallyEqual(d, start.expr, v, 8, sy);
        }
        if (problem.kind === "value") {
          if (hasVar(l.expr, v)) return false;
          const val = constValue(l.expr);
          return val !== null && target !== null && sameValue(val, target);
        }
        return exprEquivalent((prev as Extract<Line, { kind: "expression" }>).expr, l.expr, v, sy);
      } catch {
        return false;
      }
    };
    if (!valid(cur)) {
      const lineNo = i + 1;
      const message =
        problem.kind === "antiderivative"
          ? `Line ${lineNo} doesn't differentiate back to the integrand.`
          : problem.kind === "value"
            ? i === 0 ? "Line 1 doesn't equal the value asked for." : `Line ${lineNo} doesn't equal line ${lineNo - 1}.`
            : i === 0 ? `Line 1 is not equivalent to the problem.` : `Line ${lineNo} is not equivalent to line ${lineNo - 1}.`;
      results[i] = { index: i, status: "error", message };
      firstError = i;
      hints =
        problem.kind === "antiderivative" || problem.kind === "value"
          ? kindHints(problem.kind, message, i, maxHintTier)
          : hintsFor(prev, cur, lineNo, v, valid, maxHintTier).map((h) =>
              i === 0 && h.tier === 1 ? { ...h, text: "Line 1 is not equivalent to the problem." } : i === 0 ? { ...h, text: h.text.replace(/line 0/g, "the problem") } : h,
            );
      break;
    }
    results[i] = { index: i, status: "ok" };
    prev = cur;
    if (expectEquation) prevSet = lineSolutionSet(cur, v);
  }

  let complete = false;
  let finalFormMessage: string | undefined;
  if (firstError === null && lines.length > 0) {
    const fp = finalFormProblem(prev, problem.finalForm, v);
    if (fp) finalFormMessage = fp;
    else complete = true;
  }
  return { lines: results, firstError, complete, finalFormMessage, hints };
}

/** Hints for integrals and computed values. They point at what to check, never at the answer. */
function kindHints(kind: "antiderivative" | "value", where: string, i: number, maxTier: 1 | 2 | 3): Hint[] {
  const all: Hint[] =
    kind === "antiderivative"
      ? [
          { tier: 1, type: "generic", text: where },
          { tier: 2, type: "generic", text: "Differentiate your line yourself. The result should be exactly the integrand; find the term where it isn't." },
          { tier: 3, type: "generic", text: "Check one term at a time. For x^n you add one to the power and divide by the new power; for something like e^(3x) or sin(2x), remember the inner factor when you differentiate back." },
        ]
      : [
          { tier: 1, type: "generic", text: where },
          { tier: 2, type: "generic", text: i === 0 ? "Re-read the question: is this the quantity it asks for, set up the right way?" : "This line's value differs from the line above. Evaluate each part of both lines separately." },
          { tier: 3, type: "generic", text: i === 0 ? "Write the setup first (the formula with the numbers in it) before simplifying, then simplify one operation per line." : "Look for an order-of-operations slip, a sign, or a power applied to the wrong part." },
        ];
  return all.filter((h) => h.tier <= maxTier);
}
