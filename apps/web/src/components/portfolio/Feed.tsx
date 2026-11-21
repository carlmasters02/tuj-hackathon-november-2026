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
    <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>li]:mb-5">
      {items.map((w) => (
        <li key={w.id} className="break-inside-avoid">
          <Link href={`/portfolio/work/${w.id}`} className="group block overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-fg/30">
            <div className="relative">
              <ProtectedImage src={signedMediaUrl(w.id, viewerId)} width={w.width ?? 4} height={w.height ?? 3} alt={w.title} />
              {w.verified && <div className="absolute right-3 top-3"><HumanSeal size={54} /></div>}
            </div>
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <span className="text-lg font-bold leading-tight">{w.title}</span>
            </div>
            <div className="px-4 pb-4"><Meta item={w} /></div>
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
