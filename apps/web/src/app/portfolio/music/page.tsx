import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { portfolioFeed } from "@/lib/server/portfolio";
import { HubHeader } from "@/components/Hub";
import { MusicList, EmptyFeed } from "@/components/portfolio/Feed";

export const metadata = { title: "Music", other: { robots: "noai, noimageai" } };

export default async function MusicFeed() {
  await requireUserPage("/portfolio/music");
  const items = await portfolioFeed("music");
  return (
    <div>
      <HubHeader title="Music" intro="Composed note by note in the composer, where every edit is recorded." back={{ href: "/portfolio", label: "Portfolio" }}>
        <Link href="/portfolio/music/composer" className="btn btn-primary px-5 py-2.5">Open the composer</Link><Link href="/portfolio/upload" className="btn">Upload audio</Link>
      </HubHeader>
      {items.length ? <MusicList items={items} /> : <EmptyFeed text="No music yet. Compose the first track." />}
    </div>
  );
}
