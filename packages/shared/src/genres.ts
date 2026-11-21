/** Writing genres for the tutor: what each asks of the writer, and which deterministic checks apply. */
export type Genre = "free" | "research-paper" | "argumentative" | "poetry";

export interface GenreGuide {
  slug: Exclude<Genre, "free">;
  label: string;
  /** singular, lowercase: "a new poem" */
  noun: string;
  starterTitle: string;
  promise: string;
  principles: { title: string; body: string }[];
}

export const GENRES: GenreGuide[] = [
  {
    slug: "research-paper",
    label: "Research papers",
    noun: "research paper",
    starterTitle: "Untitled research paper",
    promise: "A clear question, claims tied to sources, and a voice that shows its working.",
    principles: [
      { title: "Ask one question", body: "Say early what you are investigating and why it matters." },
      { title: "Cite as you go", body: "Every factual claim should point to a source: (Author, Year), [1], or a footnote." },
      { title: "Report, then interpret", body: "Separate what the sources say from what you conclude from them." },
      { title: "Keep a references list", body: "End with a section headed References, Works Cited or Bibliography." },
    ],
  },
  {
    slug: "argumentative",
    label: "Argumentative essays",
    noun: "argumentative essay",
    starterTitle: "Untitled argumentative essay",
    promise: "Take a position, earn it with evidence, and answer the strongest objection.",
    principles: [
      { title: "State a thesis", body: "Make your position explicit in the first paragraph." },
      { title: "One claim per paragraph", body: "Lead each body paragraph with its point, then support it." },
      { title: "Use evidence", body: "Examples, data and quotations do the persuading, not intensifiers." },
      { title: "Face the other side", body: "Name a counterargument and respond to it before you conclude." },
    ],
  },
  {
    slug: "poetry",
    label: "Poetry",
    noun: "poem",
    starterTitle: "Untitled poem",
    promise: "Line by line: rhythm, sound and image. The coach counts what you can hear.",
    principles: [
      { title: "Every line is a choice", body: "Where a line breaks changes how it is read." },
      { title: "Listen to the rhythm", body: "The coach counts syllables per line so you can see your meter." },
      { title: "Hear the rhymes", body: "End sounds are grouped into a rhyme scheme (ABAB, AABB…) for you to shape — or break." },
      { title: "Show, don't tell", body: "Concrete images usually land harder than abstract words." },
    ],
  },
];

export const genreGuide = (g: string) => GENRES.find((x) => x.slug === g);

/** True while a title is still the one we filled in ("Untitled", "Untitled poem", …) or empty. */
export const isDefaultTitle = (t: string) => !t.trim() || /^untitled\b/i.test(t.trim());
