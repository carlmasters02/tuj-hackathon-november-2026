import { SignupForm } from "./SignupForm";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div>
        <h1 className="h-page">Create your account</h1>
        <p className="mt-2 text-sm text-fg-dim">We&apos;ll email you a confirmation link.</p>
      </div>
      <SignupForm />
    </div>
  );
}
