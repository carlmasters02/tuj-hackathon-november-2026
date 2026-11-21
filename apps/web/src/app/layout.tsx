import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import Image from "next/image";
import { Nav } from "@/components/Nav";
import bulb from "@/assets/bulb.png";

export const metadata: Metadata = {
  title: { default: "Humagination", template: "%s · Humagination" },
  description: "Learn and create without AI. A tutor that never gives answers, proof that you wrote it, and a gallery AI can't scrape.",
  robots: { index: true, follow: true, "max-image-preview": "none" },
  other: { robots: "noai, noimageai" },
  applicationName: "Humagination",
  appleWebApp: { capable: true, title: "Humagination", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#f7f0e1", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        {process.env.HM_DEMO_MODE === "true" && (
          <div role="status" className="bg-sun px-4 py-1.5 text-center text-xs font-bold text-fg print:hidden">
            Demo mode — login is off and everyone shares one demo account. Don&apos;t enter anything private.
          </div>
        )}
        <Nav />
        <main className="hm-app-main mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 sm:px-6">{children}</main>
        <footer className="border-t border-line bg-surface/60 print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-fg-faint sm:px-6">
            <span className="flex items-center gap-2">
              <Image src={bulb} alt="" width={22} height={22} />
              Humagination — every idea here comes from a human. No AI runs anywhere in this app.
            </span>
            <span className="chip chip-sun">✓ Verified AI-free</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
