import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

import { Header } from "@/components/header";
import { Logo } from "@/components/logo";

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
    "The transparent leaderboard for what founders spent on AI and what their products made back.",
  openGraph: {
    title: "TokenGod — Who turned tokens into money?",
    description: "AI spend with visible proof labels. Verified revenue. Public respect and public roasting.",
    type: "website",
    siteName: "TokenGod",
  },
  twitter: {
    card: "summary_large_image",
    title: "TokenGod — Who turned tokens into money?",
    description: "AI spend with visible proof labels. Verified revenue. Public respect and public roasting.",
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
        <footer className="site-footer">
          <div className="footer-main">
            <div>
              <Logo />
              <p>Proof that your AI bill was either brilliant—or extremely funny.</p>
            </div>
            <div className="footer-links">
              <span>Explore</span>
              <Link href="/#leaderboard">Leaderboard</Link>
              <Link href="/#how-it-works">Verification</Link>
              <Link href="/?enter=1&bid=300">Enter for $3</Link>
            </div>
            <div className="footer-manifesto">
              <span>THE RULE</span>
              <p>Revenue is verified. AI-spend proof is labeled. Reactions require X. The water is dramatic.</p>
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
