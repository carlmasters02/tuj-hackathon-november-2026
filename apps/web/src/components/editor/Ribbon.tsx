"use client";
import { useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, BookMarked, Highlighter, IndentDecrease, IndentIncrease, Italic, Link as LinkIcon,
  List, ListChecks, ListOrdered, MessageSquarePlus, Quote, Redo2, RemoveFormatting, Search, SeparatorHorizontal, Strikethrough, Subscript, Superscript,
  Table as TableIcon, Trash2, Underline, Undo2, Asterisk,
} from "lucide-react";
import { FONTS, type FontKey } from "@hm/shared/docMeta";
import { inText, type CitationStyle, type Source } from "@hm/shared/citations";
import { SAFE_URL } from "@/lib/editorExtensions";
import { HIGHLIGHTS, Pop, Sep, SWATCHES, TB, TSelect } from "./ui";
import { insertCitation, insertFootnote, insertPageBreak } from "./clientExtensions";

const I = "h-[17px] w-[17px]";
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];
type Block = "p" | "h1" | "h2" | "h3" | "h4" | "quote";

export function Ribbon({
  editor, sources, style, onFind, onComment, onOpenSources, defaultFont, defaultSize,
}: {
  editor: Editor; sources: Source[]; style: CitationStyle; onFind: () => void; onComment: () => void; onOpenSources: () => void; defaultFont: FontKey; defaultSize: number;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes("textStyle");
      return {
        block: (e.isActive("heading", { level: 1 }) ? "h1" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : e.isActive("heading", { level: 4 }) ? "h4" : e.isActive("blockquote") ? "quote" : "p") as Block,
        font: (Object.entries(FONTS).find(([, f]) => f.css === ts.fontFamily)?.[0] ?? (ts.fontFamily ? "" : defaultFont)) as FontKey | "",
        size: ts.fontSize ? Math.round(parseFloat(ts.fontSize)) : defaultSize,
        bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
        sub: e.isActive("subscript"), sup: e.isActive("superscript"), link: e.isActive("link"),
        align: (["center", "right", "justify"].find((a) => e.isActive({ textAlign: a })) ?? "left") as string,
        bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), task: e.isActive("taskList"),
        inTable: e.isActive("table"), inList: e.isActive("listItem") || e.isActive("taskItem"),
        color: ts.color as string | undefined,
        canUndo: e.can().undo(), canRedo: e.can().redo(),
        empty: e.state.selection.empty,
      };
    },
  });
  const c = () => editor.chain().focus();
  const setBlock = (b: Block) => {
    if (b === "p") c().setParagraph().run();
    else if (b === "quote") c().toggleBlockquote().run();
    else c().setHeading({ level: Number(b[1]) as 1 | 2 | 3 | 4 }).run();
  };
  const listItem = s.task ? "taskItem" : "listItem";

  return (
    <div className="space-y-1">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 rounded-2xl border border-line bg-surface px-2 py-1.5 shadow-[var(--shadow-soft)]">
        <TB label="Undo (Ctrl+Z)" onClick={() => c().undo().run()} disabled={!s.canUndo}><Undo2 className={I} /></TB>
        <TB label="Redo (Ctrl+Shift+Z)" onClick={() => c().redo().run()} disabled={!s.canRedo}><Redo2 className={I} /></TB>
        <Sep />
        <TSelect<Block> label="Paragraph style" value={s.block} width={118} onChange={setBlock} options={[
          { value: "p", label: "Normal text" }, { value: "h1", label: "Title" }, { value: "h2", label: "Heading 1" }, { value: "h3", label: "Heading 2" }, { value: "h4", label: "Heading 3" }, { value: "quote", label: "Quote" },
        ]} />
        <TSelect<FontKey> label="Font" value={s.font} width={138} onChange={(f) => (f === defaultFont ? c().unsetFontFamily().run() : c().setFontFamily(FONTS[f].css).run())} options={(Object.keys(FONTS) as FontKey[]).map((k) => ({ value: k, label: FONTS[k].label, style: { fontFamily: FONTS[k].css } }))} />
        <TSelect<number> label="Font size (pt)" value={s.size} width={58} onChange={(n) => (n === defaultSize ? c().unsetFontSize().run() : c().setFontSize(`${n}pt`).run())} options={SIZES.map((n) => ({ value: n, label: String(n) }))} />
        <Sep />
        <TB label="Bold (Ctrl+B)" onClick={() => c().toggleBold().run()} active={s.bold}><Bold className={I} /></TB>
        <TB label="Italic (Ctrl+I)" onClick={() => c().toggleItalic().run()} active={s.italic}><Italic className={I} /></TB>
        <TB label="Underline (Ctrl+U)" onClick={() => c().toggleUnderline().run()} active={s.underline}><Underline className={I} /></TB>
        <TB label="Strikethrough" onClick={() => c().toggleStrike().run()} active={s.strike}><Strikethrough className={I} /></TB>
        <TB label="Subscript" onClick={() => c().toggleSubscript().run()} active={s.sub}><Subscript className={I} /></TB>
        <TB label="Superscript" onClick={() => c().toggleSuperscript().run()} active={s.sup}><Superscript className={I} /></TB>
        <Pop label="Text colour" active={!!s.color} width={196} trigger={<span className="flex flex-col items-center"><Baseline className={I} /><span className="-mt-0.5 h-[3px] w-4 rounded-full" style={{ background: s.color ?? "var(--color-fg)" }} /></span>}>
          {(close) => (
            <div>
              <div className="grid grid-cols-6 gap-1.5">
                {SWATCHES.map((col) => (
                  <button key={col} type="button" aria-label={col} onClick={() => { c().setColor(col).run(); close(); }} className="aspect-square rounded-full ring-1 ring-black/10 hover:scale-110" style={{ background: col }} />
                ))}
              </div>
              <button type="button" className="mt-2 w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => { c().unsetColor().run(); close(); }}>Automatic colour</button>
            </div>
          )}
        </Pop>
        <Pop label="Highlight" width={196} trigger={<Highlighter className={I} />}>
          {(close) => (
            <div>
              <div className="grid grid-cols-6 gap-1.5">
                {HIGHLIGHTS.map((h) => (
                  <button key={h.c} type="button" aria-label={h.n} onClick={() => { c().setHighlight({ color: h.c }).run(); close(); }} className="aspect-square rounded-md ring-1 ring-black/10 hover:scale-110" style={{ background: h.c }} />
                ))}
              </div>
              <button type="button" className="mt-2 w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => { c().unsetHighlight().run(); close(); }}>No highlight</button>
            </div>
          )}
        </Pop>
        <TB label="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}><RemoveFormatting className={I} /></TB>
        <Sep />
        <TB label="Align left" onClick={() => c().setTextAlign("left").run()} active={s.align === "left"}><AlignLeft className={I} /></TB>
        <TB label="Center" onClick={() => c().setTextAlign("center").run()} active={s.align === "center"}><AlignCenter className={I} /></TB>
        <TB label="Align right" onClick={() => c().setTextAlign("right").run()} active={s.align === "right"}><AlignRight className={I} /></TB>
        <TB label="Justify" onClick={() => c().setTextAlign("justify").run()} active={s.align === "justify"}><AlignJustify className={I} /></TB>
        <Sep />
        <TB label="Bulleted list" onClick={() => c().toggleBulletList().run()} active={s.bullet}><List className={I} /></TB>
        <TB label="Numbered list" onClick={() => c().toggleOrderedList().run()} active={s.ordered}><ListOrdered className={I} /></TB>
        <TB label="Checklist" onClick={() => c().toggleTaskList().run()} active={s.task}><ListChecks className={I} /></TB>
        <TB label="Decrease indent" onClick={() => c().liftListItem(listItem).run()} disabled={!s.inList}><IndentDecrease className={I} /></TB>
        <TB label="Increase indent" onClick={() => c().sinkListItem(listItem).run()} disabled={!s.inList}><IndentIncrease className={I} /></TB>
        <TB label="Quote" onClick={() => c().toggleBlockquote().run()} active={s.block === "quote"}><Quote className={I} /></TB>
        <Sep />
        <LinkPop editor={editor} active={s.link} />
        <Pop label="Insert table" width={212} trigger={<TableIcon className={I} />}>{(close) => <TableGrid onPick={(r, col) => { c().insertTable({ rows: r, cols: col, withHeaderRow: true }).run(); close(); }} />}</Pop>
        <TB label="Insert footnote (Ctrl+Alt+F)" onClick={() => insertFootnote(editor)}><Asterisk className={I} /></TB>
        <Pop label="Insert citation" width={300} trigger={<BookMarked className={I} />}>
          {(close) => <CitePicker sources={sources} style={style} onPick={(id, loc) => { insertCitation(editor, id, loc); close(); }} onManage={() => { close(); onOpenSources(); }} />}
        </Pop>
        <TB label="Page break (Ctrl+Enter)" onClick={() => insertPageBreak(editor)}><SeparatorHorizontal className={I} /></TB>
        <TB label={s.empty ? "Select text to comment on it" : "Add a comment"} onClick={onComment} disabled={s.empty}><MessageSquarePlus className={I} /></TB>
        <Sep />
        <TB label="Find and replace (Ctrl+F)" onClick={onFind}><Search className={I} /></TB>
      </div>
      {s.inTable && (
        <div role="toolbar" aria-label="Table" className="hm-pop flex flex-wrap items-center gap-0.5 rounded-xl border border-line bg-surface px-2 py-1 text-sm">
          <span className="mr-1 px-1 text-xs font-bold text-fg-dim">Table</span>
          <TB wide label="Insert row above" onClick={() => c().addRowBefore().run()}>Row above</TB>
          <TB wide label="Insert row below" onClick={() => c().addRowAfter().run()}>Row below</TB>
          <TB wide label="Insert column left" onClick={() => c().addColumnBefore().run()}>Column left</TB>
          <TB wide label="Insert column right" onClick={() => c().addColumnAfter().run()}>Column right</TB>
          <TB wide label="Toggle header row" onClick={() => c().toggleHeaderRow().run()}>Header row</TB>
          <TB wide label="Merge or split cells" onClick={() => c().mergeOrSplit().run()}>Merge/split</TB>
          <Sep />
          <TB wide label="Delete row" onClick={() => c().deleteRow().run()}>Delete row</TB>
          <TB wide label="Delete column" onClick={() => c().deleteColumn().run()}>Delete column</TB>
          <TB label="Delete table" onClick={() => c().deleteTable().run()}><Trash2 className="h-4 w-4 text-redpen" /></TB>
        </div>
      )}
    </div>
  );
}

