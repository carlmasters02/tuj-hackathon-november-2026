"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { BookMarked, Download, FileText, History, ListTree, MessageSquare, Minus, Plus, Printer, Settings2, Sparkles } from "lucide-react";
import { pmDocToText, posAtTextOffset } from "@hm/shared/provenance/pmText";
import { countWords } from "@hm/shared/provenance/stats";
import type { Flag, RuleId } from "@hm/shared/redpen";
import { inText } from "@hm/shared/citations";
import { newId, type DocMeta } from "@hm/shared/docMeta";
import { isDefaultTitle, type Genre } from "@hm/shared/genres";
import { HIDDEN_RULES } from "@hm/shared/genreCoach";
import { editorExtensions } from "@/lib/editorExtensions";
import { postJson, ApiError } from "@/lib/client";
import { DefaultTitleWarning, TitleField } from "@/components/TitleField";
import { PasteHighlight, RedPenFocus, redpenFocusKey } from "./extensions";
import { ProvenanceRecorder, type RecorderStatus } from "./recorder";
import { RedPenPanel } from "./RedPenPanel";
import { GenreCoach } from "./GenreCoach";
import { Ribbon } from "./Ribbon";
import { FindBar } from "./FindBar";
import { geometry, Paper } from "./Paper";
import { CommentsPanel, HistoryPanel, OutlinePanel, SetupPanel, SourcesPanel } from "./Panels";
import { insertCitation, LiveCitation, Pagination, Search, setLiveMeta, WriterShortcuts, relayout } from "./clientExtensions";

interface Props {
  docId: string;
  title: string;
  content: unknown;
  lastSeq: number;
  headHash: string | null;
  genre?: Genre;
  meta: DocMeta;
}

const STATUS_TEXT: Record<RecorderStatus, string> = {
  idle: "Every keystroke is being recorded",
  saving: "Saving…",
  saved: "Saved · log verified by server",
  offline: "Offline — will retry",
  conflict: "Stopped",
};

type Tab = "coach" | "page" | "sources" | "comments" | "outline" | "history";
const NONE: RuleId[] = [];

