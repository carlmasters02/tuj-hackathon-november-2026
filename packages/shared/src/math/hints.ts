import type { MathNode } from "mathjs";
import { exprEquivalent, lineSolutionSet, sameSet } from "./equivalence";
import { math, parseLine, type Line } from "./parse";
import type { Hint, HintType } from "./types";

/**
 * Deterministic, hand-written mistake detectors. Each one rebuilds what the line *would*
 * look like if the student had made that specific mistake and checks whether it matches.
 * They point at the mistake; none of them ever produces the correct next line.
 */

type Term = { node: MathNode; neg: boolean };

const unparen = (n: any): any => (n?.isParenthesisNode ? unparen(n.content) : n);

/** Top-level additive terms with their signs. */
export function terms(node: MathNode, neg = false, out: Term[] = []): Term[] {
  const n: any = unparen(node);
  if (n.isOperatorNode && n.fn === "add" && n.args.length === 2) {
    terms(n.args[0], neg, out);
    terms(n.args[1], neg, out);
  } else if (n.isOperatorNode && n.fn === "subtract" && n.args.length === 2) {
    terms(n.args[0], neg, out);
    terms(n.args[1], !neg, out);
  } else if (n.isOperatorNode && n.fn === "unaryMinus") {
    terms(n.args[0], !neg, out);
  } else out.push({ node: n, neg });
  return out;
}

const str = (n: MathNode) => n.toString({ implicit: "hide", parenthesis: "auto" });

function termsToString(ts: Term[]): string {
  if (ts.length === 0) return "0";
  return ts
    .map((t, i) => {
      const s = `(${str(t.node)})`;
      return i === 0 ? (t.neg ? `-${s}` : s) : t.neg ? ` - ${s}` : ` + ${s}`;
    })
    .join("");
}

const termLabel = (t: Term, first: boolean) => {
  const s = str(t.node);
  return t.neg ? `-${s}` : first ? s : `+${s}`;
};

interface Ctx {
  prev: Line;
  cand: Line;
  variable: string;
  /** is `line` a valid successor of prev? */
  valid: (line: Line) => boolean;
  lineNo: number;
}

const tryParse = (s: string, v: string): Line | null => {
  try {
    return parseLine(s, v);
  } catch {
    return null;
  }
};

function nodesOf(l: Line): MathNode[] {
  if (l.kind === "expression") return [l.expr];
  if (l.parts.length !== 1) return [];
  return [l.parts[0].lhs, l.parts[0].rhs];
}
function rebuild(l: Line, newSides: string[]): string {
  return l.kind === "expression" ? newSides[0] : `${newSides[0]} = ${newSides[1]}`;
}

// 1. sign error: flipping the sign of one term of the candidate line repairs the step
function signError(c: Ctx): Hint[] | null {
  const cs = nodesOf(c.cand);
  if (!cs.length) return null;
  for (let s = 0; s < cs.length; s++) {
    const ts = terms(cs[s]);
    for (let i = 0; i < ts.length; i++) {
      const flipped = ts.map((t, j) => (j === i ? { ...t, neg: !t.neg } : t));
      const newSides = cs.map((n, k) => (k === s ? termsToString(flipped) : str(n)));
      const l = tryParse(rebuild(c.cand, newSides), c.variable);
      if (l && c.valid(l)) {
        const side = c.cand.kind === "equation" ? (s === 0 ? " on the left side" : " on the right side") : "";
        return [
          { tier: 2, type: "sign_error", text: "This looks like a sign error: one term has the wrong sign (+ instead of −, or the reverse)." },
          { tier: 3, type: "sign_error", text: `Check the sign of the term ${termLabel(ts[i], i === 0)}${side} on line ${c.lineNo}. When a term moves across the = sign or comes out of parentheses after a minus, its sign changes.` },
        ];
      }
    }
  }
  // moved a term across "=" without changing its sign
  if (c.prev.kind === "equation" && c.prev.parts.length === 1) {
    const ps = nodesOf(c.prev);
    for (let s = 0; s < 2; s++) {
      const ts = terms(ps[s]);
      for (let i = 0; i < ts.length; i++) {
        const rest = ts.filter((_, j) => j !== i);
        const other = terms(ps[1 - s]).concat([ts[i]]);
        const newSides = s === 0 ? [termsToString(rest), termsToString(other)] : [termsToString(other), termsToString(rest)];
        const vl = tryParse(rebuild(c.prev, newSides), c.variable);
        if (vl && !c.valid(vl) && linesMatch(vl, c.cand, c.variable)) {
          return [
            { tier: 2, type: "sign_error", text: "This looks like a sign error: a term moved to the other side of the = sign but kept its sign." },
            { tier: 3, type: "sign_error", text: `On line ${c.lineNo - 1}, the term ${termLabel(ts[i], i === 0)} moved across the = sign. Moving a term across = means doing the opposite operation, so its sign must change.` },
          ];
        }
      }
    }
  }
  // whole-solution negation (e.g. x = 4 when it should be x = -4)
  if (c.cand.kind === "equation" && c.prev.kind === "equation") {
    try {
      const a = lineSolutionSet(c.prev, c.variable);
      const b = lineSolutionSet(c.cand, c.variable);
      if (a.type === "finite" && b.type === "finite" && a.values.length === 1 && b.values.length === 1 && a.values[0] !== 0 && Math.abs(a.values[0] + b.values[0]) < 1e-6) {
        return [
          { tier: 2, type: "sign_error", text: "This looks like a sign error: your line has the right size of answer but the opposite sign." },
          { tier: 3, type: "sign_error", text: `Compare the signs on line ${c.lineNo} with line ${c.lineNo - 1}, term by term — one of them flipped.` },
        ];
      }
    } catch {}
  }
  return null;
}

