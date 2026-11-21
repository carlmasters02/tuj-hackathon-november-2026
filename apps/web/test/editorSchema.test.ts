import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { pmDocToText } from "@hm/shared/provenance/pmText";
import { editorExtensions, SAFE_URL } from "../src/lib/editorExtensions";

const schema = getSchema(editorExtensions());
const load = (json: unknown) => {
  const n = PMNode.fromJSON(schema, json as any);
  n.check();
  return n;
};
const p = (text?: string) => ({ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) });

describe("writer schema (shared by browser and server)", () => {
  it("has the Word-style features", () => {
    for (const n of ["table", "tableRow", "tableCell", "taskList", "taskItem", "pageBreak", "citation", "footnoteRef", "footnotes", "footnote"]) expect(schema.nodes[n], n).toBeDefined();
    for (const m of ["bold", "italic", "underline", "strike", "link", "textStyle", "highlight", "subscript", "superscript", "comment"]) expect(schema.marks[m], m).toBeDefined();
  });
  it("citations, footnote markers, page breaks and formatting add nothing to the recorded text", () => {
    const doc = load({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Sleep helps " }, { type: "text", text: "memory", marks: [{ type: "bold" }, { type: "comment", attrs: { id: "c1abcd" } }] }, { type: "citation", attrs: { sourceId: "abc123" } }, { type: "text", text: "." }, { type: "footnoteRef", attrs: { id: "n1" } }] },
        { type: "pageBreak" },
        { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [p("a")] }, { type: "tableCell", content: [p("b")] }] }] },
        { type: "footnotes", content: [{ type: "footnote", attrs: { id: "n1" }, content: [p("See chapter 2.")] }] },
      ],
    });
    expect(pmDocToText(doc)).toBe("Sleep helps memory.\na\nb\nSee chapter 2.");
  });
  it("still loads documents written before the upgrade", () => {
    expect(() => load({ type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hi" }] }, p(), { type: "bulletList", content: [{ type: "listItem", content: [p("x")] }] }] })).not.toThrow();
  });
  it("keeps the notes section at the very end", () => {
    expect(() => load({ type: "doc", content: [{ type: "footnotes", content: [{ type: "footnote", attrs: { id: "n1" }, content: [p()] }] }, p()] })).toThrow();
  });
  it("only allows web and email links", () => {
    expect(SAFE_URL.test("https://example.com/a?b=c")).toBe(true);
    expect(SAFE_URL.test("mailto:me@example.com")).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "https://exa mple.com"]) expect(SAFE_URL.test(bad), bad).toBe(false);
  });
});
