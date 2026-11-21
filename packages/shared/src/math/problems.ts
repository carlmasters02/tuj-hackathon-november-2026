import type { MathProblem } from "./types";
import linear from "../../problems/math/linear.json";
import twoStep from "../../problems/math/two-step.json";
import factoring from "../../problems/math/factoring.json";
import expanding from "../../problems/math/expanding.json";
import fractions from "../../problems/math/fractions.json";
import derivatives from "../../problems/math/derivatives.json";

/** Server-side problem bank (includes answers). Use publicProblem() before sending to a browser. */
export const MATH_PROBLEMS: MathProblem[] = [...linear, ...twoStep, ...factoring, ...expanding, ...fractions, ...derivatives] as MathProblem[];

export function getMathProblem(id: string): MathProblem | undefined {
  return MATH_PROBLEMS.find((p) => p.id === id);
}
