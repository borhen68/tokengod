import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Eye, KeyRound, ReceiptText, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms & Privacy",
  description: "TokenGod terms, payment policy, verification-key handling, and privacy practices.",
};

const effectiveDate = "August 27, 2026";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <div className="section-shell">
          <Link className="legal-back-link" href="/"><ArrowLeft size={14} /> Back to the leaderboard</Link>
          <span className="eyebrow">LEGAL · IN PLAIN ENGLISH</span>
          <h1>Terms &amp; privacy.</h1>
          <p>What TokenGod stores, what a payment buys, and what you agree to when you enter the leaderboard.</p>
          <div className="legal-summary" aria-label="Key terms">
            <span><KeyRound size={17} /><b>Verification keys are never stored</b></span>
            <span><ReceiptText size={17} /><b>Paid entries and boosts are final</b></span>
            <span><Eye size={17} /><b>Published listing data is public</b></span>
          </div>
        </div>
      </section>

      <div className="legal-layout section-shell">
        <aside className="legal-rail">
          <span>Effective {effectiveDate}</span>
          <nav aria-label="Terms sections">
            <a href="#agreement">Agreement</a>
            <a href="#listings">Listings &amp; proof</a>
            <a href="#credentials">Keys &amp; privacy</a>
            <a href="#payments">Payments &amp; refunds</a>
            <a href="#rankings">Rankings &amp; reactions</a>
            <a href="#acceptable-use">Acceptable use</a>
            <a href="#content">Your content</a>
            <a href="#service">Service &amp; liability</a>
            <a href="#contact">Changes &amp; contact</a>
          </nav>
        </aside>

        <article className="legal-copy">
          <section id="agreement">
            <span>01</span>
            <h2>Agreement and eligibility</h2>
            <p>By accessing TokenGod, publishing a listing, reacting, or making a payment, you agree to these terms. You must be at least 18 years old and legally able to enter this agreement. If you use TokenGod for a company, you confirm that you can bind that company.</p>
          </section>

          <section id="listings">
            <span>02</span>
            <h2>Listings, numbers, and verification</h2>
            <p>You are responsible for the product details, links, identity choice, spend, revenue, and other information you submit. Product descriptions and some AI subscription costs are founder-reported and are labeled that way. Provider-verified figures are aggregates returned by the connected provider; verification does not audit your business or guarantee that a figure is complete, current, or attributable to one specific product.</p>
            <p>Each number is a snapshot for the reporting period shown on the listing. Because TokenGod does not retain verification credentials, figures do not update automatically. Refreshing a figure requires a new verification.</p>
          </section>

          <section id="credentials">
            <span>03</span>
            <h2>Verification keys and privacy</h2>
            <p>Revenue and AI-provider credentials are sent over HTTPS to TokenGod&apos;s server, used transiently to request the relevant aggregate, and then discarded. Raw verification keys are not written to Turso or intentionally retained in application logs. TokenGod stores the resulting total, reporting window, verification method, and proof status.</p>
            <p>TokenGod also stores information needed to operate the service: public listing content, product links and images, public X profile details when supplied, payment and checkout references, rankings, reactions, product-visit counts, and signed browser identifiers used to limit duplicate reactions. Anonymous founder mode hides the founder identity from the public listing; it does not make the product or submitted figures private.</p>
            <p>Stripe processes payment-card data. TokenGod does not store full card details. DataFast provides traffic and attribution analytics and may process visit, session, referral, and conversion identifiers. Hosting, database, identity, payment, analytics, and verification providers process data under their own terms. TokenGod does not sell personal information.</p>
          </section>

          <section id="payments">
            <span>04</span>
            <h2>Payments and no-refund policy</h2>
            <p>Entry fees, additional-product fees, and Top Funded boosts are one-time payments processed by Stripe. <strong>All completed payments are final and non-refundable</strong>, except where a refund is required by law or TokenGod confirms a duplicate or erroneous charge. Canceling before Stripe completes checkout does not create a charge.</p>
            <p>A payment buys the stated listing or sponsored-ranking service only. It does not guarantee traffic, reactions, customers, revenue, continued rank, or any position on the Respected, Roasted, or efficiency boards. Additional-product fees do not increase Top Funded rank. Removing content that violates these terms does not create a right to a refund.</p>
          </section>

          <section id="rankings">
            <span>05</span>
            <h2>Rankings, reactions, and traffic</h2>
            <p>Public reactions and published figures can change leaderboard positions at any time. Top Funded is a separately labeled paid ranking. TokenGod may filter suspicious activity, correct calculation errors, remove fraudulent reactions, and change ranking rules to protect the integrity of the service. Displayed visit and live-traffic figures are best-effort analytics, not audited guarantees.</p>
          </section>

          <section id="acceptable-use">
            <span>06</span>
            <h2>Acceptable use</h2>
            <p>Do not impersonate another person, submit content you do not have the right to share, misrepresent financial figures, manipulate reactions or traffic, probe or disrupt the service, upload malware, or use TokenGod unlawfully. Product links must lead to legitimate destinations. TokenGod may reject, hide, or remove listings and restrict access when needed to protect users or the leaderboard.</p>
          </section>

          <section id="content">
            <span>07</span>
            <h2>Your content and TokenGod&apos;s service</h2>
            <p>You keep ownership of your submitted content. You grant TokenGod a worldwide, non-exclusive license to host, reproduce, format, display, and share that content as needed to run and promote the service, including listing pages and social cards. You confirm that your submission and product assets do not violate another party&apos;s rights.</p>
            <p>The TokenGod name, design, software, and original service content remain the property of the TokenGod operator and its licensors. These terms do not grant permission to copy the service, scrape it abusively, or present it as your own.</p>
          </section>

          <section id="service">
            <span>08</span>
            <h2>Availability, disclaimers, and liability</h2>
            <p>TokenGod is provided “as is” and “as available.” The service may change, pause, or end, and data can occasionally be delayed or unavailable. TokenGod is not accounting, tax, investment, or legal advice. You should independently confirm any public claim before relying on it.</p>
            <p>To the fullest extent permitted by law, TokenGod and its operator are not liable for indirect, incidental, special, consequential, or lost-profit damages. Total liability for any claim is limited to the amount you paid TokenGod during the 12 months before the event giving rise to that claim. Rights that cannot legally be limited remain unaffected.</p>
          </section>

          <section id="contact">
            <span>09</span>
            <h2>Changes, removal requests, and contact</h2>
            <p>These terms may be updated as TokenGod changes. The effective date above will change when a material revision is published. Continued use after an update means you accept the revised terms.</p>
            <p>For billing issues, privacy questions, or listing-removal requests, contact <a href="https://x.com/borrhensaidi" target="_blank" rel="noopener noreferrer">@borrhensaidi on X</a>. Include the listing URL and enough information to verify the request, but never send an API key in a message.</p>
          </section>

          <div className="legal-closing"><ShieldCheck size={18} /> Never send TokenGod verification keys by email, DM, or support message.</div>
        </article>
      </div>
    </main>
  );
}
