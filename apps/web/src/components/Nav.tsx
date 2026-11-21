import Link from "next/link";
import Image from "next/image";
import { currentUser, profileOf } from "@/lib/auth";
import logo from "@/assets/logo.png";
import { NavMenus } from "./NavMenus";

export async function Nav() {
  const user = await currentUser();
  const profile = user ? await profileOf(user.id).catch(() => null) : null;
  const demo = process.env.HM_DEMO_MODE === "true";
  return (
    <header className="sticky top-0 z-40 border-b print:hidden border-line bg-canvas/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-3 py-2.5 sm:gap-2 sm:px-6" aria-label="Main">
        <Link href={user ? "/dashboard" : "/"} className="mr-1 flex shrink-0 items-center sm:mr-2" aria-label="Humagination home">
          <Image src={logo} alt="Humagination" priority className="h-10 w-auto" sizes="180px" />
        </Link>
        <NavMenus signedIn={!!user} username={profile?.username ?? null} displayName={profile?.display_name ?? null} demo={demo} />
      </nav>
    </header>
  );
}
