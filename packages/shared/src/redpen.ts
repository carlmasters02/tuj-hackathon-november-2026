import { retext } from "retext";
import retextEnglish from "retext-english";
import retextPassive from "retext-passive";
import retextReadability from "retext-readability";
import retextSimplify from "retext-simplify";
import retextRepeatedWords from "retext-repeated-words";
import retextIntensify from "retext-intensify";
import retextEquality from "retext-equality";
import writeGood from "write-good";
import { syllable } from "syllable";
import CLICHES from "./data/cliches.json";

/**
 * RedPen: deterministic writing feedback. It flags; it never rewrites. No flag carries a
 * replacement string and the UI offers no one-click fix — the writer edits the text themselves.
 */
export type RuleId = "passive" | "weasel" | "intensifier" | "long-sentence" | "repeated" | "cliche" | "simpler" | "readability" | "equality" | "wordy";

export interface Flag {
  rule: RuleId;
  start: number;
  end: number;
  excerpt: string;
  message: string;
}

export interface RuleInfo {
  label: string;
  why: string;
  example: string; // generic, never derived from the user's text
}

export const RULES: Record<RuleId, RuleInfo> = {
  passive: {
    label: "Passive voice",
    why: "Passive sentences hide who did the action and usually run longer. Readers follow \"who did what\" more easily.",
    example: "\"The ball was thrown by the girl\" hides the actor until the end; \"The girl threw the ball\" leads with it.",
  },
  weasel: {
    label: "Weasel / filler word",
    why: "Words like \"very\", \"really\", \"many\" or \"basically\" add length without adding meaning, and can make claims vague.",
    example: "\"Many people basically agree\" — how many? Who? A number or a source is stronger.",
  },
  intensifier: {
    label: "Hedge or intensifier",
    why: "Hedges (\"somewhat\", \"perhaps\") weaken a point; intensifiers (\"extremely\", \"totally\") ask the reader to trust emphasis instead of evidence.",
    example: "\"It was extremely important\" vs. saying *why* it mattered.",
  },
  "long-sentence": {
    label: "Long sentence (>30 words)",
    why: "Past about 30 words, readers start losing the thread. Splitting one idea per sentence usually helps.",
    example: "A sentence that lists a cause, two effects and a caveat can often become three sentences.",
  },
  repeated: {
    label: "Repeated word",
    why: "A word typed twice in a row (\"the the\") is almost always a slip.",
    example: "\"We went to the the park.\"",
  },
  cliche: {
    label: "Cliché",
    why: "Stock phrases are so familiar that readers skim past them. Your own concrete wording is more memorable.",
    example: "\"At the end of the day\" says less than naming the actual conclusion.",
  },
  simpler: {
    label: "Complex word",
    why: "A shorter, plainer word is usually clearer. Use the complex one only when it's more precise.",
    example: "\"utilize\" often means \"use\"; \"in order to\" often means \"to\".",
  },
  readability: {
    label: "Hard-to-read sentence",
    why: "Several readability formulas agree this sentence is hard to read — usually many long words in one sentence.",
    example: "Long noun stacks like \"implementation methodology optimization\" slow readers down.",
  },
  equality: {
    label: "Possibly insensitive wording",
    why: "Some words can be gendered, ableist or otherwise exclusionary. Consider whether a neutral term fits.",
    example: "\"chairman\" → many writers prefer \"chair\" or \"chairperson\".",
  },
  wordy: {
    label: "Wordy phrase",
    why: "Some phrases say in four words what one word can.",
    example: "\"due to the fact that\" usually means \"because\".",
  },
};

const MAX_WORDS = 30;

export interface ReadabilityScores {
  words: number;
  sentences: number;
  syllables: number;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
}

export function sentenceSpans(text: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  const re = /[^.!?\n]+(?:[.!?]+|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    const lead = m[0].length - m[0].trimStart().length;
    const s = m.index + lead;
    const e = m.index + m[0].trimEnd().length;
    if (e > s && /\p{L}/u.test(text.slice(s, e))) spans.push({ start: s, end: e });
  }
  return spans;
}

