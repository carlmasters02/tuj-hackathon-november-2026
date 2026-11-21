/**
 * Document settings for the Word-style writer: page setup, template, sources, comments and a word
 * goal. Kept outside the recorded text on purpose: changing them never alters what was typed.
 */
import { z } from "zod";
import { SourceSchema } from "./citations";

export const PAGE_SIZES = { letter: { label: "US Letter", w: 8.5, h: 11 }, a4: { label: "A4", w: 8.27, h: 11.69 } } as const;
export const MARGINS = { normal: { label: "Normal (1 in)", in: 1 }, narrow: { label: "Narrow (0.5 in)", in: 0.5 }, wide: { label: "Wide (1.25 in)", in: 1.25 } } as const;
export const FONTS = {
  times: { label: "Times New Roman", css: `"Times New Roman", Tinos, "Liberation Serif", Times, serif`, docx: "Times New Roman" },
  book: { label: "Book serif", css: `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`, docx: "Palatino Linotype" },
  georgia: { label: "Georgia", css: `Georgia, "DejaVu Serif", serif`, docx: "Georgia" },
  arial: { label: "Arial", css: `Arial, Arimo, "Liberation Sans", Helvetica, sans-serif`, docx: "Arial" },
  rounded: { label: "Bricolage", css: `"Bricolage Grotesque Variable", system-ui, sans-serif`, docx: "Calibri" },
  mono: { label: "Monospace", css: `ui-monospace, "Cascadia Code", Menlo, Consolas, monospace`, docx: "Consolas" },
} as const;
export type FontKey = keyof typeof FONTS;

const Field = z.string().trim().max(120).default("");

export const SetupSchema = z
  .object({
    page: z.enum(["letter", "a4"]).default("letter"),
    margins: z.enum(["normal", "narrow", "wide"]).default("normal"),
    template: z.enum(["none", "mla", "apa"]).default("none"),
    font: z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]]).default("book"),
    fontSize: z.number().int().min(8).max(28).default(12), // points
    lineSpacing: z.union([z.literal(1), z.literal(1.15), z.literal(1.5), z.literal(2)]).default(1.15),
    pageNumbers: z.boolean().default(true),
    author: Field,
    instructor: Field,
    course: Field,
    affiliation: Field,
    date: Field,
  })
  .strict();
export type Setup = z.infer<typeof SetupSchema>;

export const CommentSchema = z
  .object({ id: z.string().regex(/^[a-z0-9]{6,16}$/), body: z.string().trim().max(2000), createdAt: z.string().max(40), resolved: z.boolean().default(false) })
  .strict();
export type DocComment = z.infer<typeof CommentSchema>;

export const DocMetaSchema = z
  .object({
    setup: SetupSchema.prefault({}),
    citationStyle: z.enum(["apa", "mla"]).default("apa"),
    sources: z.array(SourceSchema).max(300).default([]),
    comments: z.array(CommentSchema).max(500).default([]),
    wordGoal: z.number().int().min(0).max(200_000).default(0),
  })
  .strict();
export type DocMeta = z.infer<typeof DocMetaSchema>;

export const defaultMeta = (): DocMeta => DocMetaSchema.parse({});

/** Templates set sensible defaults the way Word's MLA/APA templates do. */
export function applyTemplate(meta: DocMeta, template: Setup["template"]): DocMeta {
  const setup = { ...meta.setup, template };
  if (template === "mla" || template === "apa") Object.assign(setup, { font: "times", fontSize: 12, lineSpacing: 2, margins: "normal", pageNumbers: true });
  return { ...meta, setup, citationStyle: template === "mla" ? "mla" : template === "apa" ? "apa" : meta.citationStyle };
}

/** Parse stored settings leniently: anything invalid falls back to defaults rather than failing. */
export function parseMeta(raw: unknown): DocMeta {
  const r = DocMetaSchema.safeParse(raw ?? {});
  return r.success ? r.data : defaultMeta();
}

export const newId = () => Math.random().toString(36).slice(2, 12).padEnd(8, "0");
