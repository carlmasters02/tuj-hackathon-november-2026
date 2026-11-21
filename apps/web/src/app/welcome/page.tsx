import { redirect } from "next/navigation";
import Image from "next/image";
import { currentUser, profileOf } from "@/lib/auth";
import { safeNext } from "@/lib/safeNext";
import bulb from "@/assets/bulb.png";
import { ChooseUsername } from "./ChooseUsername";

export const metadata = { title: "Welcome" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const user = await currentUser();
  if (!user) redirect("/login");
  const profile = await profileOf(user.id);
  if (!profile || profile.username_chosen) redirect(next);
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <Image src={bulb} alt="" className="mx-auto h-24 w-auto" priority />
      <div className="text-center">
        <h1 className="h-page">Welcome to Humagination!</h1>
        <p className="mt-2 text-sm text-fg-dim">Pick the username people will see on your work and certificates. You can only choose it once.</p>
      </div>
      <ChooseUsername suggestion={profile.username} next={next} />
    </div>
  );
}
