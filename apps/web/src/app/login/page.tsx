import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { GoogleButton, OrDivider } from "@/components/GoogleButton";

// Set NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true once the Google provider is configured in Supabase.
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; confirmed?: string; error?: string }> }) {
  if (process.env.HM_DEMO_MODE === "true") redirect("/dashboard"); // login is off in demo mode
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/dashboard";
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <h1 className="h-page">Log in</h1>
      {sp.confirmed && <p className="rounded-xl border border-ok/40 bg-ok-dim p-3 text-sm">If you just confirmed your email, you can log in now.</p>}
      {sp.error && (
        <p role="alert" className="rounded-xl border border-redpen/40 bg-redpen-dim p-3 text-sm">
          {sp.error === "oauth" ? "Google sign-in was cancelled or failed. Please try again." : "That link is invalid or has expired. Please log in or request a new one."}
        </p>
      )}
      {process.env.HM_DEMO_MODE === "true" && (
        <a href="/auth/demo" className="btn btn-sun w-full py-2.5">Skip login — enter the demo</a>
      )}
      {GOOGLE_ENABLED && (
        <>
          <GoogleButton next={next} />
          <OrDivider />
        </>
      )}
      <LoginForm next={next} />
    </div>
  );
}
