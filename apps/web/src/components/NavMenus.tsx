"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PORTFOLIO, TUTOR, type Section } from "@/lib/sitemap";
import { postJson } from "@/lib/client";

type MenuKey = "tutor" | "portfolio" | "account" | null;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mega-menu panel: one column per section, each with its subsections. */
function Panel({ sections, onPick }: { sections: Section[]; onPick: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-3">
      {sections.map((s) => (
        <div key={s.key} className="rounded-xl p-3 hover:bg-canvas/70">
          <Link href={s.href} onClick={onPick} className="block rounded-md">
            <span className="text-lg font-bold tracking-tight">{s.label}</span>
            <span className="mt-0.5 block text-sm leading-snug text-fg-dim">{s.blurb}</span>
          </Link>
          <ul className="mt-2 space-y-0.5">
            {s.items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} onClick={onPick} className="-mx-2 block rounded-md px-2 py-1 text-sm font-semibold text-fg-dim hover:bg-sun-soft hover:text-fg">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function NavMenus({ signedIn, username, displayName, demo }: { signedIn: boolean; username: string | null; displayName: string | null; demo: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState<MenuKey>(null);
  const [mobile, setMobile] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(null), setMobile(false));
    const onClick = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const hoverOpen = (k: MenuKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(k);
  };
  const hoverClose = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 160);
  };
  const active = (href: string) => path === href || path.startsWith(href + "/");
  const linkCls = (on: boolean) => `rounded-full px-3 py-1.5 text-[0.95rem] font-semibold transition-colors ${on ? "bg-sun-soft text-fg ring-1 ring-sun" : "text-fg-dim hover:text-fg"}`;

  const menu = (key: "tutor" | "portfolio", label: string, href: string, sections: Section[]) => (
    <div className="relative" onMouseEnter={() => hoverOpen(key)} onMouseLeave={hoverClose}>
      <div className={`flex items-center ${linkCls(active(href))} pr-1.5`}>
        <Link href={href} className="pr-1">{label}</Link>
        <button
          type="button"
          aria-label={`Show ${label} sections`}
          aria-expanded={open === key}
          aria-controls={`menu-${key}`}
          onClick={() => setOpen(open === key ? null : key)}
          className="grid h-6 w-6 place-items-center rounded-full hover:bg-muted"
        >
          <Chevron open={open === key} />
        </button>
      </div>
      {open === key && (
        <div id={`menu-${key}`} className="absolute left-1/2 top-full z-50 w-[min(46rem,92vw)] -translate-x-1/2 pt-2">
          <div className="hm-pop overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)]">
            <Panel sections={sections} onPick={() => setOpen(null)} />
          </div>
        </div>
      )}
    </div>
  );

  const logout = async () => {
    await postJson("/api/auth/logout", {});
    router.push("/");
    router.refresh();
  };

  if (!signedIn)
    return (
      <div className="ml-auto flex items-center gap-2">
        <Link href="/login" className="btn btn-ghost">Log in</Link>
        <Link href="/signup" className="btn btn-primary">Sign up</Link>
      </div>
    );

  const initial = (displayName || username || "?").trim()[0]?.toUpperCase() ?? "?";

  return (
    <div ref={wrap} className="flex flex-1 items-center">
      {/* desktop */}
      <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
        <Link href="/" className={linkCls(active("/"))}>Home</Link>
        <Link href="/dashboard" className={linkCls(active("/dashboard"))}>Dashboard</Link>
        {menu("tutor", "Tutor", "/tutor", TUTOR)}
        {menu("portfolio", "Portfolio", "/portfolio", PORTFOLIO)}
      </div>

      <div className="relative ml-auto" onMouseLeave={hoverClose} onMouseEnter={() => open === "account" && hoverOpen("account")}>
        <button
          type="button"
          onClick={() => setOpen(open === "account" ? null : "account")}
          aria-expanded={open === "account"}
          aria-haspopup="menu"
          className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-semibold shadow-[var(--shadow-soft)] hover:border-fg-faint/60"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-fg text-sm font-bold text-surface">{initial}</span>
          <span className="hidden max-w-32 truncate sm:inline">{demo ? "Demo" : `@${username}`}</span>
          <Chevron open={open === "account"} />
        </button>
        {open === "account" && (
          <div role="menu" className="hm-pop absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]">
            {demo && <p className="px-3 py-2 text-xs text-fg-dim">Demo mode: login is off and everyone shares this account.</p>}
            {[
              { href: `/u/${username}`, label: "Your profile" },
              { href: "/leaderboard", label: "Leaderboard" },
              { href: "/write", label: "All your writing" },
              { href: "/settings", label: "Settings" },
            ].map((i) => (
              <Link role="menuitem" key={i.href} href={i.href} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-sun-soft">{i.label}</Link>
            ))}
            {!demo && <button role="menuitem" onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-fg-dim hover:bg-muted">Log out</button>}
          </div>
        )}
      </div>

      {/* mobile */}
      <button type="button" className="ml-1 grid h-10 w-10 place-items-center rounded-full border border-line bg-surface sm:ml-2 md:hidden" aria-label="Open menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>
        <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden><path d={mobile ? "M5 5l10 10M15 5 5 15" : "M3 6h14M3 10h14M3 14h14"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      {mobile && (
        <div className="absolute inset-x-0 top-full z-40 h-[calc(100dvh-61px)] overflow-y-auto border-t border-line bg-canvas px-4 pb-10 pt-4 md:hidden">
          <Link href="/" className="block border-b border-line py-3 text-2xl font-bold">Home</Link>
          <Link href="/dashboard" className="block border-b border-line py-3 text-2xl font-bold">Dashboard</Link>
          {[{ label: "Tutor", href: "/tutor", sections: TUTOR }, { label: "Portfolio", href: "/portfolio", sections: PORTFOLIO }].map((g) => (
            <details key={g.label} className="group border-b border-line py-3" open={active(g.href)}>
              <summary className="flex cursor-pointer list-none items-center justify-between text-2xl font-bold">
                {g.label} <Chevron open={false} />
              </summary>
              <Link href={g.href} className="mt-2 block text-sm font-semibold text-fg-dim underline decoration-sun decoration-2 underline-offset-4">Overview</Link>
              {g.sections.map((s) => (
                <div key={s.key} className="mt-3">
                  <Link href={s.href} className="text-lg font-bold">{s.label}</Link>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {s.items.map((i) => (
                      <Link key={i.href} href={i.href} className="chip">{i.label}</Link>
                    ))}
                  </div>
                </div>
              ))}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
