export type FinalForm = "isolated" | "solutions" | "expanded" | "factored" | "fraction_lowest" | "no_division" | "polynomial";

export interface MathProblem {
  id: string;
  topic: string;
  difficulty: 1 | 2 | 3;
  /** LaTeX shown to the student */
  prompt: string;
  kind: "equation" | "expression" | "derivative";
  /** mathjs syntax of the starting line (for derivatives: the function to differentiate) */
  start: string;
  variable: string;
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
