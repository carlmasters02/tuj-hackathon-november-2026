"use client";
import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { applyTemplate, FONTS, MARGINS, newId, PAGE_SIZES, type DocComment, type DocMeta, type FontKey, type Setup } from "@hm/shared/docMeta";
import { inText, referenceText, SourceSchema, sortedSources, type Source } from "@hm/shared/citations";
import { applyEvent, type StoredBatch } from "@hm/shared/provenance/index";

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="mb-1 block text-xs font-semibold text-fg-dim">{children}</span>;
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
    <h3 className="text-sm font-bold">{title}</h3>
    {children}
  </section>
);

// ── Page setup ────────────────────────────────────────────────────────────
export function SetupPanel({ meta, setMeta }: { meta: DocMeta; setMeta: (m: DocMeta) => void }) {
  const s = meta.setup;
  const set = (p: Partial<Setup>) => setMeta({ ...meta, setup: { ...s, ...p } });
  const field = (k: "author" | "instructor" | "course" | "affiliation" | "date", label: string, ph: string) => (
    <label className="block">
      <Lbl>{label}</Lbl>
      <input className="input py-1.5" value={s[k]} maxLength={120} placeholder={ph} onChange={(e) => set({ [k]: e.target.value })} />
    </label>
  );
  return (
    <div className="space-y-5">
      <Section title="Template">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Template">
          {([["none", "Plain", "Your own layout"], ["mla", "MLA 9", "Heading block, Works Cited"], ["apa", "APA 7", "Title page, References"]] as const).map(([k, name, note]) => (
            <button key={k} type="button" role="radio" aria-checked={s.template === k} onClick={() => setMeta(applyTemplate(meta, k))} className={`rounded-xl border p-2 text-left transition ${s.template === k ? "border-fg bg-sun-soft" : "border-line hover:border-fg-faint"}`}>
              <span className="block text-sm font-bold">{name}</span>
              <span className="block text-[11px] leading-tight text-fg-dim">{note}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-fg-faint">MLA and APA set Times New Roman 12 pt, double spacing and 1-inch margins, like Word&apos;s templates.</p>
      </Section>
      {s.template !== "none" && (
        <Section title={s.template === "mla" ? "Heading" : "Title page"}>
          {field("author", "Your name", "Jordan Lee")}
          {s.template === "apa" && field("affiliation", "School / department", "Department of Biology, Temple University Japan")}
          {field("course", "Course", "ENG 101")}
          {field("instructor", "Instructor", "Prof. Tanaka")}
          <div className="flex items-end gap-2">
            <div className="flex-1">{field("date", s.template === "apa" ? "Due date" : "Date", "21 November 2026")}</div>
            <button type="button" className="btn mb-0.5 px-2.5 py-1.5" onClick={() => set({ date: new Date().toLocaleDateString(s.template === "mla" ? "en-GB" : "en-US", { day: "numeric", month: "long", year: "numeric" }) })}>Today</button>
          </div>
        </Section>
      )}
      <Section title="Page">
        <div className="grid grid-cols-2 gap-2">
          <label><Lbl>Size</Lbl><select className="input py-1.5" value={s.page} onChange={(e) => set({ page: e.target.value as Setup["page"] })}>{Object.entries(PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label><Lbl>Margins</Lbl><select className="input py-1.5" value={s.margins} onChange={(e) => set({ margins: e.target.value as Setup["margins"] })}>{Object.entries(MARGINS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label><Lbl>Font</Lbl><select className="input py-1.5" value={s.font} onChange={(e) => set({ font: e.target.value as FontKey })}>{Object.entries(FONTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label><Lbl>Size (pt)</Lbl><select className="input py-1.5" value={s.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })}>{[10, 11, 12, 13, 14, 16].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label><Lbl>Line spacing</Lbl><select className="input py-1.5" value={s.lineSpacing} onChange={(e) => set({ lineSpacing: Number(e.target.value) as Setup["lineSpacing"] })}>{[1, 1.15, 1.5, 2].map((n) => <option key={n} value={n}>{n === 2 ? "Double" : n === 1 ? "Single" : n}</option>)}</select></label>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[var(--color-fg)]" checked={s.pageNumbers} onChange={(e) => set({ pageNumbers: e.target.checked })} />Page numbers</label>
        </div>
      </Section>
      <Section title="Word goal">
        <label className="flex items-center gap-2"><input type="number" min={0} max={200000} step={50} className="input w-32 py-1.5" value={meta.wordGoal || ""} placeholder="e.g. 1500" onChange={(e) => setMeta({ ...meta, wordGoal: Math.max(0, Math.min(200000, Number(e.target.value) || 0)) })} /><span className="text-sm text-fg-dim">words</span></label>
      </Section>
    </div>
  );
}

// ── Sources & citations ───────────────────────────────────────────────────
const EMPTY: Omit<Source, "id"> = { type: "book", authors: [{ given: "", family: "" }], title: "", container: "", publisher: "", year: "", volume: "", issue: "", pages: "", url: "", accessed: "" };

export function SourcesPanel({ meta, setMeta, onCite }: { meta: DocMeta; setMeta: (m: DocMeta) => void; onCite: (id: string) => void }) {
  const [edit, setEdit] = useState<Source | null>(null);
  const [err, setErr] = useState("");
  const style = meta.citationStyle;
  const save = () => {
    if (!edit) return;
    const cleaned = { ...edit, authors: edit.authors.filter((a) => a.family.trim()), url: edit.url.trim() && !/^https?:\/\//.test(edit.url.trim()) ? `https://${edit.url.trim()}` : edit.url.trim() };
    const r = SourceSchema.safeParse(cleaned);
    if (!r.success) return setErr(r.error.issues[0]?.path.join(".") === "title" ? "Every source needs a title." : r.error.issues[0]?.path[0] === "year" ? "Year should look like 2021 or n.d." : r.error.issues[0]?.path[0] === "url" ? "The link should be a web address." : "Check the highlighted fields.");
    const exists = meta.sources.some((x) => x.id === r.data.id);
    setMeta({ ...meta, sources: exists ? meta.sources.map((x) => (x.id === r.data.id ? r.data : x)) : [...meta.sources, r.data] });
    setEdit(null);
    setErr("");
  };
  if (edit) {
    const set = (p: Partial<Source>) => setEdit({ ...edit, ...p });
    const container = edit.type === "article" ? "Journal" : edit.type === "website" ? "Website name" : edit.type === "chapter" ? "Book title" : "Series or collection";
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{meta.sources.some((x) => x.id === edit.id) ? "Edit source" : "New source"}</h3><button type="button" aria-label="Close" onClick={() => setEdit(null)} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button></div>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Source type">
          {(["book", "article", "website", "chapter", "other"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={edit.type === t} onClick={() => set({ type: t })} className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${edit.type === t ? "border-fg bg-fg text-surface" : "border-line hover:border-fg-faint"}`}>{t}</button>
          ))}
        </div>
        <div>
          <Lbl>Authors</Lbl>
          <div className="space-y-1.5">
            {edit.authors.map((a, i) => (
              <div key={i} className="flex gap-1.5">
                <input className="input py-1.5" placeholder="First name" value={a.given} maxLength={80} onChange={(e) => set({ authors: edit.authors.map((x, j) => (j === i ? { ...x, given: e.target.value } : x)) })} />
                <input className="input py-1.5" placeholder="Last name" value={a.family} maxLength={80} onChange={(e) => set({ authors: edit.authors.map((x, j) => (j === i ? { ...x, family: e.target.value } : x)) })} />
                <button type="button" aria-label="Remove author" className="rounded px-1 text-fg-faint hover:text-redpen" onClick={() => set({ authors: edit.authors.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>
              </div>
            ))}
            {edit.authors.length < 20 && <button type="button" className="text-xs font-semibold text-fg-dim hover:text-fg" onClick={() => set({ authors: [...edit.authors, { given: "", family: "" }] })}>+ Add author</button>}
          </div>
        </div>
        <label className="block"><Lbl>Title</Lbl><input className="input py-1.5" value={edit.title} maxLength={300} onChange={(e) => set({ title: e.target.value })} /></label>
        <label className="block"><Lbl>{container}</Lbl><input className="input py-1.5" value={edit.container} maxLength={300} onChange={(e) => set({ container: e.target.value })} /></label>
        <div className="grid grid-cols-3 gap-1.5">
          <label><Lbl>Year</Lbl><input className="input py-1.5" value={edit.year} placeholder="2021" maxLength={5} onChange={(e) => set({ year: e.target.value })} /></label>
          {edit.type === "article" && <label><Lbl>Volume</Lbl><input className="input py-1.5" value={edit.volume} maxLength={20} onChange={(e) => set({ volume: e.target.value })} /></label>}
          {edit.type === "article" && <label><Lbl>Issue</Lbl><input className="input py-1.5" value={edit.issue} maxLength={20} onChange={(e) => set({ issue: e.target.value })} /></label>}
          {(edit.type === "article" || edit.type === "chapter") && <label><Lbl>Pages</Lbl><input className="input py-1.5" value={edit.pages} placeholder="45-60" maxLength={30} onChange={(e) => set({ pages: e.target.value })} /></label>}
        </div>
        {edit.type !== "article" && <label className="block"><Lbl>Publisher</Lbl><input className="input py-1.5" value={edit.publisher} maxLength={200} onChange={(e) => set({ publisher: e.target.value })} /></label>}
        <label className="block"><Lbl>Link (optional)</Lbl><input className="input py-1.5" value={edit.url} maxLength={500} placeholder="https://doi.org/…" onChange={(e) => set({ url: e.target.value })} /></label>
        {edit.type === "website" && <label className="block"><Lbl>Accessed</Lbl><input className="input py-1.5" value={edit.accessed} maxLength={40} placeholder="21 Nov. 2026" onChange={(e) => set({ accessed: e.target.value })} /></label>}
        {err && <p role="alert" className="text-sm text-redpen">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={save}>Save source</button></div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Citation style" className="flex rounded-xl border border-line bg-surface p-0.5">
          {(["apa", "mla"] as const).map((st) => <button key={st} type="button" role="radio" aria-checked={style === st} onClick={() => setMeta({ ...meta, citationStyle: st })} className={`rounded-[9px] px-3 py-1 text-xs font-bold uppercase ${style === st ? "bg-fg text-surface" : "text-fg-dim"}`}>{st}</button>)}
        </div>
        <button type="button" className="btn px-3 py-1.5" onClick={() => setEdit({ ...EMPTY, id: newId() })}><Plus className="h-4 w-4" />Add source</button>
      </div>
      {meta.sources.length === 0 ? (
        <p className="text-sm text-fg-dim">Add each book, article or website you use. Then cite it from the toolbar, and the {style === "apa" ? "References" : "Works Cited"} page builds itself in {style.toUpperCase()} style.</p>
      ) : (
        <ul className="space-y-2">
          {sortedSources(meta.sources).map((src) => (
            <li key={src.id} className="rounded-xl border border-line bg-surface p-3">
              <p className="font-serif text-sm leading-snug">{referenceText(src, style)}</p>
              <div className="mt-2 flex items-center gap-1">
                <button type="button" className="btn px-2.5 py-1 text-xs" onClick={() => onCite(src.id)}>Cite {inText(src, style)}</button>
                <span className="flex-1" />
                <button type="button" aria-label="Edit source" className="rounded p-1.5 text-fg-dim hover:bg-muted hover:text-fg" onClick={() => setEdit(src)}><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Delete source" className="rounded p-1.5 text-fg-dim hover:bg-redpen-dim hover:text-redpen" onClick={() => setMeta({ ...meta, sources: meta.sources.filter((x) => x.id !== src.id) })}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Comments ──────────────────────────────────────────────────────────────
export function commentRanges(editor: Editor) {
  const out = new Map<string, { from: number; to: number; text: string }>();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const m of node.marks) {
      if (m.type.name !== "comment") continue;
      const prev = out.get(m.attrs.id);
      const from = prev ? Math.min(prev.from, pos) : pos;
      const to = prev ? Math.max(prev.to, pos + node.nodeSize) : pos + node.nodeSize;
      out.set(m.attrs.id, { from, to, text: editor.state.doc.textBetween(from, to, " ") });
    }
  });
  return out;
}

export function CommentsPanel({ editor, meta, setMeta, focusId }: { editor: Editor; meta: DocMeta; setMeta: (m: DocMeta) => void; focusId: string | null }) {
  const ranges = commentRanges(editor);
  const [showResolved, setShowResolved] = useState(false);
  const list = meta.comments.filter((c) => showResolved || !c.resolved);
  const upd = (id: string, p: Partial<DocComment>) => setMeta({ ...meta, comments: meta.comments.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const remove = (id: string) => {
    const r = ranges.get(id);
    if (r) editor.chain().setTextSelection({ from: r.from, to: r.to }).unsetMark("comment").run();
    setMeta({ ...meta, comments: meta.comments.filter((c) => c.id !== id) });
  };
  const select = (id: string) => {
    const r = ranges.get(id);
    if (r) editor.chain().focus().setTextSelection({ from: r.from, to: r.to }).scrollIntoView().run();
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-faint">Comments are private notes to yourself. They are never published or included in a certificate.</p>
      {list.length === 0 && <p className="text-sm text-fg-dim">No comments. Select some text and press the comment button in the toolbar.</p>}
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id} className={`rounded-xl border p-3 ${c.resolved ? "border-line opacity-60" : "border-sun bg-sun-soft/50"}`}>
            <button type="button" className="mb-1.5 block w-full truncate text-left font-serif text-xs text-fg-dim italic hover:text-fg" onClick={() => select(c.id)}>
              “{ranges.get(c.id)?.text || "text was deleted"}”
            </button>
            <textarea className="input min-h-[60px] py-1.5 text-sm" autoFocus={focusId === c.id} value={c.body} maxLength={2000} placeholder="Write a note…" onChange={(e) => upd(c.id, { body: e.target.value })} />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-fg-faint">{new Date(c.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
              <span className="flex gap-1">
                <button type="button" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold hover:bg-muted" onClick={() => upd(c.id, { resolved: !c.resolved })}><Check className="h-3.5 w-3.5" />{c.resolved ? "Reopen" : "Resolve"}</button>
                <button type="button" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-redpen hover:bg-redpen-dim" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" />Delete</button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {meta.comments.some((c) => c.resolved) && <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />Show resolved</label>}
    </div>
  );
}

// ── Outline ───────────────────────────────────────────────────────────────
export function OutlinePanel({ editor }: { editor: Editor }) {
  const heads: { level: number; text: string; pos: number }[] = [];
  editor.state.doc.descendants((n, pos) => {
    if (n.type.name === "heading" && n.textContent.trim()) heads.push({ level: n.attrs.level, text: n.textContent, pos });
  });
  if (!heads.length) return <p className="text-sm text-fg-dim">Headings you add (Title, Heading 1–3 in the style menu) appear here so you can jump between sections.</p>;
  return (
    <nav aria-label="Document outline">
      <ul className="space-y-0.5">
        {heads.map((h) => (
          <li key={h.pos}>
            <button type="button" style={{ paddingLeft: (h.level - 1) * 14 + 8 }} className={`w-full truncate rounded-lg py-1.5 pr-2 text-left hover:bg-muted ${h.level === 1 ? "font-bold" : h.level === 2 ? "font-semibold" : "text-fg-dim"}`} onClick={() => {
              editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, h.pos + 1)).scrollIntoView());
              editor.view.focus();
              (editor.view.nodeDOM(h.pos) as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}>{h.text}</button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Version history (replayed from the owner's own keystroke log) ─────────
export function HistoryPanel({ docId }: { docId: string }) {
  const [batches, setBatches] = useState<StoredBatch[] | null>(null);
  const [err, setErr] = useState("");
  const [i, setI] = useState(0);
  useEffect(() => {
    fetch(`/api/docs/${docId}/history`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setBatches(d.batches);
        setI(d.batches.flatMap((b: StoredBatch) => b.events).length);
      })
      .catch(() => setErr("Couldn't load the history."));
  }, [docId]);
  const events = useMemo(() => (batches ?? []).flatMap((b) => b.events.map((e) => ({ e, at: b.receivedAt }))).filter((x) => x.e.type !== "focus" && x.e.type !== "blur"), [batches]);
  const text = useMemo(() => events.slice(0, i).reduce((t, x) => applyEvent(t, x.e), ""), [events, i]);
  if (err) return <p className="text-sm text-redpen">{err}</p>;
  if (!batches) return <p className="text-sm text-fg-dim">Loading history…</p>;
  if (!events.length) return <p className="text-sm text-fg-dim">Nothing recorded yet.</p>;
  const at = events[Math.max(0, i - 1)]?.at;
  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-faint">Every version, rebuilt from your keystroke log. Drag to travel back in time; your document isn&apos;t changed.</p>
      <input type="range" min={0} max={events.length} value={i} onChange={(e) => setI(Number(e.target.value))} className="w-full accent-[var(--color-fg)]" aria-label="Point in history" />
      <div className="flex justify-between text-xs font-semibold text-fg-dim tabular-nums">
        <span>Edit {i} of {events.length}</span>
        <span>{at ? new Date(at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""}</span>
      </div>
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-line bg-white p-3 font-serif text-sm leading-relaxed whitespace-pre-wrap">{text || <span className="text-fg-faint">Empty page</span>}</div>
    </div>
  );
}