// 2. one side only: one side is unchanged while the other side changed
function oneSideOnly(c: Ctx): Hint[] | null {
  if (c.prev.kind !== "equation" || c.cand.kind !== "equation" || c.prev.parts.length !== 1 || c.cand.parts.length !== 1) return null;
  const p = c.prev.parts[0];
  const q = c.cand.parts[0];
  const lSame = exprEquivalent(p.lhs, q.lhs, c.variable);
  const rSame = exprEquivalent(p.rhs, q.rhs, c.variable);
  if (lSame === rSame) return null;
  const [changedOld, changedNew, sideName, otherName] = lSame ? [p.rhs, q.rhs, "right", "left"] : [p.lhs, q.lhs, "left", "right"];
  let op = "changed";
  const constVal = (expr: string): number | null => {
    try {
      const n = math.parse(expr);
      const a = n.evaluate({ [c.variable]: 0.37 });
      const b = n.evaluate({ [c.variable]: 1.91 });
      return typeof a === "number" && Number.isFinite(a) && Math.abs(a - b) < 1e-9 ? a : null;
    } catch {
      return null;
    }
  };
  const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);
  const d = constVal(`(${str(changedNew)}) - (${str(changedOld)})`);
  const r = constVal(`(${str(changedNew)}) / (${str(changedOld)})`);
  if (d !== null && d !== 0) op = `${d > 0 ? "added" : "subtracted"} ${fmt(Math.abs(d))}`;
  else if (r !== null && r !== 1 && r !== 0) op = Math.abs(r) >= 1 ? `multiplied by ${fmt(r)}` : `divided by ${fmt(1 / r)}`;
  if (op === "changed") return null; // a rewrite, not an operation — let the other detectors explain it
  // A side containing a(b + c) that was multiplied out wrongly can differ by a constant by coincidence;
  // that is a distribution mistake, not a one-sided operation.
  if (distributables(changedOld).length && partialDistribution(c)) return null;
  return [
    { tier: 2, type: "one_side_only", text: "It looks like you applied an operation to only one side of the equation. Whatever you do to one side, you must do to the other." },
    { tier: 3, type: "one_side_only", text: `On line ${c.lineNo} you ${op} on the ${sideName} side, but the ${otherName} side is the same as line ${c.lineNo - 1}.` },
  ];
}

