/**
 * Citation manager: APA 7 and MLA 9 formatting for in-text citations and the reference list.
 * Deterministic string formatting only. Sources are stored in the document's settings, never in
 * the recorded text, so adding a source or switching styles can't change the keystroke log.
 */
import { z } from "zod";

export const SourceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]{6,16}$/),
    type: z.enum(["book", "article", "website", "chapter", "other"]),
    authors: z.array(z.object({ given: z.string().trim().max(80), family: z.string().trim().min(1).max(80) }).strict()).max(20),
    title: z.string().trim().min(1).max(300),
    container: z.string().trim().max(300).default(""), // journal, website or book title
    publisher: z.string().trim().max(200).default(""),
    year: z.string().trim().regex(/^(\d{4}[a-z]?|n\.d\.)?$/).default(""),
    volume: z.string().trim().max(20).default(""),
    issue: z.string().trim().max(20).default(""),
    pages: z.string().trim().max(30).default(""),
    url: z.string().trim().max(500).regex(/^(https?:\/\/\S+)?$/).default(""),
    accessed: z.string().trim().max(40).default(""),
  })
  .strict();
export type Source = z.infer<typeof SourceSchema>;
export type CitationStyle = "apa" | "mla";

/** A piece of formatted text; reference lists italicise titles. */
export interface Seg {
  text: string;
  italic?: boolean;
}

const initials = (given: string) =>
  given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((g) => `${g[0].toUpperCase()}.`)
    .join(" ");
const year = (s: Source) => s.year || "n.d.";
const end = (t: string) => (/[.?!]$/.test(t) ? t : `${t}.`);

/** In-text citation, e.g. APA "(Lee & Park, 2021, p. 4)" or MLA "(Lee and Park 4)". */
export function inText(s: Source | undefined, style: CitationStyle, locator = ""): string {
  if (!s) return "(missing source)";
  const fam = s.authors.map((a) => a.family);
  const who = fam.length === 0 ? `“${s.title.length > 30 ? s.title.slice(0, 30).trim() + "…" : s.title}”` : fam.length === 1 ? fam[0] : fam.length === 2 ? `${fam[0]} ${style === "apa" ? "&" : "and"} ${fam[1]}` : `${fam[0]} et al.`;
  const loc = locator.trim();
  if (style === "apa") return `(${who}, ${year(s)}${loc ? `, ${/^\d+[-–]\d+$/.test(loc) ? "pp." : "p."} ${loc}` : ""})`;
  return `(${who}${loc ? ` ${loc}` : ""})`;
}

function apaAuthors(s: Source): string {
  const a = s.authors.map((x) => `${x.family}${x.given ? `, ${initials(x.given)}` : ""}`);
  if (a.length === 0) return "";
  if (a.length === 1) return a[0];
  if (a.length <= 20) return `${a.slice(0, -1).join(", ")}, & ${a[a.length - 1]}`;
  return a.join(", ");
}

function mlaAuthors(s: Source): string {
  const a = s.authors;
  if (a.length === 0) return "";
  const first = `${a[0].family}${a[0].given ? `, ${a[0].given}` : ""}`;
  if (a.length === 1) return first;
  if (a.length === 2) return `${first}, and ${a[1].given ? `${a[1].given} ` : ""}${a[1].family}`;
  return `${first}, et al.`;
}

/** One reference-list entry as styled segments. */
export function reference(s: Source, style: CitationStyle): Seg[] {
  const out: Seg[] = [];
  const add = (text: string, italic = false) => {
    if (text) out.push({ text, italic });
  };
  if (style === "apa") {
    const au = apaAuthors(s);
    if (au) add(`${end(au)} (${year(s)}). `);
    const titleFirst = !au;
    if (s.type === "article") {
      add(titleFirst ? `${end(s.title)} (${year(s)}). ` : `${end(s.title)} `);
      if (s.container) {
        add(s.container, true);
        if (s.volume) {
          add(", ");
          add(s.volume, true);
        }
        if (s.issue) add(`(${s.issue})`);
        if (s.pages) add(`, ${s.pages}`);
        add(". ");
      }
    } else if (s.type === "website") {
      add(end(s.title), true);
      add(titleFirst ? ` (${year(s)}). ` : " ");
      if (s.container) add(`${end(s.container)} `);
    } else if (s.type === "chapter") {
      add(`${end(s.title)} `);
      if (s.container) {
        add("In ");
        add(s.container, true);
        add(s.pages ? ` (pp. ${s.pages}). ` : ". ");
      }
      if (s.publisher) add(`${end(s.publisher)} `);
    } else {
      add(end(s.title), true);
      add(titleFirst ? ` (${year(s)}). ` : " ");
      if (s.publisher) add(`${end(s.publisher)} `);
    }
    if (s.url) add(s.url);
  } else {
    const au = mlaAuthors(s);
    if (au) add(`${end(au)} `);
    const quoted = s.type === "article" || s.type === "website" || s.type === "chapter";
    if (quoted) add(`“${end(s.title)}” `);
    else {
      add(end(s.title), true);
      add(" ");
    }
    const tail: string[] = [];
    if (s.container) {
      add(s.container, true);
      if (s.volume) tail.push(`vol. ${s.volume}`);
      if (s.issue) tail.push(`no. ${s.issue}`);
    }
    if (s.publisher && s.type !== "article") tail.push(s.publisher);
    if (s.year) tail.push(s.year);
    if (s.pages) tail.push(`${/[-–]/.test(s.pages) ? "pp." : "p."} ${s.pages}`);
    if (s.url) tail.push(s.url.replace(/^https?:\/\//, ""));
    if (s.container && tail.length) add(", ");
    if (tail.length) add(end(tail.join(", ")));
    else if (s.container) add(".");
    if (s.accessed && s.type === "website") add(` Accessed ${end(s.accessed)}`);
  }
  // tidy double spaces and trailing space
  const merged = out.map((x) => ({ ...x, text: x.text.replace(/\s+/g, " ") }));
  if (merged.length) merged[merged.length - 1].text = merged[merged.length - 1].text.trimEnd();
  return merged;
}

export const referenceText = (s: Source, style: CitationStyle) => reference(s, style).map((x) => x.text).join("");

/** Sources in reference-list order: by first author's family name, then year, then title. */
export function sortedSources(sources: Source[]): Source[] {
  const key = (s: Source) => (s.authors[0]?.family ?? s.title).toLowerCase();
  return [...sources].sort((a, b) => key(a).localeCompare(key(b)) || year(a).localeCompare(year(b)) || a.title.localeCompare(b.title));
}

export const listHeading = (style: CitationStyle) => (style === "apa" ? "References" : "Works Cited");