function LinkPop({ editor, active }: { editor: Editor; active: boolean }) {
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  return (
    <Pop label={active ? "Edit link" : "Insert link"} active={active} width={300} trigger={<LinkIcon className={I} />}>
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = /^[a-z]+:/i.test(url) ? url.trim() : `https://${url.trim()}`;
            if (!SAFE_URL.test(v)) return setErr("Use a web address (https://…) or an email (mailto:…).");
            const ch = editor.chain().focus().extendMarkRange("link");
            if (editor.state.selection.empty && !active) ch.insertContent({ type: "text", text: url.trim(), marks: [{ type: "link", attrs: { href: v } }] }).run();
            else ch.setLink({ href: v }).run();
            setUrl("");
            setErr("");
            close();
          }}
          method="post"
          className="space-y-2"
        >
          <label className="block text-xs font-semibold text-fg-dim" htmlFor="hm-link">Link address</label>
          <input id="hm-link" autoFocus className="input py-1.5" placeholder="example.com/article" value={url || editor.getAttributes("link").href || ""} onChange={(e) => setUrl(e.target.value)} />
          {err && <p className="text-xs text-redpen">{err}</p>}
          <div className="flex justify-between gap-2">
            {active ? <button type="button" className="text-sm font-semibold text-redpen" onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); close(); }}>Remove link</button> : <span />}
            <button className="btn btn-primary px-3 py-1.5">Apply</button>
          </div>
        </form>
      )}
    </Pop>
  );
}

