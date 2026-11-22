import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import bulb from "@/assets/bulb.png";
import { DEVELOPERS, REPOSITORY_URL } from "@/lib/siteInformation";

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
            <p className="mt-2 text-fg-dim">Four profile spaces for the people bringing Humagination to life.</p>
          </div>
          <span className="chip">{DEVELOPERS.length} developer slots</span>
        </div>

        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Humagination developers">
          {DEVELOPERS.map((developer) => (
            <li key={developer.id} className="card card-hover flex min-w-0 flex-col p-6">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-fg font-display text-2xl font-bold text-surface shadow-[var(--shadow-soft)]" aria-hidden>{developer.initials}</div>
              <div className="mt-5 flex-1">
                <h3 className="text-xl font-extrabold">{developer.name}</h3>
                <p className="mt-1 text-sm font-semibold text-fg-faint">{developer.role}</p>
                <p className="mt-4 text-sm leading-6 text-fg-dim">{developer.bio}</p>
              </div>
              <p className="mt-5 border-t border-line pt-4 text-xs font-semibold uppercase tracking-wide text-fg-faint">Humagination contributor</p>
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
