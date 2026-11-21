/**
 * Genre coach: deterministic, explainable checks for research papers, argumentative essays and
 * poems. Like RedPen it only *observes* — it reports what it found and why that matters, and
 * never produces wording for the writer.
 */
import { syllable } from "syllable";
import type { Genre } from "./genres";

export interface CoachItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface PoemLine {
  text: string;
  syllables: number;
  rhyme: string; // A, B, C… ("-" for no end word)
  stanza: number;
}

export interface CoachReport {
  genre: Exclude<Genre, "free">;
  items: CoachItem[];
  poem?: { lines: PoemLine[]; scheme: string; stanzas: number; meterSpread: number };
}

const paragraphsOf = (text: string) => text.split("\n").map((p) => p.trim()).filter(Boolean);
const words = (s: string) => s.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

// ── research papers ──────────────────────────────────────────────────────
const CITATION = /\(([A-Z][A-Za-z'’-]+(?:\s+(?:et al\.|and|&)\s*[A-Z]?[A-Za-z'’-]*)?),?\s+(\d{4}[a-z]?|n\.d\.)(?:,\s*p+\.\s*\d+(?:[-–]\d+)?)?\)|\[\d+(?:[,–-]\s*\d+)*\]/g;
const REFERENCES_HEADING = /^(references|works cited|bibliography|sources)\s*:?\s*$/i;
const QUESTION = /\?|\b(this (paper|study|essay|report) (examines|investigates|explores|asks|argues)|research question|we (ask|investigate|examine)|i (ask|investigate|examine))\b/i;
const FACTUAL = /\b(\d+(\.\d+)?\s?%|\d{3,}|percent|studies (show|found|suggest)|research (shows|found|suggests)|according to|data|survey|evidence)\b/i;

function research(text: string): CoachItem[] {
  const paras = paragraphsOf(text);
  const refIdx = paras.findIndex((p) => REFERENCES_HEADING.test(p));
  const body = refIdx >= 0 ? paras.slice(0, refIdx) : paras;
  const refs = refIdx >= 0 ? paras.slice(refIdx + 1) : [];
  const cites = body.join("\n").match(CITATION) ?? [];
  const intro = body.slice(0, 2).join(" ");
  const uncited = body.slice(1).filter((p) => words(p).length >= 12 && FACTUAL.test(p) && !p.match(CITATION)).length;
  return [
    { id: "question", label: "States what it investigates", ok: QUESTION.test(intro), detail: QUESTION.test(intro) ? "The opening frames a question or aim." : "The first two paragraphs don't pose a question or say what the paper examines yet." },
    { id: "citations", label: "Cites sources in the text", ok: cites.length >= 2, detail: `${plural(cites.length, "in-text citation")} found, e.g. (Author, 2020) or [1].` },
    { id: "uncited", label: "Factual paragraphs carry a citation", ok: uncited === 0, detail: uncited ? `${plural(uncited, "paragraph")} cite${uncited === 1 ? "s" : ""} figures or findings without pointing to a source.` : "Every paragraph with figures or findings points to a source." },
    { id: "references", label: "Ends with a references list", ok: refIdx >= 0 && refs.length > 0, detail: refIdx < 0 ? "No line reading References, Works Cited or Bibliography yet." : `${plural(refs.length, "entry")} under “${paras[refIdx]}”.` },
    { id: "voice", label: "Keeps first-person opinion out of findings", ok: (body.join(" ").match(/\bI (think|feel|believe)\b/gi) ?? []).length === 0, detail: "“I think / feel / believe” in a research paper usually belongs in the discussion, framed by evidence." },
  ];
}

// ── argumentative essays ─────────────────────────────────────────────────
const THESIS = /\b(should|must|ought to|need to|is (better|worse|wrong|right|essential|necessary)|i (argue|contend|maintain)|this essay (argues|contends|will show)|because)\b/i;
const COUNTER = /\b(however|critics|opponents|some (people )?(argue|claim|believe|say)|others (argue|claim|believe)|on the other hand|it (could|might) be argued|admittedly|granted|although|while it is true|skeptics)\b/i;
const EVIDENCE = /\b(\d+(\.\d+)?\s?%|\d{2,}|according to|for (example|instance)|study|survey|data|research|report)\b|["“][^"”]{12,}["”]/i;
const CONCLUSION = /\b(in conclusion|to conclude|ultimately|in the end|therefore|thus|overall|for these reasons)\b/i;

function argumentative(text: string): CoachItem[] {
  const paras = paragraphsOf(text);
  const first = paras[0] ?? "";
  const bodies = paras.slice(1, -1);
  const withEvidence = bodies.filter((p) => EVIDENCE.test(p)).length;
  const counter = paras.slice(1).some((p) => COUNTER.test(p));
  const last = paras.length > 2 ? paras[paras.length - 1] : "";
  return [
    { id: "thesis", label: "Opens with a clear position", ok: THESIS.test(first), detail: THESIS.test(first) ? "The first paragraph takes a stance." : "The first paragraph doesn't commit to a position yet (look for should / must / I argue … because …)." },
    { id: "structure", label: "Has an intro, body paragraphs and a conclusion", ok: paras.length >= 4, detail: `${plural(paras.length, "paragraph")} so far; most essays need at least four.` },
    { id: "evidence", label: "Body paragraphs bring evidence", ok: bodies.length > 0 && withEvidence >= Math.ceil(bodies.length / 2), detail: bodies.length ? `${withEvidence} of ${plural(bodies.length, "body paragraph")} include an example, figure, quotation or source.` : "No body paragraphs yet." },
    { id: "counter", label: "Answers the other side", ok: counter, detail: counter ? "A counterargument is named." : "No counterargument yet. Name the strongest objection and respond to it." },
    { id: "conclusion", label: "Concludes", ok: !!last && CONCLUSION.test(last), detail: last && CONCLUSION.test(last) ? "The last paragraph draws the argument together." : "The last paragraph doesn't read as a conclusion yet." },
  ];
}

// ── poetry ───────────────────────────────────────────────────────────────
const ABSTRACT = new Set(["love", "hope", "soul", "heart", "beauty", "pain", "sadness", "happiness", "feelings", "feeling", "emotion", "emotions", "life", "time", "eternity", "truth", "dreams", "despair", "joy", "sorrow", "loneliness", "freedom"]);

/**
 * Rhyme key: the sound of the last syllable, approximated from spelling. English spelling is
 * irregular, so common patterns are normalised first (moon/tune, bread/thread, night/kite).
 */
export function rhymeKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length > 3 && /[^su]s$/.test(w)) w = w.slice(0, -1); // plurals: threads → thread
  w = w
    .replace(/igh/g, "ie") // night, bright
    .replace(/([aiouy])([bcdfgklmnprstvz]{1,2})e$/, (_m, v: string, c: string) => ({ a: "ai", i: "ie", y: "ie", o: "oa", u: "u" })[v]! + c) // silent e: tune, time, home, late
    .replace(/oo|ue$|ew$/g, "u") // moon, blue, new
    .replace(/([rhdt])ea(?=d)/g, "$1e") // bread, thread, head, instead (not bead, plead)
    .replace(/ea|ee/g, "ee") // sea, tree
    .replace(/ay$|ey$/g, "ai") // day, they
    .replace(/([^aeiou])y$/, "$1ie") // sky, cry
    .replace(/([^aeiouy])\1$/, "$1"); // hill → hil
  const m = w.match(/[aeiouy]+[^aeiouy]*$/);
  return m ? m[0] : w;
}

