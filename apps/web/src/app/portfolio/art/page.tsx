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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.035em] text-fg">
            Made by humans<span className="text-flame">.</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/portfolio/upload" className="btn btn-primary rounded-full px-5 py-2.5">
              Upload artwork
            </Link>
            <Link href="/portfolio/art/studio" className="btn rounded-full px-5 py-2.5">
              Create in the studio
            </Link>
          </div>
        </div>
      </header>

      {items.length ? (
        <ArtWall items={items} viewerId={user.id} />
      ) : (
        <EmptyFeed
          text="No artwork has been shared yet."
          action={<Link href="/portfolio/upload" className="btn btn-primary">Upload artwork</Link>}
        />
      )}
    </div>
  );
}
