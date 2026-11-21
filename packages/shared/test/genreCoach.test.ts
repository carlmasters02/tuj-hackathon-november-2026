import { describe, expect, it } from "vitest";
import { genreReport, poemLines, rhymeKey } from "@hm/shared/genreCoach";

const item = (r: ReturnType<typeof genreReport>, id: string) => r!.items.find((i) => i.id === id)!;

describe("genre coach", () => {
  it("research papers: question, citations, uncited findings, references", () => {
    const text = [
      "Does sleep affect memory? This paper examines recent findings.",
      "Students who slept eight hours recalled 23% more words (Walker, 2017). Later work agreed [2].",
      "A survey of 1,200 students found that 40% sleep under six hours, which suggests a widespread problem across many campuses and years of study.",
      "References",
      "Walker, M. (2017). Why We Sleep.",
    ].join("\n");
    const r = genreReport("research-paper", text);
    expect(item(r, "question").ok).toBe(true);
    expect(item(r, "citations").ok).toBe(true);
    expect(item(r, "uncited").ok).toBe(false);
    expect(item(r, "references").ok).toBe(true);
    const thin = genreReport("research-paper", "Sleep is good.");
    for (const id of ["question", "citations", "references"]) expect(item(thin, id).ok, id).toBe(false);
  });
  it("argumentative essays: thesis, evidence, counterargument, conclusion", () => {
    const text = [
      "Schools should start later because teenagers need sleep.",
      "For example, one district saw attendance rise 8% after a later start.",
      "Some argue buses cost more. However, the savings from fewer absences offset that.",
      "In conclusion, a later start is worth it.",
    ].join("\n");
    const r = genreReport("argumentative", text);
    expect(r!.items.every((i) => i.ok)).toBe(true);
    const weak = genreReport("argumentative", "Schools are interesting.\nThey have classes.");
    expect(item(weak, "thesis").ok).toBe(false);
    expect(item(weak, "counter").ok).toBe(false);
  });
  it("poetry: lines, stanzas, syllables and rhyme scheme", () => {
    const poem = "The cat sat on the mat\nAnd wore a little hat\n\nThe moon was round and bright\nIt shone on us all night";
    const lines = poemLines(poem);
    expect(lines.map((l) => l.stanza)).toEqual([0, 0, 1, 1]);
    expect(lines.map((l) => l.rhyme).join("")).toBe("AABB");
    expect(lines[0].syllables).toBe(6);
    const r = genreReport("poetry", poem)!;
    expect(r.poem!.scheme).toBe("AABB");
    expect(item(r, "rhyme").ok).toBe(true);
    expect(item(genreReport("poetry", "Love and hope\nMy heart and soul\nPain and joy\nLife and time")!, "images").ok).toBe(false);
    for (const [a, b] of [["night", "bright"], ["moon", "tune"], ["threads", "bread"], ["time", "rhyme"], ["home", "foam"], ["day", "they"], ["sky", "high"], ["hill", "still"], ["sea", "tree"]]) expect(rhymeKey(a), `${a}/${b}`).toBe(rhymeKey(b));
    for (const [a, b] of [["cat", "moon"], ["cat", "dog"], ["night", "net"]]) expect(rhymeKey(a), `${a}/${b}`).not.toBe(rhymeKey(b));
  });
  it("never suggests wording", () => {
    for (const g of ["research-paper", "argumentative", "poetry"] as const) {
      const r = genreReport(g, "A short draft.")!;
      for (const i of r.items) expect(i.detail).not.toMatch(/A short draft/);
    }
    expect(genreReport("free", "x")).toBeNull();
  });
});
