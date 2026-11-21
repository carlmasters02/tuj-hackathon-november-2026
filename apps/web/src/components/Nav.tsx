import Link from "next/link";
import Image from "next/image";
import { currentUser, profileOf } from "@/lib/auth";
import logo from "@/assets/logo.png";
import { LogoutButton } from "./LogoutButton";
import { NavLinks } from "./NavLinks";

export async function Nav() {
  const user = await currentUser();
  const profile = user ? await profileOf(user.id).catch(() => null) : null;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2.5 sm:px-6">
        <Link href="/" className="mr-4 flex shrink-0 items-center" aria-label="Humagination home">
          <Image src={logo} alt="Humagination" priority className="h-10 w-auto" sizes="140px" />
        </Link>
        {user && <NavLinks />}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {process.env.HM_DEMO_MODE === "true" ? (
            <span className="chip chip-sun" title="Login is turned off (HM_DEMO_MODE=true)">Demo mode · @{profile?.username ?? "demo"}</span>
          ) : user ? (
            <>
              <Link href="/settings" className="rounded-full px-3 py-1.5 text-sm font-semibold text-fg-dim hover:bg-muted hover:text-fg">
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
