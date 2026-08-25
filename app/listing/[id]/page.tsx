import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  AtSign,
  BadgeCheck,
  Download,
  Droplets,
  Flame,
  Layers3,
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
import {
  hasFounderReportedNumbers,
  listingProofLabel,
  revenueProofLabel,
} from "@/lib/proof";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: "Listing not found" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const card = `${siteUrl}/api/listings/${listing.id}/card?v=${encodeURIComponent(listing.updatedAt)}`;
  const buildLabel = listing.products.length > 1
    ? `${listing.productName} + ${listing.products.length - 1} more`
    : listing.productName;
  const spendProof = listing.aiSpendVerification === "api" ? "API-verified" : "founder-reported";
  const revenueProof = listing.revenueVerification === "stripe" ? "verified" : "founder-reported";
  const description = `${listing.founderName} ${spendProof} ${formatMoney(listing.tokensSpentUsd)} in AI spend, built ${buildLabel}, and made ${formatMoney(listing.revenueUsd)} in ${revenueProof} revenue.`;

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
  const buildLabel = listing.products.length > 1
    ? `${listing.productName} + ${listing.products.length - 1} more`
    : listing.productName;
  const spendDisclosure = listing.aiSpendVerification === "api" ? "API-verified AI spend" : "founder-reported AI spend";
  const revenueDisclosure = listing.revenueVerification === "stripe" ? "Stripe revenue verified" : "founder-reported revenue";
  const normalShare = `I spent ${formatMoney(listing.tokensSpentUsd)} on AI to build ${buildLabel} and made ${formatMoney(listing.revenueUsd)} — ${formatEfficiency(listing.efficiencyScore)} back per $1. ${spendDisclosure}; ${revenueDisclosure}. Respect it or roast it 👇`;

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
          <div className={`verified-line ${hasFounderReportedNumbers(listing) ? "is-reported" : ""}`}>
            {hasFounderReportedNumbers(listing) ? <AtSign size={16} /> : <BadgeCheck size={16} fill="currentColor" />}
            {listingProofLabel(listing).toUpperCase()} · 90 DAYS
          </div>
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
        <article><span><Flame size={15} /> AI token burn</span><strong>{formatMoney(listing.tokensSpentUsd)}</strong><small>{listing.modelProvider} · {listing.aiSpendVerification === "api" ? "API verified" : "founder reported"}</small></article>
        <article><span>Revenue made</span><strong>{formatMoney(listing.revenueUsd)}</strong><small>{revenueProofLabel(listing)}</small></article>
        <article className="efficiency-highlight"><span>Efficiency score</span><strong>{formatEfficiency(listing.efficiencyScore)}</strong><small>made per $1 spent</small></article>
        <article className="detail-water"><div className="detail-water-gauge"><i style={{ height: `${pressure}%` }} /></div><div><span><Droplets size={14} /> Cooling panic</span><strong>{pressure}%</strong><small>{pressureLabel(pressure)}</small></div></article>
      </section>

      {listing.products.length > 1 ? (
        <section className="listing-products">
          <header>
            <div>
              <span className="eyebrow">FOUNDER PORTFOLIO</span>
              <h2>{listing.products.length} builds. One founder score.</h2>
            </div>
            <span className="listing-products-rule"><Layers3 size={15} /> One profile · one leaderboard position</span>
          </header>
          <div className="listing-product-grid">
            {listing.products.map((product, index) => (
              <a
                className="listing-product-card"
                href={safeExternalUrl(product.url)}
                target="_blank"
                rel="noopener noreferrer"
                key={`${product.url}-${index}`}
              >
                <span
                  className={product.logoUrl ? "has-product-logo" : ""}
                  style={product.logoUrl ? { backgroundImage: `url(${JSON.stringify(product.logoUrl)})` } : undefined}
                  aria-hidden="true"
                >
                  {!product.logoUrl ? product.name.slice(0, 1).toUpperCase() : null}
                </span>
                <div>
                  <small>{index === 0 ? "PRIMARY BUILD" : `BUILD ${String(index + 1).padStart(2, "0")}`}</small>
                  <strong>{product.name}</strong>
                  {product.description ? <p>{product.description}</p> : null}
                </div>
                <ArrowUpRight size={17} />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="listing-content-grid">
        <div className="card-panel">
          <header><div><span className="eyebrow">SHAREABLE RECEIPT</span><h2>The card that starts the fight.</h2></div>{hasFounderReportedNumbers(listing) ? <AtSign size={20} /> : <BadgeCheck size={20} />}</header>
          <div className="stat-card-image">
            <Image src={`/api/listings/${listing.id}/card?v=${encodeURIComponent(listing.updatedAt)}`} alt={`TokenGod stat card for ${listing.productName}`} width={1200} height={630} unoptimized priority />
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
          <ReactionControls listingId={listing.id} initialCounts={{ love: listing.loveCount, laugh: listing.laughCount }} initialActive={reactions[listing.id]} />
          <p><ShieldCheck size={15} /> Open to every visitor. One love and one laugh per browser. Twenty actions per minute.</p>
          <div className="water-disclaimer"><Droplets size={17} /><div><strong>About the water</strong><span>The waterline is a playful spend index—not a claim about measured physical water consumption.</span></div></div>
        </aside>
      </section>
    </main>
  );
}
