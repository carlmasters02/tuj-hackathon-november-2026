import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import bulb from "@/assets/bulb.png";
import { DEVELOPERS, REPOSITORY_URL, type DeveloperLink } from "@/lib/siteInformation";

export const metadata: Metadata = {
  title: "About the Developers",
  description: "Meet the four-person team behind Humagination and the human-first principles guiding the project.",
};

export default function DevelopersPage() {
  return (
    <div className="space-y-12">
      <header className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface via-surface to-sun-soft/70 p-7 shadow-[var(--shadow-soft)] sm:p-10">
        <Image src={bulb} alt="" aria-hidden className="absolute -right-3 -top-5 w-28 rotate-12 opacity-20 sm:right-8 sm:w-36" />
        <div className="relative max-w-3xl space-y-5">
          <span className="chip chip-sun">Four people · One human-first project</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg-faint">About the developers</p>
            <h1 className="h-display mt-3">Built by people who believe in <span className="hl">your imagination</span>.</h1>
          </div>
          <p className="max-w-2xl text-lg leading-relaxed text-fg-dim">
            Humagination began as a hackathon project with a simple idea: technology should help people think, learn and create for themselves—not do the meaningful part for them. Our team is building a home for honest practice and human-made work.
          </p>
        </div>
      </header>

      <section aria-labelledby="team-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="team-heading" className="text-3xl font-extrabold tracking-tight">The developer team</h2>
            <p className="mt-2 text-fg-dim">The four people bringing Humagination to life.</p>
          </div>
          <span className="chip">{DEVELOPERS.length} developers</span>
        </div>

        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Humagination developers">
          {DEVELOPERS.map((developer) => (
            <li key={developer.id} className="card card-hover flex min-w-0 flex-col p-6">
              {developer.photo ? (
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-sun-soft shadow-[var(--shadow-soft)]">
                  <Image
                    src={developer.photo}
                    alt={`Portrait of ${developer.name}`}
                    fill
                    sizes="(min-width: 1024px) 260px, (min-width: 640px) 45vw, 90vw"
                    className="object-cover object-top"
                  />
                </div>
              ) : (
                <div className="grid aspect-[4/5] w-full place-items-center rounded-2xl border border-dashed border-line bg-surface font-display text-4xl font-bold text-fg-faint" aria-hidden>{developer.initials}</div>
              )}
              <div className="mt-5 flex-1">
                <h3 className="text-xl font-extrabold">{developer.name}</h3>
                <p className="mt-1 text-sm font-semibold text-fg-faint">{developer.role}</p>
                <p className="mt-4 text-sm leading-6 text-fg-dim">{developer.bio}</p>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Humagination contributor</p>
                {developer.links?.length ? (
                  <ul className="flex gap-1.5" aria-label={`${developer.name} online`}>
                    {developer.links.map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          title={`${developer.name} on ${LINK_LABEL[link.kind]}`}
                          className="grid h-9 w-9 place-items-center rounded-xl border border-line text-fg-dim transition hover:border-fg hover:bg-muted hover:text-fg"
                        >
                          <LinkIcon kind={link.kind} />
                          <span className="sr-only">{developer.name} on {LINK_LABEL[link.kind]} (opens in a new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3" aria-labelledby="principles-heading">
        <div className="md:col-span-3">
          <h2 id="principles-heading" className="text-2xl font-extrabold">What guides our work</h2>
        </div>
        <article className="card p-6">
          <h3 className="text-lg font-extrabold">Coach, don&apos;t replace</h3>
          <p className="mt-3 text-sm leading-6 text-fg-dim">Our learning tools point out where to look and what kind of mistake to reconsider. They do not hand over the answer or do the work for you.</p>
        </article>
        <article className="card p-6">
          <h3 className="text-lg font-extrabold">Evidence, not empty claims</h3>
          <p className="mt-3 text-sm leading-6 text-fg-dim">Creation records show what happened in our tools. Their limits are stated plainly, because no website can prove everything about work done elsewhere.</p>
        </article>
        <article className="card p-6">
          <h3 className="text-lg font-extrabold">Privacy and access by design</h3>
          <p className="mt-3 text-sm leading-6 text-fg-dim">Individual accounts, row-level security, encrypted originals and limited extension data are paired with a continuing effort toward accessible experiences.</p>
        </article>
      </section>

      <section className="card flex flex-col items-start justify-between gap-5 bg-fg p-7 text-surface sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold">See how it&apos;s made</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-surface/80">Explore the source, report a problem, or help make learning and creative ownership better for everyone.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a className="btn btn-sun shrink-0" href={REPOSITORY_URL} target="_blank" rel="noreferrer">View the repository<span className="sr-only"> (opens in a new tab)</span></a>
          <Link href="/legal/accessibility" className="btn shrink-0 border-surface/30 bg-transparent text-surface shadow-none hover:bg-surface/10">Accessibility</Link>
        </div>
      </section>
    </div>
  );
}

const LINK_LABEL: Record<DeveloperLink["kind"], string> = { linkedin: "LinkedIn", github: "GitHub", website: "their website" };

function LinkIcon({ kind }: { kind: DeveloperLink["kind"] }) {
  if (kind === "linkedin")
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.83v1.54h.06c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13V21h-4v-4.98c0-1.19-.02-2.72-1.66-2.72-1.66 0-1.92 1.3-1.92 2.63V21h-4V9.75Z" />
      </svg>
    );
  if (kind === "github")
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
