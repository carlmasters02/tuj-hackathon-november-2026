import { describe, expect, it } from "vitest";
import { inText, referenceText, sortedSources, type Source } from "@hm/shared/citations";
import { applyTemplate, defaultMeta, DocMetaSchema, parseMeta } from "@hm/shared/docMeta";

const S = (p: Partial<Source>): Source => ({ id: "abcdef12", type: "book", authors: [], title: "T", container: "", publisher: "", year: "", volume: "", issue: "", pages: "", url: "", accessed: "", ...p });
const walker = S({ authors: [{ given: "Matthew", family: "Walker" }], title: "Why We Sleep", publisher: "Scribner", year: "2017" });
const article = S({ id: "bbbbbb12", type: "article", authors: [{ given: "Jane Q", family: "Lee" }, { given: "Min", family: "Park" }], title: "Sleep and memory in teens", container: "Journal of Sleep", volume: "12", issue: "3", pages: "45-60", year: "2021" });
const many = S({ id: "cccccc12", authors: [{ given: "A", family: "Ames" }, { given: "B", family: "Bell" }, { given: "C", family: "Cole" }], title: "Group work", year: "2019" });

describe("citations", () => {
  it("APA in-text", () => {
    expect(inText(walker, "apa")).toBe("(Walker, 2017)");
    expect(inText(article, "apa", "47")).toBe("(Lee & Park, 2021, p. 47)");
    expect(inText(article, "apa", "47-49")).toBe("(Lee & Park, 2021, pp. 47-49)");
    expect(inText(many, "apa")).toBe("(Ames et al., 2019)");
    expect(inText(S({ title: "Anonymous report" }), "apa")).toBe("(“Anonymous report”, n.d.)");
  });
  it("MLA in-text", () => {
    expect(inText(walker, "mla", "12")).toBe("(Walker 12)");
    expect(inText(article, "mla")).toBe("(Lee and Park)");
    expect(inText(many, "mla")).toBe("(Ames et al.)");
  });
  it("APA references", () => {
    expect(referenceText(walker, "apa")).toBe("Walker, M. (2017). Why We Sleep. Scribner.");
    expect(referenceText(article, "apa")).toBe("Lee, J. Q., & Park, M. (2021). Sleep and memory in teens. Journal of Sleep, 12(3), 45-60.");
  });
  it("MLA works cited", () => {
    expect(referenceText(walker, "mla")).toBe("Walker, Matthew. Why We Sleep. Scribner, 2017.");
    expect(referenceText(article, "mla")).toBe("Lee, Jane Q, and Min Park. “Sleep and memory in teens.” Journal of Sleep, vol. 12, no. 3, 2021, pp. 45-60.");
  });
  it("sorts by author", () => {
    expect(sortedSources([walker, article, many]).map((s) => s.authors[0].family)).toEqual(["Ames", "Lee", "Walker"]);
  });
});

describe("document settings", () => {
  it("defaults, templates, and lenient parsing", () => {
    const m = defaultMeta();
    expect(m.setup.page).toBe("letter");
    const mla = applyTemplate(m, "mla");
    expect(mla.setup).toMatchObject({ template: "mla", font: "times", lineSpacing: 2 });
    expect(mla.citationStyle).toBe("mla");
    expect(parseMeta({ setup: { page: "huge" } })).toEqual(defaultMeta());
    expect(DocMetaSchema.safeParse({ sources: [{ ...walker, url: "javascript:alert(1)" }] }).success).toBe(false);
  });
});
