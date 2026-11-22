import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { portfolioFeed } from "@/lib/server/portfolio";
import { ArtWall, EmptyFeed } from "@/components/portfolio/Feed";

export const metadata = {
  title: "Art Gallery",
  other: { robots: "noai, noimageai" },
};

export default async function ArtFeed() {
  const user = await requireUserPage("/portfolio/art");
  const items = await portfolioFeed("art");

  return (
    <div className="pb-16">
      <header className="mb-6 sm:mb-8">
        <Link href="/portfolio" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-fg-dim transition hover:text-fg">
          <span aria-hidden="true">←</span> Back to portfolio
        </Link>
        <div>
          <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.035em] text-fg">
            Art<span className="text-flame">.</span>
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-dim">Felt by art.</p>
          <nav aria-label="Art actions" className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/portfolio/upload" className="inline-flex items-center gap-1 border-b-2 border-fg pb-0.5 text-sm font-bold text-fg transition hover:border-flame focus-visible:outline-offset-4">
              Upload artwork <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/portfolio/art/studio" className="inline-flex items-center gap-1 border-b-2 border-line pb-0.5 text-sm font-bold text-fg transition hover:border-flame focus-visible:outline-offset-4">
              Create in the studio <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>

      {items.length ? (
        <ArtWall items={items} viewerId={user.id} />
      ) : (
        <EmptyFeed
          text="No artwork has been shared yet."
          action={<Link href="/portfolio/upload" className="inline-block border-b-2 border-fg pb-0.5 font-bold text-fg hover:border-flame">Upload artwork ↗</Link>}
        />
      )}
    </div>
  );
}
