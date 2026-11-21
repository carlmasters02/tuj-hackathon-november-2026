/** Single source of truth for the app's sections: drives the nav menus and the hub pages. */
export interface Section {
  key: string;
  label: string;
  href: string;
  blurb: string;
  items: { label: string; href: string; note?: string }[];
}

export const MATH_SUBJECTS = [
  { slug: "algebra", label: "Algebra", note: "Equations, factoring, expanding, fractions" },
  { slug: "precalculus", label: "Precalculus", note: "Exponential and log equations, radicals, exact roots, trig values" },
  { slug: "calc-1", label: "Calculus 1", note: "Derivatives: power, product, quotient and chain rules" },
  { slug: "calc-2", label: "Calculus 2", note: "Antiderivatives, substitution, by parts, definite integrals, series" },
  { slug: "calc-3", label: "Calculus 3", note: "Partial derivatives and double integrals" },
  { slug: "prob-stats", label: "Probability & statistics", note: "Counting, probability, the binomial distribution, mean and expected value" },
] as const;

export const CODE_LANGS = [
  { slug: "python", label: "Python", note: "Runs instantly in your browser" },
  { slug: "c", label: "C", note: "Pointers, memory, and the machine underneath" },
  { slug: "java", label: "Java", note: "Classes, interfaces and strong types" },
] as const;

export const WRITING_GENRES = [
  { slug: "research-paper", label: "Research papers", note: "Claims backed by sources, in a formal voice" },
  { slug: "argumentative", label: "Argumentative essays", note: "A thesis, evidence, and the other side" },
  { slug: "poetry", label: "Poetry", note: "Lines, sound, rhythm and rhyme" },
] as const;

export const TUTOR: Section[] = [
  { key: "math", label: "Math", href: "/tutor/math", blurb: "Write each step. StepCheck shows where it goes wrong — never the answer.", items: MATH_SUBJECTS.map((s) => ({ label: s.label, href: `/tutor/math/${s.slug}`, note: s.note })) },
  { key: "code", label: "Code", href: "/tutor/code", blurb: "Graded against hidden tests, errors explained in plain English.", items: CODE_LANGS.map((s) => ({ label: s.label, href: `/tutor/code/${s.slug}`, note: s.note })) },
  { key: "writing", label: "Writing", href: "/tutor/writing", blurb: "A coach that flags and explains, and never rewrites your words.", items: WRITING_GENRES.map((s) => ({ label: s.label, href: `/tutor/writing/${s.slug}`, note: s.note })) },
];

export const PORTFOLIO: Section[] = [
  { key: "art", label: "Art", href: "/portfolio/art", blurb: "Draw in the studio and every stroke becomes your proof.", items: [{ label: "Browse art", href: "/portfolio/art" }, { label: "Open the studio", href: "/portfolio/art/studio" }] },
  { key: "writing", label: "Words", href: "/portfolio/words", blurb: "Finished prose and poetry, shared by their authors with a replay to watch.", items: [{ label: "Browse words", href: "/portfolio/words" }, { label: "Start a draft in Tutor", href: "/tutor/writing" }] },
  { key: "music", label: "Music", href: "/portfolio/music", blurb: "Compose note by note; the composer keeps the receipts.", items: [{ label: "Browse music", href: "/portfolio/music" }, { label: "Open the composer", href: "/portfolio/music/composer" }] },
];
