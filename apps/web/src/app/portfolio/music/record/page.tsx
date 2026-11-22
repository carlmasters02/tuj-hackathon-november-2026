import { requireUserPage } from "@/lib/auth";
import { HubHeader } from "@/components/Hub";
import { AudioRecorder } from "@/components/portfolio/AudioRecorder";

export const metadata = { title: "Record" };

export default async function RecordPage() {
  await requireUserPage("/portfolio/music/record");
  return (
    <div>
      <HubHeader title="Record" intro="Sing or play an instrument into your microphone. Nothing leaves this tab until you publish." back={{ href: "/portfolio/music", label: "Music" }} />
      <AudioRecorder />
    </div>
  );
}
