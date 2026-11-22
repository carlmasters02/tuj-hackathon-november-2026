import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Humagination uses essential authentication cookies and browser storage, without advertising or analytics cookies.",
};

export default function CookiesPage() {
  return (
    <LegalPage current="/legal/cookies" title="Cookie Policy" summary="Humagination currently uses cookies only for essential sign-in and security functions. Separate browser storage supports drafts and the optional extension.">
      <LegalSection title="1. What this policy covers">
        <p>Cookies are small records a website stores in your browser. Browser local and session storage are related technologies that can keep larger values on your device. This policy covers both, including storage used by the optional Chrome extension.</p>
        <p>Humagination does not currently use advertising cookies, cross-site behavioral trackers, analytics cookies or social-media tracking pixels. We do not sell cookie-derived information.</p>
      </LegalSection>

      <LegalSection title="2. Essential website cookies">
        <LegalList>
          <li><strong>Supabase authentication cookies:</strong> maintain and refresh your signed-in session so pages and APIs can identify the account making a request.</li>
          <li><strong>PKCE verifier cookies:</strong> temporarily hold a security value during supported sign-in or confirmation flows so the callback can exchange a one-time authorization code. The code verifier is not a password.</li>
          <li><strong>Logout/expiry removals:</strong> signing out, expiration and account deletion clear or replace authentication cookies as part of ending access.</li>
        </LegalList>
        <p>Application-set authentication cookies are HTTP-only, use SameSite=Lax, and are marked Secure in production. These cookies are required for account and security functionality and are not used for personalized advertising.</p>
      </LegalSection>

      <LegalSection title="3. Browser storage in the web app">
        <p>Code Dojo uses local browser storage to preserve your draft source code for an exercise on that device. This storage is not a cookie and is not an advertising mechanism. Server-submitted attempts and saved solutions are handled under the <Link className="link" href="/legal/privacy">Privacy Policy</Link>.</p>
        <p>Clearing site data can remove locally stored Code Dojo drafts and sign you out. A locally stored draft may differ from work that has been submitted or saved to your account.</p>
      </LegalSection>

      <LegalSection title="4. Extension storage">
        <LegalList>
          <li><strong>Local extension storage:</strong> server URL, revocable extension token, Think First preference, custom AI domains, daily domain-second totals, Think First counters and the latest sync result.</li>
          <li><strong>Session extension storage:</strong> the currently matched domain, time-accounting remainder and temporary permission to continue past a Think First interstitial. Session state is not intended to persist after the browser session ends.</li>
        </LegalList>
        <p>The extension does not use these storage mechanisms to keep page content, prompts, full browsing URLs, page titles or keystrokes. Removing the extension or clearing its extension storage can delete unsynced measurements and require a new token configuration.</p>
      </LegalSection>

      <LegalSection title="5. Your controls">
        <p>You can block or delete cookies and site storage using browser settings, private browsing, site-data controls or extension-management tools. Blocking essential cookies will prevent or disrupt login, session refreshes and other account features.</p>
        <p>You may use public or read-only portions of the service where available without signing in. Private accounts, publishing, social actions, media access and personalized progress require authentication and cannot function reliably with essential cookies disabled.</p>
      </LegalSection>

      <LegalSection title="6. Future changes">
        <p>If we introduce non-essential cookies or similar tracking, we will update this policy and provide notice or consent controls where required before enabling them. Any processor may still maintain its own strictly necessary infrastructure records subject to its documented terms.</p>
      </LegalSection>
    </LegalPage>
  );
}
