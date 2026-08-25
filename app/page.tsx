import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  KeyRound,
} from "lucide-react";
import Link from "next/link";

import { EntryModal } from "@/components/entry-modal";
import { FloodTank } from "@/components/flood-tank";
import { Leaderboard } from "@/components/leaderboard";
import { OceanStage } from "@/components/ocean-stage";
import { SurfacePodium } from "@/components/surface-podium";
import { isApplicationConfigured, isPaymentConfigured } from "@/lib/config";
import {
  getLeaderboardListings,
  getViewer,
  getViewerReactions,
  sortListings,
} from "@/lib/data";
import { waterPressure } from "@/lib/format";

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
    ...sortListings(listings, "respected").slice(0, 50),
    ...sortListings(listings, "roasted").slice(0, 50),
  ].map((listing) => listing.id);
  const reactions = await getViewerReactions([...new Set(visibleListingIds)]);
  const deepestBurn = Math.max(0, ...listings.map((listing) => listing.tokensSpentUsd));
  const topSurfaceBidCents = Math.max(200, ...listings.map((listing) => listing.bidCents));
  const takeFirstCents = topSurfaceBidCents + 100;
  const requestedBidCents = Number(bid);
  const entryBidCents = Number.isInteger(requestedBidCents)
    && requestedBidCents >= 300
    && requestedBidCents <= 100_000
    && requestedBidCents % 100 === 0
    ? requestedBidCents
    : takeFirstCents;
  const configurationReady = isApplicationConfigured();
  const paymentsReady = isPaymentConfigured();
  const heroWaterLevel = deepestBurn > 0
    ? waterPressure(deepestBurn, Math.max(25_000, deepestBurn))
    : 0;

  return (
    <main>
      <OceanStage>
        <div className="ocean-world" aria-hidden="true">
          <div className="ocean-surface"><i /><i /><i /></div>
          <div className="ocean-caustics" />
          <div className="ocean-ray ocean-ray-one" />
          <div className="ocean-ray ocean-ray-two" />
          <div className="ocean-bubbles">
            {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
          </div>
          <div className="ocean-depth">
            <span>0M</span><span>10M</span><span>20M</span><span>30M</span>
          </div>
        </div>

        <div className="hero section-shell">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span><i /> LIVE RANKING</span>
              <span><BadgeCheck size={14} /> {listings.length} VERIFIED BUILDS</span>
            </div>
            <h1>
              Who turned the
              <span>most tokens</span>
              <span>into money?</span>
            </h1>
            <div className="hero-actions">
              <EntryModal
                key={enter === "1" || (!boost && Boolean(initialError)) ? `entry-open-${entryBidCents}` : "entry-closed"}
                viewer={viewer}
                configurationReady={configurationReady}
                paymentsReady={paymentsReady}
                initialBidCents={entryBidCents}
                defaultOpen={enter === "1" || (!boost && Boolean(initialError))}
                initialError={initialError}
                className="button button-primary button-large"
              >
                Be #1 for ${takeFirstCents / 100} <ArrowRight size={18} />
              </EntryModal>
              <a className="text-link" href="#leaderboard">
                See who is sinking <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <FloodTank spend={deepestBurn} level={heroWaterLevel} />
        </div>
      </OceanStage>

      <div className="section-shell">
        <SurfacePodium
          listings={listings}
          viewer={viewer}
          configurationReady={configurationReady}
          paymentsReady={paymentsReady}
          takeFirstCents={takeFirstCents}
          initialBoostId={boost}
          paymentCancelled={payment === "cancelled"}
        />
        <Leaderboard
          initialListings={listings}
          isAuthenticated={Boolean(viewer)}
          initialReactions={reactions}
        />
      </div>

      <section className="how-section section-shell" id="how-it-works">
        <div className="section-heading how-heading">
          <div>
            <span className="eyebrow">NO HONOR SYSTEM</span>
            <h2>Receipts in. Ego out.</h2>
          </div>
          <p>From @handle to a native share card in under five minutes.</p>
        </div>
        <div className="how-grid">
          <article>
            <span className="step-number">01</span>
            <div className="step-icon"><KeyRound size={24} /></div>
            <h3>Connect the receipts</h3>
            <p>Use read-only Stripe plus an OpenAI or Anthropic admin key. We pull one aggregate, then forget the keys.</p>
            <small>90 completed days · UTC</small>
          </article>
          <article>
            <span className="step-number">02</span>
            <div className="step-icon"><BarChart3 size={24} /></div>
            <h3>Get your efficiency score</h3>
            <p>Revenue divided by AI spend. A clean number that makes excellent founders look unfairly competent.</p>
            <small>Revenue ÷ token spend</small>
          </article>
          <article className="step-roast">
            <span className="step-number">03</span>
            <div className="step-icon"><span aria-hidden="true">😂</span></div>
            <h3>Let the timeline judge</h3>
            <p>Share your generated card. X-authenticated people can love it, roast it, or—perfectly legally—do both.</p>
            <small>One of each reaction per person</small>
          </article>
        </div>
      </section>

      <section className="bottom-cta section-shell">
        <div className="cta-water" aria-hidden="true"><i /><i /><i /></div>
        <div>
          <span className="eyebrow">YOUR MOVE, CAPTAIN</span>
          <h2>Did the tokens print money<br />or fill the basement?</h2>
          <p>There is only one honest way to find out.</p>
        </div>
        <Link className="button button-ink button-large" href="/?enter=1&bid=300">
          Enter for $3 <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}
