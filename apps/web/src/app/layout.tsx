import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: { default: "Humagination", template: "%s · Humagination" },
  description: "Learn and create without AI. A tutor that never gives answers, proof that you wrote it, and a gallery AI can't scrape.",
  robots: { index: true, follow: true, "max-image-preview": "none" },
  other: { robots: "noai, noimageai" },
};

export const viewport: Viewport = { themeColor: "#0e0e0d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-paper-faint sm:px-6">
            <span>Humagination — no AI runs anywhere in this app.</span>
            <span className="chip">✓ Verified AI-free · <code>pnpm check:ai</code></span>
          </div>
        </footer>
      </body>
    </html>
  );
}
