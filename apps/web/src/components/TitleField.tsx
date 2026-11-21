"use client";
import type { Ref } from "react";

/**
 * The title of a piece, in its own white box so it reads as editable. Shared by the writing
 * editor, the drawing studio and the composer.
 */
export function TitleField({ value, onChange, onBlur, maxLength = 120, inputRef, id = "piece-title" }: { value: string; onChange: (v: string) => void; onBlur?: () => void; maxLength?: number; inputRef?: Ref<HTMLInputElement>; id?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-fg-dim">Title</label>
      <div className="group relative">
        <input
          id={id}
          ref={inputRef}
          className="w-full rounded-xl border border-line bg-white py-2 pr-11 pl-4 text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em] text-fg shadow-[inset_0_1px_2px_rgb(27_43_94/0.06)] transition-colors placeholder:text-fg-faint hover:border-fg-faint/60 focus:border-fg/40 focus:ring-4 focus:ring-sun/40 focus:outline-none sm:text-[1.9rem]"
          value={value}
          maxLength={maxLength}
          placeholder="Give it a title"
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-fg-faint transition-colors group-focus-within:text-fg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </div>
    </div>
  );
}

/** Shown before publishing when the title was never changed from the default. */
export function DefaultTitleWarning({ title, onChange }: { title: string; onChange: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-warn/40 bg-warn-dim p-3 text-sm">
      <p className="font-semibold text-fg">You never changed the title.</p>
      <p className="mt-0.5 text-fg-dim">
        It will be published as <strong className="text-fg">“{title.trim() || "Untitled"}”</strong>. Are you sure you want to publish without a custom title?
      </p>
      <button type="button" className="mt-2 font-semibold text-fg underline decoration-sun decoration-2 underline-offset-4 hover:decoration-flame" onClick={onChange}>
        Change the title
      </button>
    </div>
  );
}
