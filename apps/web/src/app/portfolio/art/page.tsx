import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { portfolioFeed } from "@/lib/server/portfolio";
import { HubHeader } from "@/components/Hub";
import { ArtWall, EmptyFeed } from "@/components/portfolio/Feed";

export const metadata = { title: "Art", other: { robots: "noai, noimageai" } };

export default async function ArtFeed() {
  const user = await requireUserPage("/portfolio/art");
  const items = await portfolioFeed("art");
  return (
    <div>
      <HubHeader title="Art" intro="Drawn by hand. Studio pieces carry their full stroke-by-stroke history; uploads are shown but never sealed." back={{ href: "/portfolio", label: "Portfolio" }}>
        <Link href="/portfolio/art/studio" className="btn btn-primary px-5 py-2.5">Open the studio</Link><Link href="/portfolio/upload" className="btn">Upload</Link>
      </HubHeader>
      {items.length ? <ArtWall items={items} viewerId={user.id} /> : <EmptyFeed text="Nothing here yet. Draw the first piece in the studio." />}
    </div>
  );
}