/** Finds k·(a + b + …) and −(a + b + …) nodes. */
function distributables(root: MathNode): { node: MathNode; factor: string | null; inner: Term[] }[] {
  const out: { node: MathNode; factor: string | null; inner: Term[] }[] = [];
  root.traverse((n: any) => {
    if (n.isOperatorNode && n.fn === "multiply" && n.args.length === 2) {
      for (const [k, s] of [[0, 1], [1, 0]] as const) {
        const inner = unparen(n.args[s]);
        if (n.args[s].isParenthesisNode && inner.isOperatorNode && (inner.fn === "add" || inner.fn === "subtract")) {
          out.push({ node: n, factor: str(n.args[k]), inner: terms(inner) });
        }
      }
    }
    if (n.isOperatorNode && n.fn === "unaryMinus" && n.args[0].isParenthesisNode) {
      const inner = unparen(n.args[0]);
      if (inner.isOperatorNode && (inner.fn === "add" || inner.fn === "subtract")) out.push({ node: n, factor: null, inner: terms(inner) });
    }
  });
  return out;
}

// 3. partial distribution: a(b + c) → ab + c
function partialDistribution(c: Ctx): Hint[] | null {
  const ps = nodesOf(c.prev);
  for (let s = 0; s < ps.length; s++) {
    for (const d of distributables(ps[s])) {
      if (d.inner.length < 2) continue;
      for (let i = 0; i < d.inner.length; i++) {
        const variant = d.inner
          .map((t, j) => {
            const body = j === i ? (d.factor ? `(${d.factor})*(${str(t.node)})` : `-(${str(t.node)})`) : `(${str(t.node)})`;
            return (t.neg ? " - " : " + ") + body;
          })
          .join("");
        const replaced = ps[s].transform((n) => (n === d.node ? math.parse(`(0 ${variant})`) : n));
        const newSides = ps.map((n, k) => (k === s ? str(replaced) : str(n)));
        const vl = tryParse(rebuild(c.prev, newSides), c.variable);
        if (vl && !c.valid(vl) && linesMatch(vl, c.cand, c.variable)) {
          const what = d.factor ? `${d.factor}(${termsToString(d.inner).replace(/[()]/g, "")})` : `−(${termsToString(d.inner).replace(/[()]/g, "")})`;
          return [
            { tier: 2, type: "partial_distribution", text: "This looks like a partial distribution: when you multiply out parentheses, the outside factor must multiply every term inside." },
            { tier: 3, type: "partial_distribution", text: `Look at ${what} on line ${c.lineNo - 1}: ${d.factor ? `${d.factor} has` : "the minus sign has"} to reach every term inside the parentheses, not just one of them.` },
          ];
        }
      }
    }
  }
  return null;
}

/** Variant line matches candidate: same solution set (equations) or equivalent (expressions). */
function linesMatch(a: Line, b: Line, v: string): boolean {
  try {
    if (a.kind === "expression" && b.kind === "expression") return exprEquivalent(a.expr, b.expr, v);
    if (a.kind === "equation" && b.kind === "equation") return sameSet(lineSolutionSet(a, v), lineSolutionSet(b, v));
  } catch {}
  return false;
}

function numbersIn(...nodes: MathNode[]): number[] {
  const out = new Set<number>();
  for (const n of nodes)
    n.traverse((m: any) => {
      if (m.isConstantNode && typeof m.value === "number" && m.value !== 0 && m.value !== 1) out.add(Math.abs(m.value));
    });
  return [...out].slice(0, 12);
}

