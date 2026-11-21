import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import type { Source } from "@hm/shared/citations";
import { defaultMeta } from "@hm/shared/docMeta";
import { contentToText } from "../src/lib/server/pm";
import { preparePublishedDoc, publishedDocForDisplay } from "../src/lib/server/publishedDoc";
import { WritingDocument } from "../src/components/portfolio/WritingDocument";

const walker: Source = {
  id: "walker17", type: "book", authors: [{ given: "Matthew", family: "Walker" }],
  title: "Why We Sleep", container: "", publisher: "Scribner", year: "2017",
  volume: "", issue: "", pages: "", url: "", accessed: "",
};

function richContent(): JSONContent {
  return {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Sleep study" }] },
      { type: "paragraph", content: [
        { type: "text", text: "Sleep helps ", marks: [{ type: "bold" }, { type: "comment", attrs: { id: "private1" } }] },
        { type: "citation", attrs: { sourceId: walker.id, locator: "4", label: "" } },
        { type: "text", text: " <img src=x onerror=alert(1)>.", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
      ] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Nested", marks: [{ type: "comment", attrs: { id: "private2" } }] }] }] }] }] },
      { type: "footnotes", content: [{ type: "footnote", attrs: { id: "n1" }, content: [{ type: "paragraph", content: [{ type: "text", text: "A note." }] }] }] },
    ],
  };
}

function metaWithSource(style: "apa" | "mla" = "apa") {
  return {
    ...defaultMeta(), citationStyle: style, sources: [walker], wordGoal: 9000,
    comments: [{ id: "private1", body: "Never publish this comment", createdAt: "now", resolved: false }],
  };
}

describe("certified publication snapshots", () => {
  it("strips private comments recursively and freezes citations without mutating the draft", () => {
    const content = richContent();
    const original = structuredClone(content);
    const prepared = preparePublishedDoc(content, metaWithSource());
    const serialized = JSON.stringify(prepared.snapshot);

    expect(content).toEqual(original);
    expect(prepared.text).toBe(contentToText(content));
    expect(prepared.snapshot.content).not.toEqual(content);
    expect(serialized).not.toContain("Never publish this comment");
    expect(serialized).not.toContain("private1");
    expect(serialized).not.toContain("private2");
    expect(serialized).not.toContain("wordGoal");
    expect(serialized).toContain('"type":"bold"');
    expect(serialized).toContain('"label":"(Walker, 2017, p. 4)"');
    expect(prepared.snapshot).not.toHaveProperty("comments");
    expect(prepared.snapshot).not.toHaveProperty("wordGoal");
  });

  it("uses the selected citation style, including a deterministic missing-source label", () => {
    const content: JSONContent = { type: "doc", content: [
      { type: "paragraph", content: [
        { type: "citation", attrs: { sourceId: walker.id, locator: "12" } },
        { type: "citation", attrs: { sourceId: "absent1" } },
      ] },
    ] };
    const prepared = preparePublishedDoc(content, metaWithSource("mla"));
    const citations = prepared.snapshot.content.content?.[0].content ?? [];
    expect(citations[0].attrs?.label).toBe("(Walker 12)");
    expect(citations[1].attrs?.label).toBe("(missing source)");
  });

  it("renders escaped rich HTML and references without private or executable content", () => {
    const prepared = preparePublishedDoc(richContent(), metaWithSource());
    const html = renderToStaticMarkup(React.createElement(WritingDocument, { doc: prepared.snapshot }));

    expect(html).toContain("<strong>Sleep helps </strong>");
    expect(html).toContain("(Walker, 2017, p. 4)");
    expect(html).toContain("Why We Sleep");
    expect(html).toContain("References");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data-comment");
    expect(html).not.toContain("Never publish this comment");
  });

  it("falls back for legacy, invalid, private, or projection-mismatched snapshots", () => {
    const prepared = preparePublishedDoc(richContent(), metaWithSource());
    expect(publishedDocForDisplay(null, prepared.text)).toBeNull();
    expect(publishedDocForDisplay({}, prepared.text)).toBeNull();
    expect(publishedDocForDisplay(prepared.snapshot, "different text")).toBeNull();
    expect(publishedDocForDisplay({ ...prepared.snapshot, content: richContent() }, prepared.text)).toBeNull();
    expect(publishedDocForDisplay(prepared.snapshot, prepared.text)).toEqual(prepared.snapshot);
  });
});
