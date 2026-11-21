import { requireUserPage, profileOf } from "@/lib/auth";
import { SettingsForms } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUserPage("/settings");
  const profile = await profileOf(user.id);
  if (!profile) return <p>Profile not found.</p>;
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="h-page">Settings</h1>
      <SettingsForms profile={profile} email={user.email ?? ""} />
    </div>
  );
}
