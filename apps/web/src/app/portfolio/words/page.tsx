import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { portfolioFeed } from "@/lib/server/portfolio";
import { WritingList } from "@/components/portfolio/Feed";

export const metadata = { title: "Words", other: { robots: "noai, noimageai" } };

export default async function WordsFeed() {
  await requireUserPage("/portfolio/words");
  const items = await portfolioFeed("writing");

  return (
    <div className="pb-16">
      <header className="mb-6 sm:mb-8">
        <Link href="/portfolio" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-fg-dim transition hover:text-fg">
          <span aria-hidden="true">←</span> Back to portfolio
        </Link>
        <div>
          <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.035em] text-fg">
            Words<span className="text-flame">.</span>
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-dim">Stories only humans can tell.</p>
          <nav aria-label="Words actions" className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/write" className="inline-flex items-center gap-1 border-b-2 border-fg pb-0.5 text-sm font-bold text-fg transition hover:border-flame focus-visible:outline-offset-4">
              Write something <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/tutor/writing" className="inline-flex items-center gap-1 border-b-2 border-line pb-0.5 text-sm font-bold text-fg transition hover:border-flame focus-visible:outline-offset-4">
              Writing studio <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>

      <section aria-label="Published writing">
        {items.length ? (
          <WritingList items={items} />
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
            <p className="text-sm text-fg-dim">No writing has been shared yet.</p>
            <Link href="/write" className="mt-5 inline-block border-b-2 border-fg pb-0.5 font-bold text-fg hover:border-flame">Write something ↗</Link>
          </div>
        )}
      </section>
    </div>
  );
}
