import Link from "next/link";
import { currentUser, profileOf } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tutor/math", label: "StepCheck" },
  { href: "/tutor/code", label: "Code Dojo" },
  { href: "/write", label: "Write" },
  { href: "/gallery", label: "Gallery" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export async function Nav() {
  const user = await currentUser();
  const profile = user ? await profileOf(user.id).catch(() => null) : null;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-3 sm:px-6">
        <Link href="/" className="mr-3 flex shrink-0 items-center gap-2 font-serif text-lg">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-redpen" />
          Humagination
        </Link>
        {user &&
          LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="shrink-0 rounded-md px-2.5 py-1.5 text-sm text-paper-dim hover:bg-ink-3 hover:text-paper">
              {l.label}
            </Link>
          ))}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <Link href="/settings" className="rounded-md px-2.5 py-1.5 text-sm text-paper-dim hover:bg-ink-3 hover:text-paper">
                @{profile?.username ?? "me"}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">Log in</Link>
              <Link href="/signup" className="btn btn-primary">Sign up</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
