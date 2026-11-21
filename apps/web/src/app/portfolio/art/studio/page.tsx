import { requireUserPage } from "@/lib/auth";
import { myCreations } from "@/lib/server/creations";
import { HubHeader } from "@/components/Hub";
import { CreationList } from "@/components/studio/CreationList";
import { NewCreationButton } from "@/components/studio/NewCreationButton";

export const metadata = { title: "Drawing studio" };

export default async function StudioIndex() {
  const user = await requireUserPage("/portfolio/art/studio");
  const items = await myCreations(user.id, "art");
  return (
    <div>
      <HubHeader title="Drawing studio" intro="Every stroke you make here is recorded and timestamped by the server. Finish a piece and it carries its whole history, which is what earns the Human-made seal." back={{ href: "/portfolio/art", label: "Art" }}>
        <NewCreationButton kind="art" label="New drawing" />
      </HubHeader>
      <CreationList items={items} base="/portfolio/art/studio" empty="No drawings yet. Start one and it will be saved here as you go." />
    </div>
  );
}
