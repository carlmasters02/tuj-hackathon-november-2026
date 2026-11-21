import { z } from "zod";

export const LANGS = ["python", "c", "java"] as const;
export type Lang = (typeof LANGS)[number];

export const CONCEPTS = [
  "io-variables", "conditionals", "loops", "functions", "arrays", "strings", "structs-classes", "recursion",
  "pointers-memory", "oop-interfaces", "mini-project",
] as const;
export type Concept = (typeof CONCEPTS)[number];

export const CONCEPT_LABEL: Record<Concept, string> = {
  "io-variables": "I/O & variables",
  conditionals: "Conditionals",
  loops: "Loops",
  functions: "Functions",
  arrays: "Arrays / lists",
  strings: "Strings",
  "structs-classes": "Structs & classes",
  recursion: "Recursion",
  "pointers-memory": "Pointers & memory",
  "oop-interfaces": "OOP & interfaces",
  "mini-project": "Mini project",
};

export const PatternSchema = z.object({ regex: z.string(), flags: z.string().optional(), message: z.string() });

export const ExerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  lang: z.enum(LANGS),
  concept: z.enum(CONCEPTS),
  difficulty: z.number().int().min(1).max(3),
  title: z.string(),
  promptMd: z.string(),
  starterCode: z.string(),
  tests: z.array(z.object({ stdin: z.string(), expectedStdout: z.string(), hidden: z.boolean() })).min(2),
  requiredPatterns: z.array(PatternSchema).optional(),
  forbiddenPatterns: z.array(PatternSchema).optional(),
  hints: z.tuple([z.string(), z.string(), z.string()]),
  conceptNoteMd: z.string(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

/** What the browser may see: hidden tests are reduced to a count. */
export type PublicExercise = Omit<Exercise, "tests" | "hints"> & { visibleTests: { stdin: string; expectedStdout: string }[]; hiddenCount: number };

export interface RunRequest {
  lang: Lang;
  source: string;
  stdin: string;
  sanitize?: boolean; // C only: -fsanitize=address,undefined
}

export type RunStatus = "ok" | "compile_error" | "runtime_error" | "timeout" | "memory" | "output_limit" | "internal_error";

export interface RunResult {
  status: RunStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  exitCode: number | null;
  timeMs: number | null;
}

/** Any sandbox that can compile/run code: Judge0, Piston, or a test double. */
export interface CodeRunner {
  readonly name: string;
  run(req: RunRequest): Promise<RunResult>;
}

export const LIMITS = {
  maxSourceBytes: 20 * 1024,
  maxOutputBytes: 64 * 1024,
  cpuSeconds: { python: 2, c: 2, java: 4 } as Record<Lang, number>,
  wallSeconds: 5,
  memoryMb: { python: 128, c: 128, java: 256 } as Record<Lang, number>,
};