export function Editor({ docId, title: initialTitle, content, lastSeq, headHash, genre = "free", meta: initialMeta }: Props) {
  const router = useRouter();
  const recorder = useRef<ProvenanceRecorder | null>(null);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [pasteWarnings, setPasteWarnings] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [meta, setMetaState] = useState<DocMeta>(initialMeta);
  const [tab, setTab] = useState<Tab>("coach");
  const [find, setFind] = useState<null | { replace: boolean }>(null);
  const [pages, setPages] = useState(1);
  const [referencePages, setReferencePages] = useState(1);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [fitZoom, setFitZoom] = useState(1);
  const [focusComment, setFocusComment] = useState<string | null>(null);
  const [metaSave, setMetaSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const titleRef = useRef<HTMLInputElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);

  const geo = geometry(meta.setup);
  const geoRef = useRef(geo.geo);
  geoRef.current = geo.geo;
  const firstOffset = useRef(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...editorExtensions().map((e) => (e.name === "citation" ? LiveCitation : e)),
      Placeholder.configure({ placeholder: "Start writing. Everything you type here is recorded, so you can prove you wrote it." }),
      PasteHighlight,
      RedPenFocus,
      Search,
      Pagination.configure({ geometry: () => geoRef.current, firstPageOffset: () => firstOffset.current, onPages: (n) => setPages(n) }),
      WriterShortcuts.configure({ onFind: (replace) => setFind({ replace }) }),
    ],
    content: content as any,
    editorProps: { attributes: { class: "focus:outline-none", spellcheck: "true", "aria-label": "Document" } },
    onCreate: ({ editor }) => {
      const t = pmDocToText(editor.state.doc);
      setText(t);
      setLiveMeta(editor as any, { sources: initialMeta.sources, style: initialMeta.citationStyle });
      recorder.current = new ProvenanceRecorder(
        docId,
        lastSeq,
        headHash,
        () => editor.getJSON(),
        (s, err) => {
          setStatus(s);
          setError(err);
          if (s === "conflict") editor.setEditable(false);
        },
        t,
        content,
      );
      recorder.current.start();
    },
    onTransaction: ({ transaction, editor }) => {
      if (!recorder.current) return;
      const { externalPaste, text: t } = recorder.current.record(transaction, editor.state.doc);
      if (externalPaste) setPasteWarnings((n) => n + 1);
      setText(t);
    },
    onFocus: () => recorder.current?.focus("focus"),
    onBlur: () => recorder.current?.focus("blur"),
  });

  // fit the page to the desk width
  useEffect(() => {
    const el = deskRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFitZoom(Math.max(0.4, Math.min(1.25, (el.clientWidth - 32) / geo.w))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [geo.w]);
  const z = zoom === "fit" ? fitZoom : zoom;

  // Settings are versioned so responses can never arrive out of order and overwrite newer
  // choices. One shared promise also lets Finalize await a PATCH that is already in flight.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaRef = useRef(initialMeta);
  const metaVersion = useRef(0);
  const metaSavedVersion = useRef(0);
  const metaSavePromise = useRef<Promise<boolean> | null>(null);
  const metaKeepalive = useRef(false);
  const flushMeta = useCallback((keepalive = false): Promise<boolean> => {
    if (keepalive) metaKeepalive.current = true;
    if (metaSavePromise.current) return metaSavePromise.current;
    if (metaSavedVersion.current >= metaVersion.current) return Promise.resolve(true);
    const run = (async () => {
      try {
        while (metaSavedVersion.current < metaVersion.current) {
          const version = metaVersion.current;
          const snapshot = metaRef.current;
          setMetaSave("saving");
          await postJson(`/api/docs/${docId}`, { meta: snapshot }, "PATCH", keepalive || metaKeepalive.current);
          metaSavedVersion.current = version;
        }
        setMetaSave("saved");
        return true;
      } catch {
        setMetaSave("error");
        return false;
      } finally {
        metaSavePromise.current = null;
      }
    })();
    metaSavePromise.current = run;
    return run;
  }, [docId]);
  const setMeta = useCallback(
    (m: DocMeta) => {
      setMetaState(m);
      metaRef.current = m;
      metaVersion.current++;
      if (editor) setLiveMeta(editor as any, { sources: m.sources, style: m.citationStyle });
      setMetaSave("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void flushMeta();
      }, 700);
    },
    [editor, flushMeta],
  );

  useEffect(() => {
    const onHide = () => {
      void recorder.current?.flush(true);
      void flushMeta(true);
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      recorder.current?.stop();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void recorder.current?.flush(true);
      void flushMeta(true);
    };
  }, [flushMeta]);
  const setupKey = JSON.stringify(meta.setup);
  useEffect(() => {
    if (editor) requestAnimationFrame(() => relayout(editor as any));
  }, [setupKey, editor]);
  const onFirstOffset = useCallback(
    (px: number) => {
      if (Math.abs(firstOffset.current - px) < 1) return;
      firstOffset.current = px;
      if (editor) relayout(editor as any);
    },
    [editor],
  );

  const focusFlag = useCallback(
    (f: Flag | null) => {
      if (!editor) return;
      const m = f ? { from: posAtTextOffset(editor.state.doc, f.start), to: posAtTextOffset(editor.state.doc, f.end) } : null;
      editor.view.dispatch(editor.state.tr.setMeta(redpenFocusKey, m).setMeta("addToHistory", false));
    },
    [editor],
  );

  const saveTitle = async () => {
    try {
      await postJson(`/api/docs/${docId}`, { title: title.trim() || "Untitled" }, "PATCH");
    } catch {}
  };

  const finalize = async () => {
    if (!recorder.current) return;
    setFinalizing(true);
    setError(null);
    try {
      await saveTitle();
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (!(await flushMeta())) throw new Error("Couldn't save the latest settings — check your connection.");
      const drained = await recorder.current.drain();
      if (!drained) throw new Error(recorder.current.error ?? "Couldn't save the latest edits — check your connection.");
      const r = await postJson<{ certId: string }>(`/api/docs/${docId}/finalize`, {});
      router.push(`/verify/${r.certId}`);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Finalize failed");
      setFinalizing(false);
      setConfirmFinalize(false);
    }
  };

  const addComment = () => {
    if (!editor || editor.state.selection.empty) return;
    const id = newId();
    editor.chain().focus().setMark("comment", { id }).run();
    setMeta({ ...meta, comments: [...meta.comments, { id, body: "", createdAt: new Date().toISOString(), resolved: false }] });
    setFocusComment(id);
    setTab("comments");
  };

  const download = async () => {
    if (!editor) return;
    const { exportDocx } = await import("./exportDocx");
    const blob = await exportDocx(editor.getJSON(), meta, title.trim() || "Untitled");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(title.trim() || "Untitled").replace(/[\\/:*?"<>|]+/g, "").slice(0, 80)}.docx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // text for the coaches: what's typed, plus citation labels so "cites sources" can see them
  const coachText = useMemo(() => {
    if (!editor) return text;
    return editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n", (leaf) =>
      leaf.type.name === "hardBreak" ? "\n" : leaf.type.name === "citation" ? inText(meta.sources.find((x) => x.id === leaf.attrs.sourceId), meta.citationStyle, leaf.attrs.locator) : "",
    );
  }, [text, meta.sources, meta.citationStyle, editor]);

  const words = countWords(text);
  const openComments = meta.comments.filter((c) => !c.resolved).length;
  const totalPages = pages + (meta.setup.template === "apa" ? 1 : 0) + (meta.sources.length ? referencePages : 0);
  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "coach", label: genre === "free" ? "RedPen" : "Coach", icon: <Sparkles className="h-4 w-4" /> },
    { id: "page", label: "Page", icon: <Settings2 className="h-4 w-4" /> },
    { id: "sources", label: "Sources", icon: <BookMarked className="h-4 w-4" />, badge: meta.sources.length || undefined },
    { id: "comments", label: "Comments", icon: <MessageSquare className="h-4 w-4" />, badge: openComments || undefined },
    { id: "outline", label: "Outline", icon: <ListTree className="h-4 w-4" /> },
    { id: "history", label: "History", icon: <History className="h-4 w-4" /> },
  ];

  return (
    <div className="hm-writer space-y-3">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <TitleField value={title} onChange={setTitle} onBlur={saveTitle} maxLength={200} inputRef={titleRef} />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn h-[3.4rem] px-3" onClick={download} title="Download as a Word document"><Download className="h-4 w-4" />Word</button>
          <button type="button" className="btn h-[3.4rem] px-3" onClick={() => window.print()} title="Print, or save as PDF"><Printer className="h-4 w-4" />PDF</button>
          {!confirmFinalize && (
            <button className="btn btn-primary h-[3.4rem] px-5" disabled={finalizing || status === "conflict" || !text.trim()} onClick={() => setConfirmFinalize(true)}>
              Finalize & certify
            </button>
          )}
        </div>
      </div>
      {confirmFinalize && (
        <div className="hm-pop space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)] print:hidden">
          {isDefaultTitle(title) && (
            <DefaultTitleWarning
              title={title}
              onChange={() => {
                setConfirmFinalize(false);
                titleRef.current?.focus();
                titleRef.current?.select();
              }}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm text-fg-dim">This publishes the formatted text, citation sources, page setup and replay at a public link. Comments stay private.</span>
            <button className="btn btn-ghost" onClick={() => setConfirmFinalize(false)} disabled={finalizing}>Cancel</button>
            <button className="btn btn-primary" disabled={finalizing} onClick={finalize}>{finalizing ? "Verifying…" : isDefaultTitle(title) ? "Publish anyway" : "Confirm"}</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-faint print:hidden">
        <span className={`inline-block h-2 w-2 rounded-full ${status === "conflict" ? "bg-redpen" : status === "offline" ? "bg-warn" : "bg-ok"}`} />
        <span>{STATUS_TEXT[status]}</span>
        {metaSave === "error" && <span className="text-redpen">Settings not saved — check your connection</span>}
        {pasteWarnings > 0 && <span className="chip border-warn/50 text-warn">{pasteWarnings} external paste{pasteWarnings > 1 ? "s" : ""} highlighted — they count against authenticity</span>}
      </div>
      {error && <p role="alert" className="rounded-md border border-redpen/50 bg-redpen-dim p-3 text-sm">{error} {status === "conflict" && <button className="link" onClick={() => location.reload()}>Reload</button>}</p>}

      {editor && (
        <div className="sticky top-[4.25rem] z-30 space-y-1 print:hidden">
          <Ribbon editor={editor} sources={meta.sources} style={meta.citationStyle} defaultFont={meta.setup.font} defaultSize={meta.setup.fontSize} onFind={() => setFind({ replace: false })} onComment={addComment} onOpenSources={() => setTab("sources")} />
          {find && <FindBar editor={editor} replace={find.replace} onClose={() => setFind(null)} />}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div
            ref={deskRef}
            className="hm-desk-wrap rounded-3xl border border-line"
            onMouseDown={(e) => {
              // Clicking blank paper (below the text, the margins, the page gaps) should land in the
              // document, like a word processor, instead of leaving focus on the page.
              const t = e.target as HTMLElement;
              if (!editor || !editor.isEditable || e.button !== 0) return;
              if (t.closest(".ProseMirror, a, button, input, textarea, select, label, [contenteditable='true']")) return;
              e.preventDefault();
              editor.commands.focus("end");
            }}
          >
            <Paper setup={meta.setup} title={title} pages={pages} sources={meta.sources} style={meta.citationStyle} zoom={z} onFirstOffset={onFirstOffset} onReferencePages={setReferencePages}>
              <EditorContent editor={editor} />
            </Paper>
          </div>
          <div className="sticky bottom-0 z-20 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-line bg-surface/95 px-4 py-2 text-xs text-fg-dim shadow-[var(--shadow-soft)] backdrop-blur print:hidden">
            <span><strong className="text-fg tabular-nums">{words.toLocaleString()}</strong> words</span>
            <span className="tabular-nums">{text.replace(/\s/g, "").length.toLocaleString()} characters</span>
            <span className="tabular-nums">{totalPages} {totalPages === 1 ? "page" : "pages"}</span>
            {meta.wordGoal > 0 && (
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line"><span className={`block h-full rounded-full ${words >= meta.wordGoal ? "bg-ok" : "bg-fg"}`} style={{ width: `${Math.min(100, (100 * words) / meta.wordGoal)}%` }} /></span>
                <span className="tabular-nums">{Math.min(100, Math.round((100 * words) / meta.wordGoal))}% of {meta.wordGoal.toLocaleString()}</span>
              </span>
            )}
            <span className="ml-auto flex items-center gap-1">
              <button type="button" aria-label="Zoom out" className="rounded p-1 hover:bg-muted" onClick={() => setZoom(Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}><Minus className="h-3.5 w-3.5" /></button>
              <button type="button" className="w-14 rounded px-1 py-0.5 text-center font-semibold tabular-nums hover:bg-muted" onClick={() => setZoom("fit")} title="Fit to width">{zoom === "fit" ? "Fit" : `${Math.round(z * 100)}%`}</button>
              <button type="button" aria-label="Zoom in" className="rounded p-1 hover:bg-muted" onClick={() => setZoom(Math.min(2, Math.round((z + 0.1) * 10) / 10))}><Plus className="h-3.5 w-3.5" /></button>
            </span>
          </div>
        </div>

        <aside className="print:hidden xl:sticky xl:top-[8.5rem] xl:max-h-[calc(100vh-10rem)] xl:self-start xl:overflow-y-auto" aria-label="Writing tools">
          <div role="tablist" aria-label="Writing tools" className="mb-3 grid grid-cols-6 gap-1 rounded-2xl border border-line bg-surface p-1">
            {TABS.map((t) => (
              <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)} className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-semibold transition-colors ${tab === t.id ? "bg-fg text-surface" : "text-fg-dim hover:bg-muted hover:text-fg"}`}>
                {t.icon}
                {t.label}
                {t.badge ? <span className="absolute top-0.5 right-1 min-w-4 rounded-full bg-flame px-1 text-[9px] leading-4 text-fg">{t.badge}</span> : null}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} className="space-y-5">
            {tab === "coach" && (
              <>
                <GenreCoach genre={genre} text={coachText} />
                <RedPenPanel text={text} onFocusFlag={focusFlag} hide={(HIDDEN_RULES[genre] as RuleId[] | undefined) ?? NONE} />
              </>
            )}
            {tab === "page" && <SetupPanel meta={meta} setMeta={setMeta} />}
            {tab === "sources" && <SourcesPanel meta={meta} setMeta={setMeta} onCite={(id) => editor && insertCitation(editor as any, id)} />}
            {tab === "comments" && editor && <CommentsPanel editor={editor} meta={meta} setMeta={setMeta} focusId={focusComment} />}
            {tab === "outline" && editor && <OutlinePanel editor={editor} />}
            {tab === "history" && <HistoryPanel docId={docId} />}
          </div>
          {tab !== "history" && <p className="mt-4 flex items-center gap-1.5 text-[11px] text-fg-faint"><FileText className="h-3.5 w-3.5" />{metaSave === "saving" ? "Saving settings…" : "Settings save automatically."}</p>}
        </aside>
      </div>
    </div>
  );
}
