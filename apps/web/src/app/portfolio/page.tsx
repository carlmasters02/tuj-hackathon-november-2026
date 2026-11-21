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
          <strong className="text-fg">The Human-made seal</strong> appears only on work created inside Humagination — written in the editor, drawn in the studio or composed in the composer —
          whose recorded process passes verification. Uploads are welcome, but they can&apos;t prove how they were made, so they never get the seal.
        </p>
      </div>
      <nav aria-label="Portfolio sections">
        {PORTFOLIO.map((s) => {
          const c = counts[s.key as keyof typeof counts];
          return <IndexRow key={s.key} href={s.href} title={s.label} note={s.blurb} chips={s.items.map((i) => i.label)} status={<span className="tabular-nums">{c.total} published<br /><span className="text-fg-faint">{c.verified} human-made</span></span>} />;
        })}
      </nav>
    </div>
  );
}
