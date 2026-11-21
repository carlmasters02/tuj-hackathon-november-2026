/**
 * Word export (.docx) built from the editor's JSON with the `docx` library. Loaded on demand.
 * Pure document generation in the browser: nothing is uploaded anywhere.
 */
import type { JSONContent } from "@tiptap/core";
import { FONTS, MARGINS, PAGE_SIZES, type DocMeta } from "@hm/shared/docMeta";
import { inText, listHeading, reference, sortedSources } from "@hm/shared/citations";

export async function exportDocx(json: JSONContent, meta: DocMeta, title: string): Promise<Blob> {
  const d = await import("docx");
  const { AlignmentType, Document, ExternalHyperlink, FootnoteReferenceRun, Header, Footer, HeadingLevel, LevelFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } = d;
  const s = meta.setup;
  const twip = (inch: number) => Math.round(inch * 1440);
  const font = FONTS[s.font].docx;
  const lineRule = Math.round(240 * s.lineSpacing);
  const academic = s.template === "mla" || s.template === "apa";
  const hex = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.slice(1).toUpperCase() : undefined);
  const align = (a?: string) => (a === "center" ? AlignmentType.CENTER : a === "right" ? AlignmentType.RIGHT : a === "justify" ? AlignmentType.JUSTIFIED : undefined);

  // footnotes: numbered in the order their markers appear
  const notes = new Map<string, JSONContent>();
  const body = (json.content ?? []).filter((n) => {
    if (n.type !== "footnotes") return true;
    for (const f of n.content ?? []) notes.set(f.attrs?.id, f);
    return false;
  });
  const footnotes: Record<number, { children: InstanceType<typeof Paragraph>[] }> = {};
  const noteNo = new Map<string, number>();

  type Run = InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink> | InstanceType<typeof FootnoteReferenceRun>;
  const runs = (nodes: JSONContent[] = []): Run[] => {
    const out: Run[] = [];
    for (const n of nodes) {
      if (n.type === "hardBreak") out.push(new TextRun({ text: "", break: 1 }));
      else if (n.type === "citation") {
        const src = meta.sources.find((x) => x.id === n.attrs?.sourceId);
        out.push(new TextRun({ text: inText(src, meta.citationStyle, n.attrs?.locator ?? "") }));
      } else if (n.type === "footnoteRef") {
        const id = n.attrs?.id as string;
        if (!noteNo.has(id)) {
          const k = noteNo.size + 1;
          noteNo.set(id, k);
          const f = notes.get(id);
          footnotes[k] = { children: (f?.content ?? [{ type: "paragraph" }]).map((p) => new Paragraph({ children: runs(p.content) as any })) };
        }
        out.push(new FootnoteReferenceRun(noteNo.get(id)!));
      } else if (n.type === "text") {
        const marks = Object.fromEntries((n.marks ?? []).map((m) => [m.type, m.attrs ?? {}]));
        const ts = marks.textStyle ?? {};
        const size = ts.fontSize ? Math.round(parseFloat(ts.fontSize) * 2) : undefined;
        const fam = ts.fontFamily ? Object.values(FONTS).find((f) => f.css === ts.fontFamily)?.docx : undefined;
        const run = new TextRun({
          text: n.text ?? "",
          bold: !!marks.bold, italics: !!marks.italic, strike: !!marks.strike,
          underline: marks.underline || marks.link ? {} : undefined,
          subScript: !!marks.subscript, superScript: !!marks.superscript,
          color: hex(ts.color) ?? (marks.link ? "1F4E9A" : undefined),
          size, font: fam,
          shading: marks.highlight ? { type: ShadingType.CLEAR, color: "auto", fill: hex(marks.highlight.color) ?? "FDF1C7" } : undefined,
        });
        out.push(marks.link?.href ? new ExternalHyperlink({ link: marks.link.href, children: [run] }) : run);
      }
    }
    return out;
  };

  let listInstance = 0;
  const blocks = (nodes: JSONContent[], ctx: { list?: { ref: string; level: number; instance: number }; quote?: boolean } = {}): (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] => {
    const out: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
    for (const n of nodes) {
      switch (n.type) {
        case "paragraph":
          out.push(new Paragraph({
            children: runs(n.content) as any,
            alignment: align(n.attrs?.textAlign),
            numbering: ctx.list ? { reference: ctx.list.ref, level: ctx.list.level, instance: ctx.list.instance } : undefined,
            indent: ctx.quote ? { left: twip(0.5) } : academic && !ctx.list ? { firstLine: twip(0.5) } : undefined,
          }));
          break;
        case "heading": {
          const lv = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][Math.min(3, (n.attrs?.level ?? 1) - 1)];
          out.push(new Paragraph({ heading: lv, alignment: align(n.attrs?.textAlign), children: runs(n.content) as any }));
          break;
        }
        case "blockquote":
          out.push(...blocks(n.content ?? [], { ...ctx, quote: true }));
          break;
        case "bulletList":
        case "orderedList":
        case "taskList": {
          const ref = n.type === "orderedList" ? "numbers" : "bullets";
          const instance = ctx.list && ctx.list.ref === ref ? ctx.list.instance : ++listInstance;
          const level = ctx.list ? ctx.list.level + 1 : 0;
          for (const item of n.content ?? []) {
            const [first, ...rest] = item.content ?? [];
            if (first?.type === "paragraph") {
              const box = item.type === "taskItem" ? [{ type: "text", text: item.attrs?.checked ? "☑ " : "☐ " } as JSONContent] : [];
              out.push(...blocks([{ ...first, content: [...box, ...(first.content ?? [])] }], { list: { ref, level, instance } }));
            }
            out.push(...blocks(rest, { list: { ref, level, instance } }));
          }
          break;
        }
        case "table":
          out.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: (n.content ?? []).map((row, ri) => new TableRow({
              tableHeader: ri === 0 && row.content?.[0]?.type === "tableHeader",
              children: (row.content ?? []).map((cell) => new TableCell({
                columnSpan: cell.attrs?.colspan ?? 1,
                rowSpan: cell.attrs?.rowspan ?? 1,
                shading: cell.type === "tableHeader" ? { type: ShadingType.CLEAR, color: "auto", fill: "F1E7D2" } : undefined,
                children: blocks(cell.content ?? [{ type: "paragraph" }]) as any,
              })),
            })),
          }));
          break;
        case "pageBreak":
          out.push(new Paragraph({ children: [new PageBreak()] }));
          break;
      }
    }
    return out;
  };

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  if (s.template === "apa") {
    children.push(
      ...[0, 1, 2].map(() => new Paragraph({ children: [] })),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true })] }),
      new Paragraph({ children: [] }),
      ...[s.author, s.affiliation, s.course, s.instructor, s.date].filter(Boolean).map((t) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(t)] })),
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true })] }),
    );
  } else if (s.template === "mla") {
    children.push(...[s.author, s.instructor, s.course, s.date].map((t) => new Paragraph({ children: [new TextRun(t)] })), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(title)] }));
  }
  children.push(...blocks(body));
  if (meta.sources.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: listHeading(meta.citationStyle), bold: meta.citationStyle === "apa" })] }));
    for (const src of sortedSources(meta.sources)) {
      children.push(new Paragraph({ indent: { left: twip(0.5), hanging: twip(0.5) }, children: reference(src, meta.citationStyle).map((seg) => new TextRun({ text: seg.text, italics: seg.italic })) }));
    }
  }

  const size = PAGE_SIZES[s.page];
  const m = twip(MARGINS[s.margins].in);
  const surname = s.author.trim().split(/\s+/).pop() ?? "";
  const pageNo = (alignment: (typeof AlignmentType)[keyof typeof AlignmentType]) => new Paragraph({ alignment, children: [new TextRun({ children: s.template === "mla" ? [`${surname} `, PageNumber.CURRENT] : [PageNumber.CURRENT] })] });

  const doc = new Document({
    title,
    creator: s.author || undefined,
    description: "Written in Humagination",
    styles: { default: { document: { run: { font, size: s.fontSize * 2 }, paragraph: { spacing: { line: lineRule, after: academic ? 0 : 120 } } } } },
    numbering: {
      config: [
        { reference: "bullets", levels: [0, 1, 2, 3].map((level) => ({ level, format: LevelFormat.BULLET, text: ["•", "◦", "▪", "•"][level], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: twip(0.5 * (level + 1)), hanging: twip(0.25) } } } })) },
        { reference: "numbers", levels: [0, 1, 2, 3].map((level) => ({ level, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN, LevelFormat.DECIMAL][level], text: `%${level + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: twip(0.5 * (level + 1)), hanging: twip(0.25) } } } })) },
      ],
    },
    footnotes,
    sections: [
      {
        properties: { page: { size: { width: twip(size.w), height: twip(size.h) }, margin: { top: m, bottom: m, left: m, right: m, header: Math.round(m / 2), footer: Math.round(m / 2) } } },
        headers: s.pageNumbers && academic ? { default: new Header({ children: [pageNo(AlignmentType.RIGHT)] }) } : undefined,
        footers: s.pageNumbers && !academic ? { default: new Footer({ children: [pageNo(AlignmentType.CENTER)] }) } : undefined,
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}
