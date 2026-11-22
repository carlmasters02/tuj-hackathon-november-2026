"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, X, Heart, MessageCircle } from "lucide-react";
import type { FeedItem } from "@/lib/server/portfolio";
import { ProtectedImage } from "@/components/gallery/ProtectedImage";

type ArtTile = FeedItem & { imageUrl: string };

export function ArtDiscoveryWall({ items }: { items: ArtTile[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "uploaded">("all");

  const results = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (filter === "verified" && !item.verified) return false;
      if (filter === "uploaded" && item.verified) return false;
      return !term || item.title.toLocaleLowerCase().includes(term) || item.owner.toLocaleLowerCase().includes(term);
    });
  }, [items, filter, search]);

  return (
    <section aria-label="Browse community artwork">
      <div className="sticky top-0 z-20 -mx-4 mb-7 border-b border-line bg-canvas/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1">
            <Search aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-dim" />
            <label htmlFor="art-search" className="sr-only">Search artworks or creators</label>
            <input
              id="art-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search artworks or creators"
              className="w-full rounded-full border border-line bg-surface py-3 pl-12 pr-11 text-base text-fg shadow-sm placeholder:text-fg-faint focus:border-fg/50 focus:outline-none focus:ring-2 focus:ring-sun"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-fg-dim hover:bg-muted">
                <X size={17} aria-hidden="true" />
              </button>
            )}
          </div>
          <Link href="/portfolio/upload" className="btn btn-primary rounded-full px-5 py-3">+ Share your art</Link>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <SlidersHorizontal size={16} className="mr-1 shrink-0 text-fg-dim" aria-hidden="true" />
          {([
            ["all", "All artwork"],
            ["verified", "Studio verified"],
            ["uploaded", "Community uploads"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${filter === value ? "border-fg bg-fg text-surface" : "border-line bg-surface text-fg-dim hover:border-fg/30 hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto shrink-0 pl-2 text-xs text-fg-dim" aria-live="polite">
            {results.length} {results.length === 1 ? "piece" : "pieces"}
          </span>
        </div>
      </div>

      {results.length ? (
        <ul className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 [&>li]:mb-5">
          {results.map((item) => (
            <li key={item.id} className="break-inside-avoid">
              <article className="group">
                <Link
                  href={`/portfolio/work/${item.id}`}
                  className="relative block overflow-hidden rounded-[1.15rem] border border-line bg-muted shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg sm:rounded-[1.4rem]"
                  aria-label={`View ${item.title} by ${item.owner}`}
                >
                  <ProtectedImage src={item.imageUrl} width={item.width ?? 4} height={item.height ?? 3} alt={item.title} />
                  {item.verified && (
                    <span className="absolute left-2 top-2 rounded-full bg-surface/95 px-2.5 py-1 text-[10px] font-bold text-fg shadow-sm sm:left-3 sm:top-3">
                      ✓ Studio verified
                    </span>
                  )}
                  <span className="absolute bottom-3 right-3 hidden rounded-full bg-fg px-3 py-2 text-xs font-semibold text-surface shadow-md group-hover:block group-focus-within:block sm:inline-flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    View piece ↗
                  </span>
                </Link>
                <div className="px-1.5 pt-2.5">
                  <Link href={`/portfolio/work/${item.id}`} className="line-clamp-2 text-sm font-bold leading-snug text-fg hover:underline sm:text-[0.97rem]">
                    {item.title}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <Link href={`/u/${encodeURIComponent(item.owner)}`} className="min-w-0 truncate text-xs text-fg-dim hover:underline">
                      @{item.owner}
                    </Link>
                    <span className="inline-flex items-center gap-2 text-xs text-fg-faint">
                      <span className="inline-flex items-center gap-1" aria-label={`${item.likes} likes`}><Heart size={12} aria-hidden="true" />{item.likes}</span>
                      <span className="inline-flex items-center gap-1" aria-label={`${item.comments} comments`}><MessageCircle size={12} aria-hidden="true" />{item.comments}</span>
                    </span>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <h2 className="font-serif text-2xl">No artwork found</h2>
          <p className="mt-2 text-sm text-fg-dim">Try a different artist, title, or filter.</p>
          <button type="button" className="btn mt-5" onClick={() => { setSearch(""); setFilter("all"); }}>Show all artwork</button>
        </div>
      )}
    </section>
  );
}
