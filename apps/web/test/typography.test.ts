import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { FONTS } from "@hm/shared/docMeta";

const css = fs.readFileSync("apps/web/src/app/globals.css", "utf8");

describe("self-hosted application typography", () => {
  it("uses only local font assets, including the writer's Bricolage option", () => {
    expect(css).toContain('@import "@fontsource-variable/source-sans-3"');
    expect(css).toContain('@import "@fontsource-variable/playfair-display"');
    expect(css).toContain('@import "@fontsource-variable/bricolage-grotesque"');
    expect(css).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com|@import\s+url\(/);
    expect(css).toContain('--font-sans: "Source Sans 3 Variable"');
    expect(css).toContain('--font-display: "Playfair Display Variable"');
    expect(FONTS.rounded.css).toContain("Bricolage Grotesque Variable");
  });

  it("keeps display headings separate from long-form and publication document fonts", () => {
    expect(css).toContain('.hm-doc :is(h1, h2, h3, h4, h5, h6) { font-family: inherit; }');
    expect(css).toContain(".hm-editor .ProseMirror h1, .hm-editor .ProseMirror h2, .hm-editor .ProseMirror h3 { font-family: var(--font-sans); font-weight: 800; }");
    expect(css).toContain('--font-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, ui-serif, serif;');
  });
});
