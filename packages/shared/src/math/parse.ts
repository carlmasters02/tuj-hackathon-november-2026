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
    .trim();
}

const ALLOWED_FUNCS = new Set(["sqrt", "abs"]);

/** Parses an expression and rejects anything outside basic algebra (no assignments, no functions beyond sqrt/abs). */
export function parseExpr(input: string, variable = "x"): MathNode {
  const src = normalizeInput(input);
  if (!src) throw new MathInputError("empty expression");
  if (src.length > 300) throw new MathInputError("expression too long");
  if (/[=<>!:;"'`[\]{}]/.test(src)) throw new MathInputError("unexpected symbol");
  let node: MathNode;
  try {
    node = math.parse(src);
  } catch (e) {
    throw new MathInputError((e as Error).message);
  }
  node.traverse((n: any) => {
    if (n.isFunctionNode && !ALLOWED_FUNCS.has(n.fn?.name)) throw new MathInputError(`function "${n.fn?.name}" isn't allowed`);
    if (n.isSymbolNode && !n.isFunctionNode && n.name !== variable && n.name !== "pi" && n.name !== "e") {
      // a symbol that's the function name of a FunctionNode is visited as SymbolNode too; skip those
      if (!ALLOWED_FUNCS.has(n.name)) throw new MathInputError(`unknown symbol "${n.name}" (use ${variable})`);
    }
    if (n.isAssignmentNode || n.isFunctionAssignmentNode || n.isAccessorNode || n.isIndexNode || n.isObjectNode || n.isArrayNode || n.isRangeNode || n.isBlockNode || n.isConditionalNode || n.isRelationalNode)
      throw new MathInputError("only plain algebra is allowed");
    if (n.isConstantNode && typeof n.value !== "number") throw new MathInputError("only numbers are allowed");
  });
  return node;
}

export type Line =
  | { kind: "expression"; expr: MathNode; raw: string }
  | { kind: "equation"; parts: { lhs: MathNode; rhs: MathNode }[]; raw: string };

/**
 * A line is an expression, an equation `a = b`, or a disjunction of equations
 * `x = 2 or x = -3` (also accepts "," / ";" separators when every part has "=").
 */
export function parseLine(raw: string, variable = "x"): Line {
  const s = normalizeInput(raw);
  if (!s.includes("=")) return { kind: "expression", expr: parseExpr(s, variable), raw };
  const pieces = s.split(/\s+or\s+|;|,/i).map((p) => p.trim()).filter(Boolean);
  if (!pieces.every((p) => p.includes("="))) throw new MathInputError('separate solutions with "or", e.g. x = 2 or x = -3');
  const parts = pieces.map((p) => {
    const sides = p.split("=");
    if (sides.length !== 2) throw new MathInputError("an equation needs exactly one =");
    return { lhs: parseExpr(sides[0], variable), rhs: parseExpr(sides[1], variable) };
  });
  return { kind: "equation", parts, raw };
}

export function toTex(raw: string, variable = "x"): string {
  const l = parseLine(raw, variable);
  if (l.kind === "expression") return l.expr.toTex({ implicit: "hide", parenthesis: "keep" });
  return l.parts
    .map((p) => p.lhs.toTex({ implicit: "hide", parenthesis: "keep" }) + " = " + p.rhs.toTex({ implicit: "hide", parenthesis: "keep" }))
    .join(" \\;\\text{or}\\; ");
}

/** Explicit-multiplication string, safe to hand to nerdamer. */
export function explicit(node: MathNode): string {
  return node.toString({ implicit: "show", parenthesis: "keep" });
}
