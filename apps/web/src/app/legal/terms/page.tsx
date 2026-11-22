import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for using Humagination accounts, learning tools, creation records, certificates, portfolios and social features.",
};

export default function TermsPage() {
  return (
    <LegalPage current="/legal/terms" title="Terms of Use" summary="These terms set the ground rules for learning, creating and sharing on Humagination. By accessing or using the service, you agree to them.">
      <LegalSection title="1. Who may use Humagination">
        <p>You must be at least 13 years old, or the higher minimum age required in your country. If you are below the age of legal majority, you may use the service only with permission from a parent or legal guardian who agrees to these terms.</p>
        <p>You must provide accurate account information, keep your credentials and extension tokens private, and take reasonable steps to protect your account. You are responsible for activity that occurs through your account unless it resulted from a failure of our safeguards. Do not share the shared demo account or use it for private material.</p>
      </LegalSection>

      <LegalSection title="2. What the service provides">
        <p>Humagination offers deterministic tutoring, writing and creation tools, creation-event records, certificates, public portfolio pages, comments, likes, profiles, and an optional browser extension. Features may change as the project develops.</p>
        <p>Tutoring feedback, progress measures and creation records are educational and motivational tools. They are not accredited assessments, guarantees of learning outcomes, fraud-proof identity checks, or conclusive proof that a person worked without outside assistance.</p>
      </LegalSection>

      <LegalSection title="3. Creation records and tracker figures">
        <p>A creation-record seal means an eligible event log was received by the server, replayed to the published work and passed the integrity checks described in the service. It does not prove that nobody copied, received assistance or used another tool off-screen. Replay evidence, statistics and verdict labels must be read together with those limitations.</p>
        <p>Reliance Tracker figures come from the browser extension and focus/idle signals available to it. They are self-reported motivational estimates, not surveillance records or proof of conduct. Do not rely on certificates or tracker figures for high-stakes employment, disciplinary, legal, academic-integrity, or eligibility decisions without independent human review.</p>
      </LegalSection>

      <LegalSection title="4. Your content and permission to operate the service">
        <p>You retain ownership of the text, artwork, music, comments, profile material and other content you submit. You represent that you have the rights and permissions needed to submit it and to allow others to view it as you direct.</p>
        <p>You give Humagination a non-exclusive, worldwide, royalty-free license to host, store, reproduce, process, re-encode, encrypt, decrypt for authorized operation, watermark, render from event logs, and display your content only as needed to provide, secure and improve the service. This includes showing public work and certificates to other users, applying ownership and viewer watermarks, and generating previews. The license for private content ends when it is deleted, subject to limited backup retention and legal obligations; public-content licenses survive only as needed for copies lawfully retained by others or records we must keep.</p>
        <p>See our <Link className="link" href="/legal/privacy">Privacy Policy</Link> for handling of personal information and our <Link className="link" href="/legal/copyright">Copyright & Content Policy</Link> for takedowns and sharing rules.</p>
      </LegalSection>

      <LegalSection title="5. Public and social activity">
        <p>When you publish work, publish a certificate, comment, like, follow, or opt into a leaderboard, associated information may be visible to other users. Your username, public profile, published work, public comments, and certificate replay may be shared along with that activity. Private drafts, private originals, private document comments and non-public account information are not made public merely because you use the service.</p>
        <p>You are responsible for what you choose to publish. Do not expose personal information about yourself or another person that you do not have permission or a valid reason to share.</p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>You must not:</p>
        <LegalList>
          <li>Break the law, infringe intellectual-property or privacy rights, or upload content you are not entitled to share.</li>
          <li>Harass, threaten, defame, exploit, or harm others; post sexual content involving minors; or facilitate violence, fraud, or other serious harm.</li>
          <li>Upload malware, attempt unauthorized access, probe another user&apos;s private data, bypass row-level security, defeat access controls, or interfere with the service.</li>
          <li>Forge, alter, or misrepresent certificates, provenance logs, signatures, watermarks, points, progress, identities, or account ownership.</li>
          <li>Use automated scraping, credential stuffing, denial-of-service traffic, evasion of rate limits, or bulk collection that burdens the service or violates another person&apos;s rights.</li>
          <li>Impersonate another person, mislead others about the origin of work, or use reports and moderation tools abusively.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="7. Reports, moderation and enforcement">
        <p>We may review reported content and activity, restrict visibility, remove content, suspend features, or suspend or terminate accounts when reasonably necessary to enforce these terms, protect users, comply with law, or keep the service secure. We may preserve and disclose information where legally required or necessary to address fraud, security, or abuse.</p>
        <p>We do not promise to monitor all content or resolve every report in a particular way. Report decisions involve judgment; automated checks and labels alone should not determine whether a person violated a rule.</p>
      </LegalSection>

      <LegalSection title="8. Third-party services and external links">
        <p>Humagination relies on providers such as Supabase for accounts/data and Vercel for hosting. Optional sign-in providers and code-running services have their own terms. External links are provided for convenience; we do not control external sites or their policies. Your dealings with those services are subject to their terms as well.</p>
      </LegalSection>

      <LegalSection title="9. Availability, changes and termination">
        <p>You may stop using the service at any time and can request deletion through your account settings. We may suspend or discontinue all or part of the service, including for maintenance, security, funding, technical, or legal reasons. Where reasonably possible, we will provide notice of material changes.</p>
        <p>Provisions about ownership, acceptable use, disclaimers, liability, disputes, and information that must survive account closure remain effective after termination to the extent relevant.</p>
      </LegalSection>

      <LegalSection title="10. Disclaimer of warranties">
        <p>The service is provided on an <strong>“as is” and “as available”</strong> basis. To the maximum extent permitted by law, Humagination and its contributors disclaim express and implied warranties, including merchantability, fitness for a particular purpose, non-infringement, uninterrupted availability, accuracy, and that the service will meet a particular educational or verification need.</p>
        <p>No certificate, watermark, AI-crawler block, encryption measure, or privacy control guarantees that content cannot be copied, captured, misused, or exposed. Nothing in these terms removes rights or warranties that cannot legally be excluded.</p>
      </LegalSection>

      <LegalSection title="11. Limitation of liability">
        <p>To the maximum extent permitted by law, Humagination and its contributors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages; loss of data, work, profits, goodwill, opportunities, or reputation; or decisions made in reliance on certificates, scores, feedback, or availability of the service.</p>
        <p>Where liability cannot be excluded, it is limited to the greatest extent allowed by applicable law. These limits do not exclude liability for intentional misconduct, gross negligence, death or personal injury caused by negligence, or other liability that cannot legally be limited.</p>
      </LegalSection>

      <LegalSection title="12. Changes and general terms">
        <p>We may update these terms as the service changes. The date above shows the latest revision. If changes materially affect your rights or obligations, we will provide reasonable notice where appropriate. Continued use after updated terms take effect means you accept them; if you do not agree, stop using the service and delete your account.</p>
        <p>If a provision is unenforceable, the remaining provisions continue to apply. A failure to enforce a provision is not a waiver. These terms, together with the linked policies, form the agreement about using Humagination. Mandatory consumer and other local rights still apply; no jurisdiction-specific clause here is intended to remove them.</p>
      </LegalSection>
    </LegalPage>
  );
}
