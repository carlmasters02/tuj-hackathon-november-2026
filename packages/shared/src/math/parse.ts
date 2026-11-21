import { create, all, type MathNode } from "mathjs";

export const math = create(all, {});

export class MathInputError extends Error {}

/** Normalizes typographic symbols students paste/type. */
export function normalizeInput(s: string): string {
  return s
    .replace(/[−–—]/g, "-")
    .replace(/[×·∙]/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\*\*/g, "^")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/\bln\s*\(/g, "log(")
    .trim();
}

/** Functions students may use. C(n,k)/nCr and P(n,k)/nPr are rewritten to combinations/permutations. */
const ALLOWED_FUNCS = new Set(["sqrt", "abs", "log", "log10", "log2", "exp", "sin", "cos", "tan", "factorial", "combinations", "permutations", "C", "P", "nCr", "nPr"]);
const RENAME: Record<string, string> = { C: "combinations", nCr: "combinations", P: "permutations", nPr: "permutations" };

/**
 * Parses an expression and rejects anything outside school math: no assignments, no unknown
 * functions, and no letters other than the problem's variable, its extra constants, pi and e.
 */
export function parseExpr(input: string, variable = "x", symbols: readonly string[] = []): MathNode {
  const src = normalizeInput(input);
  if (!src) throw new MathInputError("empty expression");
  if (src.length > 300) throw new MathInputError("expression too long");
  if (/[=<>:;"'`[\]{}]/.test(src) || /!=/.test(src)) throw new MathInputError("unexpected symbol");
  let node: MathNode;
  try {
    node = math.parse(src);
  } catch (e) {
    throw new MathInputError((e as Error).message);
  }
  const fnNames = new Set<unknown>();
  node.traverse((n: any) => {
    if (n.isFunctionNode) {
      if (!ALLOWED_FUNCS.has(n.fn?.name)) throw new MathInputError(`function "${n.fn?.name}" isn't allowed`);
      fnNames.add(n.fn);
    }
  });
  const known = new Set([variable, ...symbols, "pi", "e"]);
  node.traverse((n: any) => {
    if (n.isSymbolNode && !fnNames.has(n) && !known.has(n.name)) {
      throw new MathInputError(`unknown symbol "${n.name}" (use ${[variable, ...symbols].join(", ")})`);
    }
    if (n.isAssignmentNode || n.isFunctionAssignmentNode || n.isAccessorNode || n.isIndexNode || n.isObjectNode || n.isArrayNode || n.isRangeNode || n.isBlockNode || n.isConditionalNode || n.isRelationalNode)
      throw new MathInputError("only plain math is allowed");
    if (n.isConstantNode && typeof n.value !== "number") throw new MathInputError("only numbers are allowed");
  });
  return node.transform((n: any) => (n.isFunctionNode && RENAME[n.fn.name] ? new math.FunctionNode(new math.SymbolNode(RENAME[n.fn.name]), n.args) : n));
}

/** Split on commas/semicolons/"or" that are not inside parentheses. */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && (ch === "," || ch === ";")) {
      out.push(cur);
      cur = "";
      continue;
    }
    if (depth === 0 && /^\s+or\s+/i.test(s.slice(i))) {
      const m = s.slice(i).match(/^\s+or\s+/i)!;
      out.push(cur);
      cur = "";
      i += m[0].length - 1;
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((p) => p.trim()).filter(Boolean);
}

export type Line =
  | { kind: "expression"; expr: MathNode; raw: string }
  | { kind: "equation"; parts: { lhs: MathNode; rhs: MathNode }[]; raw: string };

/**
 * A line is an expression, an equation `a = b`, or a disjunction of equations
 * `x = 2 or x = -3` (also accepts "," / ";" separators when every part has "=").
 */
export function parseLine(raw: string, variable = "x", symbols: readonly string[] = []): Line {
  const s = normalizeInput(raw);
  if (!s.includes("=")) return { kind: "expression", expr: parseExpr(s, variable, symbols), raw };
  const pieces = splitTopLevel(s);
  if (!pieces.every((p) => p.includes("="))) throw new MathInputError('separate solutions with "or", e.g. x = 2 or x = -3');
  const parts = pieces.map((p) => {
    const sides = p.split("=");
    if (sides.length !== 2) throw new MathInputError("an equation needs exactly one =");
    return { lhs: parseExpr(sides[0], variable, symbols), rhs: parseExpr(sides[1], variable, symbols) };
  });
  return { kind: "equation", parts, raw };
}

export function toTex(raw: string, variable = "x", symbols: readonly string[] = []): string {
  const l = parseLine(raw, variable, symbols);
  if (l.kind === "expression") return l.expr.toTex({ implicit: "hide", parenthesis: "keep" });
  return l.parts
    .map((p) => p.lhs.toTex({ implicit: "hide", parenthesis: "keep" }) + " = " + p.rhs.toTex({ implicit: "hide", parenthesis: "keep" }))
    .join(" \\;\\text{or}\\; ");
}

/** Explicit-multiplication string, safe to hand to nerdamer. */
export function explicit(node: MathNode): string {
  return node.toString({ implicit: "show", parenthesis: "keep" });
}
