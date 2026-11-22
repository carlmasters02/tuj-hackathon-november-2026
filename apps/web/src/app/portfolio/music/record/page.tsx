import { requireUserPage } from "@/lib/auth";
import { HubHeader } from "@/components/Hub";
import { AudioRecorderPublisher } from "@/components/portfolio/AudioRecorderPublisher";

export const metadata = { title: "Record audio" };

export default async function RecordPage() {
  await requireUserPage("/portfolio/music/record");
  return (
    <div>
      <HubHeader title="Record audio" intro="Sing or play an instrument into your microphone. Your recording stays in this tab until you choose to publish it as an unsealed upload." back={{ href: "/portfolio/music", label: "Music" }} />
      <AudioRecorderPublisher />
    </div>
  );
}
