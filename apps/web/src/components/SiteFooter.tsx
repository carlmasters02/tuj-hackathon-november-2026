import Image from "next/image";
import Link from "next/link";
import bulb from "@/assets/bulb.png";
import { LEGAL_LINKS, REPOSITORY_URL } from "@/lib/siteInformation";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface/60 print:hidden">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fg-faint">
          <span className="flex items-center gap-2">
            <Image src={bulb} alt="" width={22} height={22} />
            Humagination — every idea here comes from a human. No AI runs anywhere in this app.
          </span>
          <span className="chip chip-sun">✓ Verified AI-free</span>
        </div>

        <div className="grid grid-cols-1 gap-6 border-t border-line pt-6 text-sm sm:grid-cols-2">
          <nav aria-label="Legal information">
            <h2 className="text-xs font-bold uppercase tracking-wide text-fg-dim">Legal</h2>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}><Link className="text-fg-dim underline decoration-transparent underline-offset-4 transition hover:text-fg hover:decoration-sun" href={link.href}>{link.label}</Link></li>
              ))}
            </ul>
          </nav>
          <nav aria-label="About the project" className="sm:justify-self-end">
            <h2 className="text-xs font-bold uppercase tracking-wide text-fg-dim">Project</h2>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <li><Link className="text-fg-dim underline decoration-transparent underline-offset-4 transition hover:text-fg hover:decoration-sun" href="/about/developers">About the developers</Link></li>
              <li><a className="text-fg-dim underline decoration-transparent underline-offset-4 transition hover:text-fg hover:decoration-sun" href={REPOSITORY_URL} target="_blank" rel="noreferrer">Source code<span className="sr-only"> (opens in a new tab)</span></a></li>
            </ul>
          </nav>
        </div>

        <p className="text-xs text-fg-faint">© {new Date().getFullYear()} Humagination contributors. Built for human learning and creativity.</p>
      </div>
    </footer>
  );
}
