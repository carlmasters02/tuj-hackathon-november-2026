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
  const verifiedCount = items.filter(
    (item) => item.verified
  ).length;

  return (
    <div className="pb-20">
      <header className="relative mb-10 overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-9 shadow-sm sm:px-10 sm:py-12 lg:px-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full border-[42px] border-sun/20 sm:h-[28rem] sm:w-[28rem]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-8rem] right-24 h-64 w-64 rounded-full bg-sun/10 blur-3xl"
        />

        <div className="relative z-10 max-w-2xl">
          <Link
            href="/portfolio"
            className="mb-8 flex w-fit items-center gap-2 text-sm font-semibold text-fg-dim transition hover:text-fg"
          >
            <span aria-hidden="true">←</span>
            Back to portfolio
          </Link>

          <p className="mb-4 flex w-fit items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-fg-dim">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-flame"
            />
            Humagination / Art
          </p>

          {/* Smaller heading, similar to Writing page */}
          <h1 className="max-w-2xl text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-fg">
            Made by{" "}
            <span className="relative whitespace-nowrap">
              humans
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-0 h-2 w-full -rotate-1 rounded-full bg-sun/70"
              />
            </span>
            .
          </h1>

          <p className="mt-9 max-w-lg text-lg leading-relaxed text-fg-dim">
            A home for original art and the people behind it.
            Explore the gallery, celebrate every creative voice,
            and share something of your own.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/portfolio/art/studio"
              className="btn btn-primary px-6 py-3"
            >
              ✦ Create in the studio
            </Link>

            <Link
              href="/portfolio/upload"
              className="btn px-6 py-3"
            >
              Upload artwork <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <p className="mt-5 text-xs leading-relaxed text-fg-faint">
            Studio artworks can carry a verified stroke history.
            Uploaded art is shared without a verification seal.
          </p>
        </div>
      </header>

      {/* Gallery collection */}
      <section
        aria-label="Gallery collection"
        className="mb-8 flex flex-wrap items-center justify-between gap-5 border-b border-line pb-7"
      >
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-fg-dim">
            Explore the collection
          </p>

          <h2 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
            The art wall
            <span className="text-flame">.</span>
          </h2>

          <p className="mt-2 text-sm text-fg-dim">
            Every piece has a story. Find one that speaks to you.
          </p>
        </div>

        <div className="flex items-center gap-5 rounded-2xl border border-line bg-surface px-5 py-3">
          <div className="text-center">
            <p className="text-2xl font-extrabold tabular-nums">
              {items.length}
            </p>
            <p className="text-xs font-semibold text-fg-dim">
              Artworks
            </p>
          </div>

          <div className="h-9 w-px bg-line" />

          <div className="text-center">
            <p className="text-2xl font-extrabold tabular-nums">
              {verifiedCount}
            </p>
            <p className="text-xs font-semibold text-fg-dim">
              Studio verified
            </p>
          </div>
        </div>
      </section>

      {/* Real artwork gallery */}
      {items.length ? (
        <ArtWall items={items} viewerId={user.id} />
      ) : (
        <EmptyFeed
          text="The art wall is waiting for its first masterpiece. Share your creativity and start the collection."
          action={
            <Link
              href="/portfolio/upload"
              className="btn btn-primary"
            >
              Share your artwork
            </Link>
          }
        />
      )}
    </div>
  );
}
