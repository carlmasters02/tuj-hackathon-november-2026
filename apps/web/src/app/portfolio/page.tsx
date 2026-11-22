import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { PORTFOLIO } from "@/lib/sitemap";
import { portfolioCounts } from "@/lib/server/portfolio";
import { HubHeader, IndexRow } from "@/components/Hub";
import { HumanSeal } from "@/components/HumanSeal";

export const metadata = { title: "Portfolio", other: { robots: "noai, noimageai" } };

export default async function PortfolioHub() {
  await requireUserPage("/portfolio");
  const counts = await portfolioCounts();
  return (
    <div>
      <HubHeader title="Portfolio" intro="Work made by people, shown only to people. Pieces made in Humagination carry a seal that proves how they were made." >
        <Link href="/portfolio/upload" className="btn">Upload a finished piece</Link>
      </HubHeader>
      <div className="mb-8 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
        <HumanSeal size={64} />
        <p className="text-sm leading-relaxed text-fg-dim">
          <strong className="text-fg">The creation-record seal</strong> appears only when the server can replay a non-empty work from its event chain and every integrity check passes. Stroke counts and active time are shown as context, not targets. Uploads are welcome, but they have no creation record to verify.
        </p>
      </div>
      <nav aria-label="Portfolio sections">
        {PORTFOLIO.map((s) => {
          const c = counts[s.key as keyof typeof counts];
          return <IndexRow key={s.key} href={s.href} title={s.label} note={s.blurb} chips={s.items.map((i) => i.label)} status={<span className="tabular-nums">{c.total} published<br /><span className="text-fg-faint">{c.verified} verified records</span></span>} />;
        })}
      </nav>
    </div>
  );
}
