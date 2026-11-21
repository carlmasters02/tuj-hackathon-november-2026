import type { MathNode } from "mathjs";
import nerdamer from "nerdamer";
import "nerdamer/Algebra.js";
import "nerdamer/Calculus.js";
import "nerdamer/Solve.js";
import { explicit, math, type Line } from "./parse";

const REL_TOL = 1e-9;
const SOL_TOL = 1e-6;

/** Deterministic PRNG so the numeric test is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function evalAt(node: MathNode, variable: string, x: number): number | null {
  try {
    const v = node.evaluate({ [variable]: x });
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

const close = (a: number, b: number, tol = REL_TOL) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** Numeric equivalence at 8 random points (points where either side is undefined are skipped). */
export function numericallyEqual(a: MathNode, b: MathNode, variable = "x", points = 8): boolean {
  const rnd = mulberry32(0x5eed);
  let tested = 0;
  for (let tries = 0; tries < points * 6 && tested < points; tries++) {
    const x = (rnd() * 2 - 1) * 10;
    const fa = evalAt(a, variable, x);
    const fb = evalAt(b, variable, x);
    if (fa === null || fb === null) continue;
    if (!close(fa, fb)) return false;
    tested++;
  }
  return tested >= Math.min(points, 4);
}

/** Expressions equivalent ⇔ simplify(a − b) = 0, or (fallback) numerically equal. */
export function exprEquivalent(a: MathNode, b: MathNode, variable = "x"): boolean {
  try {
    const diff = math.simplify(new math.OperatorNode("-", "subtract", [new math.ParenthesisNode(a), new math.ParenthesisNode(b)]));
    if ((diff as any).isConstantNode && (diff as any).value === 0) return true;
  } catch {}
  return numericallyEqual(a, b, variable);
}

export type SolutionSet = { type: "all" } | { type: "none" } | { type: "finite"; values: number[] };

function dependsOn(node: MathNode, variable: string): boolean {
  const rnd = mulberry32(42);
  let first: number | null = null;
  for (let i = 0; i < 12; i++) {
    const v = evalAt(node, variable, (rnd() * 2 - 1) * 50);
    if (v === null) continue;
    if (first === null) first = v;
    else if (!close(first, v, 1e-9)) return true;
  }
  return false;
}

function verifyRoot(f: MathNode, variable: string, r: number): boolean {
  const v = evalAt(f, variable, r);
  if (v === null) return false;
  // scale tolerance by the function's magnitude near r
  const scale = Math.max(1, Math.abs(evalAt(f, variable, r + 1) ?? 1), Math.abs(evalAt(f, variable, r - 1) ?? 1));
  return Math.abs(v) <= 1e-6 * scale;
}

function numericRoots(f: MathNode, variable: string): number[] {
  const roots: number[] = [];
  const add = (r: number) => {
    if (!roots.some((x) => Math.abs(x - r) < 1e-6)) roots.push(r);
  };
  const N = 8000;
  const lo = -1000;
  const hi = 1000;
  const step = (hi - lo) / N;
  let px = lo;
  let pv = evalAt(f, variable, px);
  for (let i = 1; i <= N; i++) {
    const x = lo + i * step;
    const v = evalAt(f, variable, x);
    if (v !== null && Math.abs(v) < 1e-12) add(x);
    else if (v !== null && pv !== null && Math.sign(v) !== Math.sign(pv)) {
      let a = px, b = x, fa = pv;
      for (let k = 0; k < 80; k++) {
        const m = (a + b) / 2;
        const fm = evalAt(f, variable, m);
        if (fm === null) break;
        if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
      }
      const r = (a + b) / 2;
      if (verifyRoot(f, variable, r)) add(r);
    }
    px = x;
    pv = v;
  }
  return roots;
}

/** Real solution set of lhs = rhs for `variable`. nerdamer first, numeric bracketing as fallback. */
export function solutionSet(lhs: MathNode, rhs: MathNode, variable = "x"): SolutionSet {
  const f = new math.OperatorNode("-", "subtract", [new math.ParenthesisNode(lhs), new math.ParenthesisNode(rhs)]);
  if (!dependsOn(f, variable)) {
    // constant: either an identity (0 = 0) or a contradiction (1 = 0)
    const v = evalAt(f, variable, 0.5) ?? evalAt(f, variable, 1.5);
    return v !== null && Math.abs(v) < 1e-9 ? { type: "all" } : { type: "none" };
  }
  if (numericallyEqual(lhs, rhs, variable)) return { type: "all" };
  let values: number[] | null = null;
  try {
    const sol = (nerdamer as any).solve(`${explicit(lhs)}-(${explicit(rhs)})`, variable) as any;
    const els: any[] = sol.symbol?.elements ?? [];
    values = [];
    for (const el of els) {
      const txt = nerdamer(el.toString()).evaluate().text("decimals");
      if (/i/.test(txt)) continue; // complex root
      const n = Number(txt);
      if (Number.isFinite(n) && verifyRoot(f, variable, n)) values.push(n);
    }
    // nerdamer occasionally misses roots of rational equations; cross-check when it found none
    if (values.length === 0) values = numericRoots(f, variable);
  } catch {
    values = numericRoots(f, variable);
  }
  const uniq: number[] = [];
  for (const v of values.sort((a, b) => a - b)) if (!uniq.some((u) => Math.abs(u - v) < SOL_TOL)) uniq.push(v);
  return uniq.length ? { type: "finite", values: uniq } : { type: "none" };
}

export function unionSets(sets: SolutionSet[]): SolutionSet {
  if (sets.some((s) => s.type === "all")) return { type: "all" };
  const vals: number[] = [];
  for (const s of sets) if (s.type === "finite") for (const v of s.values) if (!vals.some((u) => Math.abs(u - v) < SOL_TOL)) vals.push(v);
  return vals.length ? { type: "finite", values: vals.sort((a, b) => a - b) } : { type: "none" };
}

export function sameSet(a: SolutionSet, b: SolutionSet): boolean {
  if (a.type !== b.type) return false;
  if (a.type !== "finite" || b.type !== "finite") return true;
  if (a.values.length !== b.values.length) return false;
  return a.values.every((v, i) => Math.abs(v - b.values[i]) <= SOL_TOL * Math.max(1, Math.abs(v)));
}

export function lineSolutionSet(line: Line, variable = "x"): SolutionSet {
  if (line.kind !== "equation") throw new Error("not an equation");
  return unionSets(line.parts.map((p) => solutionSet(p.lhs, p.rhs, variable)));
}
