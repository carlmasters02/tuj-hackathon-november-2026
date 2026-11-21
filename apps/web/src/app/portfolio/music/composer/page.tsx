import { requireUserPage } from "@/lib/auth";
import { myCreations } from "@/lib/server/creations";
import { HubHeader } from "@/components/Hub";
import { CreationList } from "@/components/studio/CreationList";
import { NewCreationButton } from "@/components/studio/NewCreationButton";

export const metadata = { title: "Composer" };

export default async function ComposerIndex() {
  const user = await requireUserPage("/portfolio/music/composer");
  const items = await myCreations(user.id, "music");
  return (
    <div>
      <HubHeader title="Composer" intro="Write a melody note by note on a sixteen-step grid. Every note you place or remove is recorded, so a finished piece can show exactly how it was written." back={{ href: "/portfolio/music", label: "Music" }}>
        <NewCreationButton kind="music" label="New piece" />
      </HubHeader>
      <CreationList items={items} base="/portfolio/music/composer" empty="No pieces yet. Start one and it will be saved here as you go." />
    </div>
  );
}