// 4. divided only one term: (a + b)/k → a/k + b
function dividedOneTerm(c: Ctx): Hint[] | null {
  const ps = nodesOf(c.prev);
  const cs = nodesOf(c.cand);
  if (!ps.length || !cs.length) return null;
  const ks = numbersIn(...ps, ...cs);
  // expression problems: (sum)/k nodes
  if (c.prev.kind === "expression") {
    let found: Hint[] | null = null;
    ps[0].traverse((n: any) => {
      if (found || !(n.isOperatorNode && n.fn === "divide")) return;
      const num = unparen(n.args[0]);
      if (!(num.isOperatorNode && (num.fn === "add" || num.fn === "subtract"))) return;
      const ts = terms(num);
      const k = str(n.args[1]);
      for (let i = 0; i < ts.length && !found; i++) {
        const variant = ts.map((t, j) => (t.neg ? " - " : " + ") + (j === i ? `(${str(t.node)})/(${k})` : `(${str(t.node)})`)).join("");
        const replaced = ps[0].transform((m) => (m === n ? math.parse(`(0 ${variant})`) : m));
        const vl = tryParse(str(replaced), c.variable);
        if (vl && !c.valid(vl) && linesMatch(vl, c.cand, c.variable)) found = mkDivHint(c, k, termLabel(ts[i], i === 0));
      }
    });
    return found;
  }
  if (ps.length !== 2) return null;
  for (const k of ks) {
    for (let s = 0; s < 2; s++) {
      const ts = terms(ps[s]);
      if (ts.length < 2) continue;
      for (let i = 0; i < ts.length; i++) {
        const variant = ts.map((t, j) => (t.neg ? " - " : " + ") + (j === i ? `(${str(t.node)})/${k}` : `(${str(t.node)})`)).join("");
        const other = `(${str(ps[1 - s])})/${k}`;
        const newSides = s === 0 ? [`0 ${variant}`, other] : [other, `0 ${variant}`];
        const vl = tryParse(rebuild(c.prev, newSides), c.variable);
        if (vl && !c.valid(vl) && linesMatch(vl, c.cand, c.variable)) return mkDivHint(c, String(k), termLabel(ts[i], i === 0));
      }
    }
  }
  return null;
}
const mkDivHint = (c: Ctx, k: string, term: string): Hint[] => [
  { tier: 2, type: "divided_one_term", text: "It looks like you divided only one term. When you divide a side by a number, every term on that side gets divided." },
  { tier: 3, type: "divided_one_term", text: `On line ${c.lineNo} you divided ${term} by ${k}, but the other term(s) on that side of line ${c.lineNo - 1} weren't divided.` },
];

// 5. arithmetic slip: changing a single number in the candidate repairs the step
function arithmeticSlip(c: Ctx): Hint[] | null {
  const cs = nodesOf(c.cand);
  const ps = nodesOf(c.prev);
  if (!cs.length) return null;
  const prevNums = numbersIn(...ps);
  for (let s = 0; s < cs.length; s++) {
    const consts: any[] = [];
    cs[s].traverse((n: any) => {
      if (n.isConstantNode && typeof n.value === "number") consts.push(n);
    });
    for (const target of consts) {
      const v = target.value as number;
      const candidates = new Set<number>([...prevNums, v * 10, v / 10]);
      for (let d = 1; d <= 12; d++) {
        candidates.add(v + d);
        candidates.add(v - d);
      }
      candidates.delete(v);
      for (const nv of candidates) {
        if (nv < 0) continue; // a negative replacement would be a sign error, handled above
        const replaced = cs[s].transform((n) => (n === target ? new math.ConstantNode(nv) : n));
        const newSides = cs.map((n, k) => (k === s ? str(replaced) : str(n)));
        const l = tryParse(rebuild(c.cand, newSides), c.variable);
        if (l && c.valid(l)) {
          return [
            { tier: 2, type: "arithmetic_slip", text: "Your method looks right, but there's an arithmetic slip: one number is off." },
            { tier: 3, type: "arithmetic_slip", text: `Re-check how you got the number ${v} on line ${c.lineNo}.` },
          ];
        }
      }
    }
  }
  return null;
}

const DETECTORS: ((c: Ctx) => Hint[] | null)[] = [signError, oneSideOnly, partialDistribution, dividedOneTerm, arithmeticSlip];

/**
 * Returns hints up to `maxTier` for the first invalid line. Tier 1 always names the line;
 * tier 2 names the mistake type; tier 3 points to the specific term.
 */
export function hintsFor(prev: Line, cand: Line, lineNo: number, variable: string, valid: (l: Line) => boolean, maxTier: 1 | 2 | 3): Hint[] {
  const out: Hint[] = [{ tier: 1, type: "generic", text: `Line ${lineNo} is not equivalent to line ${lineNo - 1}.` }];
  if (maxTier === 1) return out;
  const ctx: Ctx = { prev, cand, variable, valid, lineNo };
  let found: Hint[] | null = null;
  let type: HintType = "generic";
  for (const d of DETECTORS) {
    try {
      found = d(ctx);
    } catch {
      found = null;
    }
    if (found) {
      type = found[0].type;
      break;
    }
  }
  if (!found) {
    found = [
      { tier: 2, type: "generic", text: "This step changes the answer. Re-check each operation you applied going from the line above to this one." },
      { tier: 3, type: "generic", text: `Compare line ${lineNo} with line ${lineNo - 1} one term at a time and check which term doesn't follow.` },
    ];
  }
  void type;
  return out.concat(found.filter((h) => h.tier <= maxTier));
}
