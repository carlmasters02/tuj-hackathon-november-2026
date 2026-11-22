import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description: "Humagination's accessibility goals, supported features, known limitations and ways to report access barriers.",
};

export default function AccessibilityPage() {
  return (
    <LegalPage current="/legal/accessibility" title="Accessibility Statement" summary="Humagination aims to make learning, creating and sharing usable by people with different access needs, assistive technologies and devices.">
      <LegalSection title="1. Our goal">
        <p>We aim toward <strong>WCAG 2.2 Level AA</strong> principles: perceivable content, operable controls, understandable interactions and robust semantic markup. This is an ongoing design and engineering goal, not a claim that every page has completed a formal WCAG conformance audit.</p>
      </LegalSection>

      <LegalSection title="2. Measures in the product">
        <LegalList>
          <li>A root main landmark, semantic headings, navigation labels and native links, buttons, inputs and form labels.</li>
          <li>Visible keyboard-focus indicators and client controls that remain disabled until safe keyboard/form behavior is available.</li>
          <li>Text and icon labels in addition to color for status, errors, progress and important actions.</li>
          <li>Color tokens selected for readable contrast, responsive single-column layouts and controls intended to reflow without horizontal page overflow.</li>
          <li>Support for reduced-motion preferences by removing non-essential transitions and animations.</li>
          <li>Alternative text or accessible names for meaningful images and controls, with decorative imagery hidden from assistive technology where appropriate.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Known limitations and alternatives">
        <p>Some rich interactions are inherently more complex: the writing editor and tables, mathematical notation, code-editing surfaces, drawing canvas, music grid, replay players and image-watermark previews may not yet provide equivalent operation for every screen reader, keyboard-only workflow, magnification level or motor/sensory need.</p>
        <p>Uploaded media depends partly on creator-supplied text and may not contain captions, transcripts, audio descriptions or other alternatives. On-screen writer pagination is approximate and should not be confused with print layout. If a particular visualization prevents access to information, contact us so we can provide a reasonable alternative where feasible.</p>
      </LegalSection>

      <LegalSection title="4. Browser and assistive-technology compatibility">
        <p>The application targets current versions of major standards-based browsers. The optional extension is designed for desktop Chrome; browser focus and idle features are not an accessibility requirement for using the core web application. Older browsers, unusual CSS overrides and combinations we have not tested may produce different results.</p>
        <p>Browser zoom and text resizing are preferable to disabling responsive layout or forcing fixed desktop dimensions. Your operating system&apos;s reduced-motion preference is respected where supported.</p>
      </LegalSection>

      <LegalSection title="5. Feedback and reporting a barrier">
        <p>Please tell us when something blocks your access. Useful details include the page address, browser and version, assistive technology, device, input method, and the result you expected. Do not attach private work, medical details, passwords or account tokens to a public issue.</p>
        <p>Use the maintainer link below to open an accessibility report. We will review concrete reports as the project develops and prioritize barriers affecting sign-in, core learning, account/privacy controls and access to published work. We cannot guarantee an immediate resolution or a particular legal conformance outcome.</p>
      </LegalSection>

      <LegalSection title="6. Enforcement and user rights">
        <p>This statement is not intended to limit any accessibility, consumer-protection or disability rights that apply to you. If you cannot access an account or privacy control, use the maintainer link below rather than sharing sensitive details publicly. For information about personal-data handling, see the <Link className="link" href="/legal/privacy">Privacy Policy</Link>.</p>
      </LegalSection>
    </LegalPage>
  );
}
