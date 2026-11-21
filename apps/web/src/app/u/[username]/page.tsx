import Link from "next/link";
import { notFound } from "next/navigation";
import { UsernameSchema } from "@hm/shared/passwords";
import { VERDICT_LABEL, type Verdict } from "@hm/shared/provenance/stats";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { FollowButton } from "@/components/gallery/WorkActions";

export const metadata = { title: "Profile", other: { robots: "noai, noimageai" } };

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const parsed = UsernameSchema.safeParse((await params).username);
  if (!parsed.success) notFound();
  const viewer = await currentUser();
  const sb = supabaseAdmin();
  const { data: p } = await sb.from("profiles").select("id, username, display_name, bio, is_public, created_at").eq("username", parsed.data).maybeSingle();
  if (!p || (!p.is_public && p.id !== viewer?.id)) notFound();
  const [works, certs, followers, following, amFollowing] = await Promise.all([
    sb.from("gallery_works").select("id, kind, title, created_at").eq("owner_id", p.id).eq("published", true).order("created_at", { ascending: false }).limit(50),
    sb.from("certificates").select("id, title, verdict, created_at").eq("owner_id", p.id).order("created_at", { ascending: false }).limit(20),
    sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", p.id),
    sb.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", p.id),
    viewer ? sb.from("follows").select("follower_id").eq("follower_id", viewer.id).eq("followee_id", p.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-page">{p.display_name || p.username}</h1>
          <p className="text-sm text-fg-dim">@{p.username} · {followers.count ?? 0} followers · {following.count ?? 0} following</p>
          {p.bio && <p className="mt-2 max-w-xl text-fg-dim">{p.bio}</p>}
        </div>
        {viewer && viewer.id !== p.id && <FollowButton username={p.username} following={!!amFollowing.data} />}
      </header>
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-fg-faint">Published work</h2>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {(works.data ?? []).length === 0 && <li className="p-4 text-sm text-fg-faint">Nothing published yet.</li>}
          {(works.data ?? []).map((w) => (
            <li key={w.id}><Link href={`/portfolio/work/${w.id}`} className="flex justify-between px-4 py-3 hover:bg-surface"><span className="font-bold">{w.title}</span><span className="chip">{w.kind}</span></Link></li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-fg-faint">Certificates</h2>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {(certs.data ?? []).length === 0 && <li className="p-4 text-sm text-fg-faint">No certificates yet.</li>}
          {(certs.data ?? []).map((c) => (
            <li key={c.id}><Link href={`/verify/${c.id}`} className="flex justify-between px-4 py-3 hover:bg-surface"><span className="font-bold">{c.title}</span><span className="chip">{VERDICT_LABEL[c.verdict as Verdict]}</span></Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
