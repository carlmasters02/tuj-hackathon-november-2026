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
import { HumanSeal } from "@/components/HumanSeal";
import { ScorePlayer } from "@/components/studio/ScorePlayer";
import { MIN_EFFORT } from "@hm/shared/creation";

/** Plain-language reason a recorded piece didn't earn the seal. */
function whyNotSealed(kind: string, s: Record<string, unknown> | undefined): string {
  if (!s) return "The record didn't clear the bar for the Human-made seal.";
  const flags = (s.flags as string[] | undefined) ?? [];
  if (flags.length) return `The record was flagged: ${flags.join("; ").toLowerCase()}.`;
  const secs = Number(s.activeSeconds ?? 0);
  if (kind === "art" || kind === "music") {
    const need = kind === "art" ? MIN_EFFORT.art : { strokes: MIN_EFFORT.music.edits, seconds: MIN_EFFORT.music.seconds };
    const done = Number((kind === "art" ? s.strokes : s.noteEdits) ?? 0);
    const unit = kind === "art" ? "strokes" : "note edits";
    const short: string[] = [];
    if (done < need.strokes) short.push(`${done} of ${need.strokes} ${unit}`);
    if (secs < need.seconds) short.push(`${secs} of ${need.seconds} seconds of active time`);
    if (short.length) return `It was too short for the seal: ${short.join(" and ")}.`;
  }
  return "The record didn't clear the bar for the Human-made seal.";
}

export const metadata = { title: "Work", other: { robots: "noai, noimageai" } };

