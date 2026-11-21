import { VerifyTool } from "@/components/verify/VerifyTool";

export const metadata = { title: "Verify a certificate" };

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="h-page">Verify a certificate</h1>
        <p className="mt-2 text-sm text-fg-dim">
          Paste a certificate&apos;s JSON and the text it claims to cover. Everything is checked in your browser: the Ed25519 signature against
          Humagination&apos;s public key, and the SHA-256 of the text against the signed content hash. Nothing is uploaded.
        </p>
      </div>
      <VerifyTool />
    </div>
  );
}