export function poemLines(text: string): PoemLine[] {
  const raw = text.split("\n");
  const out: PoemLine[] = [];
  const keys: string[] = [];
  let stanza = 0;
  let prevBlank = false;
  for (const line of raw) {
    const t = line.trim();
    if (!t) {
      if (out.length && !prevBlank) stanza++;
      prevBlank = true;
      continue;
    }
    prevBlank = false;
    const ws = words(t);
    const end = ws[ws.length - 1];
    let rhyme = "-";
    if (end) {
      const k = rhymeKey(end);
      let i = keys.indexOf(k);
      if (i < 0) i = keys.push(k) - 1;
      rhyme = String.fromCharCode(65 + (i % 26));
    }
    out.push({ text: t, syllables: ws.reduce((n, w) => n + syllable(w), 0), rhyme, stanza });
  }
  return out;
}

function poetry(text: string): CoachReport {
  const lines = poemLines(text);
  const stanzas = lines.length ? lines[lines.length - 1].stanza + 1 : 0;
  const counts = lines.map((l) => l.syllables);
  const spread = counts.length ? Math.max(...counts) - Math.min(...counts) : 0;
  const scheme = lines.map((l) => l.rhyme).join("");
  const rhymed = lines.filter((l, i) => lines.some((m, j) => j !== i && m.rhyme === l.rhyme && l.rhyme !== "-")).length;
  const abstract = words(text).filter((w) => ABSTRACT.has(w.toLowerCase()));
  const longLines = lines.filter((l) => l.syllables > 16).length;
  return {
    genre: "poetry",
    poem: { lines, scheme, stanzas, meterSpread: spread },
    items: [
      { id: "lines", label: "Written in lines", ok: lines.length >= 4, detail: `${plural(lines.length, "line")} in ${plural(stanzas, "stanza")}. Press Enter to break a line; leave an empty line between stanzas.` },
      { id: "meter", label: "Steady rhythm", ok: lines.length > 1 && spread <= 3, detail: lines.length > 1 ? `Lines run ${Math.min(...counts)}–${Math.max(...counts)} syllables. A tight range reads as a steady beat; a wide one as free verse. Either can be a choice.` : "Write a few lines to see the syllable counts." },
      { id: "rhyme", label: "Sound patterns", ok: rhymed >= 2, detail: rhymed ? `Rhyme scheme ${scheme || "—"}: ${rhymed} of ${plural(lines.length, "line")} share an end sound with another line.` : "No end rhymes found. That's fine for free verse, but you can use them to tie lines together." },
      { id: "images", label: "Shows more than it tells", ok: abstract.length <= Math.max(1, Math.floor(lines.length / 4)), detail: abstract.length ? `${plural(abstract.length, "abstract word")} (${[...new Set(abstract.map((w) => w.toLowerCase()))].slice(0, 5).join(", ")}). Concrete images usually carry feeling further than naming it.` : "No abstract emotion words: the images are doing the work." },
      { id: "line-length", label: "Lines stay breathable", ok: longLines === 0, detail: longLines ? `${plural(longLines, "line")} run past 16 syllables. Would a line break help?` : "No line runs past 16 syllables." },
    ],
  };
}

export function genreReport(genre: Genre, text: string): CoachReport | null {
  if (genre === "research-paper") return { genre, items: research(text) };
  if (genre === "argumentative") return { genre, items: argumentative(text) };
  if (genre === "poetry") return poetry(text);
  return null;
}

/** RedPen rules that make no sense for a genre (prose-length rules don't apply to poems). */
export const HIDDEN_RULES: Partial<Record<Genre, string[]>> = { poetry: ["long-sentence", "readability", "simpler"] };
