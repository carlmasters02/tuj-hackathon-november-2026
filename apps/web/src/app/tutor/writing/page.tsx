import { requireUserPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { GENRES } from "@hm/shared/genres";
import { HubHeader, IndexRow } from "@/components/Hub";

export const metadata = { title: "Writing" };

export default async function WritingHub() {
  await requireUserPage("/tutor/writing");
  const sb = await supabaseServer();
  const { data } = await sb.from("documents").select("genre");
  const count = new Map<string, number>();
  for (const d of data ?? []) count.set(d.genre, (count.get(d.genre) ?? 0) + 1);
  return (
    <div>
      <HubHeader title="Writing" intro="Every keystroke is recorded so you can prove you wrote it, and a coach for each genre explains what to work on — it never rewrites a word." back={{ href: "/tutor", label: "Tutor" }} />
      <nav aria-label="Genres">
        {GENRES.map((g) => (
          <IndexRow key={g.slug} href={`/tutor/writing/${g.slug}`} title={g.label} note={g.promise} chips={g.principles.map((p) => p.title)} status={`${count.get(g.slug) ?? 0} piece${count.get(g.slug) === 1 ? "" : "s"}`} />
        ))}
      </nav>
    </div>
  );
}
