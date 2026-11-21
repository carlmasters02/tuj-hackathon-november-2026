import Link from "next/link";
import { Whorl } from "./Whorl";

/** Page header for hub pages: title, one line of purpose, optional back link and actions. */
export function HubHeader({ title, intro, back, children }: { title: string; intro: string; back?: { href: string; label: string }; children?: React.ReactNode }) {
  return (
    <header className="hm-hero mb-8 pt-2">
      <Whorl />
      {back && (
        <Link href={back.href} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fg-dim hover:text-fg">
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <h1 className="max-w-3xl text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em] [font-stretch:88%]">{title}</h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-fg-dim">{intro}</p>
      {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
    </header>
  );
}

/** One row of a hub index: big name, a line of description, chips for subsections, a status on the right. */
export function IndexRow({ href, title, note, chips, status }: { href: string; title: string; note: string; chips?: string[]; status?: React.ReactNode }) {
  return (
    <Link href={href} className="hm-index-row group">
      <div className="min-w-0">
        <div className="hm-index-title">{title}</div>
        <p className="mt-2 max-w-xl text-[1.02rem] leading-snug text-fg-dim">{note}</p>
        {chips && chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="chip">{c}</span>
            ))}
          </div>
        )}
      </div>
      <div className="text-right text-sm font-semibold text-fg-dim">{status}</div>
    </Link>
  );
}

/** Thin progress meter with an accessible label. */
export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((100 * done) / total) : 0;
  return (
    <div className="w-32 sm:w-40" aria-label={`${label}: ${done} of ${total}`}>
      <div className="mb-1 tabular-nums">{done}<span className="text-fg-faint"> / {total}</span></div>
      <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-fg transition-[width]" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
