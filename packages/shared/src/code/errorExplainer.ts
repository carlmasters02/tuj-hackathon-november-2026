import type { Lang, RunStatus } from "./types";
import PY from "./errorRules/python.json";
import C from "./errorRules/c.json";
import JAVA from "./errorRules/java.json";

export interface ErrorRule {
  id: string;
  pattern: string;
  title: string;
  explanation: string;
  where: string;
}

export const ERROR_RULES: Record<Lang, ErrorRule[]> = { python: PY, c: C, java: JAVA };

export interface Explanation {
  ruleId: string;
  title: string;
  explanation: string;
  where: string;
  line: number | null;
}

/** Line number of the student's code mentioned in compiler / runtime output (last frame in their file). */
export function extractLine(lang: Lang, output: string): number | null {
  const re =
    lang === "python"
      ? /File "(?:[^"]*\/)?(?:main(?:\.py)*|<exec>|<string>)", line (\d+)/g
      : lang === "c"
        ? /(?:^|[\s/(])(?:main|source)\.c:(\d+)(?::\d+)?/gm
        : /Main\.java:(\d+)/g;
  const all = [...output.matchAll(re)].map((m) => Number(m[1]));
  if (!all.length) return null;
  // Python tracebacks list the innermost frame last; gcc, javac and sanitizers report the most
  // relevant location first.
  return lang === "python" ? all[all.length - 1] : all[0];
}

const compiled = new Map<string, RegExp>();

/**
 * Matches output against the hand-written rule files. Returns explanations in rule order
 * (most specific rules are listed first in each file), de-duplicated.
 */
export function explainErrors(lang: Lang, output: string, status?: RunStatus, source?: string): Explanation[] {
  const out: Explanation[] = [];
  output = output.replace(/[‘’]/g, "'").replace(/[“”]/g, '"'); // gcc uses typographic quotes in UTF-8 locales
  const line = extractLine(lang, output);
  for (const r of ERROR_RULES[lang]) {
    let hit = false;
    if (r.pattern === "__TIMEOUT__") hit = status === "timeout";
    else if (r.pattern === "__STRING_EQ__") hit = !!source && /\b(\w+)\s*==\s*"|"\s*==\s*\w+/.test(source) && /String/.test(source);
    else {
      let re = compiled.get(r.id);
      if (!re) compiled.set(r.id, (re = new RegExp(r.pattern)));
      hit = re.test(output);
    }
    if (hit) out.push({ ruleId: r.id, title: r.title, explanation: r.explanation, where: r.where, line });
    if (out.length >= 3) break;
  }
  // a generic syntax error rule is noise when a specific one already matched
  if (out.length > 1) return out.filter((e) => e.ruleId !== "py-syntax-generic");
  return out;
}
