import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Humagination collects, why it uses information, when information is public, and the choices available to users.",
};

export default function PrivacyPage() {
  return (
    <LegalPage current="/legal/privacy" title="Privacy Policy" summary="This policy explains how Humagination handles account information, creative work, creation-event records, social activity and optional extension measurements.">
      <LegalSection title="1. Scope and key principles">
        <p>This policy applies to the Humagination web application and its optional Chrome extension. Humagination does not sell personal information, use advertising trackers, or submit your work to AI models for training or analysis. Privacy controls and watermarks reduce risk but cannot eliminate screenshots, breaches, misuse by authorized viewers, or every form of data collection by your device or service providers.</p>
      </LegalSection>

      <LegalSection title="2. Information you provide">
        <LegalList>
          <li><strong>Account and profile:</strong> email address, username, display name, biography, preferences, authentication-provider identifiers, and optional social or leaderboard settings. Passwords are handled by Supabase Auth; Humagination does not need your plaintext password to authenticate existing sessions.</li>
          <li><strong>Learning activity:</strong> submitted math steps and code, attempts, progress, hints, active-time estimates, human-time records, points and streaks. Code submissions are sent to the configured execution service for compilation or testing.</li>
          <li><strong>Creative work:</strong> documents, titles, sources, document setup, private comments, artwork, audio, descriptions, uploads, filenames and publishing choices.</li>
          <li><strong>Creation-event records:</strong> actions performed inside eligible creation tools, including inserted/deleted text, paste markers, formatting changes, strokes, notes, undo/clear actions, sequence data, client timestamps and server receipt times. This can contain the content of your work and is used to replay and validate creations.</li>
          <li><strong>Social activity:</strong> comments, likes, follows, reports, public profile choices, published work and certificates.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Information collected automatically">
        <p>Servers and infrastructure providers may process IP addresses, timestamps, user agents, requested routes and diagnostic logs to deliver and protect the service. Application rate limits and login-failure records use hashed identifiers where designed to do so. Security logs should not contain your password, private document contents or full extension payloads.</p>
        <p>The service uses essential authentication and security cookies. Browser storage may hold Code Dojo drafts and extension settings. The <Link className="link" href="/legal/cookies">Cookie Policy</Link> explains these separately.</p>
      </LegalSection>

      <LegalSection title="4. Optional Reliance Tracker extension">
        <p>The extension inspects the hostname of the active tab in the focused browser window to determine whether it matches a configured AI service. It measures active time using tab, window-focus and idle events.</p>
        <p>It stores and syncs <strong>date, matched domain and seconds</strong>, plus optional Think First redirect/bypass counters. It does not intentionally store or send full URLs, page paths, page titles, prompts, conversations, page contents or keystrokes. Extension tokens are revocable and stored server-side as hashes.</p>
        <p>Tracker measurements are estimates produced by your browser. Participation is optional, and you can stop syncing by removing the extension token or uninstalling the extension. Previously synced daily totals remain until you delete the relevant data or your account.</p>
      </LegalSection>

      <LegalSection title="5. How information is used">
        <LegalList>
          <li>Authenticate users, maintain sessions and provide individual accounts.</li>
          <li>Store and return your work, replay creation logs and issue or verify certificates.</li>
          <li>Provide tutoring feedback, progress, points, streaks and leaderboards.</li>
          <li>Operate public portfolios, profiles, likes, comments, follows and reports.</li>
          <li>Encrypt private originals, restrict media access, apply ownership/viewer watermarks and process previews.</li>
          <li>Prevent abuse, enforce rate limits, investigate reports, secure accounts and maintain reliability.</li>
          <li>Comply with legal obligations and establish, exercise or defend legal claims.</li>
        </LegalList>
        <p>We use information only for these operations and compatible purposes, not behavioral advertising. Where required by local law, processing relies on providing the service you request, your choices or consent, legitimate security/operational interests, and legal obligations.</p>
      </LegalSection>

      <LegalSection title="6. What is public and what is shared">
        <LegalList>
          <li><strong>Your choices:</strong> published work, public certificates and replays, usernames, public profiles, public comments, and opted-in leaderboard entries can be visible to others. Uploaded work can be public without receiving a Human-made seal.</li>
          <li><strong>Other authorized users:</strong> media previews may contain a forensic mark linked to the viewer and date. Private viewer-specific links do not make public sharing socially risk-free.</li>
          <li><strong>Infrastructure providers:</strong> Supabase processes authentication, database and storage operations; Vercel hosts application traffic. Optional identity providers process sign-in if enabled. Configured code runners process submitted source code. These providers act under their own terms and our configuration.</li>
          <li><strong>Legal and safety disclosures:</strong> information may be disclosed when reasonably necessary to comply with valid legal process, protect rights and safety, investigate abuse, or complete a legitimate project transfer subject to safeguards.</li>
        </LegalList>
        <p>We do not sell account information, creative work, exact browsing histories or tracker payloads.</p>
      </LegalSection>

      <LegalSection title="7. Retention and deletion">
        <p>Information is kept while your account or relevant feature remains active and as needed afterward for backups, security, dispute handling and legal obligations. Drafts, uploaded originals, creation records and social data can be removed through available controls where offered. Deleting an account through Settings invokes the application&apos;s cascade cleanup for associated records and media.</p>
        <p>Copies in encrypted or operational backups may remain until the hosting provider&apos;s normal backup cycle expires. Limited security records may be retained where necessary. Content already copied, captured, downloaded or reshared by another person is outside Humagination&apos;s direct control.</p>
      </LegalSection>

      <LegalSection title="8. Security and limitations">
        <p>The application uses authenticated requests, row-level security, least-privilege server routes, encryption for sensitive stored work, private storage, short-lived viewer-bound links and HTTP-only session cookies. No online service can promise absolute security. Use a unique password, protect extension tokens, sign out on shared devices, avoid putting unnecessary personal information in public work, and contact maintainers about suspected exposure.</p>
      </LegalSection>

      <LegalSection title="9. Your choices and rights">
        <p>Depending on your location, you may have rights to access, correct, export, restrict, object to, or delete personal information, withdraw consent, and complain to a privacy regulator. You can update profile settings, unpublish or delete eligible work, revoke extension tokens, remove the extension, stop using optional features and delete your account.</p>
        <p>For requests not available in the interface, contact the maintainers using the link below. We may need to verify account ownership before completing a request. Do not send identity documents or secrets in a public issue.</p>
      </LegalSection>

      <LegalSection title="10. Children and international processing">
        <p>The service is not directed to children under 13 or any higher minimum age required locally. If we learn that a child below the applicable age provided information without required permission, we will take reasonable steps to delete it.</p>
        <p>Infrastructure providers may process information in countries other than yours. Their locations and safeguards can vary. By using a hosted service, you acknowledge this processing; legally required safeguards and rights remain applicable.</p>
      </LegalSection>

      <LegalSection title="11. Policy changes">
        <p>We may revise this policy as features, providers or legal obligations change. Material changes will be reflected by the date above and, where appropriate, communicated through the service. Continued use after an update is subject to the revised policy, except where a different legal basis or renewed consent is required.</p>
      </LegalSection>
    </LegalPage>
  );
}
