import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { portfolioCounts } from "@/lib/server/portfolio";
import { HumanSeal } from "@/components/HumanSeal";

export const metadata = { title: "Portfolio", other: { robots: "noai, noimageai" } };

const sections = [
  { key: "art", title: "Art", tagline: "Felt by heart", href: "/portfolio/art", action: "View Art", image: "/portfolio/illustrations/art.png" },
  { key: "writing", title: "Words", tagline: "Stories only humans can tell", href: "/portfolio/words", action: "View Words", image: "/portfolio/illustrations/words.png" },
  { key: "music", title: "Music", tagline: "Where feelings become melodies", href: "/portfolio/music", action: "View Music", image: "/portfolio/illustrations/music.png" },
] as const;

export default async function PortfolioHub() {
  await requireUserPage("/portfolio");
  const counts = await portfolioCounts();

  return (
    <main className="mx-auto max-w-5xl pb-12">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(2.4rem,5vw,3.8rem)] font-semibold leading-tight tracking-tight text-fg">Portfolio</h1>
          <p className="mt-1 text-sm text-fg-dim">Art, words, and music made by people.</p>
        </div>
        <Link href="/portfolio/upload" className="text-sm font-semibold text-fg transition hover:text-navy-2 focus-visible:outline-offset-4">
          Upload your work <span aria-hidden="true">→</span>
        </Link>
      </header>

      <nav aria-label="Portfolio sections" className="space-y-4">
        {sections.map((section) => {
          const count = counts[section.key];
          return (
            <Link
              href={section.href}
              key={section.key}
              className="group grid min-h-[154px] grid-cols-[minmax(0,34%)_minmax(0,1fr)] items-center gap-0 overflow-hidden rounded-xl border-[1.5px] border-[#E9D68A] bg-white shadow-[0_5px_14px_rgba(91,77,39,0.09)] transition hover:border-[#D4BD62] hover:shadow-[0_7px_18px_rgba(91,77,39,0.12)] focus-visible:outline-offset-4 sm:grid-cols-[minmax(0,29%)_minmax(0,1fr)_auto]"
              aria-label={`${section.action}: ${count.total} published`}
            >
              <div className="flex h-[150px] min-w-0 items-center justify-center overflow-hidden p-3 sm:h-[172px] sm:p-4">
                {/* User-supplied illustrations. Keep original artwork, including its paper background. */}
                <img
                  src={section.image}
                  alt=""
                  aria-hidden="true"
                  className="block h-full w-full object-contain object-center"
                />
              </div>
              <div className="min-w-0 border-l border-[#E9D68A] px-4 py-3 sm:px-7">
                <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] font-semibold leading-tight text-fg">{section.title}</h2>
                <p className="mt-1 font-serif text-sm italic leading-snug text-fg-dim sm:text-lg">{section.tagline}</p>
              </div>
              <div className="col-span-2 flex items-center justify-end px-4 pb-4 sm:col-span-1 sm:px-6 sm:pb-0">
                <span className="whitespace-nowrap text-sm font-medium text-fg">
                  {section.action} <span aria-hidden="true" className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span>
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <aside className="mt-5 flex items-center gap-4 rounded-xl border-[1.5px] border-[#E9D68A] bg-white p-4 shadow-[0_4px_12px_rgba(91,77,39,0.06)]">
        <HumanSeal size={48} />
        <div>
          <h2 className="text-sm font-bold text-fg">The Human-made Seal</h2>
          <p className="mt-1 text-xs leading-relaxed text-fg-dim">
            Work created inside Humagination can receive a seal when its recorded creation process passes verification. Uploaded work cannot automatically receive the seal.
          </p>
        </div>
      </aside>
    </main>
  );
}
