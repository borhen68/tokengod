import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/header";
import { Logo } from "@/components/logo";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TokenGod — AI token efficiency leaderboard",
    template: "%s · TokenGod",
  },
  description:
    "The verified leaderboard for what founders burned on AI and what their products made back.",
  openGraph: {
    title: "TokenGod — Who turned tokens into money?",
    description: "Verified AI spend. Verified revenue. Public respect and public roasting.",
    type: "website",
    siteName: "TokenGod",
  },
  twitter: {
    card: "summary_large_image",
    title: "TokenGod — Who turned tokens into money?",
    description: "Verified AI spend. Verified revenue. Public respect and public roasting.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
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
              <p>Numbers are verified. Reactions require X. The water is dramatic.</p>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 TokenGod</span>
            <span className="footer-live"><i /> The tank is open</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
