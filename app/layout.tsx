import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

import { Header } from "@/components/header";
import { Logo } from "@/components/logo";
import "./globals.css";
import "./professional.css";
import "./network.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const dataFastWebsiteId = process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID
  || "dfid_7e2JjRMAMJP4ppGiuJAoj";
const dataFastDomain = process.env.NEXT_PUBLIC_DATAFAST_DOMAIN || "tokengod.lol";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TokenGod — the living map of AI-built products",
    template: "%s · TokenGod",
  },
  description:
    "Explore the builders, products, and proof signals shaping the next wave of AI.",
  openGraph: {
    title: "TokenGod — find the signal in the noise.",
    description: "A living map of AI-built products, founder experiments, and public proof.",
    type: "website",
    siteName: "TokenGod",
  },
  twitter: {
    card: "summary_large_image",
    title: "TokenGod — find the signal in the noise.",
    description: "A living map of AI-built products, founder experiments, and public proof.",
  },
  other: {
    "ory-verify": "orynth-ac9426a953944d7488a03bf29042e5af",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('tokengod-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}`}
        </Script>
        <Script id="datafast-queue" strategy="beforeInteractive">
          {`window.datafast = window.datafast || function() {
            window.datafast.q = window.datafast.q || [];
            window.datafast.q.push(arguments);
          };`}
        </Script>
      </head>
      <body>
        <Header />
        {children}
        <footer className="tg-footer">
          <div className="tg-footer-main">
            <div>
              <Logo />
              <p>A living wall of products people are building.</p>
            </div>
            <div className="tg-footer-links">
              <span>Explore</span>
              <Link href="/#live-map">Live field</Link>
              <Link href="/?join=1">Add your build</Link>
              <Link href="/terms">Terms &amp; privacy</Link>
            </div>
            <div className="tg-footer-manifesto">
              <span>THE RULE</span>
              <p>Every bubble is a product. Joining is free.</p>
            </div>
          </div>
          <div className="tg-footer-bottom">
            <span>© 2026 TokenGod</span>
            <span><i /> The field is open</span>
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
