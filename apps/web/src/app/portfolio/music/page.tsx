import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { portfolioFeed } from "@/lib/server/portfolio";
import { MusicList, EmptyFeed } from "@/components/portfolio/Feed";

export const metadata = { title: "Music", other: { robots: "noai, noimageai" } };

export default async function MusicFeed() {
  await requireUserPage("/portfolio/music");
  const items = await portfolioFeed("music");

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
              Upload audio
            </Link>
            <Link href="/portfolio/music/composer" className="btn rounded-full px-5 py-2.5">
              Open the composer
            </Link>
          </div>
        </div>
      </header>

      {items.length ? (
        <MusicList items={items} />
      ) : (
        <EmptyFeed
          text="No music has been shared yet."
          action={<Link href="/portfolio/music/composer" className="btn btn-primary">Open the composer</Link>}
        />
      )}
    </div>
  );
}
