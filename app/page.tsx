import {
  ArrowRight,
  BarChart3,
  Check,
  KeyRound,
} from "lucide-react";
import Link from "next/link";

import { HeroEntry } from "@/components/hero-entry";
import { Leaderboard } from "@/components/leaderboard";
import { OceanStage } from "@/components/ocean-stage";
import { TokenWaterfall } from "@/components/token-waterfall";
import { isApplicationConfigured, isPaymentConfigured } from "@/lib/config";
import {
  getLeaderboardListings,
  getViewer,
  getViewerReactions,
  sortListings,
} from "@/lib/data";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    enter?: string | string[];
    bid?: string | string[];
    boost?: string | string[];
    error?: string | string[];
    payment?: string | string[];
  }>;
}) {
  const [listings, viewer, query] = await Promise.all([
    getLeaderboardListings(),
    getViewer(),
    searchParams,
  ]);
  const enter = Array.isArray(query.enter) ? query.enter[0] : query.enter;
  const bid = Array.isArray(query.bid) ? query.bid[0] : query.bid;
  const boost = Array.isArray(query.boost) ? query.boost[0] : query.boost;
  const payment = Array.isArray(query.payment) ? query.payment[0] : query.payment;
  const queryError = Array.isArray(query.error) ? query.error[0] : query.error;
  const initialError = queryError
    || (payment === "cancelled" ? "Checkout canceled. Nothing was charged." : undefined)
    || (payment === "failed" ? "Stripe confirmed the return, but we could not finalize it. Please try again." : undefined)
    || (payment === "invalid" ? "That Stripe checkout link is invalid or expired." : undefined);
  const visibleListingIds = [
    ...sortListings(listings, "funded").slice(0, 50),
    ...sortListings(listings, "respected").slice(0, 50),
    ...sortListings(listings, "roasted").slice(0, 50),
  ].map((listing) => listing.id);
  const reactions = await getViewerReactions([...new Set(visibleListingIds)]);
  const deepestBurn = Math.max(0, ...listings.map((listing) => listing.tokensSpentUsd));
  const topBidCents = Math.max(
    200,
    ...listings.map((listing) => listing.bidCents),
  );
  const takeFirstCents = topBidCents + 100;
  const requestedBidCents = Number(bid);
  const entryBidCents = Number.isInteger(requestedBidCents)
    && requestedBidCents >= 300
    && requestedBidCents <= 100_000
    && requestedBidCents % 100 === 0
    ? requestedBidCents
    : enter === "1" ? 300 : takeFirstCents;
  const configurationReady = isApplicationConfigured();
  const paymentsReady = isPaymentConfigured();

  return (
    <main>
      <OceanStage>
        <div className="waterfall-scene" aria-hidden="true">
          <i /><i /><i /><i /><i />
          <span />
        </div>
        <div className="hero section-shell">
          <TokenWaterfall spend={deepestBurn} />
          <div className="hero-copy">
            <div className="hero-kicker">
              <span><i /> LIVE LEADERBOARD</span>
              <span><BarChart3 size={14} /> {listings.length} {listings.length === 1 ? "FOUNDER" : "FOUNDERS"}</span>
            </div>
            <HeroEntry
              key={enter === "1" || (!boost && Boolean(initialError)) ? `entry-open-${entryBidCents}` : `entry-closed-${entryBidCents}`}
              viewer={viewer}
              configurationReady={configurationReady}
              paymentsReady={paymentsReady}
              initialBidCents={entryBidCents}
              takeFirstCents={takeFirstCents}
              defaultOpen={enter === "1" || (!boost && Boolean(initialError))}
              initialError={initialError}
            />
            <div className="hero-rules" aria-label="Entry rules">
              <span><Check size={14} /><b>$3 minimum</b></span>
              <span><Check size={14} /><b>Up to 3 products</b></span>
              <span><Check size={14} /><b>Bid + public reactions</b></span>
            </div>
          </div>
        </div>
      </OceanStage>

      <div className="section-shell">
        <Leaderboard
          initialListings={listings}
          initialReactions={reactions}
          paymentsReady={paymentsReady}
          initialBoostId={boost}
          paymentCancelled={payment === "cancelled"}
        />
      </div>

      <section className="how-section section-shell" id="how-it-works">
        <div className="section-heading how-heading">
          <div>
          <span className="eyebrow">HOW IT WORKS</span>
          <h2>Simple rules. Visible proof.</h2>
          </div>
          <p>Publish once, earn reactions, and share a card built for X.</p>
        </div>
        <div className="how-grid">
          <article>
            <span className="step-number">01</span>
            <div className="step-icon"><KeyRound size={24} /></div>
            <h3>Choose your proof</h3>
            <p>Verify organization API spend, or report a personal Claude/ChatGPT plan. Every row shows which path you used.</p>
            <small>API verified or founder reported</small>
          </article>
          <article>
            <span className="step-number">02</span>
            <div className="step-icon"><BarChart3 size={24} /></div>
            <h3>Get your efficiency score</h3>
            <p>Labeled revenue divided by 90-day AI spend. Stronger proof wins exact reaction-count ties.</p>
            <small>Revenue ÷ token spend</small>
          </article>
          <article className="step-roast">
            <span className="step-number">03</span>
            <div className="step-icon"><span aria-hidden="true">😂</span></div>
            <h3>Let people decide</h3>
            <p>Share your generated card. Every visitor can love it, roast it, or—perfectly legally—do both.</p>
            <small>One of each reaction per browser</small>
          </article>
        </div>
      </section>

      <section className="bottom-cta section-shell">
        <div className="cta-water" aria-hidden="true"><i /><i /><i /></div>
        <div>
          <span className="eyebrow">JOIN THE LEADERBOARD</span>
          <h2>Put your AI spend<br />to the public test.</h2>
          <p>$3 minimum. Bid for Top Funded; earn your place on Respect and Roast.</p>
        </div>
        <Link className="button button-ink button-large" href="/?enter=1">
          Enter for $3 <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}
