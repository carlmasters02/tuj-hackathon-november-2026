import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Nav } from "@/components/Nav";
import { SiteFooter } from "@/components/SiteFooter";

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
        <SiteFooter />
      </body>
    </html>
  );
}
