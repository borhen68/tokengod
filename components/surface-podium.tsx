"use client";

import {
  ArrowUpRight,
  BadgeCheck,
  BadgeDollarSign,
  Crown,
  ShieldCheck,
  Waves,
} from "lucide-react";
import Link from "next/link";

import { BoostModal } from "@/components/boost-modal";
import { EntryModal } from "@/components/entry-modal";
import { safeExternalUrl } from "@/lib/format";
import type { LeaderboardListing, Viewer } from "@/lib/types";

function wholeDollar(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function avatarStyle(name: string, avatarUrl: string | null) {
  const hue = [...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360;
  return {
    backgroundColor: `hsl(${hue} 72% 42%)`,
    ...(avatarUrl ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` } : {}),
  };
}

export function SurfacePodium({
  listings,
  viewer,
  configurationReady,
  paymentsReady,
  takeFirstCents,
  initialBoostId,
  paymentCancelled,
}: {
  listings: LeaderboardListing[];
  viewer: Viewer | null;
  configurationReady: boolean;
  paymentsReady: boolean;
  takeFirstCents: number;
  initialBoostId?: string;
  paymentCancelled?: boolean;
}) {
  const surface = [...listings]
    .sort(
      (a, b) =>
        b.bidCents - a.bidCents
        || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .slice(0, 3);
  const leaderBidCents = surface[0]?.bidCents ?? 200;

  return (
    <section className="surface-section" id="surface-three">
      <div className="surface-heading">
        <div>
          <span className="surface-eyebrow"><i /> PAID SURFACE · 3 SPOTS ONLY</span>
          <h2>The builds above water.</h2>
          <p>$3 gets verified founders into the tank. Every extra $1 pushes a build toward the surface.</p>
        </div>
        <EntryModal
          viewer={viewer}
          configurationReady={configurationReady}
          paymentsReady={paymentsReady}
          initialBidCents={takeFirstCents}
          className="button button-primary button-large"
        >
          Be #1 for {wholeDollar(takeFirstCents)} <Crown size={17} fill="currentColor" />
        </EntryModal>
      </div>

      <div className="surface-rulebar">
        <BadgeDollarSign size={17} />
        <strong>Surface 3 is sponsored.</strong>
        <span>Money moves these three slots. It cannot buy Respect or erase a Roast.</span>
        <ShieldCheck size={16} />
      </div>

      <div className="surface-grid">
        {Array.from({ length: 3 }, (_, index) => {
          const listing = surface[index];
          const rank = index + 1;

          if (!listing) {
            return (
              <article className={`surface-card surface-rank-${rank} is-empty`} key={`empty-${rank}`}>
                <div className="surface-rank"><span>#{rank}</span></div>
                <div className="surface-empty-icon"><Waves size={24} /></div>
                <div className="surface-empty-copy">
                  <strong>Open water</strong>
                  <span>{rank === 1 ? "The first paid entry owns the surface." : "This sponsored spot is unclaimed."}</span>
                </div>
                <Link className="surface-empty-link" href="/?enter=1&bid=300">Claim it for $3 <ArrowUpRight size={14} /></Link>
              </article>
            );
          }

          const logoUrl = listing.productLogoUrl || listing.avatarUrl;
          return (
            <article className={`surface-card surface-rank-${rank}`} key={listing.id}>
              {rank === 1 ? <div className="surface-crown"><Crown size={14} fill="currentColor" /> ABOVE WATER</div> : null}
              <div className="surface-rank"><span>#{rank}</span><small>PAID</small></div>
              <span
                className="surface-avatar"
                style={avatarStyle(listing.productName, logoUrl)}
                aria-hidden="true"
              >
                {!logoUrl ? listing.productName.slice(0, 1).toUpperCase() : null}
              </span>
              <div className="surface-product">
                <Link href={`/listing/${listing.id}`}>{listing.productName}</Link>
                <span>@{listing.xHandle} <BadgeCheck size={12} /></span>
              </div>
              <div className="surface-bid">
                <span>SURFACE TOTAL</span>
                <strong>{wholeDollar(listing.bidCents)}</strong>
              </div>
              <BoostModal
                listing={listing}
                rank={rank}
                leaderBidCents={leaderBidCents}
                paymentsReady={paymentsReady}
                defaultOpen={initialBoostId === listing.id}
                initialError={initialBoostId === listing.id && paymentCancelled ? "Checkout canceled. Nothing was charged." : undefined}
              />
              <a
                className="surface-visit"
                href={safeExternalUrl(listing.productUrl)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${listing.productName}`}
              >
                <ArrowUpRight size={16} />
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
