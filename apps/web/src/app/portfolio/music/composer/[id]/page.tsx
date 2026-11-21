import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { MusicEvent } from "@hm/shared/creation";
import { requireUserPage } from "@/lib/auth";
import { UUID } from "@/lib/http";
import { creationForEditing, myCreations } from "@/lib/server/creations";
import { Composer } from "@/components/studio/Composer";

export const metadata = { title: "Composer" };

export default async function ComposerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) notFound();
  const user = await requireUserPage(`/portfolio/music/composer/${id}`);
  const c = await creationForEditing(id, user.id);
  if (!c || c.row.kind !== "music") notFound();
  if (c.row.status === "finalized") {
    const done = (await myCreations(user.id, "music")).find((x) => x.id === id);
    redirect(done?.workId ? `/portfolio/work/${done.workId}` : "/portfolio/music/composer");
  }
  return (
    <div className="space-y-6">
      <Link href="/portfolio/music/composer" className="inline-flex items-center gap-1 text-sm font-semibold text-fg-dim hover:text-fg"><span aria-hidden>←</span> Composer</Link>
      <Composer id={id} initialTitle={c.row.title} lastSeq={c.row.last_seq} headHash={c.row.head_hash} events={c.events as MusicEvent[]} prior={{ edits: c.prior.count, activeSeconds: c.prior.activeSeconds }} />
    </div>
  );
}
