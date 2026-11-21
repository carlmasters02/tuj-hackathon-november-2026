import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ArtEvent } from "@hm/shared/creation";
import { requireUserPage } from "@/lib/auth";
import { UUID } from "@/lib/http";
import { creationForEditing, myCreations } from "@/lib/server/creations";
import { Studio } from "@/components/studio/Studio";

export const metadata = { title: "Drawing studio" };

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) notFound();
  const user = await requireUserPage(`/portfolio/art/studio/${id}`);
  const c = await creationForEditing(id, user.id);
  if (!c || c.row.kind !== "art") notFound();
  if (c.row.status === "finalized") {
    const done = (await myCreations(user.id, "art")).find((x) => x.id === id);
    redirect(done?.workId ? `/portfolio/work/${done.workId}` : "/portfolio/art/studio");
  }
  return (
    <div className="space-y-6">
      <Link href="/portfolio/art/studio" className="inline-flex items-center gap-1 text-sm font-semibold text-fg-dim hover:text-fg"><span aria-hidden>←</span> Studio</Link>
      <Studio id={id} initialTitle={c.row.title} lastSeq={c.row.last_seq} headHash={c.row.head_hash} events={c.events as ArtEvent[]} prior={{ strokes: c.prior.count, activeSeconds: c.prior.activeSeconds }} />
    </div>
  );
}