const wordsIn = (s: string) => s.match(/\p{L}[\p{L}'’-]*/gu) ?? [];

export function readability(text: string): ReadabilityScores {
  const words = wordsIn(text);
  const sentences = Math.max(1, sentenceSpans(text).length);
  const syl = words.reduce((n, w) => n + Math.max(1, syllable(w)), 0);
  const wc = Math.max(1, words.length);
  const fre = 206.835 - 1.015 * (wc / sentences) - 84.6 * (syl / wc);
  const fk = 0.39 * (wc / sentences) + 11.8 * (syl / wc) - 15.59;
  return {
    words: words.length,
    sentences: words.length ? sentences : 0,
    syllables: syl,
    fleschReadingEase: Math.round(fre * 10) / 10,
    fleschKincaidGrade: Math.round(fk * 10) / 10,
  };
}

const SOURCE_TO_RULE: Record<string, RuleId> = {
  "retext-passive": "passive",
  "retext-readability": "readability",
  "retext-simplify": "simpler",
  "retext-repeated-words": "repeated",
  "retext-intensify": "intensifier",
  "retext-equality": "equality",
};

/** Strip any suggested replacement from third-party messages: RedPen never proposes wording. */
function scrub(reason: string): string {
  return reason
    .replace(/,?\s*use\s+[`"“][^`"”]*[`"”](\s*,\s*[`"“][^`"”]*[`"”])*(\s*(or|,)\s*[`"“][^`"”]*[`"”])*\s*instead/gi, "")
    .replace(/[`"“][^`"”]*[`"”]\s*(may be|is)\s*(better|clearer)/gi, "")
    .replace(/\s*instead\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const processor = retext()
  .use(retextEnglish as any)
  .use(retextPassive as any)
  .use(retextReadability as any, { age: 16, minWords: 8 })
  .use(retextSimplify as any)
  .use(retextRepeatedWords as any)
  .use(retextIntensify as any)
  .use(retextEquality as any);

export async function analyze(text: string): Promise<{ flags: Flag[]; scores: ReadabilityScores }> {
  const flags: Flag[] = [];
  if (text.length > 200_000) text = text.slice(0, 200_000);
  const file = await processor.process(text);
  for (const m of file.messages) {
    const rule = SOURCE_TO_RULE[m.source ?? ""];
    const start = m.place && "start" in m.place ? m.place.start.offset : (m.place as any)?.offset;
    const end = m.place && "end" in m.place ? m.place.end.offset : start;
    if (!rule || start == null || end == null) continue;
    flags.push({ rule, start, end, excerpt: text.slice(start, end), message: scrub(m.reason) || RULES[rule].label });
  }

  for (const s of writeGood(text, { passive: false, eprime: false, tooWordy: true, cliches: false, adverb: false, illusion: false, so: false, thereIs: false, weasel: true })) {
    const excerpt = text.slice(s.index, s.index + s.offset);
    const rule: RuleId = /wordy/i.test(s.reason) ? "wordy" : "weasel";
    flags.push({ rule, start: s.index, end: s.index + s.offset, excerpt, message: `"${excerpt}" ${rule === "wordy" ? "is wordy" : "is a weasel/filler word"}` });
  }

  const lower = text.toLowerCase();
  for (const c of CLICHES as string[]) {
    let i = lower.indexOf(c);
    while (i >= 0) {
      const before = i === 0 ? " " : lower[i - 1];
      const after = lower[i + c.length] ?? " ";
      if (!/\p{L}/u.test(before) && !/\p{L}/u.test(after)) flags.push({ rule: "cliche", start: i, end: i + c.length, excerpt: text.slice(i, i + c.length), message: `"${text.slice(i, i + c.length)}" is a cliché` });
      i = lower.indexOf(c, i + c.length);
    }
  }

  for (const sp of sentenceSpans(text)) {
    const n = wordsIn(text.slice(sp.start, sp.end)).length;
    if (n > MAX_WORDS) flags.push({ rule: "long-sentence", start: sp.start, end: sp.end, excerpt: text.slice(sp.start, Math.min(sp.end, sp.start + 80)), message: `This sentence has ${n} words` });
  }

  // de-duplicate overlapping flags of the same rule
  flags.sort((a, b) => a.start - b.start || a.rule.localeCompare(b.rule));
  const out: Flag[] = [];
  for (const f of flags) {
    if (out.some((g) => g.rule === f.rule && g.start === f.start && g.end === f.end)) continue;
    out.push(f);
  }
  return { flags: out, scores: readability(text) };
}
