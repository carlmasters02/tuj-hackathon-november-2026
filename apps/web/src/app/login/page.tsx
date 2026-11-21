import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; confirmed?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/dashboard";
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <h1 className="h-page">Log in</h1>
      {sp.confirmed && <p className="rounded-md border border-ok/40 bg-ok-dim p-3 text-sm">Email confirmed — you can log in now.</p>}
      <LoginForm next={next} />
    </div>
  );
}
