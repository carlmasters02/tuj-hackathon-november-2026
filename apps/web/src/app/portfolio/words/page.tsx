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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.035em] text-fg">
            Made by humans<span className="text-flame">.</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/write" className="btn btn-primary rounded-full px-5 py-2.5">
              Write something
            </Link>
            <Link href="/tutor/writing" className="btn rounded-full px-5 py-2.5">
              Writing studio
            </Link>
          </div>
        </div>
      </header>

      <section aria-label="Published writing">
        {items.length ? (
          <WritingList items={items} />
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
            <p className="text-sm text-fg-dim">No writing has been shared yet.</p>
            <Link href="/write" className="btn btn-primary mt-5">Write something</Link>
          </div>
        )}
      </section>
    </div>
  );
}
