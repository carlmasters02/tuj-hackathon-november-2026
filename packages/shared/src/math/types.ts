export type FinalForm =
  | "isolated" | "solutions" | "expanded" | "factored" | "fraction_lowest" | "no_division" | "polynomial"
  | "exact" // x = (any exact constant), e.g. x = 2 + sqrt(3) or x = log(7)/2
  | "number" // an integer, decimal or fraction in lowest terms
  | "antiderivative" // must include + C
  | "any"; // any equivalent expression

export type MathSubject = "algebra" | "precalculus" | "calc-1" | "calc-2" | "calc-3" | "prob-stats";

export interface MathProblem {
  id: string;
  subject: MathSubject;
  topic: string;
  difficulty: 1 | 2 | 3;
  /** LaTeX shown to the student */
  prompt: string;
  /**
   * equation / expression: transform `start` step by step.
   * derivative / partial: every line must equal d(start)/d(variable).
   * antiderivative: every line must differentiate back to `start` (the integrand).
   * value: every line must equal the answer (a number); `start` is unused.
   */
  kind: "equation" | "expression" | "derivative" | "partial" | "antiderivative" | "value";
  /** mathjs syntax of the starting line (for derivatives: the function to differentiate) */
  start: string;
  variable: string;
  /** other letters that are constants here, e.g. ["y"] for a partial derivative in x */
  symbols?: string[];
  finalForm: FinalForm;
  /** Server-only. Never sent to the browser. */
  answer: string;
}

export type PublicMathProblem = Omit<MathProblem, "answer">;

export type HintType = "sign_error" | "one_side_only" | "partial_distribution" | "divided_one_term" | "arithmetic_slip" | "generic";

export interface Hint {
  tier: 1 | 2 | 3;
  type: HintType;
  text: string;
}
