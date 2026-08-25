import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Download,
  Droplets,
  Flame,
  Share2,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { ReactionControls } from "@/components/reaction-controls";
import {
  getLeaderboardListings,
  getListing,
  getViewer,
  getViewerReactions,
  sortListings,
} from "@/lib/data";
import {
  formatEfficiency,
  formatMoney,
  pressureLabel,
  safeExternalUrl,
  waterPressure,
} from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: "Listing not found" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const card = `${siteUrl}/api/listings/${listing.id}/card?v=${encodeURIComponent(listing.updatedAt)}`;
  const description = `${listing.founderName} burned ${formatMoney(listing.tokensSpentUsd)} in AI tokens, built ${listing.productName}, and made ${formatMoney(listing.revenueUsd)}.`;

  return {
    title: `${listing.productName} by @${listing.xHandle}`,
    description,
    alternates: { canonical: `/listing/${listing.id}` },
    openGraph: { title: `${listing.productName} · TokenGod`, description, images: [{ url: card, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: `${listing.productName} · TokenGod`, description, images: [card] },
  };
}

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params;
  const [listing, allListings, viewer] = await Promise.all([
    getListing(id),
    getLeaderboardListings(),
    getViewer(),
  ]);
  if (!listing) notFound();

  const reactions = await getViewerReactions([listing.id]);
  const respected = sortListings(allListings, "respected");
  const roasted = sortListings(allListings, "roasted");
  const respectedRank = respected.findIndex((item) => item.id === listing.id) + 1;
  const roastedRank = roasted.findIndex((item) => item.id === listing.id) + 1;
  const maxSpend = Math.max(1, ...allListings.map((item) => item.tokensSpentUsd));
  const pressure = waterPressure(listing.tokensSpentUsd, maxSpend);
  const ownerImage = listing.avatarUrl || listing.productLogoUrl;
  const pageUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/listing/${listing.id}`;
  const normalShare = `I burned ${formatMoney(listing.tokensSpentUsd)} in AI tokens to build ${listing.productName} and made ${formatMoney(listing.revenueUsd)} — ${formatEfficiency(listing.efficiencyScore)} back per $1. Respect it or roast it 👇`;

  const droppedBoard = respectedRank > 10 ? "Most Respected" : roastedRank > 10 ? "Most Roasted" : null;
  const overtaker = droppedBoard === "Most Respected" ? respected[9] : droppedBoard === "Most Roasted" ? roasted[9] : null;
  const reclaimShare = overtaker
    ? `${overtaker.productName} just passed me on ${droppedBoard}. Beat ${formatEfficiency(overtaker.efficiencyScore)} per $1? Let’s see it 👀`
    : normalShare;
  const shareText = viewer?.id === listing.ownerUserId && droppedBoard ? reclaimShare : normalShare;
  const shareHref = `https://x.com/intent/post?${new URLSearchParams({ text: `${shareText}\n${pageUrl}` })}`;

  return (
    <main className="listing-page section-shell">
      <Link className="back-link" href="/#leaderboard"><ArrowLeft size={15} /> Back to leaderboard</Link>

      <section className="listing-hero">
        <div className="listing-main-copy">
          <div className="verified-line"><BadgeCheck size={16} fill="currentColor" /> VERIFIED · LAST 90 COMPLETED DAYS</div>
          <h1>{listing.productName}</h1>
          <p>{listing.productDescription}</p>
          <div className="listing-owner">
            <span
              className={ownerImage ? "has-product-logo" : ""}
              style={ownerImage ? { backgroundImage: `url(${JSON.stringify(ownerImage)})` } : undefined}
            >
              {!ownerImage ? listing.productName.slice(0, 1).toUpperCase() : null}
            </span>
            <div><strong>{listing.founderName}</strong><a href={`https://x.com/${listing.xHandle}`} target="_blank" rel="noopener noreferrer">@{listing.xHandle}</a></div>
            <a className="visit-listing" href={safeExternalUrl(listing.productUrl)} target="_blank" rel="noopener noreferrer">Visit product <ArrowUpRight size={15} /></a>
          </div>
        </div>
        <div className="listing-rank-stack">
          <div><span>❤️ Most Respected</span><strong>#{respectedRank || "—"}</strong><small>{listing.loveCount.toLocaleString()} loves</small></div>
          <div><span>😂 Most Roasted</span><strong>#{roastedRank || "—"}</strong><small>{listing.laughCount.toLocaleString()} laughs</small></div>
        </div>
      </section>

      <section className="listing-scoreboard">
        <article><span><Flame size={15} /> AI token burn</span><strong>{formatMoney(listing.tokensSpentUsd)}</strong><small>{listing.modelProvider} · verified</small></article>
        <article><span>Revenue made</span><strong>{formatMoney(listing.revenueUsd)}</strong><small>Stripe · verified</small></article>
        <article className="efficiency-highlight"><span>Efficiency score</span><strong>{formatEfficiency(listing.efficiencyScore)}</strong><small>made per $1 spent</small></article>
        <article className="detail-water"><div className="detail-water-gauge"><i style={{ height: `${pressure}%` }} /></div><div><span><Droplets size={14} /> Cooling panic</span><strong>{pressure}%</strong><small>{pressureLabel(pressure)}</small></div></article>
      </section>

      <section className="listing-content-grid">
        <div className="card-panel">
          <header><div><span className="eyebrow">SHAREABLE RECEIPT</span><h2>The card that starts the fight.</h2></div><BadgeCheck size={20} /></header>
          <div className="stat-card-image">
            <Image src={`/api/listings/${listing.id}/card?v=${encodeURIComponent(listing.updatedAt)}`} alt={`Verified TokenGod stat card for ${listing.productName}`} width={1200} height={630} unoptimized priority />
          </div>
          <div className="card-actions">
            <a className="button button-primary" href={shareHref} target="_blank" rel="noopener noreferrer"><Share2 size={16} /> {viewer?.id === listing.ownerUserId && droppedBoard ? "Reclaim your spot" : "Share on X"}</a>
            <a className="button button-secondary" href={`/api/listings/${listing.id}/card?download=1`} download><Download size={16} /> Download PNG</a>
          </div>
          {viewer?.id === listing.ownerUserId && droppedBoard ? <p className="reclaim-note"><Trophy size={14} /> You fell out of the top 10 on {droppedBoard}. The share draft calls out the listing that passed you.</p> : null}
        </div>

        <aside className="verdict-panel">
          <span className="eyebrow">PUBLIC VERDICT</span>
          <h2>Respect it.<br />Roast it.<br /><span>Both is allowed.</span></h2>
          <ReactionControls listingId={listing.id} initialCounts={{ love: listing.loveCount, laugh: listing.laughCount }} initialActive={reactions[listing.id]} isAuthenticated={Boolean(viewer)} />
          <p><ShieldCheck size={15} /> X login required. One love and one laugh per account. Twenty actions per minute.</p>
          <div className="water-disclaimer"><Droplets size={17} /><div><strong>About the water</strong><span>The waterline is a playful spend index—not a claim about measured physical water consumption.</span></div></div>
        </aside>
      </section>
    </main>
  );
}
