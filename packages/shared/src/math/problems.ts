import type { MathProblem } from "./types";
import linear from "../../problems/math/linear.json";
import twoStep from "../../problems/math/two-step.json";
import factoring from "../../problems/math/factoring.json";
import expanding from "../../problems/math/expanding.json";
import fractions from "../../problems/math/fractions.json";
import derivatives from "../../problems/math/derivatives.json";
import precalculus from "../../problems/math/precalculus.json";
import calc2 from "../../problems/math/calc2.json";
import calc3 from "../../problems/math/calc3.json";
import probstats from "../../problems/math/probstats.json";

/** Server-side problem bank (includes answers). Use publicProblem() before sending to a browser. */
export const MATH_PROBLEMS: MathProblem[] = [...linear, ...twoStep, ...factoring, ...expanding, ...fractions, ...derivatives, ...precalculus, ...calc2, ...calc3, ...probstats] as MathProblem[];

export function getMathProblem(id: string): MathProblem | undefined {
  return MATH_PROBLEMS.find((p) => p.id === id);
}
