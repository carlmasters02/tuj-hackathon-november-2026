import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { strFromU8, unzipSync } from "fflate";
import { defaultMeta } from "@hm/shared/docMeta";
import type { Source } from "@hm/shared/citations";
import { exportDocx } from "../src/components/editor/exportDocx";

const source: Source = {
  id: "source1", type: "book", authors: [{ given: "Test", family: "Author" }], title: "A Reference",
  container: "", publisher: "Publisher", year: "2024", volume: "", issue: "", pages: "", url: "", accessed: "",
};

describe("DOCX export smoke test", () => {
  it("creates a readable Word archive with body text, references and real footnotes", async () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [
          { type: "text", text: "DOCX_UNZIP_MARKER", marks: [{ type: "bold" }, { type: "comment", attrs: { id: "private1" } }] },
          { type: "citation", attrs: { sourceId: source.id } },
          { type: "footnoteRef", attrs: { id: "note1" } },
        ] },
        { type: "footnotes", content: [{ type: "footnote", attrs: { id: "note1" }, content: [{ type: "paragraph", content: [{ type: "text", text: "FOOTNOTE_XML_MARKER" }] }] }] },
      ],
    };
    const meta = {
      ...defaultMeta(), sources: [source],
      comments: [{ id: "private1", body: "PRIVATE_COMMENT_NEVER_EXPORT", createdAt: "now", resolved: false }],
    };

    const blob = await exportDocx(content, meta, "Smoke test");
    const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const documentXml = strFromU8(archive["word/document.xml"]);
    const footnotesXml = strFromU8(archive["word/footnotes.xml"]);

    expect(documentXml).toContain("DOCX_UNZIP_MARKER");
    expect(documentXml).toContain("A Reference");
    expect(documentXml).toContain("(Author, 2024)");
    expect(footnotesXml).toContain("FOOTNOTE_XML_MARKER");
    expect(documentXml).not.toContain("PRIVATE_COMMENT_NEVER_EXPORT");
    expect(footnotesXml).not.toContain("PRIVATE_COMMENT_NEVER_EXPORT");
  });
});
