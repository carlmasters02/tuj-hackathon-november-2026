import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedMediaUrl } from "@/lib/server/gallery";
import { ProtectedImage } from "@/components/gallery/ProtectedImage";

export const metadata = { title: "Gallery", other: { robots: "noai, noimageai" } };
const TABS = [
  { id: "art", label: "Art" },
  { id: "writing", label: "Writing" },
  { id: "music", label: "Music" },
] as const;

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUserPage("/gallery");
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t.id === requested)?.id ?? "art";
  const sb = supabaseAdmin();
  const { data: works } = await sb.from("gallery_works").select("id, owner_id, title, width, height, created_at, cert_id").eq("kind", tab).eq("published", true).order("created_at", { ascending: false }).limit(60);
  const ownerIds = [...new Set((works ?? []).map((w) => w.owner_id))];
  const { data: owners } = ownerIds.length ? await sb.from("profiles").select("id, username").in("id", ownerIds) : { data: [] };
  const name = new Map((owners ?? []).map((o) => [o.id, o.username]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-page">Gallery</h1>
          <p className="mt-1 max-w-2xl text-sm text-fg-dim">Human-made work only. AI crawlers are refused, originals are encrypted and never served, and every image you see is stamped with your username — screenshot-deterred and traceable.</p>
        </div>
        <Link href="/gallery/upload" className="btn btn-primary">Upload</Link>
      </div>
      <nav className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link key={t.id} href={`/gallery?tab=${t.id}`} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-fg text-fg" : "border-transparent text-fg-dim hover:text-fg"}`}>{t.label}</Link>
        ))}
      </nav>
      {(works ?? []).length === 0 && <p className="text-sm text-fg-faint">Nothing published here yet.</p>}
      {tab === "art" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(works ?? []).map((w) => (
            <Link key={w.id} href={`/gallery/${w.id}`} className="card overflow-hidden hover:border-fg-faint">
              <ProtectedImage src={signedMediaUrl(w.id, user.id)} width={w.width ?? 4} height={w.height ?? 3} alt={w.title} />
              <div className="p-3"><div className="font-bold">{w.title}</div><div className="text-xs text-fg-faint">@{name.get(w.owner_id)}</div></div>
            </Link>
          ))}
        </div>
      )}
      {tab !== "art" && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {(works ?? []).map((w) => (
            <li key={w.id}>
              <Link href={`/gallery/${w.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface">
                <span className="text-lg font-extrabold">{w.title}</span>
                <span className="flex items-center gap-2 text-xs text-fg-faint">{tab === "writing" && <span className="chip border-ok/50 text-ok">Human-Verified</span>}@{name.get(w.owner_id)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
