import { SignupForm } from "./SignupForm";
import { GoogleButton, OrDivider } from "@/components/GoogleButton";

// Set NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true once the Google provider is configured in Supabase.
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div>
        <h1 className="h-page">Create your account</h1>
        <p className="mt-2 text-sm text-fg-dim">We&apos;ll email you a confirmation link.</p>
      </div>
      {process.env.HM_DEMO_MODE === "true" && (
        <a href="/auth/demo" className="btn btn-sun w-full py-2.5">Skip login — enter the demo</a>
      )}
      {GOOGLE_ENABLED && (
        <>
          <GoogleButton label="Sign up with Google" />
          <OrDivider />
        </>
      )}
      <SignupForm />
    </div>
  );
}
