import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { portfolioFeed } from "@/lib/server/portfolio";
import { HubHeader } from "@/components/Hub";
import { WritingList, EmptyFeed } from "@/components/portfolio/Feed";

export const metadata = { title: "Words", other: { robots: "noai, noimageai" } };

export default async function WordsFeed() {
  await requireUserPage("/portfolio/words");
  const items = await portfolioFeed("writing");

  return (
    <main className="pb-20">
      <HubHeader
        title="Words"
        intro="A home for human-written poems, stories, essays, and articles. Discover original voices, written and shared by people."
        back={{ href: "/portfolio", label: "Portfolio" }}
      >
        <Link href="/write" className="btn btn-primary px-5 py-2.5">
          Write and certify
        </Link>
      </HubHeader>

      <section aria-label="Published writing" className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-fg-dim">The human collection</p>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Stories worth sharing<span className="text-flame">.</span></h2>
          <p className="mt-2 text-sm text-fg-dim">Poetry, articles, essays, and more — from real human voices.</p>
        </div>
        <span className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg-dim">
          {items.length} published
        </span>
      </section>

      {items.length ? (
        <WritingList items={items} />
      ) : (
        <EmptyFeed
          text="No writing has been published yet. Create a piece in the Humagination editor, certify it, and publish it to share with readers."
          action={<Link href="/write" className="btn btn-primary">Start writing</Link>}
        />
      )}
    </main>
  );
}
