import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { portfolioFeed } from "@/lib/server/portfolio";
import { WritingList, EmptyFeed } from "@/components/portfolio/Feed";

export const metadata = { title: "Words", other: { robots: "noai, noimageai" } };

export default async function WordsFeed() {
  await requireUserPage("/portfolio/words");
  const items = await portfolioFeed("writing");

  return (
    <main className="pb-20">
      <header className="relative mb-12 overflow-hidden rounded-[1.75rem] border border-line bg-surface px-6 pb-10 pt-7 sm:px-10 sm:pb-14 sm:pt-9 lg:px-14">
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-full w-24 border-l border-line/60 bg-canvas/40 sm:w-32" />
        <div aria-hidden="true" className="pointer-events-none absolute right-10 top-10 font-serif text-[9rem] leading-none text-flame/15 sm:right-16 sm:text-[12rem]">
          ”
        </div>
        <div className="relative max-w-2xl">
          <Link href="/portfolio" className="inline-flex items-center gap-2 text-sm font-semibold text-fg-dim transition hover:text-fg">
            <span aria-hidden="true">←</span> Back to portfolio
          </Link>
          <div className="mt-12 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-fg-dim">
            <span className="h-px w-8 bg-flame" aria-hidden="true" />
            The Humagination collection
          </div>
          <h1 className="mt-4 font-serif text-[clamp(3.5rem,8vw,6rem)] font-normal leading-none tracking-[-0.045em] text-fg">
            Words<span className="text-flame">.</span>
          </h1>
          <p className="mt-6 max-w-xl font-serif text-[clamp(1.35rem,2.5vw,1.8rem)] italic leading-snug text-fg">
            Some things are better said in our own words.
          </p>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-fg-dim">
            A quiet corner for the poems, stories, essays, and articles people write.
            Every page has a voice behind it. Come read, and leave a few words of your own.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/write" className="btn btn-primary px-6 py-3">
              Write something of your own
            </Link>
            <span className="text-xs leading-relaxed text-fg-faint">
              Write here, certify your process, then publish.
            </span>
          </div>
        </div>
        <div className="relative mt-10 flex items-center gap-3 border-t border-line pt-4 text-xs font-semibold text-fg-faint sm:mt-12">
          <span>POEMS</span>
          <span aria-hidden="true" className="text-flame">✦</span>
          <span>STORIES</span>
          <span aria-hidden="true" className="text-flame">✦</span>
          <span>ESSAYS & ARTICLES</span>
        </div>
      </header>

      <section aria-label="Published writing">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-fg-dim">
              On these pages
            </p>
            <h2 className="font-serif text-3xl leading-tight tracking-tight text-fg sm:text-4xl">
              From one human to another
            </h2>
          </div>
          <span className="text-sm font-medium tabular-nums text-fg-dim">
            {items.length} {items.length === 1 ? "piece" : "pieces"} shared
          </span>
        </div>

        {items.length ? (
          <WritingList items={items} />
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-line bg-surface px-6 py-14 text-center sm:px-10">
            <p aria-hidden="true" className="mb-4 font-serif text-5xl text-flame">“</p>
            <h3 className="font-serif text-2xl text-fg sm:text-3xl">Every collection begins with a first line.</h3>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-fg-dim">
              Nothing has been published here yet. Write a piece in the Humagination editor,
              certify its creation, and share it when you are ready.
            </p>
            <div className="mt-7">
              <Link href="/write" className="btn btn-primary px-6 py-3">Begin your story</Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
