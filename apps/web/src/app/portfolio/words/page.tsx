import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { portfolioFeed } from "@/lib/server/portfolio";
import { HubHeader } from "@/components/Hub";
import { WritingList, EmptyFeed } from "@/components/portfolio/Feed";

export const metadata = { title: "Words", other: { robots: "noai, noimageai" } };

export default async function WordsFeed() {
  await requireUserPage("/portfolio/words");
  const items = await portfolioFeed("writing");
  return (
    <div>
      <HubHeader title="Words" intro="Finished poems, essays and papers, shared by their authors. Read, respond and inspect the certified process — coaching stays in Tutor." back={{ href: "/portfolio", label: "Portfolio" }}>
        <Link href="/tutor/writing" className="btn btn-primary px-5 py-2.5">Start a draft in Tutor</Link>
      </HubHeader>
      {items.length ? <WritingList items={items} /> : <EmptyFeed text="No published words yet. Finish a draft in Tutor’s Writing studio, certify it, then publish it from its certificate." />}
    </div>
  );
}
