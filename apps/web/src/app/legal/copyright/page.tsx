import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Copyright & Content Policy",
  description: "Rules for sharing work on Humagination and how to report copyright, ownership, privacy or other content concerns.",
};

export default function CopyrightPage() {
  return (
    <LegalPage current="/legal/copyright" title="Copyright & Content Policy" summary="Keep ownership of your work, share only what you have permission to share, and use the reporting process when something should be reviewed.">
      <LegalSection title="1. Ownership and originality">
        <p>Creators retain their rights in uploaded or recorded work. Publishing on Humagination does not transfer copyright to us or to other users. The limited permission needed to host and operate the service is described in the <Link className="link" href="/legal/terms">Terms of Use</Link>.</p>
        <p>Only submit work if you created it, have the necessary license or permission, or have another valid legal basis to share it. Giving credit does not replace permission where permission is required. Do not remove another creator&apos;s notices or claim someone else&apos;s work as your own.</p>
      </LegalSection>

      <LegalSection title="2. What the seals and labels do not decide">
        <p>A Human-made seal reflects automated checks on an eligible creation-event log; it is not a copyright registration, identity verification or final judgment about authorship. An upload without a seal has not been found infringing merely because it is unsealed. Copyright ownership, plagiarism, licensed reuse and creation-process evidence are different questions.</p>
        <p>Reports about ownership should receive human review. A seal, score or detector-like label must not be used as the sole basis for accusations or punishment.</p>
      </LegalSection>

      <LegalSection title="3. Watermarks and copying">
        <p>Ownership marks, viewer marks, encryption, signed links and AI-crawler refusals are deterrent and tracing measures. They do not prevent screenshots, photography, copying by hand, independent creation, or every form of redistribution. Removing, obscuring or falsifying these measures to mislead others or facilitate infringement is prohibited, except where applicable law expressly permits the activity.</p>
        <p>Viewing another person&apos;s work does not grant you a license to republish, sell, train on, adapt or redistribute it. You are responsible for obtaining any permission you need.</p>
      </LegalSection>

      <LegalSection title="4. Reporting content">
        <p>Use the <strong>Report</strong> control on a work when available. For a copyright or ownership request, provide enough information for maintainers to understand and locate the issue:</p>
        <LegalList>
          <li>Your name or username and a reliable way to contact you through a privately arranged channel.</li>
          <li>A link to the Humagination work, comment, profile or certificate at issue.</li>
          <li>A description and location of the original work or other material involved.</li>
          <li>Why you are entitled to act, and any relevant permission or license.</li>
          <li>A good-faith explanation of what is wrong and what action you request.</li>
        </LegalList>
        <p>Do not post evidence containing private documents, addresses, passwords or other sensitive material in a public issue. Use the maintainer link below to begin without sensitive details and arrange a private channel.</p>
      </LegalSection>

      <LegalSection title="5. Review and possible actions">
        <p>We may request clarification, temporarily restrict visibility while reviewing, remove content, or restrict an account where reasonably justified. We may retain records needed to investigate abuse or satisfy legal obligations. We are not a court and cannot finally determine every ownership or licensing dispute.</p>
        <p>Submitting a knowingly false or malicious report is prohibited. If your content was restricted in error, contact maintainers with an explanation and supporting material. Where legally required, we will follow applicable notice, counter-notice, restoration or repeat-infringer procedures; no deadline or formal statutory agent is promised by this page.</p>
      </LegalSection>

      <LegalSection title="6. Privacy, safety and non-copyright concerns">
        <p>Use the same reporting route for suspected impersonation, private-information exposure, harassment, malware or other unsafe content. Emergency and imminent-safety issues should be directed to appropriate local services rather than waiting for a website maintainer.</p>
        <p>Personal information involved in reports is handled as explained in the <Link className="link" href="/legal/privacy">Privacy Policy</Link>. Information may be shared with the affected user or relevant parties where needed to evaluate the report or comply with law, but unnecessary personal details should be omitted.</p>
      </LegalSection>
    </LegalPage>
  );
}
