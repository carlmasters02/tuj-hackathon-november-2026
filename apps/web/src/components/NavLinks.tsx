"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tutor/math", label: "StepCheck" },
  { href: "/tutor/code", label: "Code Dojo" },
  { href: "/write", label: "Write" },
  { href: "/gallery", label: "Gallery" },
  { href: "/leaderboard", label: "Leaderboard" },
];

/** Top-level links; the current section gets a sun-yellow pill. */
export function NavLinks() {
  const path = usePathname();
  return (
    <>
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${active ? "bg-sun-soft text-fg ring-1 ring-sun" : "text-fg-dim hover:bg-muted hover:text-fg"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