const KIND_LABEL = { art: "Art", writing: "Writing", music: "Music" } as const;

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) notFound();
  const user = await requireUserPage(`/portfolio/work/${id}`);
  const sb = supabaseAdmin();
  const { data: w } = await sb.from("gallery_works").select("*").eq("id", id).maybeSingle();
  if (!w || (!w.published && w.owner_id !== user.id)) notFound();

  const [owner, viewer, likes, mine, commentRows, cert] = await Promise.all([
    profileOf(w.owner_id),
    profileOf(user.id),
    sb.from("likes").select("user_id", { count: "exact", head: true }).eq("work_id", id),
    sb.from("likes").select("user_id").eq("work_id", id).eq("user_id", user.id).maybeSingle(),
    sb.from("comments").select("id, author_id, body, created_at").eq("work_id", id).order("created_at", { ascending: true }).limit(200),
    w.cert_id ? sb.from("certificates").select("id, kind, verdict, payload, events_json").eq("id", w.cert_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const authorIds = [...new Set((commentRows.data ?? []).map((c) => c.author_id))];
  const { data: authors } = authorIds.length ? await sb.from("profiles").select("id, username").in("id", authorIds) : { data: [] };
  const authorName = new Map((authors ?? []).map((a) => [a.id, a.username]));
  const comments: CommentView[] = (commentRows.data ?? []).map((c) => ({ id: c.id, author: authorName.get(c.author_id) ?? "deleted", body: c.body, createdAt: c.created_at, mine: c.author_id === user.id }));
  const isOwner = w.owner_id === user.id;
  const c = cert.data;
  const verified = c?.verdict === "human_verified";
  const stats = (c?.payload as { stats?: Record<string, number> } | undefined)?.stats;
  const statsAny = stats as Record<string, unknown> | undefined;

  let writing: string | null = null;
  if (w.kind === "writing" && c) writing = replay((c.events_json as StoredBatch[]).flatMap((b) => b.events));
  const stamp = `@${viewer?.username ?? "viewer"} ${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-12">
      <Link href={`/portfolio/${w.kind}`} className="inline-flex items-center gap-1 text-sm font-semibold text-fg-dim hover:text-fg">
        <span aria-hidden>←</span> {KIND_LABEL[w.kind as keyof typeof KIND_LABEL]}
      </Link>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          {w.kind === "art" && w.preview_key && <ProtectedImage src={signedMediaUrl(id, user.id)} width={w.width ?? 4} height={w.height ?? 3} alt={w.title} />}
          {w.kind === "music" && c?.kind === "music" && <ScorePlayer batches={c.events_json as { events: unknown[] }[]} />}
          {w.kind === "music" && !c && (
            <div className="rounded-3xl border border-line bg-surface p-6">
              <audio controls controlsList="nodownload noplaybackrate" preload="none" src={signedMediaUrl(id, user.id, "music")} className="w-full" />
              <p className="mt-2 text-xs text-fg-faint">64 kbps preview. The original is encrypted and never served.</p>
            </div>
          )}
          {w.kind === "writing" && writing !== null && (
            <article className="hm-protected relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-10 sm:px-14">
              <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-wrap content-start gap-x-16 gap-y-12 p-4 text-xs opacity-[0.05]" style={{ transform: "rotate(-20deg) scale(1.4)" }}>
                {Array.from({ length: 120 }, (_, i) => <span key={i}>{stamp}</span>)}
              </div>
              <div className="relative mx-auto max-w-[66ch] whitespace-pre-wrap font-serif text-[1.2rem] leading-[1.85]">{writing}</div>
            </article>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div>
            <h1 className="text-[2.2rem] font-extrabold leading-[1.02] tracking-[-0.03em]">{w.title}</h1>
            <p className="mt-2 text-fg-dim">
              by <Link className="link" href={`/u/${owner?.username}`}>@{owner?.username}</Link>, {new Date(w.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
            </p>
            {!w.published && <p className="mt-2 chip">Only you can see this</p>}
          </div>

          {verified ? (
            <div className="rounded-2xl bg-sun-soft p-4 ring-1 ring-sun">
              <div className="flex items-center gap-3">
                <HumanSeal size={60} />
                <div>
                  <p className="font-bold">Human-made</p>
                  <p className="text-sm text-fg-dim">The full creation process was recorded and checked.</p>
                </div>
              </div>
              {stats && (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {w.kind === "writing" && <><dt className="text-fg-dim">Typed here</dt><dd className="text-right font-bold">{stats.typedPct}%</dd></>}
                  {"strokes" in stats && <><dt className="text-fg-dim">Strokes</dt><dd className="text-right font-bold">{stats.strokes}</dd></>}
                  {"noteEdits" in stats && <><dt className="text-fg-dim">Note edits</dt><dd className="text-right font-bold">{stats.noteEdits}</dd></>}
                  <dt className="text-fg-dim">Time spent</dt><dd className="text-right font-bold">{Math.max(1, Math.round((stats.activeSeconds ?? 0) / 60))} min</dd>
                </dl>
              )}
              <Link href={`/verify/${c!.id}`} className="mt-3 inline-block text-sm font-bold underline decoration-flame decoration-2 underline-offset-4">Watch how it was made</Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-line p-4 text-sm text-fg-dim">
              <p className="font-bold text-fg">Not verified</p>
              {c ? (
                <p className="mt-1">
                  Made here, so the whole process is on record. {whyNotSealed(w.kind, statsAny)}{" "}
                  <Link className="link" href={`/verify/${c.id}`}>See the record</Link>
                </p>
              ) : (
                <p className="mt-1">This piece was uploaded, so there&apos;s no record of how it was made and it can&apos;t carry the Human-made seal.</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <LikeButton id={id} liked={!!mine.data} count={likes.count ?? 0} />
            {!isOwner && <ReportButton id={id} />}
          </div>
          {w.description && <p className="leading-relaxed text-fg-dim">{w.description}</p>}
          {isOwner && <OwnerControls id={id} published={w.published} />}
        </aside>
      </div>

      {/* comments line up with the artwork column above */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <ArtworkComments workId={id} initial={comments} canModerate={isOwner} />
        </div>
      </div>
    </div>
  );
}