function TableGrid({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [h, setH] = useState<[number, number]>([0, 0]);
  return (
    <div>
      <div className="grid grid-cols-8 gap-1" onMouseLeave={() => setH([0, 0])}>
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8) + 1;
          const col = (i % 8) + 1;
          const on = r <= h[0] && col <= h[1];
          return <button key={i} type="button" aria-label={`${r} by ${col} table`} onMouseEnter={() => setH([r, col])} onFocus={() => setH([r, col])} onClick={() => onPick(r, col)} className={`aspect-square rounded-[4px] border ${on ? "border-fg bg-sun-soft" : "border-line bg-white"}`} />;
        })}
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-fg-dim tabular-nums">{h[0] ? `${h[0]} × ${h[1]} table` : "Choose a size"}</p>
    </div>
  );
}

function CitePicker({ sources, style, onPick, onManage }: { sources: Source[]; style: CitationStyle; onPick: (id: string, locator: string) => void; onManage: () => void }) {
  const [loc, setLoc] = useState("");
  if (!sources.length)
    return (
      <div className="space-y-2 p-1 text-sm">
        <p className="text-fg-dim">No sources yet. Add the books, articles and websites you used, then cite them here.</p>
        <button type="button" className="btn btn-primary w-full" onClick={onManage}>Add a source</button>
      </div>
    );
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-fg-dim">Page (optional)
        <input className="input mt-1 py-1.5" placeholder="e.g. 47 or 47-49" value={loc} maxLength={30} onChange={(e) => setLoc(e.target.value)} />
      </label>
      <ul className="max-h-60 overflow-y-auto">
        {sources.map((src) => (
          <li key={src.id}>
            <button type="button" className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted" onClick={() => onPick(src.id, loc)}>
              <span className="block truncate text-sm font-semibold">{src.title}</span>
              <span className="text-xs text-fg-dim">{inText(src, style, loc)}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="w-full rounded-lg px-2 py-1 text-left text-sm font-semibold hover:bg-muted" onClick={onManage}>Manage sources…</button>
    </div>
  );
}
