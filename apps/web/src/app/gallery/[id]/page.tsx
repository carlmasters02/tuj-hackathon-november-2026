import Link from "next/link";
import { notFound } from "next/navigation";
import { replay, type StoredBatch } from "@hm/shared/provenance/index";
import { profileOf, requireUserPage } from "@/lib/auth";
import { UUID } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedMediaUrl } from "@/lib/server/gallery";
import { ProtectedImage } from "@/components/gallery/ProtectedImage";
import { LikeButton, OwnerControls, ReportButton } from "@/components/gallery/WorkActions";
import ArtworkComments, { type CommentView } from "@/components/gallery/ArtworkComments";

export const metadata = { title: "Work", other: { robots: "noai, noimageai" } };

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) notFound();
  const user = await requireUserPage(`/gallery/${id}`);
  const sb = supabaseAdmin();
  const { data: w } = await sb.from("gallery_works").select("*").eq("id", id).maybeSingle();
  if (!w || (!w.published && w.owner_id !== user.id)) notFound();
  const [owner, viewer, likes, mine, commentRows] = await Promise.all([
    profileOf(w.owner_id),
    profileOf(user.id),
    sb.from("likes").select("user_id", { count: "exact", head: true }).eq("work_id", id),
    sb.from("likes").select("user_id").eq("work_id", id).eq("user_id", user.id).maybeSingle(),
    sb.from("comments").select("id, author_id, body, created_at").eq("work_id", id).order("created_at", { ascending: true }).limit(200),
  ]);
  const authorIds = [...new Set((commentRows.data ?? []).map((c) => c.author_id))];
  const { data: authors } = authorIds.length ? await sb.from("profiles").select("id, username").in("id", authorIds) : { data: [] };
  const authorName = new Map((authors ?? []).map((a) => [a.id, a.username]));
  const comments: CommentView[] = (commentRows.data ?? []).map((c) => ({
    id: c.id,
    author: authorName.get(c.author_id) ?? "deleted",
    body: c.body,
    createdAt: c.created_at,
    mine: c.author_id === user.id,
  }));
  const isOwner = w.owner_id === user.id;

  let writing: string | null = null;
  if (w.kind === "writing" && w.cert_id) {
    const { data: cert } = await sb.from("certificates").select("events_json").eq("id", w.cert_id).maybeSingle();
    if (cert) writing = replay((cert.events_json as StoredBatch[]).flatMap((b) => b.events));
  }
  const stamp = `@${viewer?.username ?? "viewer"} ${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/gallery?tab=${w.kind}`} className="text-sm text-fg-dim hover:text-fg">← Gallery</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-page">{w.title}</h1>
          <p className="text-sm text-fg-dim">by <Link className="link" href={`/u/${owner?.username}`}>@{owner?.username}</Link> · {new Date(w.created_at).toLocaleDateString()} {!w.published && <span className="chip ml-2">unpublished</span>}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LikeButton id={id} liked={!!mine.data} count={likes.count ?? 0} />
          {!isOwner && <ReportButton id={id} />}
        </div>
      </div>

      {w.kind === "art" && <ProtectedImage src={signedMediaUrl(id, user.id)} width={w.width ?? 4} height={w.height ?? 3} alt={w.title} />}
      {w.kind === "music" && (
        <div className="card space-y-2 p-5">
          <audio controls controlsList="nodownload noplaybackrate" preload="none" src={signedMediaUrl(id, user.id, "music")} className="w-full" />
          <p className="text-xs text-fg-faint">64 kbps preview. The original is encrypted and never served. Link expires in 5 minutes — reload to play again.</p>
        </div>
      )}
      {w.kind === "writing" && writing !== null && (
        <article className="hm-protected relative overflow-hidden rounded-xl border border-line bg-surface p-8">
          {/* per-viewer watermark in a background layer */}
          <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-wrap content-start gap-x-16 gap-y-12 p-4 text-xs opacity-[0.05]" style={{ transform: "rotate(-20deg) scale(1.4)" }}>
            {Array.from({ length: 120 }, (_, i) => <span key={i}>{stamp}</span>)}
          </div>
          <div className="relative whitespace-pre-wrap font-serif text-lg leading-relaxed">{writing}</div>
          <Link href={`/verify/${w.cert_id}`} className="relative mt-6 inline-flex chip border-ok/50 text-ok">✓ Human-Verified — see certificate & replay</Link>
        </article>
      )}
      {w.description && <p className="text-fg-dim">{w.description}</p>}
      {isOwner && <OwnerControls id={id} published={w.published} />}
      <ArtworkComments workId={id} initial={comments} canModerate={isOwner} />
    </div>
  );
}
