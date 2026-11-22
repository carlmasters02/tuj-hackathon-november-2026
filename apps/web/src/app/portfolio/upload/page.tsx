import { requireUserPage } from "@/lib/auth";
import { UploadForm } from "@/components/gallery/UploadForm";
import { OwnershipChecker } from "@/components/gallery/OwnershipChecker";

export const metadata = { title: "Upload" };

export default async function UploadPage() {
  await requireUserPage("/portfolio/upload");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="h-page">Upload your work</h1>
      <ul className="space-y-1 text-sm text-fg-dim">
        <li>• Images are re-encoded (stripping EXIF/GPS and anything hidden in the file), hashed, and checked against existing work for re-uploads.</li>
        <li>• Your original is watermarked invisibly, encrypted with AES-256-GCM and never served to anyone.</li>
        <li>• Viewers see a ≤1200 px preview with your handle tiled faintly, plus their own username stamped near-invisibly.</li>
        <li>• Words are published from a certificate with a verified creation record, not uploaded — <a className="link" href="/tutor/writing">start a draft in Tutor</a>.</li>
      </ul>
      <UploadForm />
      <OwnershipChecker />
    </div>
  );
}
