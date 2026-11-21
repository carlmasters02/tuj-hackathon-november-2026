import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { portfolioFeed } from "@/lib/server/portfolio";
import { HubHeader } from "@/components/Hub";
import { WritingList, EmptyFeed } from "@/components/portfolio/Feed";

export const metadata = { title: "Writing", other: { robots: "noai, noimageai" } };

export default async function WritingFeed() {
  await requireUserPage("/portfolio/writing");
  const items = await portfolioFeed("writing");
  return (
    <div>
      <HubHeader title="Writing" intro="Every piece here was typed in the Humagination editor, with a certificate and a replay you can watch." back={{ href: "/portfolio", label: "Portfolio" }}>
        <Link href="/tutor/writing" className="btn btn-primary px-5 py-2.5">Write something</Link>
      </HubHeader>
      {items.length ? <WritingList items={items} /> : <EmptyFeed text="No published writing yet. Finish a piece in the editor, certify it, and publish it from its certificate." />}
    </div>
  );
}
