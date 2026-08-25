"use client";

import {
  ArrowUpRight,
  AtSign,
  BadgeCheck,
  Crown,
  Droplets,
  Flame,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { ReactionControls } from "@/components/reaction-controls";
import {
  formatEfficiency,
  formatMoney,
  pressureLabel,
  safeExternalUrl,
  waterPressure,
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

export function Leaderboard({
  initialListings,
  initialReactions,
}: {
  initialListings: LeaderboardListing[];
  initialReactions: ReactionState;
}) {
  const [board, setBoard] = useState<Board>("respected");
  const [listings, setListings] = useState(initialListings);

  const ordered = useMemo(
    () =>
      [...listings].sort((a, b) => {
        const verificationTieBreak = proofStrength(b) - proofStrength(a);
        return board === "respected"
          ? b.loveCount - a.loveCount || verificationTieBreak || b.efficiencyScore - a.efficiencyScore
          : b.laughCount - a.laughCount || verificationTieBreak || a.efficiencyScore - b.efficiencyScore;
      }),
    [board, listings],
  );
  const visibleListings = ordered.slice(0, 50);
  const maxSpend = Math.max(1, ...listings.map((listing) => listing.tokensSpentUsd));

  return (
    <section className="board-section" id="leaderboard">
      <div className="section-heading board-heading">
        <div>
          <span className="eyebrow">THE PUBLIC VERDICT</span>
          <h2>{board === "respected" ? "Builders we respect." : "Budgets we need to discuss."}</h2>
        </div>
        <p>
          {board === "respected"
            ? "Love decides the order. Stronger proof, then efficiency, breaks a tie."
            : "Laughs decide the order. Stronger proof, then worst return, breaks a tie."}
        </p>
      </div>

      <div className="board-proof-key">
        <span><BadgeCheck size={13} fill="currentColor" /> API spend + Stripe revenue verified</span>
        <span className="is-reported"><AtSign size={13} /> AI spend founder reported · revenue verified</span>
        <span className="is-reported"><AtSign size={13} /> Founding profile · both founder reported</span>
      </div>

      <div className="board-switch" role="tablist" aria-label="Leaderboard view">
        <button
          className={board === "respected" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={board === "respected"}
          onClick={() => setBoard("respected")}
        >
          <span aria-hidden="true">❤️</span>
          Most Respected
          <small>high signal</small>
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
          <small>high spend, low tide</small>
        </button>
      </div>

      <div className="board-column-labels" aria-hidden="true">
        <span>Rank / builder</span>
        <span>AI burn</span>
        <span>Revenue</span>
        <span>Made per $1</span>
        <span>Cooling panic</span>
        <span>The verdict</span>
      </div>

      <div className="leaderboard-list">
        {visibleListings.map((listing, index) => {
          const rank = index + 1;
          const pressure = waterPressure(listing.tokensSpentUsd, maxSpend);
          const logoUrl = listing.avatarUrl || listing.productLogoUrl;
          return (
            <article
              className={`leaderboard-row ${rank === 1 ? "is-champion" : ""}`}
              key={listing.id}
            >
              {rank === 1 ? (
                <div className="champion-ribbon">
                  <Crown size={13} fill="currentColor" />
                  {board === "respected" ? "THE GOLDEN FLOATIE" : "DEEPEST IN THE TANK"}
                </div>
              ) : null}
              <div className="rank-and-founder">
                <div className={`rank-badge rank-${Math.min(rank, 4)}`}>
                  {rank <= 3 ? <Trophy size={13} /> : null}
                  <strong>#{rank}</strong>
                </div>
                <span
                  className="founder-avatar"
                  style={avatarStyle(listing.productName, logoUrl)}
                  aria-hidden="true"
                >
                  {!logoUrl ? listing.productName.slice(0, 1).toUpperCase() : null}
                </span>
                <div className="founder-product">
                  <Link href={`/listing/${listing.id}`}>{listing.productName}</Link>
                  <span>
                    {listing.founderName} · @{listing.xHandle}{listing.products.length > 1 ? ` · ${listing.products.length} sites` : ""}
                  </span>
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
              <div className="row-water-cell" data-label="Cooling panic">
                <div
                  className="mini-water-meter"
                  title={pressureLabel(pressure)}
                  style={{ "--meter-level": `${pressure}%` } as CSSProperties}
                >
                  <span style={{ height: `${pressure}%` }} />
                  <i />
                </div>
                <div>
                  <strong>{pressure}%</strong>
                  <span><Droplets size={12} /> {pressureLabel(pressure)}</span>
                </div>
              </div>
              <div className="verdict-cell">
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
                <a
                  className="visit-product"
                  href={safeExternalUrl(listing.productUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${listing.productName}`}
                >
                  Visit <ArrowUpRight size={14} />
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {!ordered.length ? (
        <div className="empty-board">
          <Droplets size={30} />
          <h3>The tank is bone-dry.</h3>
          <p>Enter the first build and claim every number-one spot at once.</p>
          <Link className="button button-primary" href="/?enter=1&bid=300">Be first in for $3</Link>
        </div>
      ) : null}
    </section>
  );
}
