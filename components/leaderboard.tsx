"use client";

import {
  AtSign,
  BadgeCheck,
  Droplets,
  Eye,
  Flame,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BoostModal } from "@/components/boost-modal";
import { ReactionControls } from "@/components/reaction-controls";
import { ListingQuickView } from "@/components/listing-quick-view";
import {
  formatEfficiency,
  formatMoney,
} from "@/lib/format";
import {
  hasFounderReportedNumbers,
  listingProofLabel,
  proofStrength,
  revenueProofLabel,
} from "@/lib/proof";
import type {
  Board,
  LeaderboardListing,
  ReactionState,
} from "@/lib/types";

function avatarStyle(name: string, avatarUrl: string | null) {
  const hue = [...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360;
  return {
    backgroundColor: `hsl(${hue} 72% 42%)`,
    ...(avatarUrl ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` } : {}),
  };
}

function wholeDollar(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function Leaderboard({
  initialListings,
  initialReactions,
  paymentsReady,
  initialBoostId,
  paymentCancelled,
}: {
  initialListings: LeaderboardListing[];
  initialReactions: ReactionState;
  paymentsReady: boolean;
  initialBoostId?: string;
  paymentCancelled?: boolean;
}) {
  const [board, setBoard] = useState<Board>("funded");
  const [listings, setListings] = useState(initialListings);

  const ordered = useMemo(
    () =>
      [...listings].sort((a, b) => {
        if (board === "funded") {
          return b.bidCents - a.bidCents
            || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        const verificationTieBreak = proofStrength(b) - proofStrength(a);
        return board === "respected"
          ? b.loveCount - a.loveCount || verificationTieBreak || b.efficiencyScore - a.efficiencyScore
          : b.laughCount - a.laughCount || verificationTieBreak || a.efficiencyScore - b.efficiencyScore;
      }),
    [board, listings],
  );
  const visibleListings = ordered.slice(0, 50);

  return (
    <section className="board-section" id="leaderboard">
      <div className="board-layout">
        <aside className="board-sidebar">
          <span className="eyebrow">LEADERBOARD</span>
          <h2>Public verdict</h2>
          <p>One founder pool, three transparent ways to rank it.</p>
          <div className="board-switch" role="tablist" aria-label="Leaderboard view">
          <button
            className={board === "funded" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={board === "funded"}
            onClick={() => setBoard("funded")}
          >
            <span aria-hidden="true">⚡</span>
            Top Funded
            <small>by bid</small>
          </button>
          <button
            className={board === "respected" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={board === "respected"}
            onClick={() => setBoard("respected")}
          >
            <span aria-hidden="true">❤️</span>
            Most Respected
            <small>by love votes</small>
          </button>
          <button
            className={board === "roasted" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={board === "roasted"}
            onClick={() => setBoard("roasted")}
          >
            <span aria-hidden="true">😂</span>
            Most Roasted
            <small>by laugh votes</small>
          </button>
          </div>
          <div className="board-proof-key">
            <span><BadgeCheck size={13} fill="currentColor" /> API + Stripe verified</span>
            <span className="is-reported"><AtSign size={13} /> Founder reported</span>
          </div>
        </aside>

        <div className="board-results">
          <header className="board-results-heading">
            <div>
              <span>{board === "funded" ? "⚡ TOP FUNDED" : board === "respected" ? "❤️ MOST RESPECTED" : "😂 MOST ROASTED"}</span>
              <h2>{board === "funded" ? "Highest bids right now" : board === "respected" ? "Founders earning respect" : "Spending under scrutiny"}</h2>
            </div>
            <p>
              {board === "funded"
                ? "$3 minimum. Each extra dollar moves a founder higher."
                : board === "respected"
                ? "Love votes decide the order. Proof and efficiency break ties."
                : "Laugh votes decide the order. Proof and lowest return break ties."}
            </p>
          </header>

          <div className="board-column-labels" aria-hidden="true">
            <span>Founder + products</span>
            <span>AI burn</span>
            <span>Revenue</span>
            <span>Return</span>
            <span>Bid</span>
            <span>{board === "funded" ? "Action" : "Vote"}</span>
          </div>

          <div className="leaderboard-list">
        {visibleListings.map((listing, index) => {
          const rank = index + 1;
          const founderImage = listing.avatarUrl;
          const buildNames = listing.products.map((product) => product.name).join(" · ") || listing.productName;
          return (
            <article
              className={`leaderboard-row ${rank === 1 ? "is-champion" : ""}`}
              key={listing.id}
            >
              <div className="rank-and-founder">
                <div className={`rank-badge rank-${Math.min(rank, 4)}`}>
                  {rank <= 3 ? <Trophy size={13} /> : null}
                  <strong>#{rank}</strong>
                </div>
                <span
                  className="founder-avatar"
                  style={avatarStyle(listing.founderName, founderImage)}
                  aria-hidden="true"
                >
                  {!founderImage ? listing.founderName.slice(0, 1).toUpperCase() : null}
                </span>
                <div className="founder-product">
                  <ListingQuickView
                    listing={listing}
                    className="founder-product-trigger"
                    ariaLabel={`Open ${listing.founderName} founder profile`}
                  >
                    {listing.founderName}
                  </ListingQuickView>
                  <span className="founder-meta">
                    @{listing.xHandle} · {listing.products.length} {listing.products.length === 1 ? "build" : "builds"}
                  </span>
                  <div className="founder-builds" title={buildNames} aria-label={`Builds: ${buildNames}`}>
                    {listing.products.slice(0, 3).map((product, productIndex) => (
                      <span className="founder-build-chip" key={`${product.url}-${productIndex}`}>
                        <i
                          className="founder-build-icon"
                          style={avatarStyle(product.name, product.logoUrl)}
                          aria-hidden="true"
                        >
                          {!product.logoUrl ? product.name.slice(0, 1).toUpperCase() : null}
                        </i>
                        <b>{product.name}</b>
                      </span>
                    ))}
                    {listing.products.length > 3 ? <span className="founder-build-more">+{listing.products.length - 3}</span> : null}
                  </div>
                  <small className={hasFounderReportedNumbers(listing) ? "is-reported" : ""}>
                    {hasFounderReportedNumbers(listing) ? <AtSign size={12} /> : <BadgeCheck size={12} fill="currentColor" />}
                    {listingProofLabel(listing)} · {listing.modelProvider}
                  </small>
                </div>
              </div>

              <div className="money-cell burn-cell" data-label="AI burn">
                <span><Flame size={13} /> AI burn</span>
                <strong>{formatMoney(listing.tokensSpentUsd, true)}</strong>
              </div>
              <div className="money-cell revenue-cell" data-label="Revenue">
                <span>Revenue</span>
                <strong>{formatMoney(listing.revenueUsd, true)}</strong>
                <small>{revenueProofLabel(listing)}</small>
              </div>
              <div className="ratio-cell" data-label="Made per $1">
                <strong>{formatEfficiency(listing.efficiencyScore)}</strong>
                <span>made / $1</span>
              </div>
              <div className="bid-cell" data-label="Bid">
                <span>TOTAL BID</span>
                <strong>{wholeDollar(listing.bidCents)}</strong>
                <small>{rank === 1 && board === "funded" ? "current #1" : "one-time total"}</small>
              </div>
              <div className="verdict-cell">
                {board === "funded" ? (
                  <BoostModal
                    listing={listing}
                    rank={rank}
                    leaderBidCents={ordered[0]?.bidCents ?? 200}
                    paymentsReady={paymentsReady}
                    defaultOpen={initialBoostId === listing.id}
                    initialError={initialBoostId === listing.id && paymentCancelled ? "Checkout canceled. Nothing was charged." : undefined}
                  />
                ) : (
                  <ReactionControls
                    listingId={listing.id}
                    initialCounts={{ love: listing.loveCount, laugh: listing.laughCount }}
                    initialActive={initialReactions[listing.id]}
                    compact
                    onUpdate={(counts) => {
                      setListings((current) =>
                        current.map((item) =>
                          item.id === listing.id
                            ? { ...item, loveCount: counts.love, laughCount: counts.laugh }
                            : item,
                        ),
                      );
                    }}
                  />
                )}
                <ListingQuickView
                  listing={listing}
                  className="visit-product"
                  ariaLabel={`Open ${listing.founderName} founder profile`}
                >
                  View <Eye size={14} />
                </ListingQuickView>
              </div>
            </article>
          );
        })}
          </div>

          {!ordered.length ? (
            <div className="empty-board">
              <Droplets size={30} />
              <h3>The tank is empty.</h3>
              <p>Enter the first founder profile and take the first rank.</p>
              <Link className="button button-primary" href="/?enter=1">Enter for $3</Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
