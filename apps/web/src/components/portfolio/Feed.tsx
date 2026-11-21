import Link from "next/link";
import type { FeedItem } from "@/lib/server/portfolio";
import { signedMediaUrl } from "@/lib/server/gallery";
import { ProtectedImage } from "@/components/gallery/ProtectedImage";
import { HumanBadge, HumanSeal } from "@/components/HumanSeal";

function Meta({ item }: { item: FeedItem }) {
  return (
    <span className="flex items-center gap-3 text-sm text-fg-dim">
      <span>@{item.owner}</span>
      <span aria-label={`${item.likes} likes`}>♥ {item.likes}</span>
      <span aria-label={`${item.comments} comments`}>💬 {item.comments}</span>
    </span>
  );
}

export function ArtWall({ items, viewerId }: { items: FeedItem[]; viewerId: string }) {
  return (
    <ul className="columns-1 gap-6 sm:columns-2 xl:columns-3 [&>li]:mb-6">
      {items.map((w) => (
        <li key={w.id} className="break-inside-avoid">
          <Link
            href={`/portfolio/work/${w.id}`}
            className="group block overflow-hidden rounded-[1.6rem] border border-line bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-fg/20 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg"
          >
            <div className="relative overflow-hidden bg-muted">
              <div className="transition-transform duration-500 group-hover:scale-[1.03]">
                <ProtectedImage src={signedMediaUrl(w.id, viewerId)} width={w.width ?? 4} height={w.height ?? 3} alt={w.title} />
              </div>
              {w.verified && (
                <div className="absolute right-3 top-3 rounded-full bg-surface/95 p-1 shadow-sm">
                  <HumanSeal size={48} />
                </div>
              )}
              <span className="absolute bottom-3 right-3 translate-y-2 rounded-full bg-fg px-3 py-1.5 text-xs font-bold text-surface opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                View artwork ↗
              </span>
            </div>
            <div className="px-5 pb-5 pt-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-xl font-extrabold leading-snug tracking-tight text-fg transition-colors group-hover:text-fg-dim">{w.title}</h3>
                <span aria-hidden="true" className="mt-1 text-lg text-fg-faint transition-transform group-hover:translate-x-1">↗</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <Meta item={w} />
                {w.verified && <span className="text-[0.65rem] font-bold uppercase tracking-wider text-fg-dim">Studio verified</span>}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function WritingList({ items }: { items: FeedItem[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((w) => (
        <li key={w.id}>
          <Link href={`/portfolio/work/${w.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-1 py-6 transition-colors hover:bg-sun-soft/50">
            <div className="min-w-0">
              <h3 className="font-serif text-[1.7rem] leading-tight">{w.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Meta item={w} />
                {w.words != null && <span className="text-sm text-fg-faint">{w.words} words</span>}
              </div>
            </div>
            {w.verified ? <HumanSeal size={64} /> : <span className="chip">Not verified</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MusicList({ items }: { items: FeedItem[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((w) => (
        <li key={w.id}>
          <Link href={`/portfolio/work/${w.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-fg/30">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-fg text-2xl text-sun" aria-hidden>♪</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-bold">{w.title}</span>
              <Meta item={w} />
            </span>
            {w.verified ? <HumanBadge /> : <span className="chip">Uploaded</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function EmptyFeed({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-6 py-14 text-center">
      <p className="mx-auto max-w-md text-lg text-fg-dim">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
