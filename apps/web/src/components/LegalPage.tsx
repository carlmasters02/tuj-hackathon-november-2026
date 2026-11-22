import Link from "next/link";
import { LEGAL_LAST_UPDATED, LEGAL_LINKS, REPOSITORY_URL } from "@/lib/siteInformation";

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-extrabold tracking-tight text-fg">{title}</h2>
      <div className="mt-3 space-y-3 text-[0.98rem] leading-7 text-fg-dim">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-fg-faint">{children}</ul>;
}

export function LegalPage({ current, title, summary, children }: { current: string; title: string; summary: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-8">
        <nav aria-label="Legal documents" className="card p-4">
          <p className="px-2 text-xs font-bold uppercase tracking-wide text-fg-faint">Legal & policies</p>
          <ul className="mt-3 space-y-1">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current === link.href ? "page" : undefined}
                  className={`block rounded-lg px-2.5 py-2 text-sm font-semibold transition ${current === link.href ? "bg-sun-soft text-fg" : "text-fg-dim hover:bg-muted hover:text-fg"}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <article className="card min-w-0 p-6 sm:p-10">
        <header className="border-b border-line pb-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg-faint">Legal · Last updated {LEGAL_LAST_UPDATED}</p>
          <h1 className="h-page mt-3 text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-fg-dim">{summary}</p>
        </header>

        <div className="mt-8 space-y-8">{children}</div>

        <footer className="mt-10 rounded-2xl border border-line bg-muted/60 p-5 text-sm leading-6 text-fg-dim">
          <h2 className="font-sans text-base font-bold text-fg">Questions or requests</h2>
          <p className="mt-2">
            Contact the maintainers through the <a className="link" href={REPOSITORY_URL} target="_blank" rel="noreferrer">official Humagination repository<span className="sr-only"> (opens in a new tab)</span></a>.
            Do not include passwords, full access tokens, private work, or sensitive personal information in a public issue; a maintainer can arrange a private channel when needed.
          </p>
        </footer>
      </article>
    </div>
  );
}
