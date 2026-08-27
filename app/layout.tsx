import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

import { Header } from "@/components/header";
import { Logo } from "@/components/logo";
import { TrustNotice } from "@/components/trust-notice";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const dataFastWebsiteId = process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID
  || "dfid_7e2JjRMAMJP4ppGiuJAoj";
const dataFastDomain = process.env.NEXT_PUBLIC_DATAFAST_DOMAIN || "tokengod.lol";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TokenGod — AI token efficiency leaderboard",
    template: "%s · TokenGod",
  },
  description:
    "See what founders spent on AI, what their products made, and how the public ranks the result.",
  openGraph: {
    title: "TokenGod — AI spend. Real revenue. Public ranking.",
    description: "Founder results with visible proof labels, ranked by public reactions.",
    type: "website",
    siteName: "TokenGod",
  },
  twitter: {
    card: "summary_large_image",
    title: "TokenGod — AI spend. Real revenue. Public ranking.",
    description: "Founder results with visible proof labels, ranked by public reactions.",
  },
  other: {
    "ory-verify": "orynth-ac9426a953944d7488a03bf29042e5af",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <Script id="datafast-queue" strategy="beforeInteractive">
          {`window.datafast = window.datafast || function() {
            window.datafast.q = window.datafast.q || [];
            window.datafast.q.push(arguments);
          };`}
        </Script>
      </head>
      <body>
        <div className="ambient-bubble bubble-bg-one" />
        <div className="ambient-bubble bubble-bg-two" />
        <Header />
        {children}
        <TrustNotice />
        <footer className="site-footer">
          <div className="footer-main">
            <div>
              <Logo />
              <p>See what founders spent on AI and what their products made back.</p>
            </div>
            <div className="footer-links">
              <span>Explore</span>
              <Link href="/#leaderboard">Leaderboard</Link>
              <Link href="/#how-it-works">Verification</Link>
              <Link href="/?enter=1">Create a profile</Link>
            </div>
            <div className="footer-manifesto">
              <span>THE RULE</span>
              <p>Paid backing ranks Top Funded only. Proof, efficiency, and public votes control every evidence board.</p>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 TokenGod</span>
            <span className="footer-live"><i /> The tank is open</span>
          </div>
        </footer>
      </body>
      <Script
        src="https://datafa.st/js/script.js"
        data-website-id={dataFastWebsiteId}
        data-domain={dataFastDomain}
        strategy="afterInteractive"
      />
    </html>
  );
}
